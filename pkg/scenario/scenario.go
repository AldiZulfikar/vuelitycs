package scenario

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"vuelitycs/pkg/event"
	"vuelitycs/pkg/plugin"
	"vuelitycs/pkg/utils"
)

// AuthConfig represents authentications credentials for scenario requests
type AuthConfig struct {
	Type         string `json:"type"`                     // "none", "basic", "bearer", "apikey", "oauth2"
	Username     string `json:"username,omitempty"`
	Password     string `json:"password,omitempty"`
	Token        string `json:"token,omitempty"`          // Bearer Token
	HeaderName   string `json:"header_name,omitempty"`     // API Key Header Name
	KeyValue     string `json:"key_value,omitempty"`       // API Key Value
	TokenURL     string `json:"token_url,omitempty"`       // OAuth2 Token URL
	ClientID     string `json:"client_id,omitempty"`       // OAuth2 Client ID
	ClientSecret string `json:"client_secret,omitempty"`   // OAuth2 Client Secret
	Scope        string `json:"scope,omitempty"`           // OAuth2 Scope
}

// DataSourceConfig represents an external dataset (e.g. CSV) for data-driven testing
type DataSourceConfig struct {
	Type     string            `json:"type"`               // "csv"
	FileName string            `json:"file_name,omitempty"`
	Strategy string            `json:"strategy,omitempty"` // "sequential", "random", "round-robin"
	Mapping  map[string]string `json:"mapping,omitempty"`
}

// SLAConfig represents the performance threshold limits defined for the scenario
type SLAConfig struct {
	P95LatencyMs  float64 `json:"p95_latency_ms,omitempty"`
	P99LatencyMs  float64 `json:"p99_latency_ms,omitempty"`
	MaxErrorRate  float64 `json:"max_error_rate,omitempty"`
	MinThroughput float64 `json:"min_throughput,omitempty"`
}

// Scenario represents the configuration for a performance test run
type Scenario struct {
	Name            string                 `json:"name"`
	Protocol        string                 `json:"protocol"` // "HTTP", "Browser", "Kafka", "Database"
	VUs             int                    `json:"vus"`
	DurationSeconds int                    `json:"duration_seconds"`
	RampUpSeconds   int                    `json:"ramp_up_seconds"`
	PacingMs        int                    `json:"pacing_ms,omitempty"` // delay between loops
	TestType        string                 `json:"test_type,omitempty"` // LOAD, STRESS, SPIKE, SOAK, VOLUME, SCALABILITY
	Scheduler       string                 `json:"scheduler,omitempty"` // LoadScheduler, StressScheduler, SpikeScheduler, SoakScheduler, VolumeScheduler, ScalabilityScheduler
	SLAs            *SLAConfig             `json:"slas,omitempty"`
	Metadata        map[string]string      `json:"metadata,omitempty"`
	Auth            *AuthConfig            `json:"auth,omitempty"`
	DataSource      *DataSourceConfig      `json:"data_source,omitempty"`
	Config          map[string]interface{} `json:"config"`
}

// LoadScenario parses a scenario JSON file
func LoadScenario(path string) (*Scenario, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	bytes, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	return LoadScenarioFromBytes(bytes)
}

// LoadScenarioFromBytes parses scenario JSON bytes
func LoadScenarioFromBytes(bytes []byte) (*Scenario, error) {
	var s Scenario
	err := json.Unmarshal(bytes, &s)
	if err != nil {
		return nil, err
	}

	if s.Name == "" {
		s.Name = "Unnamed Scenario"
	}
	if s.Protocol == "" {
		s.Protocol = "HTTP"
	}
	if s.VUs <= 0 {
		s.VUs = 1
	}
	if s.DurationSeconds <= 0 {
		s.DurationSeconds = 10
	}
	if s.PacingMs <= 0 {
		s.PacingMs = 100 // default 100ms pacing
	}
	if s.TestType == "" {
		s.TestType = "LOAD"
	}
	if s.Scheduler == "" {
		s.Scheduler = s.TestType + "Scheduler"
	}

	return &s, nil
}

// Runner handles the orchestration of virtual users and plugin executions
type Runner struct {
	scenario *Scenario
	eventBus *event.EventBus
	plugins  map[string]plugin.ProtocolPlugin
	mu       sync.Mutex
	active   bool
}

// NewRunner initializes a Scenario Runner with default protocol plugins
func NewRunner(s *Scenario, eb *event.EventBus) *Runner {
	plugins := make(map[string]plugin.ProtocolPlugin)
	plugins["HTTP"] = plugin.NewHTTPPlugin()
	plugins["Browser"] = plugin.NewBrowserPlugin()
	plugins["Kafka"] = plugin.NewKafkaPlugin()
	plugins["Database"] = plugin.NewDatabasePlugin()

	return &Runner{
		scenario: s,
		eventBus: eb,
		plugins:  plugins,
	}
}

