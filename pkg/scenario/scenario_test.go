package scenario

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"vuelitycs/pkg/event"
)

func TestScenarioLoadAndRun(t *testing.T) {
	// Start mock HTTP server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	dsl := `
	{
		"name": "Unit Test Run",
		"protocol": "HTTP",
		"vus": 2,
		"duration_seconds": 2,
		"ramp_up_seconds": 1,
		"pacing_ms": 10,
		"config": {
			"url": "` + server.URL + `",
			"method": "GET"
		}
	}`

	scen, err := LoadScenarioFromBytes([]byte(dsl))
	if err != nil {
		t.Fatalf("Failed to load scenario: %v", err)
	}

	if scen.Name != "Unit Test Run" {
		t.Errorf("Expected scenario name 'Unit Test Run', got '%s'", scen.Name)
	}
	if scen.VUs != 2 {
		t.Errorf("Expected 2 VUs, got %d", scen.VUs)
	}

	eventBus := event.NewEventBus()
	evChan := eventBus.SubscribeAll()
	defer eventBus.Unsubscribe(evChan)

	runner := NewRunner(scen, eventBus)
	ctx := context.Background()

	// Run scenario
	err = runner.Run(ctx)
	if err != nil {
		t.Fatalf("Runner failed to execute: %v", err)
	}

	// Read and verify lifecycle events
	var hasScenarioStart, hasVUStart, hasVUStop, hasScenarioComplete, hasRequests bool

	timeout := time.After(3 * time.Second)
Loop:
	for {
		select {
		case ev := <-evChan:
			switch ev.Type {
			case event.SCENARIO_STARTED:
				hasScenarioStart = true
			case event.SCENARIO_COMPLETED:
				hasScenarioComplete = true
			case event.VU_STARTED:
				hasVUStart = true
			case event.VU_STOPPED:
				hasVUStop = true
			case event.REQUEST_COMPLETED:
				hasRequests = true
			}
		case <-timeout:
			break Loop
		default:
			// No more events in channel, exits test draining
			if hasScenarioComplete {
				break Loop
			}
			time.Sleep(50 * time.Millisecond)
		}
	}

	if !hasScenarioStart {
		t.Error("Expected SCENARIO_STARTED event")
	}
	if !hasVUStart {
		t.Error("Expected VU_STARTED event")
	}
	if !hasVUStop {
		t.Error("Expected VU_STOPPED event")
	}
	if !hasScenarioComplete {
		t.Error("Expected SCENARIO_COMPLETED event")
	}
	if !hasRequests {
		t.Error("Expected REQUEST_COMPLETED events inside VU loop")
	}
}
