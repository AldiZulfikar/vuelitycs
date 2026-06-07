package dashboard

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"vuelitycs/pkg/event"
	"vuelitycs/pkg/metrics"
	"vuelitycs/pkg/scenario"
	"vuelitycs/pkg/storage"
	"vuelitycs/pkg/utils"
)

//go:embed templates/*
var templateFS embed.FS

// DashboardServer manages the dashboard API routes, static assets, and SSE broadcasts
type DashboardServer struct {
	eventBus    *event.EventBus
	activeTest  *activeMetrics
	isRunning   bool
	cancelFunc  context.CancelFunc
	mu          sync.Mutex
	sseClients  map[chan string]bool
	sseMu       sync.Mutex
}

// activeMetrics accumulates metrics during a live scenario test run
type activeMetrics struct {
	RunID              string
	ScenarioID         string
	Name               string
	Protocol           string
	TestType           string
	Stage              string
	VUs                int64
	SuccessCount       int64
	FailedCount        int64
	RawHistogram       *metrics.HDRHistogram
	CorrectedHistogram *metrics.HDRHistogram
	startTime          time.Time
	seq                int
	pacingMs           int
	mu                 sync.RWMutex

	// Ramping parameters for Workload Profile
	VUsPlanned         int
	RampUpSeconds      int
	DurationSeconds    int

	// SLAs configuration
	SLAs               *scenario.SLAConfig

	// Browser specific averages
	fcpSum            int64
	lcpSum            int64
	clsSum            float64
	ttiSum            int64
	resSum            int64
	jsSum             int64
	browserCount      int64
}

// NewDashboardServer initializes the dashboard orchestrator
func NewDashboardServer(eb *event.EventBus) *DashboardServer {
	return &DashboardServer{
		eventBus:   eb,
		sseClients: make(map[chan string]bool),
	}
}

// StartTelemetryBroadcaster hooks into the EventBus and streams everything via SSE
func (s *DashboardServer) StartTelemetryBroadcaster(ctx context.Context) {
	evChan := s.eventBus.SubscribeAll()
	go func() {
		defer s.eventBus.Unsubscribe(evChan)

		// A ticker to broadcast aggregated metrics summary every 500ms when a test runs
		summaryTicker := time.NewTicker(500 * time.Millisecond)
		defer summaryTicker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case ev, ok := <-evChan:
				if !ok {
					return
				}
				s.processEvent(ev)
				s.broadcastEvent(ev)
			case <-summaryTicker.C:
				s.broadcastSummary()
			}
		}
	}()
}

// processEvent aggregates real-time stats from the event stream
func (s *DashboardServer) processEvent(ev event.Event) {
	s.mu.Lock()
	active := s.activeTest
	s.mu.Unlock()

	if active == nil {
		return
	}

	active.mu.Lock()
	defer active.mu.Unlock()

	switch ev.Type {
	case "STAGE_TRANSITION":
		if payload, ok := ev.Payload.(map[string]interface{}); ok {
			if newStage, ok := payload["new_stage"].(string); ok {
				active.Stage = newStage
			}
		}
	case event.VU_STARTED:
		active.VUs++
	case event.VU_STOPPED:
		if active.VUs > 0 {
			active.VUs--
		}
	case event.REQUEST_COMPLETED:
		if payload, ok := ev.Payload.(event.RequestPayload); ok {
			isCorrected := payload.Tags["corrected"] == "true"
			if isCorrected {
				active.CorrectedHistogram.RecordValue(payload.LatencyMicro)
			} else {
				active.SuccessCount++
				active.RawHistogram.RecordValue(payload.RawLatencyMicro)
				active.CorrectedHistogram.RecordValue(payload.LatencyMicro)
			}

			if payload.Protocol == "Browser" && !isCorrected {
				active.browserCount++
				if fVal, err := strconv.ParseInt(payload.Tags["fcp"], 10, 64); err == nil { active.fcpSum += fVal }
				if lVal, err := strconv.ParseInt(payload.Tags["lcp"], 10, 64); err == nil { active.lcpSum += lVal }
				if cVal, err := strconv.ParseFloat(payload.Tags["cls"], 64); err == nil { active.clsSum += cVal }
				if tVal, err := strconv.ParseInt(payload.Tags["tti"], 10, 64); err == nil { active.ttiSum += tVal }
				if rVal, err := strconv.ParseInt(payload.Tags["resource_load_time"], 10, 64); err == nil { active.resSum += rVal }
				if jVal, err := strconv.ParseInt(payload.Tags["js_execution_time"], 10, 64); err == nil { active.jsSum += jVal }
			}
		}
	case event.REQUEST_FAILED:
		active.FailedCount++
		if payload, ok := ev.Payload.(event.RequestPayload); ok {
			active.RawHistogram.RecordValue(payload.RawLatencyMicro)
			active.CorrectedHistogram.RecordValue(payload.LatencyMicro)
		}
	}
}

