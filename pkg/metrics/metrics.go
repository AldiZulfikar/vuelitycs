package metrics

import (
	"sync"
	"time"
)

// MetricType defines standard aggregator classifications
type MetricType string

const (
	MetricCounter   MetricType = "COUNTER"
	MetricGauge     MetricType = "GAUGE"
	MetricHistogram MetricType = "HISTOGRAM"
)

// Metric represents a normalized single metric sample
type Metric struct {
	Name      string            `json:"name"`
	Value     float64           `json:"value"`
	Timestamp time.Time         `json:"timestamp"`
	Tags      map[string]string `json:"tags,omitempty"`
}

// Counter represents a simple accumulating metric
type Counter struct {
	mu    sync.Mutex
	value float64
}

func (c *Counter) Add(val float64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.value += val
}

func (c *Counter) Value() float64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.value
}

// Gauge represents a metric that holds a single latest value
type Gauge struct {
	mu    sync.Mutex
	value float64
}

func (g *Gauge) Set(val float64) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.value = val
}

func (g *Gauge) Value() float64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.value
}
