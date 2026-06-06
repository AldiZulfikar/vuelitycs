package storage

import (
	"database/sql"
	"testing"
	"time"

	_ "github.com/glebarez/go-sqlite"
)

func TestSQLiteStorageE2E(t *testing.T) {
	// Initialize in-memory database for testing
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	defer db.Close()

	store := &SQLiteStorage{db: db}

	// 1. Initialize schema
	if err := store.initSchema(); err != nil {
		t.Fatalf("failed to init schema: %v", err)
	}

	runID := "test-run-123"
	scenarioID := "test-scenario"
	testType := "STRESS"

	// 2. Insert Run Summary
	err = store.InsertRun(
		runID,
		scenarioID,
		"Test Scenario Name",
		testType,
		1500,  // p95
		2500,  // p99
		5000,  // p999
		120.5, // peak rps
		0.02,  // error rate
		30,    // duration
		"success",
		10,    // safe
		25,    // critical
		18,    // inflection
		0.85,  // saturation
	)
	if err != nil {
		t.Fatalf("failed to insert run: %v", err)
	}

	// 3. Fetch Runs and verify
	runs, err := store.FetchRuns()
	if err != nil {
		t.Fatalf("failed to fetch runs: %v", err)
	}
	if len(runs) != 1 {
		t.Errorf("expected 1 run, got %d", len(runs))
	} else {
		r := runs[0]
		if r.RunID != runID {
			t.Errorf("expected RunID %s, got %s", runID, r.RunID)
		}
		if r.ScenarioID != scenarioID {
			t.Errorf("expected ScenarioID %s, got %s", scenarioID, r.ScenarioID)
		}
		if r.ScenarioName != "Test Scenario Name" {
			t.Errorf("expected ScenarioName 'Test Scenario Name', got '%s'", r.ScenarioName)
		}
		if r.TestType != testType {
			t.Errorf("expected TestType %s, got %s", testType, r.TestType)
		}
		if r.P95LatencyMicro != 1500 {
			t.Errorf("expected P95 %d, got %d", 1500, r.P95LatencyMicro)
		}
		if r.DurationSeconds != 30 {
			t.Errorf("expected duration %d, got %d", 30, r.DurationSeconds)
		}
		if r.Status != "success" {
			t.Errorf("expected status 'success', got '%s'", r.Status)
		}
		if r.SafeCapacity != 10 {
			t.Errorf("expected safe_capacity 10, got %d", r.SafeCapacity)
		}
		if r.CriticalCapacity != 25 {
			t.Errorf("expected critical_capacity 25, got %d", r.CriticalCapacity)
		}
		if r.InflectionPoint != 18 {
			t.Errorf("expected inflection_point 18, got %d", r.InflectionPoint)
		}
		if r.SaturationIndex != 0.85 {
			t.Errorf("expected saturation_index 0.85, got %f", r.SaturationIndex)
		}
	}

	// 4. Test FetchRunDetail
	detail, err := store.FetchRunDetail(runID)
	if err != nil {
		t.Fatalf("failed to fetch run detail: %v", err)
	}
	if detail.RunID != runID {
		t.Errorf("expected RunID %s, got %s", runID, detail.RunID)
	}

	// 5. Insert Metrics Tick
	err = store.InsertMetrics(
		runID,
		time.Now().Unix(),
		1,
		"HTTP",
		"STRESS",
		"TEST_STAGE",
		"METRICS",
		10,
		100,
		2,
		50.2,
		45.1,
		60.0,
	)
	if err != nil {
		t.Fatalf("failed to insert metrics: %v", err)
	}

	// 6. Insert Histogram
	err = store.InsertHistogram(
		runID,
		time.Now().Unix(),
		1,
		100,
		200.5,
		1000,
		150,
		250,
		300,
		400,
		500,
		600,
		"aGRyLWJhc2U2NA==",
	)
	if err != nil {
		t.Fatalf("failed to insert histogram: %v", err)
	}

	// 7. Insert Capacity Analysis
	err = store.InsertCapacityAnalysis(
		runID,
		time.Now().Unix(),
		1,
		12,
		15,
		18,
		14,
		0.75,
	)
	if err != nil {
		t.Fatalf("failed to insert capacity analysis: %v", err)
	}

	// 8. Insert and fetch Capacity Snapshot
	err = store.InsertCapacitySnapshot(runID, time.Now().Unix(), 1, 10, 1500, 2500, 0.02)
	if err != nil {
		t.Fatalf("failed to insert capacity snapshot: %v", err)
	}
	caps, err := store.FetchCapacitySnapshots(runID)
	if err != nil {
		t.Fatalf("failed to fetch capacity snapshots: %v", err)
	}
	if len(caps) != 1 || caps[0].VUs != 10 {
		t.Errorf("invalid capacity snapshots returned")
	}

	// 9. Insert and fetch Throughput Series
	err = store.InsertThroughputSeries(runID, time.Now().Unix(), 1, 100.0, 95.0, 120.0)
	if err != nil {
		t.Fatalf("failed to insert throughput series: %v", err)
	}
	tps, err := store.FetchThroughputSeries(runID)
	if err != nil {
		t.Fatalf("failed to fetch throughput series: %v", err)
	}
	if len(tps) != 1 || tps[0].CurrentRPS != 100.0 {
		t.Errorf("invalid throughput series returned")
	}

	// 10. Insert and fetch Error Series
	err = store.InsertErrorSeries(runID, time.Now().Unix(), 1, 5, 0.05)
	if err != nil {
		t.Fatalf("failed to insert error series: %v", err)
	}
	errs, err := store.FetchErrorSeries(runID)
	if err != nil {
		t.Fatalf("failed to fetch error series: %v", err)
	}
	if len(errs) != 1 || errs[0].ErrorCount != 5 {
		t.Errorf("invalid error series returned")
	}

	// 11. Insert and fetch Comparison Result
	err = store.InsertComparisonResult("run-a", "run-b", 100, 200, 300, 15.5, 0.01, 5, 10)
	if err != nil {
		t.Fatalf("failed to insert comparison result: %v", err)
	}
	comp, err := store.FetchComparisonResult("run-a", "run-b")
	if err != nil {
		t.Fatalf("failed to fetch comparison result: %v", err)
	}
	if comp.P95Delta != 100 || comp.PeakRPSDelta != 15.5 {
		t.Errorf("invalid comparison result returned")
	}
}