// computeCapacity calculates inflection point and system warning bounds
func computeCapacity(activeVUs int64, currentRPS float64, rawP95 int64, pacingMs int) (safe, warning, critical, inflection int, saturation float64) {
	if activeVUs <= 0 {
		return 0, 0, 0, 0, 0.0
	}
	inflection = int(float64(activeVUs) * 0.7)
	if inflection < 1 {
		inflection = 1
	}
	safe = int(float64(inflection) * 0.75)
	if safe < 1 {
		safe = 1
	}
	critical = int(float64(activeVUs) * 1.2)
	
	// Saturation Index = Observed Throughput / Expected Linear Throughput
	pacing := pacingMs
	if pacing <= 0 {
		pacing = 100 // fallback
	}
	expectedRPS := float64(activeVUs) * (1000.0 / float64(pacing))
	if expectedRPS > 0 {
		saturation = currentRPS / expectedRPS
	}
	if saturation > 1.0 {
		saturation = 1.0
	}
	if saturation < 0.0 {
		saturation = 0.0
	}
	return
}

// broadcastSummary compiles IMF v2.0 envelope & payload structures and pushes to clients and SQLite
func (s *DashboardServer) broadcastSummary() {
	s.mu.Lock()
	active := s.activeTest
	s.mu.Unlock()

	if active == nil {
		return
	}

	active.mu.Lock()
	defer active.mu.Unlock()

	active.seq++
	elapsed := time.Since(active.startTime)
	elapsedSec := elapsed.Seconds()
	if elapsedSec <= 0 {
		elapsedSec = 0.1
	}

	totalReq := active.SuccessCount + active.FailedCount
	rps := float64(totalReq) / elapsedSec

	// Calculate latency report
	rawReport := active.RawHistogram.GetReport()
	correctedReport := active.CorrectedHistogram.GetReport()

	// Capacity analysis
	safeVUs, warningVUs, criticalVUs, inflectionVUs, saturationIndex := computeCapacity(active.VUs, rps, rawReport.P95, active.pacingMs)

	// Build IMF Envelope
	envelope := event.IMFEnvelope{
		Version:    "2.0",
		RunID:      active.RunID,
		ScenarioID: active.ScenarioID,
		WorkerID:   "local-worker",
		Module:     active.Protocol,
		TestType:   active.TestType,
		Stage:      active.Stage,
		DataType:   "AGGREGATED",
		Ts:         time.Now().UnixMicro(),
		Seq:        active.seq,
	}

	// Build IMF Message conforming to specification
	imfMessage := event.IMFMessage{
		Envelope: envelope,
		Histogram: &event.IMFHistogramPayload{
			LatencyUs: event.IMFLatencyUs{
				Min:    correctedReport.Min,
				Mean:   correctedReport.Mean,
				Max:    correctedReport.Max,
				P50:    correctedReport.P50,
				P90:    correctedReport.P90,
				P95:    correctedReport.P95,
				P99:    correctedReport.P99,
				P999:   correctedReport.P999,
				P9999:  correctedReport.P9999,
				HdrB64: correctedReport.HdrB64,
			},
		},
		Throughput: &event.IMFThroughputPayload{
			Throughput: event.IMFThroughput{
				TotalRequests: totalReq,
				Successful:    active.SuccessCount,
				Failed:        active.FailedCount,
				CurrentRPS:    rps,
				AvgRPS:        rps,
				PeakRPS:       rps * 1.15, // estimated peak
			},
		},
		Concurrency: &event.IMFConcurrencyPayload{
			Concurrency: event.IMFConcurrency{
				ActiveVUs:    active.VUs,
				ScheduledVUs: active.VUs,
				CompletedVUs: 0,
				PeakVUs:      active.VUs,
			},
		},
		Capacity: &event.IMFCapacityAnalysisPayload{
			Capacity: event.IMFCapacity{
				SafeVUs:         safeVUs,
				WarningVUs:      warningVUs,
				CriticalVUs:     criticalVUs,
				InflectionVUs:   inflectionVUs,
				SaturationIndex: saturationIndex,
			},
		},
	}

	// Dynamic errors list
	errorRateFraction := 0.0
	if totalReq > 0 {
		errorRateFraction = float64(active.FailedCount) / float64(totalReq)
	}

	if active.FailedCount > 0 {
		pct := errorRateFraction * 100.0
		imfMessage.Errors = &event.IMFErrorPayload{
			Errors: []event.IMFErrorItem{
				{Code: "UNKNOWN", Count: active.FailedCount, Pct: pct},
			},
		}
	}

	// Write to SQLite database (Sprint 1 & Sprint 2)
	if db, err := storage.GetStorage(); err == nil && db != nil {
		_ = db.InsertMetrics(active.RunID, envelope.Ts, envelope.Seq, envelope.Module, envelope.TestType, envelope.Stage, envelope.DataType, active.VUs, active.SuccessCount, active.FailedCount, rps, rps, rps*1.15)
		_ = db.InsertHistogram(active.RunID, envelope.Ts, envelope.Seq, correctedReport.Min, correctedReport.Mean, correctedReport.Max, correctedReport.P50, correctedReport.P90, correctedReport.P95, correctedReport.P99, correctedReport.P999, correctedReport.P9999, correctedReport.HdrB64)
		_ = db.InsertCapacityAnalysis(active.RunID, envelope.Ts, envelope.Seq, safeVUs, warningVUs, criticalVUs, inflectionVUs, saturationIndex)
		
		// Sprint 2 Timeline & snapshot captures
		_ = db.InsertCapacitySnapshot(active.RunID, envelope.Ts, envelope.Seq, int(active.VUs), correctedReport.P95, correctedReport.P99, errorRateFraction)
		_ = db.InsertThroughputSeries(active.RunID, envelope.Ts, envelope.Seq, rps, rps, rps*1.15)
		_ = db.InsertErrorSeries(active.RunID, envelope.Ts, envelope.Seq, active.FailedCount, errorRateFraction)
	}

	saturationClass := "Healthy"
	if saturationIndex < 0.80 {
		saturationClass = "Critical"
	} else if saturationIndex < 0.95 {
		saturationClass = "Warning"
	}

	// Pack payload to match frontend listener
	broadcastPayload := map[string]interface{}{
		"active_vus":      active.VUs,
		"success_count":   active.SuccessCount,
		"failed_count":    active.FailedCount,
		"rps":             rps,
		"elapsed_seconds": int(elapsedSec),
		"latency":         correctedReport,
		"raw_latency":     rawReport, // Provide raw latencies too for Coordinated Omission comparison
		"error_rate":      errorRateFraction * 100.0,
		"capacity": map[string]interface{}{
			"safe_vus":         safeVUs,
			"warning_vus":      warningVUs,
			"critical_vus":     criticalVUs,
			"inflection_vus":   inflectionVUs,
			"saturation_index": saturationIndex,
			"saturation_class": saturationClass,
		},
		"imf": imfMessage,
		"scenario_config": map[string]interface{}{
			"name":             active.Name,
			"vus":              active.VUsPlanned,
			"ramp_up_seconds":  active.RampUpSeconds,
			"duration_seconds": active.DurationSeconds,
		},
	}

	// Add browser metrics if applicable
	if active.Protocol == "Browser" && active.browserCount > 0 {
		broadcastPayload["browser"] = map[string]interface{}{
			"active":                  true,
			"avg_fcp":                 active.fcpSum / active.browserCount,
			"avg_lcp":                 active.lcpSum / active.browserCount,
			"avg_cls":                 active.clsSum / float64(active.browserCount),
			"avg_tti":                 active.ttiSum / active.browserCount,
			"avg_resource_load_time":  active.resSum / active.browserCount,
			"avg_js_execution_time":   active.jsSum / active.browserCount,
		}
	}

	summaryEv := event.Event{
		ID:        "summary",
		Type:      "METRICS_SUMMARY",
		Timestamp: time.Now(),
		Source:    "aggregator",
		Payload:   broadcastPayload,
	}

	s.broadcastEvent(summaryEv)
}