// getTargetVUsAndStage returns the target VU count and current stage based on elapsed time
func (r *Runner) getTargetVUsAndStage(elapsedSec float64, totalDuration float64, maxVUs int, rampUp float64) (int, string) {
	if elapsedSec >= totalDuration {
		return 0, "COMPLETE"
	}

	switch r.scenario.TestType {
	case "SOAK":
		return maxVUs, "STEADY"

	case "SPIKE":
		// Spike in the middle 30% of the duration
		spikeStart := totalDuration * 0.35
		spikeEnd := totalDuration * 0.65
		if elapsedSec >= spikeStart && elapsedSec <= spikeEnd {
			return maxVUs, "SPIKE"
		}
		baseVUs := maxVUs / 5
		if baseVUs < 1 {
			baseVUs = 1
		}
		return baseVUs, "STEADY"

	case "STRESS":
		// Stair step pattern: 5 steps up
		stepDuration := totalDuration / 5
		stepIndex := int(elapsedSec / stepDuration)
		if stepIndex >= 5 {
			stepIndex = 4
		}
		target := int(float64(maxVUs) * float64(stepIndex+1) / 5.0)
		if target < 1 {
			target = 1
		}
		return target, "RAMP_UP"

	case "SCALABILITY":
		// Steps of scale: 25%, 50%, 75%, 100%
		stepDuration := totalDuration / 4
		stepIndex := int(elapsedSec / stepDuration)
		if stepIndex >= 4 {
			stepIndex = 3
		}
		target := int(float64(maxVUs) * float64(stepIndex+1) / 4.0)
		if target < 1 {
			target = 1
		}
		return target, "STEADY"

	case "VOLUME":
		// Flat load but zero pacing
		return maxVUs, "STEADY"

	case "LOAD":
		fallthrough
	default:
		if rampUp > 0 && elapsedSec < rampUp {
			fraction := elapsedSec / rampUp
			target := int(fraction * float64(maxVUs))
			if target < 1 {
				target = 1
			}
			return target, "RAMP_UP"
		}
		return maxVUs, "STEADY"
	}
}

