package plugin

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"vuelitycs/pkg/event"
)

func TestHTTPPluginSuccess(t *testing.T) {
	// Start a mock HTTP test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer server.Close()

	eventBus := event.NewEventBus()
	evChan := eventBus.SubscribeAll()
	defer eventBus.Unsubscribe(evChan)

	plug := NewHTTPPlugin()
	config := map[string]interface{}{
		"url":        server.URL,
		"method":     "GET",
		"timeout_ms": 5000,
	}

	ctx := context.Background()
	err := plug.Execute(ctx, config, "test-corr-id", eventBus, "test-source")
	if err != nil {
		t.Fatalf("Expected successful execution, got error: %v", err)
	}

	// Read and verify emitted events
	select {
	case ev := <-evChan:
		if ev.Type != event.REQUEST_STARTED {
			t.Errorf("Expected first event to be REQUEST_STARTED, got %s", ev.Type)
		}
		if payload, ok := ev.Payload.(event.RequestPayload); ok {
			if payload.Protocol != "HTTP" {
				t.Errorf("Expected protocol HTTP, got %s", payload.Protocol)
			}
		}
	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for REQUEST_STARTED event")
	}

	select {
	case ev := <-evChan:
		if ev.Type != event.REQUEST_COMPLETED {
			t.Errorf("Expected second event to be REQUEST_COMPLETED, got %s", ev.Type)
		}
		if payload, ok := ev.Payload.(event.RequestPayload); ok {
			if !payload.Success {
				t.Errorf("Expected success true, got false")
			}
			if payload.Status != 200 {
				t.Errorf("Expected status 200, got %d", payload.Status)
			}
			if payload.LatencyMicro <= 0 {
				t.Errorf("Expected positive latency, got %d", payload.LatencyMicro)
			}
		}
	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for REQUEST_COMPLETED event")
	}
}

func TestHTTPPluginFailure(t *testing.T) {
	// Start a mock server that returns an HTTP error code (e.g. 500 Server Error)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	eventBus := event.NewEventBus()
	evChan := eventBus.SubscribeAll()
	defer eventBus.Unsubscribe(evChan)

	plug := NewHTTPPlugin()
	config := map[string]interface{}{
		"url":    server.URL,
		"method": "POST",
	}

	ctx := context.Background()
	err := plug.Execute(ctx, config, "test-corr-id", eventBus, "test-source")
	if err == nil {
		t.Error("Expected error from failing HTTP response status, got nil")
	}

	// Drain the REQUEST_STARTED event
	<-evChan

	// Read and verify the REQUEST_FAILED event
	select {
	case ev := <-evChan:
		if ev.Type != event.REQUEST_FAILED {
			t.Errorf("Expected event to be REQUEST_FAILED, got %s", ev.Type)
		}
		if payload, ok := ev.Payload.(event.RequestPayload); ok {
			if payload.Success {
				t.Errorf("Expected success false, got true")
			}
			if payload.Status != 500 {
				t.Errorf("Expected status 500, got %d", payload.Status)
			}
		}
	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for REQUEST_FAILED event")
	}
}
