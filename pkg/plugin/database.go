package plugin

import (
	"context"
	"fmt"
	"math/rand"
	"net"
	"time"

	"vuelitycs/pkg/event"
	"vuelitycs/pkg/utils"
)

type DatabasePlugin struct{}

func NewDatabasePlugin() *DatabasePlugin {
	return &DatabasePlugin{}
}

func (p *DatabasePlugin) Name() string {
	return "Database"
}

func (p *DatabasePlugin) Execute(ctx context.Context, config map[string]interface{}, correlationID string, eventBus *event.EventBus, source string) error {
	query, _ := config["query"].(string)
	if query == "" {
		query = "SELECT 1"
	}
	dsn, _ := config["dsn"].(string)

	requestID := utils.GenerateUUID()
	startTime := time.Now()

	eventBus.Publish(event.Event{
		ID:            requestID,
		Type:          event.REQUEST_STARTED,
		Timestamp:     startTime,
		Source:        source,
		CorrelationID: correlationID,
		Payload: event.RequestPayload{
			Name:     "DB Query: " + query,
			Protocol: "Database",
		},
	})

	var err error
	var latency int64

	if dsn != "" {
		// Attempt simple TCP connection if DSN looks like host:port
		d := net.Dialer{Timeout: 1 * time.Second}
		conn, dialErr := d.DialContext(ctx, "tcp", dsn)
		if dialErr != nil {
			err = fmt.Errorf("database connection failed: %w", dialErr)
		} else {
			conn.Close()
			// Simulate query execution latency (e.g. 10ms - 50ms)
			simDuration := time.Duration(10+rand.Intn(40)) * time.Millisecond
			select {
			case <-ctx.Done():
				err = ctx.Err()
			case <-time.After(simDuration):
			}
		}
	} else {
		// Mock query execution with standard distribution
		simDuration := time.Duration(1+rand.Intn(15)) * time.Millisecond
		select {
		case <-ctx.Done():
			err = ctx.Err()
		case <-time.After(simDuration):
		}
	}

	latency = time.Since(startTime).Microseconds()

	if err != nil {
		eventBus.Publish(event.Event{
			ID:            requestID,
			Type:          event.REQUEST_FAILED,
			Timestamp:     time.Now(),
			Source:        source,
			CorrelationID: correlationID,
			Payload: event.RequestPayload{
				Name:            "DB Query: " + query,
				Protocol:        "Database",
				LatencyMicro:    latency,
				RawLatencyMicro: latency,
				Success:         false,
				Error:           err.Error(),
			},
		})
		return err
	}

	eventBus.Publish(event.Event{
		ID:            requestID,
		Type:          event.REQUEST_COMPLETED,
		Timestamp:     time.Now(),
		Source:        source,
		CorrelationID: correlationID,
		Payload: event.RequestPayload{
			Name:            "DB Query: " + query,
			Protocol:        "Database",
			LatencyMicro:    latency,
			RawLatencyMicro: latency,
			Status:          200,
			Success:         true,
			Tags:            map[string]string{"query": query},
		},
	})

	return nil
}
