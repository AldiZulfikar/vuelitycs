package event

type IMFEnvelope struct {
	Version    string `json:"version"`
	RunID      string `json:"run_id"`
	ScenarioID string `json:"scenario_id"`
	WorkerID   string `json:"worker_id"`
	Module     string `json:"module"`    // HTTP, BROWSER, KAFKA, DATABASE, SYSTEM
	TestType   string `json:"test_type"` // LOAD, STRESS, SPIKE, SOAK, VOLUME, SCALABILITY
	Stage      string `json:"stage"`     // INIT, RAMP_UP, STEADY, SPIKE, COOLDOWN, COMPLETE
	DataType   string `json:"data_type"` // AGGREGATED or RAW
	Ts         int64  `json:"ts"`
	Seq        int    `json:"seq"`
}

type IMFLatencyUs struct {
	Min    int64   `json:"min"`
	Mean   float64 `json:"mean"`
	Max    int64   `json:"max"`
	P50    int64   `json:"p50"`
	P90    int64   `json:"p90"`
	P95    int64   `json:"p95"`
	P99    int64   `json:"p99"`
	P999   int64   `json:"p999"`
	P9999  int64   `json:"p9999"`
	HdrB64 string  `json:"hdr_b64"`
}

type IMFHistogramPayload struct {
	LatencyUs IMFLatencyUs `json:"latency_us"`
}

type IMFThroughput struct {
	TotalRequests int64   `json:"total_requests"`
	Successful    int64   `json:"successful"`
	Failed        int64   `json:"failed"`
	CurrentRPS    float64 `json:"current_rps"`
	AvgRPS        float64 `json:"avg_rps"`
	PeakRPS       float64 `json:"peak_rps"`
}

type IMFThroughputPayload struct {
	Throughput IMFThroughput `json:"throughput"`
}

type IMFErrorItem struct {
	Code  string  `json:"code"`
	Count int64   `json:"count"`
	Pct   float64 `json:"pct"`
}

type IMFErrorPayload struct {
	Errors []IMFErrorItem `json:"errors"`
}

type IMFConcurrency struct {
	ActiveVUs    int64 `json:"active_vus"`
	ScheduledVUs int64 `json:"scheduled_vus"`
	CompletedVUs int64 `json:"completed_vus"`
	PeakVUs      int64 `json:"peak_vus"`
}

type IMFConcurrencyPayload struct {
	Concurrency IMFConcurrency `json:"concurrency"`
}

type IMFCapacity struct {
	SafeVUs         int     `json:"safe_vus"`
	WarningVUs      int     `json:"warning_vus"`
	CriticalVUs     int     `json:"critical_vus"`
	InflectionVUs   int     `json:"inflection_vus"`
	SaturationIndex float64 `json:"saturation_index"`
}

type IMFCapacityAnalysisPayload struct {
	Capacity IMFCapacity `json:"capacity"`
}

type IMFMessage struct {
	Envelope    IMFEnvelope                 `json:"envelope"`
	Histogram   *IMFHistogramPayload        `json:"histogram,omitempty"`
	Throughput  *IMFThroughputPayload       `json:"throughput,omitempty"`
	Errors      *IMFErrorPayload            `json:"errors,omitempty"`
	Concurrency *IMFConcurrencyPayload      `json:"concurrency,omitempty"`
	Capacity    *IMFCapacityAnalysisPayload `json:"capacity,omitempty"`
}
