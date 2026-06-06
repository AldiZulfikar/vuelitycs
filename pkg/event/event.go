package event

import (
	"sync"
	"time"
)

// Event types specified by the PRD
const (
	// Lifecycle Events
	VU_STARTED         = "VU_STARTED"
	VU_STOPPED         = "VU_STOPPED"
	SCENARIO_STARTED   = "SCENARIO_STARTED"
	SCENARIO_COMPLETED = "SCENARIO_COMPLETED"

	// Request Events
	REQUEST_STARTED   = "REQUEST_STARTED"
	REQUEST_COMPLETED = "REQUEST_COMPLETED"
	REQUEST_FAILED    = "REQUEST_FAILED"
)

// Event represents an immutable system action event
type Event struct {
	ID            string      `json:"id"`
	Type          string      `json:"type"`
	Timestamp     time.Time   `json:"timestamp"`
	Source        string      `json:"source"`
	CorrelationID string      `json:"correlation_id"`
	Payload       interface{} `json:"payload,omitempty"`
}

// RequestPayload details execution stats for protocol/browser requests
type RequestPayload struct {
	Name                  string            `json:"name"`
	Protocol              string            `json:"protocol"` // e.g., HTTP, Browser, Kafka, Database
	LatencyMicro          int64             `json:"latency_micro"` // Default/Corrected latency in microseconds
	RawLatencyMicro       int64             `json:"raw_latency_micro"` // Raw latency in microseconds
	CorrectedLatencyMicro int64             `json:"corrected_latency_micro"` // Corrected latency in microseconds
	Status                int               `json:"status,omitempty"` // Status code if HTTP/gRPC
	Success               bool              `json:"success"`
	Error                 string            `json:"error,omitempty"`
	Tags                  map[string]string `json:"tags,omitempty"`
}

// EventListener is a channel that receives events
type EventListener chan Event

// EventBus implements a thread-safe event pub-sub engine
type EventBus struct {
	mu          sync.RWMutex
	subscribers map[string][]EventListener
	allSubs     []EventListener
}

// NewEventBus initializes a new EventBus
func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string][]EventListener),
	}
}

// Subscribe listens to a specific event type
func (eb *EventBus) Subscribe(eventType string) EventListener {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	ch := make(EventListener, 100)
	eb.subscribers[eventType] = append(eb.subscribers[eventType], ch)
	return ch
}

// SubscribeAll listens to all events
func (eb *EventBus) SubscribeAll() EventListener {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	ch := make(EventListener, 1000)
	eb.allSubs = append(eb.allSubs, ch)
	return ch
}

// Publish broadcasts an event to all matched subscribers
func (eb *EventBus) Publish(ev Event) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	// Publish to specific type subscribers
	if subs, exists := eb.subscribers[ev.Type]; exists {
		for _, ch := range subs {
			select {
			case ch <- ev:
			default:
				// Skip if channel is full to prevent blockages
			}
		}
	}

	// Publish to wildcard subscribers
	for _, ch := range eb.allSubs {
		select {
		case ch <- ev:
		default:
			// Skip if channel is full
		}
	}
}

// Unsubscribe removes a subscriber channel
func (eb *EventBus) Unsubscribe(ch EventListener) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	// Remove from specific type subscribers
	for eventType, subs := range eb.subscribers {
		for i, subCh := range subs {
			if subCh == ch {
				close(subCh)
				eb.subscribers[eventType] = append(subs[:i], subs[i+1:]...)
				break
			}
		}
	}

	// Remove from wildcard subscribers
	for i, subCh := range eb.allSubs {
		if subCh == ch {
			close(subCh)
			eb.allSubs = append(eb.allSubs[:i], eb.allSubs[i+1:]...)
			break
		}
	}
}