// broadcastEvent writes raw SSE strings to all client channels
func (s *DashboardServer) broadcastEvent(ev event.Event) {
	bytes, err := json.Marshal(ev)
	if err != nil {
		return
	}

	s.sseMu.Lock()
	defer s.sseMu.Unlock()

	sseData := string(bytes)
	for ch := range s.sseClients {
		select {
		case ch <- sseData:
		default:
		}
	}
}

// HandlerRoutes maps HTTP endpoints
func (s *DashboardServer) HandlerRoutes() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("/static/style.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css")
		css, _ := templateFS.ReadFile("templates/style.css")
		_, _ = w.Write(css)
	})

	mux.HandleFunc("/static/app.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		js, _ := templateFS.ReadFile("templates/app.js")
		_, _ = w.Write(js)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		html, _ := templateFS.ReadFile("templates/dashboard.html")
		_, _ = w.Write(html)
	})

	mux.HandleFunc("/api/scenario/run", s.handleRunScenario)
	mux.HandleFunc("/api/scenario/stop", s.handleStopScenario)
	
	mux.HandleFunc("/api/history", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		db, err := storage.GetStorage()
		if err != nil || db == nil {
			_, _ = w.Write([]byte("[]"))
			return
		}
		records, err := db.FetchRuns()
		if err != nil || records == nil {
			_, _ = w.Write([]byte("[]"))
			return
		}
		_ = json.NewEncoder(w).Encode(records)
	})

	mux.HandleFunc("/api/series", s.handleFetchSeries)
	mux.HandleFunc("/api/comparison", s.handleRunComparison)
	mux.HandleFunc("/api/wizard/generate", s.handleWizardGenerate)

	mux.HandleFunc("/api/stream", s.handleSSEStream)

	return mux
}

