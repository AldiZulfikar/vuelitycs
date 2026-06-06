package plugin

import (
	"context"
	"vuelitycs/pkg/event"
)

// ProtocolPlugin defines the execution contract for any performance test protocol engine
type ProtocolPlugin interface {
	// Name returns the identifier of the plugin, e.g. "HTTP", "Browser"
	Name() string

	// Execute runs a single invocation of the protocol action (e.g. an HTTP request)
	// It measures timings, handles timeouts, and publishes events to the EventBus.
	Execute(ctx context.Context, config map[string]interface{}, correlationID string, eventBus *event.EventBus, source string) error
}
