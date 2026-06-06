package plugin

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/chromedp/chromedp"
	"vuelitycs/pkg/event"
	"vuelitycs/pkg/utils"
)

// BrowserPlugin executes browser-level performance testing using headless Google Chrome
type BrowserPlugin struct{}

// NewBrowserPlugin initializes a BrowserPlugin
func NewBrowserPlugin() *BrowserPlugin {
	return &BrowserPlugin{}
}

func (p *BrowserPlugin) Name() string {
	return "Browser"
}

// BrowserMetrics encapsulates Core Web Vitals and load timing statistics
type BrowserMetrics struct {
	FCP               int64 // First Contentful Paint in microseconds
	LCP               int64 // Largest Contentful Paint in microseconds
	CLS               float64 // Cumulative Layout Shift score
	TTI               int64 // Time to Interactive in microseconds
	ResourceLoadTime  int64 // Microseconds
	JSExecutionTime   int64 // Microseconds
}

func (p *BrowserPlugin) Execute(ctx context.Context, config map[string]interface{}, correlationID string, eventBus *event.EventBus, source string) error {
	urlStr, ok := config["url"].(string)
	if !ok || urlStr == "" {
		return fmt.Errorf("browser plugin: 'url' parameter is required")
	}

	timeoutMs := 15000
	if tVal, ok := config["timeout_ms"].(float64); ok {
		timeoutMs = int(tVal)
	} else if tValInt, ok := config["timeout_ms"].(int); ok {
		timeoutMs = tValInt
	}

	// Create headless browser context with custom options
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.NoSandbox,
		chromedp.DisableGPU,
		chromedp.Flag("disable-web-security", true),
	)
	
	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx, opts...)
	defer allocCancel()

	browserCtx, browserCancel := chromedp.NewContext(allocCtx)
	defer browserCancel()

	// Add timeout
	reqCtx, cancel := context.WithTimeout(browserCtx, time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	requestID := utils.GenerateUUID()
	startTime := time.Now()

	// Publish REQUEST_STARTED event
	eventBus.Publish(event.Event{
		ID:            requestID,
		Type:          event.REQUEST_STARTED,
		Timestamp:     startTime,
		Source:        source,
		CorrelationID: correlationID,
		Payload: event.RequestPayload{
			Name:     "Browser " + urlStr,
			Protocol: "Browser",
		},
	})

	var fcpMicro, lcpMicro, ttiMicro, resourceMicro, jsMicro int64
	var clsScore float64

	// Script to extract Core Web Vitals and timings
	metricsScript := `
	(function() {
		let fcp = 0, lcp = 0, cls = 0, tti = 0;
		
		// 1. FCP (First Contentful Paint)
		let paintEntries = performance.getEntriesByType('paint');
		let fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
		if (fcpEntry) {
			fcp = fcpEntry.startTime;
		}

		// 2. LCP (Largest Contentful Paint)
		let lcpEntries = performance.getEntriesByType('largest-contentful-paint');
		if (lcpEntries.length > 0) {
			lcp = lcpEntries[lcpEntries.length - 1].startTime;
		} else {
			// Fallback to FCP or load event if LCP not fired yet
			lcp = fcp;
		}

		// 3. CLS (Cumulative Layout Shift)
		// Custom simple CLS computation from layout-shift events
		let shifts = performance.getEntriesByType('layout-shift');
		shifts.forEach(s => {
			if (!s.hadRecentInput) {
				cls += s.value;
			}
		});

		// 4. timings (TTI and Load times)
		let navs = performance.getEntriesByType('navigation');
		let loadTime = 0;
		let domInteractive = 0;
		if (navs.length > 0) {
			loadTime = navs[0].loadEventEnd - navs[0].startTime;
			domInteractive = navs[0].domInteractive - navs[0].startTime;
		}
		tti = domInteractive || loadTime || performance.now();
		if (lcp === 0) {
			lcp = tti;
		}
		if (fcp === 0) {
			fcp = domInteractive || (tti * 0.6);
		}

		// 5. Resource Load Timings
		let resEntries = performance.getEntriesByType('resource');
		let resTotal = 0;
		resEntries.forEach(r => {
			resTotal += r.duration;
		});

		// 6. JS execution time helper
		let jsTime = performance.now();

		return {
			fcp: Math.round(fcp * 1000), // milliseconds to microseconds
			lcp: Math.round(lcp * 1000),
			cls: cls,
			tti: Math.round(tti * 1000),
			resource_load_time: Math.round(resTotal * 1000),
			js_execution_time: Math.round(jsTime * 1000)
		};
	})()
	`

	var result struct {
		Fcp              int64   `json:"fcp"`
		Lcp              int64   `json:"lcp"`
		Cls              float64 `json:"cls"`
		Tti              int64   `json:"tti"`
		ResourceLoadTime int64   `json:"resource_load_time"`
		JsExecutionTime  int64   `json:"js_execution_time"`
	}

	err := chromedp.Run(reqCtx,
		chromedp.Navigate(urlStr),
		// Wait for load or paint event to populate metrics
		chromedp.Sleep(2*time.Second), 
		chromedp.Evaluate(metricsScript, &result),
	)

	fcpMicro = result.Fcp
	lcpMicro = result.Lcp
	clsScore = result.Cls
	ttiMicro = result.Tti
	resourceMicro = result.ResourceLoadTime
	jsMicro = result.JsExecutionTime

	latency := time.Since(startTime).Microseconds()

	if err != nil {
		eventBus.Publish(event.Event{
			ID:            requestID,
			Type:          event.REQUEST_FAILED,
			Timestamp:     time.Now(),
			Source:        source,
			CorrelationID: correlationID,
			Payload: event.RequestPayload{
				Name:                  "Browser " + urlStr,
				Protocol:              "Browser",
				LatencyMicro:          latency,
				RawLatencyMicro:       latency,
				CorrectedLatencyMicro: latency,
				Success:               false,
				Error:                 err.Error(),
			},
		})
		return err
	}

	// Pack metrics in dynamic tags to satisfy normalization
	tags := map[string]string{
		"fcp":                strconv.FormatInt(fcpMicro, 10),
		"lcp":                strconv.FormatInt(lcpMicro, 10),
		"cls":                strconv.FormatFloat(clsScore, 'f', 4, 64),
		"tti":                strconv.FormatInt(ttiMicro, 10),
		"resource_load_time": strconv.FormatInt(resourceMicro, 10),
		"js_execution_time":  strconv.FormatInt(jsMicro, 10),
	}

	eventBus.Publish(event.Event{
		ID:            requestID,
		Type:          event.REQUEST_COMPLETED,
		Timestamp:     time.Now(),
		Source:        source,
		CorrelationID: correlationID,
		Payload: event.RequestPayload{
			Name:                  "Browser " + urlStr,
			Protocol:              "Browser",
			LatencyMicro:          latency,
			RawLatencyMicro:       latency,
			CorrectedLatencyMicro: latency,
			Status:                200,
			Success:               true,
			Tags:                  tags,
		},
	})

	return nil
}