// Run executes the scenario and blocks until completion
func (r *Runner) Run(ctx context.Context) error {
	r.mu.Lock()
	if r.active {
		r.mu.Unlock()
		return fmt.Errorf("runner is already executing a scenario")
	}
	r.active = true
	r.mu.Unlock()

	defer func() {
		r.mu.Lock()
		r.active = false
		r.mu.Unlock()
	}()

	plug, exists := r.plugins[r.scenario.Protocol]
	if !exists {
		return fmt.Errorf("unsupported protocol plugin: %s", r.scenario.Protocol)
	}

	correlationID := utils.GenerateUUID()
	scenarioStart := time.Now()
	totalDurationSec := float64(r.scenario.DurationSeconds)
	rampUpSec := float64(r.scenario.RampUpSeconds)

	// Emit SCENARIO_STARTED
	r.eventBus.Publish(event.Event{
		ID:            utils.GenerateUUID(),
		Type:          event.SCENARIO_STARTED,
		Timestamp:     scenarioStart,
		Source:        "runner",
		CorrelationID: correlationID,
		Payload: map[string]interface{}{
			"name":             r.scenario.Name,
			"protocol":         r.scenario.Protocol,
			"target_vus":       r.scenario.VUs,
			"duration_seconds": r.scenario.DurationSeconds,
			"ramp_up_seconds":  r.scenario.RampUpSeconds,
			"test_type":        r.scenario.TestType,
			"scheduler":        r.scenario.Scheduler,
		},
	})

	testCtx, cancelTest := context.WithTimeout(ctx, time.Duration(r.scenario.DurationSeconds)*time.Second)
	defer cancelTest()

	// VU management state
	var vuMu sync.Mutex
	vuCancels := make(map[int]context.CancelFunc)
	activeVUCount := 0
	lastStage := "INIT"

	// Ticker for dynamic scaling adjustments
	adjustTicker := time.NewTicker(200 * time.Millisecond)
	defer adjustTicker.Stop()

	// Central controller loop for VU scheduling
	go func() {
		for {
			select {
			case <-testCtx.Done():
				// Terminate all remaining VUs
				vuMu.Lock()
				for _, cancel := range vuCancels {
					cancel()
				}
				vuMu.Unlock()
				return
			case <-adjustTicker.C:
				elapsedSec := time.Since(scenarioStart).Seconds()
				targetVUs, currentStage := r.getTargetVUsAndStage(elapsedSec, totalDurationSec, r.scenario.VUs, rampUpSec)

				// Stage transition emission
				if currentStage != lastStage {
					r.eventBus.Publish(event.Event{
						ID:            utils.GenerateUUID(),
						Type:          "STAGE_TRANSITION",
						Timestamp:     time.Now(),
						Source:        "runner",
						CorrelationID: correlationID,
						Payload: map[string]interface{}{
							"old_stage": lastStage,
							"new_stage": currentStage,
						},
					})
					lastStage = currentStage
				}

				vuMu.Lock()
				currentVUs := activeVUCount
				if currentVUs < targetVUs {
					// Scale up VUs
					spawnCount := targetVUs - currentVUs
					for i := 0; i < spawnCount; i++ {
						vuID := len(vuCancels) + 1
						vuCtx, vuCancel := context.WithCancel(testCtx)
						vuCancels[vuID] = vuCancel
						activeVUCount++
						
						go func(id int, vCtx context.Context) {
							vuSource := fmt.Sprintf("vu-%d", id)
							r.eventBus.Publish(event.Event{
								ID:            utils.GenerateUUID(),
								Type:          event.VU_STARTED,
								Timestamp:     time.Now(),
								Source:        vuSource,
								CorrelationID: correlationID,
							})

							defer func() {
								r.eventBus.Publish(event.Event{
									ID:            utils.GenerateUUID(),
									Type:          event.VU_STOPPED,
									Timestamp:     time.Now(),
									Source:        vuSource,
									CorrelationID: correlationID,
								})
								vuMu.Lock()
								activeVUCount--
								delete(vuCancels, id)
								vuMu.Unlock()
							}()

							pacingMs := r.scenario.PacingMs
							if r.scenario.TestType == "VOLUME" {
								pacingMs = 1 // minimal pacing for high data volume
							}

							ticker := time.NewTicker(time.Duration(pacingMs) * time.Millisecond)
							defer ticker.Stop()

							for {
								select {
								case <-vCtx.Done():
									return
								case <-ticker.C:
									startTime := time.Now()
									_ = plug.Execute(vCtx, r.scenario.Config, correlationID, r.eventBus, vuSource)
									
									// Coordinated Omission Corrective Logic (ADR-010)
									// If a single request block runs longer than pacing interval, it offsets expected execution
									duration := time.Since(startTime)
									pacingDuration := time.Duration(pacingMs) * time.Millisecond
									if duration > pacingDuration {
										// We missed requests! Backfill them with offset latency
										missedCount := int(duration / pacingDuration)
										for m := 1; m < missedCount; m++ {
											// Backfill dummy events into event bus to correct metric distribution
											virtualLatency := duration - (time.Duration(m) * pacingDuration)
											r.eventBus.Publish(event.Event{
												ID:            utils.GenerateUUID(),
												Type:          event.REQUEST_COMPLETED,
												Timestamp:     time.Now(),
												Source:        vuSource,
												CorrelationID: correlationID,
												Payload: event.RequestPayload{
													Name:                  r.scenario.Protocol + " Coordinated Omission Corrected",
													Protocol:              r.scenario.Protocol,
													LatencyMicro:          virtualLatency.Microseconds(),
													RawLatencyMicro:       virtualLatency.Microseconds(),
													CorrectedLatencyMicro: virtualLatency.Microseconds(),
													Status:                200,
													Success:               true,
													Tags:                  map[string]string{"corrected": "true"},
												},
											})
										}
									}
								}
							}
						}(vuID, vuCtx)
					}
				} else if currentVUs > targetVUs {
					// Scale down VUs
					terminateCount := currentVUs - targetVUs
					terminated := 0
					for id, cancel := range vuCancels {
						if terminated >= terminateCount {
							break
						}
						cancel()
						delete(vuCancels, id)
						terminated++
					}
				}
				vuMu.Unlock()
			}
		}
	}()

	// Wait for scenario completion
	select {
	case <-ctx.Done():
	case <-testCtx.Done():
	}

	// Wait a bit for VUs to shutdown cleanly
	time.Sleep(300 * time.Millisecond)

	// Emit SCENARIO_COMPLETED
	r.eventBus.Publish(event.Event{
		ID:            utils.GenerateUUID(),
		Type:          event.SCENARIO_COMPLETED,
		Timestamp:     time.Now(),
		Source:        "runner",
		CorrelationID: correlationID,
		Payload: map[string]interface{}{
			"name":         r.scenario.Name,
			"elapsed_ms":   time.Since(scenarioStart).Milliseconds(),
			"completed_at": time.Now().Format(time.RFC3339),
		},
	})

	return nil
}

