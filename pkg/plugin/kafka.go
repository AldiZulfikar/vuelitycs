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

type KafkaPlugin struct{}

func NewKafkaPlugin() *KafkaPlugin {
	return &KafkaPlugin{}
}

func (p *KafkaPlugin) Name() string {
	return "Kafka"
}

func (p *KafkaPlugin) Execute(ctx context.Context, config map[string]interface{}, correlationID string, eventBus *event.EventBus, source string) error {
	topic, _ := config["topic"].(string)
	if topic == "" {
		topic = "default-topic"
	}
	broker, _ := config["broker"].(string)

	requestID := utils.GenerateUUID()
	startTime := time.Now()

	eventBus.Publish(event.Event{
		ID:            requestID,
		Type:          event.REQUEST_STARTED,
		Timestamp:     startTime,
		Source:        source,
		CorrelationID: correlationID,
		Payload: event.RequestPayload{
			Name:     "Kafka Produce to " + topic,
			Protocol: "Kafka",
		},
	})

	var err error
	var latency int64

	// If broker address is provided, try to establish a quick TCP connection to test availability
	if broker != "" {
		d := net.Dialer{Timeout: 2 * time.Second}
		conn, dialErr := d.DialContext(ctx, "tcp", broker)
		if dialErr != nil {
			err = fmt.Errorf("kafka broker connection failed: %w", dialErr)
		} else {
			conn.Close()
			// Simulate message serialization and produce latency (e.g. 5ms - 25ms)
			simDuration := time.Duration(5+rand.Intn(20)) * time.Millisecond
			select {
			case <-ctx.Done():
				err = ctx.Err()
			case <-time.After(simDuration):
			}
		}
	} else {
		// Mock execution with realistic queueing delay
		simDuration := time.Duration(2+rand.Intn(8)) * time.Millisecond
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
				Name:            "Kafka Produce to " + topic,
				Protocol:        "Kafka",
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
			Name:            "Kafka Produce to " + topic,
			Protocol:        "Kafka",
			LatencyMicro:    latency,
			RawLatencyMicro: latency,
			Status:          200,
			Success:         true,
			Tags:            map[string]string{"topic": topic},
		},
	})

	return nil
}
