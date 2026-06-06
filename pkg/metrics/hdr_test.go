package metrics

import (
	"math"
	"testing"
)

func TestHDRHistogram(t *testing.T) {
	// Lowest 1µs, highest 10 minutes (600,000,000µs)
	h := NewHDRHistogram(1, 600000000)

	// Record values: 100 values of 1000µs (1ms), 10 values of 10000µs (10ms), 1 value of 100000µs (100ms)
	for i := 0; i < 100; i++ {
		h.RecordValue(1000)
	}
	for i := 0; i < 10; i++ {
		h.RecordValue(10000)
	}
	h.RecordValue(100000)

	report := h.GetReport()

	if report.Count != 111 {
		t.Errorf("Expected count 111, got %d", report.Count)
	}

	if report.Min != 1000 {
		t.Errorf("Expected min 1000, got %d", report.Min)
	}

	if report.Max != 100000 {
		t.Errorf("Expected max 100000, got %d", report.Max)
	}

	// Mean should be (100 * 1000 + 10 * 10000 + 1 * 100000) / 111 = 300000 / 111 = ~2702.7µs
	expectedMean := float64(300000) / 111.0
	if math.Abs(report.Mean-expectedMean) > 1.0 {
		t.Errorf("Expected mean around %.2f, got %.2f", expectedMean, report.Mean)
	}

	// P50 should be in the 1000µs bin
	p50 := h.ValueAtPercentile(50.0)
	// Logarithmic bins might have minor approximation errors, let's verify it is very close to 1000
	if math.Abs(float64(p50-1000)) > 10.0 {
		t.Errorf("Expected P50 close to 1000, got %d", p50)
	}

	// P95 (target = 111 * 0.95 = 105.45, so it falls in the 10000µs bin)
	p95 := h.ValueAtPercentile(95.0)
	if math.Abs(float64(p95-10000)) > 100.0 {
		t.Errorf("Expected P95 close to 10000, got %d", p95)
	}

	// P99.9 (target = 111 * 0.999 = 110.89, so it falls in the 100000µs bin)
	p999 := h.ValueAtPercentile(99.9)
	if math.Abs(float64(p999-100000)) > 1000.0 {
		t.Errorf("Expected P99.9 close to 100000, got %d", p999)
	}
}

func TestHDRHistogramMerge(t *testing.T) {
	h1 := NewHDRHistogram(1, 600000000)
	h2 := NewHDRHistogram(1, 600000000)

	h1.RecordValue(100)
	h2.RecordValue(200)

	h1.Merge(h2)

	report := h1.GetReport()
	if report.Count != 2 {
		t.Errorf("Expected count 2 after merge, got %d", report.Count)
	}
	if report.Min != 100 {
		t.Errorf("Expected min 100, got %d", report.Min)
	}
	if report.Max != 200 {
		t.Errorf("Expected max 200, got %d", report.Max)
	}
}
