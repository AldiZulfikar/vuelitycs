package metrics

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"math"
	"sync"
)

// HDRHistogram tracks high-dynamic range latency metrics in microseconds
type HDRHistogram struct {
	mu           sync.RWMutex
	lowestValue  int64
	highestValue int64
	scale        float64
	counts       []int64
	minVal       int64
	maxVal       int64
	sumVal       int64
	totalCount   int64
}

// NewHDRHistogram creates a new HDRHistogram with 3-digit precision
func NewHDRHistogram(lowest, highest int64) *HDRHistogram {
	scale := 500.0
	maxBin := int(math.Log(float64(highest)) * scale) + 1
	if maxBin < 1000 {
		maxBin = 1000
	}

	return &HDRHistogram{
		lowestValue:  lowest,
		highestValue: highest,
		scale:        scale,
		counts:       make([]int64, maxBin+1),
		minVal:       math.MaxInt64,
		maxVal:       0,
	}
}

// RecordValue records a microsecond latency value in the histogram
func (h *HDRHistogram) RecordValue(val int64) {
	if val < h.lowestValue {
		val = h.lowestValue
	}
	if val > h.highestValue {
		val = h.highestValue
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	bin := int(math.Log(float64(val)) * h.scale)
	if bin >= len(h.counts) {
		bin = len(h.counts) - 1
	}
	if bin < 0 {
		bin = 0
	}

	h.counts[bin]++
	h.totalCount++
	h.sumVal += val
	if val < h.minVal {
		h.minVal = val
	}
	if val > h.maxVal {
		h.maxVal = val
	}
}

// TotalCount returns the number of recorded samples
func (h *HDRHistogram) TotalCount() int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.totalCount
}

// Min returns the minimum recorded value
func (h *HDRHistogram) Min() int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.totalCount == 0 {
		return 0
	}
	return h.minVal
}

// Max returns the maximum recorded value
func (h *HDRHistogram) Max() int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.maxVal
}

// Mean returns the arithmetic mean of recorded values
func (h *HDRHistogram) Mean() float64 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.totalCount == 0 {
		return 0
	}
	return float64(h.sumVal) / float64(h.totalCount)
}

// ValueAtPercentile calculates the estimated latency at a given percentile (e.g. 99.0)
func (h *HDRHistogram) ValueAtPercentile(percentile float64) int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.totalCount == 0 {
		return 0
	}
	if percentile >= 100.0 {
		return h.maxVal
	}

	target := int64(math.Ceil(float64(h.totalCount) * (percentile / 100.0)))
	if target <= 0 {
		target = 1
	}

	var accumulated int64
	for bin, count := range h.counts {
		accumulated += count
		if accumulated >= target {
			val := math.Exp((float64(bin) + 0.5) / h.scale)
			iVal := int64(val)
			if iVal > h.maxVal {
				return h.maxVal
			}
			if iVal < h.minVal {
				return h.minVal
			}
			return iVal
		}
	}
	return h.maxVal
}

// LatencyReport bundles HDR histogram calculation results in microseconds
type LatencyReport struct {
	Min    int64   `json:"min"`
	Mean   float64 `json:"mean"`
	Max    int64   `json:"max"`
	P50    int64   `json:"p50"`
	P90    int64   `json:"p90"`
	P95    int64   `json:"p95"`
	P99    int64   `json:"p99"`
	P999   int64   `json:"p999"`
	P9999  int64   `json:"p9999"`
	HdrB64 string  `json:"hdr_b64"`
	Count  int64   `json:"count"`
}

// GetReport compiles the calculated percentiles and statistics
func (h *HDRHistogram) GetReport() LatencyReport {
	return LatencyReport{
		Min:    h.Min(),
		Mean:   h.Mean(),
		Max:    h.Max(),
		P50:    h.ValueAtPercentile(50.0),
		P90:    h.ValueAtPercentile(90.0),
		P95:    h.ValueAtPercentile(95.0),
		P99:    h.ValueAtPercentile(99.0),
		P999:   h.ValueAtPercentile(99.9),
		P9999:  h.ValueAtPercentile(99.99),
		HdrB64: h.ToBase64(),
		Count:  h.TotalCount(),
	}
}

// ToBase64 serializes the non-zero counts of the histogram to a base64 string
func (h *HDRHistogram) ToBase64() string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var buf bytes.Buffer
	for bin, count := range h.counts {
		if count > 0 {
			_ = binary.Write(&buf, binary.BigEndian, int32(bin))
			_ = binary.Write(&buf, binary.BigEndian, count)
		}
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes())
}

// FromBase64 restores the histogram counts from a base64 string
func (h *HDRHistogram) FromBase64(b64 string) error {
	if b64 == "" {
		return nil
	}
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return err
	}
	h.mu.Lock()
	defer h.mu.Unlock()

	h.counts = make([]int64, len(h.counts))
	h.totalCount = 0
	h.sumVal = 0
	h.minVal = math.MaxInt64
	h.maxVal = 0

	reader := bytes.NewReader(data)
	for reader.Len() > 0 {
		var bin int32
		var count int64
		if err := binary.Read(reader, binary.BigEndian, &bin); err != nil {
			return err
		}
		if err := binary.Read(reader, binary.BigEndian, &count); err != nil {
			return err
		}
		if int(bin) < len(h.counts) {
			h.counts[bin] = count
			h.totalCount += count

			val := int64(math.Exp((float64(bin) + 0.5) / h.scale))
			h.sumVal += val * count
			if val < h.minVal {
				h.minVal = val
			}
			if val > h.maxVal {
				h.maxVal = val
			}
		}
	}
	return nil
}

// Merge merges another HDRHistogram into this one
func (h *HDRHistogram) Merge(other *HDRHistogram) {
	if other == nil {
		return
	}
	h.mu.Lock()
	other.mu.RLock()
	defer h.mu.Unlock()
	defer other.mu.RUnlock()

	for bin, count := range other.counts {
		if bin < len(h.counts) {
			h.counts[bin] += count
		}
	}
	h.totalCount += other.totalCount
	h.sumVal += other.sumVal
	if other.minVal < h.minVal {
		h.minVal = other.minVal
	}
	if other.maxVal > h.maxVal {
		h.maxVal = other.maxVal
	}
}

// LatencyPercentile represents a percentile data point
type LatencyPercentile struct {
	Percentile float64 `json:"percentile"`
	Latency    int64   `json:"latency"`
}

// GetPercentilesCurve returns percentiles curve
func (h *HDRHistogram) GetPercentilesCurve() []LatencyPercentile {
	percentiles := []float64{10, 25, 50, 75, 90, 95, 99, 99.9, 99.99}
	var curve []LatencyPercentile
	for _, p := range percentiles {
		curve = append(curve, LatencyPercentile{
			Percentile: p,
			Latency:    h.ValueAtPercentile(p),
		})
	}
	return curve
}