func (s *DashboardServer) handleSSEStream(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	clientCh := make(chan string, 100)

	s.sseMu.Lock()
	s.sseClients[clientCh] = true
	s.sseMu.Unlock()

	defer func() {
		s.sseMu.Lock()
		delete(s.sseClients, clientCh)
		s.sseMu.Unlock()
		close(clientCh)
	}()

	_, _ = fmt.Fprintf(w, "data: {\"type\":\"ping\"}\n\n")
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case data := <-clientCh:
			_, err := fmt.Fprintf(w, "data: %s\n\n", data)
			if err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (s *DashboardServer) handleRunScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.mu.Lock()
	if s.isRunning {
		s.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"A test is already running. Stop it before starting a new one."}`))
		return
	}

	bytes, err := io.ReadAll(r.Body)
	if err != nil {
		s.mu.Unlock()
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	scen, err := scenario.LoadScenarioFromBytes(bytes)
	if err != nil {
		s.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"Invalid Scenario DSL: %s"}`, err.Error())))
		return
	}

	runID := utils.GenerateUUID()
	scenarioID := "scen-" + utils.GenerateUUID()[:8]

	s.activeTest = &activeMetrics{
		RunID:              runID,
		ScenarioID:         scenarioID,
		Name:               scen.Name,
		Protocol:           scen.Protocol,
		TestType:           scen.TestType,
		Stage:              "INIT",
		RawHistogram:       metrics.NewHDRHistogram(1, 600000000),
		CorrectedHistogram: metrics.NewHDRHistogram(1, 600000000),
		startTime:          time.Now(),
		pacingMs:           scen.PacingMs,
		VUsPlanned:         scen.VUs,
		RampUpSeconds:      scen.RampUpSeconds,
		DurationSeconds:    scen.DurationSeconds,
		SLAs:               scen.SLAs,
	}
	s.isRunning = true

	ctx, cancel := context.WithCancel(context.Background())
	s.cancelFunc = cancel
	s.mu.Unlock()

	runner := scenario.NewRunner(scen, s.eventBus)

	go func() {
		errRun := runner.Run(ctx)
		if errRun != nil {
			fmt.Printf("Scenario execution error: %v\n", errRun)
		}

		s.mu.Lock()
		s.activeTest.mu.RLock()
		total := s.activeTest.SuccessCount + s.activeTest.FailedCount
		
		var p95, p99, p999 int64
		var errorRate float64
		
		if total > 0 {
			p95 = s.activeTest.CorrectedHistogram.ValueAtPercentile(95.0)
			p99 = s.activeTest.CorrectedHistogram.ValueAtPercentile(99.0)
			p999 = s.activeTest.CorrectedHistogram.ValueAtPercentile(99.9)
			errorRate = float64(s.activeTest.FailedCount) / float64(total)
		}
		
		elapsedSec := int(time.Since(s.activeTest.startTime).Seconds())
		if elapsedSec <= 0 {
			elapsedSec = 1
		}
		rps := float64(total) / float64(elapsedSec)

		status := "success"
		if errRun != nil {
			status = "failed"
		}

		// Compute final capacity and saturation indicators
		var safeVal, criticalVal, inflectionVal int
		var saturationVal float64
		if total > 0 {
			safeVal, _, criticalVal, inflectionVal, saturationVal = computeCapacity(s.activeTest.VUs, rps, p95, s.activeTest.pacingMs)
		}

		// Evaluate SLA Compliance
		slaStatus := "NONE"
		if s.activeTest.SLAs != nil {
			slaStatus = "PASS"
			if s.activeTest.SLAs.P95LatencyMs > 0 && float64(p95)/1000.0 > s.activeTest.SLAs.P95LatencyMs {
				slaStatus = "FAIL"
			}
			if s.activeTest.SLAs.P99LatencyMs > 0 && float64(p99)/1000.0 > s.activeTest.SLAs.P99LatencyMs {
				slaStatus = "FAIL"
			}
			if s.activeTest.SLAs.MaxErrorRate > 0 && errorRate > s.activeTest.SLAs.MaxErrorRate {
				slaStatus = "FAIL"
			}
			if s.activeTest.SLAs.MinThroughput > 0 && rps < s.activeTest.SLAs.MinThroughput {
				slaStatus = "FAIL"
			}
		}

		// Insert completed run summary to SQLite
		if db, err := storage.GetStorage(); err == nil && db != nil {
			_ = db.InsertRun(storage.RunSummary{
				RunID:            s.activeTest.RunID,
				ScenarioID:       s.activeTest.ScenarioID,
				ScenarioName:     s.activeTest.Name,
				TestType:         s.activeTest.TestType,
				P95:              p95,
				P99:              p99,
				P999:             p999,
				PeakRPS:          rps, // simple estimate for now, actual peak is handled elsewhere
				ErrorRate:        errorRate,
				Duration:         int(elapsedSec),
				Status:           status,
				SafeCapacity:     safeVal,
				CriticalCapacity: criticalVal,
				InflectionPoint:  inflectionVal,
				SaturationIndex:  saturationVal,
				SLAStatus:        slaStatus,
			})
		}

		s.activeTest.mu.RUnlock()
		s.isRunning = false
		s.activeTest = nil
		s.cancelFunc = nil
		s.mu.Unlock()
	}()

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"deployed"}`))
}

func (s *DashboardServer) handleStopScenario(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning || s.cancelFunc == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"No test is currently executing"}`))
		return
	}

	s.cancelFunc()
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"stopping"}`))
}

func (s *DashboardServer) handleFetchSeries(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	runID := r.URL.Query().Get("run_id")
	if runID == "" {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"run_id parameter required"}`))
		return
	}

	db, err := storage.GetStorage()
	if err != nil || db == nil {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"storage unavailable"}`))
		return
	}

	throughput, err := db.FetchThroughputSeries(runID)
	if err != nil {
		throughput = []storage.ThroughputSeriesRecord{}
	}
	errors, err := db.FetchErrorSeries(runID)
	if err != nil {
		errors = []storage.ErrorSeriesRecord{}
	}
	capacity, err := db.FetchCapacitySnapshots(runID)
	if err != nil {
		capacity = []storage.CapacitySnapshotRecord{}
	}

	response := map[string]interface{}{
		"throughput": throughput,
		"error":      errors,
		"capacity":   capacity,
	}
	_ = json.NewEncoder(w).Encode(response)
}

func (s *DashboardServer) handleRunComparison(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	runA := r.URL.Query().Get("run_a")
	runB := r.URL.Query().Get("run_b")
	if runA == "" || runB == "" {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"run_a and run_b parameters required"}`))
		return
	}

	db, err := storage.GetStorage()
	if err != nil || db == nil {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"storage unavailable"}`))
		return
	}

	// 1. Check if comparison exists
	cached, err := db.FetchComparisonResult(runA, runB)
	if err == nil && cached != nil {
		_ = json.NewEncoder(w).Encode(cached)
		return
	}

	// 2. Fetch run details
	detailA, err := db.FetchRunDetail(runA)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"failed to fetch run_a details: %v"}`, err)))
		return
	}
	detailB, err := db.FetchRunDetail(runB)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"failed to fetch run_b details: %v"}`, err)))
		return
	}

	// 3. Compute deltas (Run B minus Run A)
	p95Delta := detailB.P95LatencyMicro - detailA.P95LatencyMicro
	p99Delta := detailB.P99LatencyMicro - detailA.P99LatencyMicro
	p999Delta := detailB.P999LatencyMicro - detailA.P999LatencyMicro
	peakRPSDelta := detailB.PeakRPS - detailA.PeakRPS
	errorRateDelta := detailB.ErrorRate - detailA.ErrorRate
	safeDelta := detailB.SafeCapacity - detailA.SafeCapacity
	criticalDelta := detailB.CriticalCapacity - detailA.CriticalCapacity

	// 4. Save to DB
	_ = db.InsertComparisonResult(runA, runB, p95Delta, p99Delta, p999Delta, peakRPSDelta, errorRateDelta, safeDelta, criticalDelta)

	res := storage.ComparisonResultRecord{
		RunIDA:                runA,
		RunIDB:                runB,
		P95Delta:              p95Delta,
		P99Delta:              p99Delta,
		P999Delta:             p999Delta,
		PeakRPSDelta:          peakRPSDelta,
		ErrorRateDelta:        errorRateDelta,
		SafeCapacityDelta:     safeDelta,
		CriticalCapacityDelta: criticalDelta,
		Timestamp:             time.Now(),
	}

	_ = json.NewEncoder(w).Encode(res)
}

func (s *DashboardServer) handleWizardGenerate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_, _ = w.Write([]byte(`{"error":"Method not allowed"}`))
		return
	}

	var req struct {
		Name            string                 `json:"name"`
		Protocol        string                 `json:"protocol"`
		TestType        string                 `json:"test_type"`
		VUs             int                    `json:"vus"`
		DurationSeconds int                    `json:"duration_seconds"`
		RampUpSeconds   int                    `json:"ramp_up_seconds"`
		PacingMs        int                    `json:"pacing_ms"`
		Config          map[string]interface{} `json:"config"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"Invalid request payload: %v"}`, err)))
		return
	}

	if req.Name == "" {
		req.Name = fmt.Sprintf("Wizard generated %s test", req.TestType)
	}

	// Populate protocol-specific defaults if missing
	if req.Config == nil {
		req.Config = make(map[string]interface{})
	}
	switch req.Protocol {
	case "HTTP":
		if _, ok := req.Config["url"]; !ok {
			req.Config["url"] = "http://localhost:8080/"
		}
		if _, ok := req.Config["method"]; !ok {
			req.Config["method"] = "GET"
		}
	case "Browser":
		if _, ok := req.Config["url"]; !ok {
			req.Config["url"] = "http://localhost:8080/"
		}
	case "Kafka":
		if _, ok := req.Config["brokers"]; !ok {
			req.Config["brokers"] = "localhost:9092"
		}
		if _, ok := req.Config["topic"]; !ok {
			req.Config["topic"] = "vuelitycs-events"
		}
	case "Database":
		if _, ok := req.Config["driver"]; !ok {
			req.Config["driver"] = "sqlite"
		}
		if _, ok := req.Config["dsn"]; !ok {
			req.Config["dsn"] = "vuelitycs.db"
		}
		if _, ok := req.Config["query"]; !ok {
			req.Config["query"] = "SELECT 1"
		}
	}

	scen := scenario.Scenario{
		Name:            req.Name,
		Protocol:        req.Protocol,
		VUs:             req.VUs,
		DurationSeconds: req.DurationSeconds,
		RampUpSeconds:   req.RampUpSeconds,
		PacingMs:        req.PacingMs,
		TestType:        req.TestType,
		Scheduler:       req.TestType + "Scheduler",
		Config:          req.Config,
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(scen)
}
