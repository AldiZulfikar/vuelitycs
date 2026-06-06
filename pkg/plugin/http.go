package plugin

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"vuelitycs/pkg/event"
	"vuelitycs/pkg/utils" // We'll put a small UUID utility here
)

// HTTPPlugin executes protocol-level HTTP workloads
type HTTPPlugin struct {
	client *http.Client
}

// NewHTTPPlugin initializes an HTTPPlugin with pooled and optimized network settings
func NewHTTPPlugin() *HTTPPlugin {
	transport := &http.Transport{
		MaxIdleConns:        10000,
		MaxIdleConnsPerHost: 2000,
		IdleConnTimeout:     90 * time.Second,
		TLSClientConfig:     &tls.Config{InsecureSkipVerify: true}, // Allows testing staging/local sites easily
	}
	return &HTTPPlugin{
		client: &http.Client{
			Transport: transport,
		},
	}
}

func (p *HTTPPlugin) Name() string {
	return "HTTP"
}

func (p *HTTPPlugin) Execute(ctx context.Context, config map[string]interface{}, correlationID string, eventBus *event.EventBus, source string) error {
	// Parse configurations
	urlStr, ok := config["url"].(string)
	if !ok || urlStr == "" {
		return fmt.Errorf("http plugin: 'url' parameter is required")
	}

	method, _ := config["method"].(string)
	if method == "" {
		method = "GET"
	}
	method = strings.ToUpper(method)

	var reqBody io.Reader
	bodyStr, _ := config["body"].(string)
	if bodyStr != "" {
		reqBody = strings.NewReader(bodyStr)
	}

	timeoutMs := 10000
	if tVal, ok := config["timeout_ms"].(float64); ok {
		timeoutMs = int(tVal)
	} else if tValInt, ok := config["timeout_ms"].(int); ok {
		timeoutMs = tValInt
	}

	// Create request-specific context with timeout
	reqCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, method, urlStr, reqBody)
	if err != nil {
		return fmt.Errorf("http plugin: failed to create request: %w", err)
	}

	// Parse and apply headers
	if headersMap, exists := config["headers"].(map[string]interface{}); exists {
		for k, v := range headersMap {
			if vStr, ok := v.(string); ok {
				req.Header.Set(k, vStr)
			}
		}
	} else if headersStrMap, exists := config["headers"].(map[string]string); exists {
		for k, v := range headersStrMap {
			req.Header.Set(k, v)
		}
	}

	// Dynamic correlation ID or request unique ID
	requestID := utils.GenerateUUID()

	// Publish REQUEST_STARTED event
	startTime := time.Now()
	eventBus.Publish(event.Event{
		ID:            requestID,
		Type:          event.REQUEST_STARTED,
		Timestamp:     startTime,
		Source:        source,
		CorrelationID: correlationID,
		Payload: event.RequestPayload{
			Name:     method + " " + urlStr,
			Protocol: "HTTP",
		},
	})

	// Execute HTTP request
	resp, err := p.client.Do(req)
	latency := time.Since(startTime).Microseconds()

	if err != nil {
		// Publish REQUEST_FAILED event
		eventBus.Publish(event.Event{
			ID:            requestID,
			Type:          event.REQUEST_FAILED,
			Timestamp:     time.Now(),
			Source:        source,
			CorrelationID: correlationID,
			Payload: event.RequestPayload{
				Name:                  method + " " + urlStr,
				Protocol:              "HTTP",
				LatencyMicro:          latency,
				RawLatencyMicro:       latency,
				CorrectedLatencyMicro: latency,
				Success:               false,
				Error:                 err.Error(),
			},
		})
		return err
	}
	defer resp.Body.Close()

	// Fully consume and discard body to reuse connection
	_, _ = io.Copy(io.Discard, resp.Body)

	success := resp.StatusCode < 400
	status := resp.StatusCode

	payload := event.RequestPayload{
		Name:                  method + " " + urlStr,
		Protocol:              "HTTP",
		LatencyMicro:          latency,
		RawLatencyMicro:       latency,
		CorrectedLatencyMicro: latency,
		Status:                status,
		Success:               success,
	}

	if !success {
		payload.Error = fmt.Sprintf("HTTP status %d", status)
	}

	// Publish REQUEST_COMPLETED or REQUEST_FAILED based on status code
	evType := event.REQUEST_COMPLETED
	if !success {
		evType = event.REQUEST_FAILED
	}

	eventBus.Publish(event.Event{
		ID:            requestID,
		Type:          evType,
		Timestamp:     time.Now(),
		Source:        source,
		CorrelationID: correlationID,
		Payload:       payload,
	})

	if !success {
		return fmt.Errorf("http response failed with status code %d", status)
	}
	return nil
}
