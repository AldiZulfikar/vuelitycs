package storage

import (
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	_ "github.com/glebarez/go-sqlite"
)

type SQLiteStorage struct {
	db *sql.DB
	mu sync.Mutex
}

var (
	instance *SQLiteStorage
	initErr  error
	once     sync.Once
)

// GetStorage returns the singleton instance of the SQLite storage.
// The init error (if any) is cached so every call after a failure also returns
// the error instead of (nil, nil) which would cause a nil-pointer panic.
func GetStorage() (*SQLiteStorage, error) {
	once.Do(func() {
		db, err := sql.Open("sqlite", "vuelitycs.db")
		if err != nil {
			initErr = fmt.Errorf("sqlite open: %w", err)
			log.Printf("[-] SQLite storage initialization failed to open: %v", initErr)
			return
		}

		// Keep a single writer connection – SQLite is not safe for concurrent writes.
		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)

		if err := db.Ping(); err != nil {
			initErr = fmt.Errorf("sqlite ping: %w", err)
			log.Printf("[-] SQLite storage initialization failed to ping: %v", initErr)
			_ = db.Close()
			return
		}

		s := &SQLiteStorage{db: db}
		if err = s.initSchema(); err != nil {
			initErr = fmt.Errorf("sqlite schema init: %w", err)
			log.Printf("[-] SQLite storage initialization failed to init schema: %v", initErr)
			_ = db.Close()
			return
		}
		instance = s
		log.Println("[+] SQLite storage initialized successfully (CGO-free driver)")
	})
	return instance, initErr
}

func (s *SQLiteStorage) initSchema() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	queries := []string{
		`CREATE TABLE IF NOT EXISTS scenarios (
			id TEXT PRIMARY KEY,
			name TEXT,
			config_json TEXT,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE IF NOT EXISTS runs (
			run_id TEXT PRIMARY KEY,
			scenario_id TEXT,
			scenario_name TEXT DEFAULT '',
			test_type TEXT,
			p95 INTEGER,
			p99 INTEGER,
			p99_9 INTEGER,
			peak_rps REAL,
			error_rate REAL,
			duration INTEGER,
			status TEXT,
			timestamp DATETIME,
			safe_capacity INTEGER DEFAULT 0,
			critical_capacity INTEGER DEFAULT 0,
			inflection_point INTEGER DEFAULT 0,
			saturation_index REAL DEFAULT 0.0,
			sla_status TEXT DEFAULT 'NONE',
			app_version TEXT DEFAULT '',
			build_number TEXT DEFAULT '',
			environment TEXT DEFAULT '',
			release_tag TEXT DEFAULT '',
			executed_by TEXT DEFAULT '',
			notes TEXT DEFAULT ''
		);`,
		`CREATE TABLE IF NOT EXISTS metrics (
			run_id TEXT,
			ts INTEGER,
			seq INTEGER,
			module TEXT,
			test_type TEXT,
			stage TEXT,
			data_type TEXT,
			active_vus INTEGER,
			success_count INTEGER,
			failed_count INTEGER,
			current_rps REAL,
			avg_rps REAL,
			peak_rps REAL,
			PRIMARY KEY (run_id, seq)
		);`,
		`CREATE TABLE IF NOT EXISTS histograms (
			run_id TEXT,
			ts INTEGER,
			seq INTEGER,
			min INTEGER,
			mean REAL,
			max INTEGER,
			p50 INTEGER,
			p90 INTEGER,
			p95 INTEGER,
			p99 INTEGER,
			p999 INTEGER,
			p9999 INTEGER,
			hdr_b64 TEXT,
			PRIMARY KEY (run_id, seq)
		);`,
		`CREATE TABLE IF NOT EXISTS capacity_analysis (
			run_id TEXT,
			ts INTEGER,
			seq INTEGER,
			safe_vus INTEGER,
			warning_vus INTEGER,
			critical_vus INTEGER,
			inflection_vus INTEGER,
			saturation_index REAL,
			PRIMARY KEY (run_id, seq)
		);`,
		`CREATE TABLE IF NOT EXISTS capacity_snapshots (
			run_id TEXT,
			ts INTEGER,
			seq INTEGER,
			vus INTEGER,
			p95 INTEGER,
			p99 INTEGER,
			error_rate REAL,
			PRIMARY KEY (run_id, seq)
		);`,
		`CREATE TABLE IF NOT EXISTS comparison_results (
			run_id_a TEXT,
			run_id_b TEXT,
			p95_delta INTEGER,
			p99_delta INTEGER,
			p999_delta INTEGER,
			peak_rps_delta REAL,
			error_rate_delta REAL,
			safe_capacity_delta INTEGER,
			critical_capacity_delta INTEGER,
			timestamp DATETIME,
			PRIMARY KEY (run_id_a, run_id_b)
		);`,
		`CREATE TABLE IF NOT EXISTS throughput_series (
			run_id TEXT,
			ts INTEGER,
			seq INTEGER,
			current_rps REAL,
			avg_rps REAL,
			peak_rps REAL,
			PRIMARY KEY (run_id, seq)
		);`,
		`CREATE TABLE IF NOT EXISTS error_series (
			run_id TEXT,
			ts INTEGER,
			seq INTEGER,
			error_count INTEGER,
			error_rate REAL,
			PRIMARY KEY (run_id, seq)
		);`,
	}

	for _, q := range queries {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("failed to init schema: %w", err)
		}
	}

	// Schema migrations for pre-existing db (ignore errors if columns exist)
	alterQueries := []string{
		`ALTER TABLE runs ADD COLUMN scenario_name TEXT DEFAULT '';`,
		`ALTER TABLE runs ADD COLUMN safe_capacity INTEGER DEFAULT 0;`,
		`ALTER TABLE runs ADD COLUMN critical_capacity INTEGER DEFAULT 0;`,
		`ALTER TABLE runs ADD COLUMN inflection_point INTEGER DEFAULT 0;`,
		`ALTER TABLE runs ADD COLUMN saturation_index REAL DEFAULT 0.0;`,
	}
	for _, q := range alterQueries {
		_, _ = s.db.Exec(q)
	}

	return nil
}

type RunSummary struct {
	RunID            string
	ScenarioID       string
	ScenarioName     string
	TestType         string
	P95              int64
	P99              int64
	P999             int64
	PeakRPS          float64
	ErrorRate        float64
	Duration         int
	Status           string
	SafeCapacity     int
	CriticalCapacity int
	InflectionPoint  int
	SaturationIndex  float64
	SLAStatus        string
	AppVersion       string
	BuildNumber      string
	Environment      string
	ReleaseTag       string
	ExecutedBy       string
	Notes            string
}

// InsertRun saves a completed scenario run summary to SQLite
func (s *SQLiteStorage) InsertRun(sum RunSummary) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO runs 
		(run_id, scenario_id, scenario_name, test_type, p95, p99, p99_9, peak_rps, error_rate, duration, status, timestamp, safe_capacity, critical_capacity, inflection_point, saturation_index, sla_status, app_version, build_number, environment, release_tag, executed_by, notes) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	
	_, err := s.db.Exec(query, sum.RunID, sum.ScenarioID, sum.ScenarioName, sum.TestType, sum.P95, sum.P99, sum.P999, sum.PeakRPS, sum.ErrorRate, sum.Duration, sum.Status, time.Now(), sum.SafeCapacity, sum.CriticalCapacity, sum.InflectionPoint, sum.SaturationIndex, sum.SLAStatus, sum.AppVersion, sum.BuildNumber, sum.Environment, sum.ReleaseTag, sum.ExecutedBy, sum.Notes)
	return err
}

type ScenarioRecord struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ConfigJSON string `json:"config_json"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

// InsertScenario saves a generated scenario config to SQLite
func (s *SQLiteStorage) InsertScenario(id, name, configJSON string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO scenarios (id, name, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(query, id, name, configJSON, now, now)
	return err
}

// GetScenarios retrieves all saved scenarios
func (s *SQLiteStorage) GetScenarios() ([]ScenarioRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `SELECT id, name, config_json, created_at, updated_at FROM scenarios ORDER BY updated_at DESC`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ScenarioRecord
	for rows.Next() {
		var rec ScenarioRecord
		if err := rows.Scan(&rec.ID, &rec.Name, &rec.ConfigJSON, &rec.CreatedAt, &rec.UpdatedAt); err == nil {
			results = append(results, rec)
		}
	}
	return results, nil
}

// InsertMetrics saves real-time metrics tick to SQLite
func (s *SQLiteStorage) InsertMetrics(runID string, ts int64, seq int, module, testType, stage, dataType string, vus, success, failed int64, currentRPS, avgRPS, peakRPS float64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO metrics 
		(run_id, ts, seq, module, test_type, stage, data_type, active_vus, success_count, failed_count, current_rps, avg_rps, peak_rps) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	
	_, err := s.db.Exec(query, runID, ts, seq, module, testType, stage, dataType, vus, success, failed, currentRPS, avgRPS, peakRPS)
	return err
}

// InsertHistogram saves calculated percentiles and raw base64 histogram to SQLite
func (s *SQLiteStorage) InsertHistogram(runID string, ts int64, seq int, min int64, mean float64, max int64, p50, p90, p95, p99, p999, p9999 int64, hdrB64 string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO histograms 
		(run_id, ts, seq, min, mean, max, p50, p90, p95, p99, p999, p9999, hdr_b64) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	
	_, err := s.db.Exec(query, runID, ts, seq, min, mean, max, p50, p90, p95, p99, p999, p9999, hdrB64)
	return err
}

// InsertCapacityAnalysis saves capacity indicators to SQLite
func (s *SQLiteStorage) InsertCapacityAnalysis(runID string, ts int64, seq int, safeVUs, warningVUs, criticalVUs, inflectionVUs int, saturationIndex float64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO capacity_analysis 
		(run_id, ts, seq, safe_vus, warning_vus, critical_vus, inflection_vus, saturation_index) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	
	_, err := s.db.Exec(query, runID, ts, seq, safeVUs, warningVUs, criticalVUs, inflectionVUs, saturationIndex)
	return err
}

// InsertCapacitySnapshot saves capacity metrics snapshot to SQLite
func (s *SQLiteStorage) InsertCapacitySnapshot(runID string, ts int64, seq int, vus int, p95, p99 int64, errorRate float64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO capacity_snapshots (run_id, ts, seq, vus, p95, p99, error_rate) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, runID, ts, seq, vus, p95, p99, errorRate)
	return err
}

// InsertComparisonResult saves runs comparison results to SQLite
func (s *SQLiteStorage) InsertComparisonResult(runIDA, runIDB string, p95Delta, p99Delta, p999Delta int64, peakRPSDelta, errorRateDelta float64, safeDelta, criticalDelta int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO comparison_results 
		(run_id_a, run_id_b, p95_delta, p99_delta, p999_delta, peak_rps_delta, error_rate_delta, safe_capacity_delta, critical_capacity_delta, timestamp) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	
	_, err := s.db.Exec(query, runIDA, runIDB, p95Delta, p99Delta, p999Delta, peakRPSDelta, errorRateDelta, safeDelta, criticalDelta, time.Now())
	return err
}

// InsertThroughputSeries saves throughput timeline series data point
func (s *SQLiteStorage) InsertThroughputSeries(runID string, ts int64, seq int, currentRPS, avgRPS, peakRPS float64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO throughput_series (run_id, ts, seq, current_rps, avg_rps, peak_rps) VALUES (?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, runID, ts, seq, currentRPS, avgRPS, peakRPS)
	return err
}

// InsertErrorSeries saves error timeline series data point
func (s *SQLiteStorage) InsertErrorSeries(runID string, ts int64, seq int, errorCount int64, errorRate float64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `INSERT OR REPLACE INTO error_series (run_id, ts, seq, error_count, error_rate) VALUES (?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, runID, ts, seq, errorCount, errorRate)
	return err
}

// RunHistoryRecord represents a unified run record fetched from DB
type RunHistoryRecord struct {
	RunID            string    `json:"run_id"`
	ScenarioID       string    `json:"scenario_id"`
	ScenarioName     string    `json:"scenario_name"`
	TestType         string    `json:"test_type"`
	P95LatencyMicro  int64     `json:"p95_latency_micro"`
	P99LatencyMicro  int64     `json:"p99_latency_micro"`
	P999LatencyMicro int64     `json:"p999_latency_micro"`
	PeakRPS          float64   `json:"peak_rps"`
	ErrorRate        float64   `json:"error_rate"`
	DurationSeconds  int       `json:"duration_seconds"`
	Status           string    `json:"status"`
	Timestamp        time.Time `json:"timestamp"`
	SafeCapacity     int       `json:"safe_capacity"`
	CriticalCapacity int       `json:"critical_capacity"`
	InflectionPoint  int       `json:"inflection_point"`
	SaturationIndex  float64   `json:"saturation_index"`
}

// FetchRuns retrieves all recorded runs from SQLite
func (s *SQLiteStorage) FetchRuns() ([]RunHistoryRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rows, err := s.db.Query("SELECT run_id, scenario_id, scenario_name, test_type, p95, p99, p99_9, peak_rps, error_rate, duration, status, timestamp, safe_capacity, critical_capacity, inflection_point, saturation_index FROM runs ORDER BY timestamp DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []RunHistoryRecord
	for rows.Next() {
		var r RunHistoryRecord
		err := rows.Scan(
			&r.RunID, &r.ScenarioID, &r.ScenarioName, &r.TestType,
			&r.P95LatencyMicro, &r.P99LatencyMicro, &r.P999LatencyMicro,
			&r.PeakRPS, &r.ErrorRate, &r.DurationSeconds, &r.Status, &r.Timestamp,
			&r.SafeCapacity, &r.CriticalCapacity, &r.InflectionPoint, &r.SaturationIndex,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return records, nil
}

// FetchRunDetail retrieves a single run record by ID
func (s *SQLiteStorage) FetchRunDetail(runID string) (*RunHistoryRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	row := s.db.QueryRow("SELECT run_id, scenario_id, scenario_name, test_type, p95, p99, p99_9, peak_rps, error_rate, duration, status, timestamp, safe_capacity, critical_capacity, inflection_point, saturation_index FROM runs WHERE run_id = ?", runID)
	
	var r RunHistoryRecord
	err := row.Scan(
		&r.RunID, &r.ScenarioID, &r.ScenarioName, &r.TestType,
		&r.P95LatencyMicro, &r.P99LatencyMicro, &r.P999LatencyMicro,
		&r.PeakRPS, &r.ErrorRate, &r.DurationSeconds, &r.Status, &r.Timestamp,
		&r.SafeCapacity, &r.CriticalCapacity, &r.InflectionPoint, &r.SaturationIndex,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// CapacitySnapshotRecord represents a capacity timeline snapshot record
type CapacitySnapshotRecord struct {
	RunID     string  `json:"run_id"`
	Ts        int64   `json:"ts"`
	Seq       int     `json:"seq"`
	VUs       int     `json:"vus"`
	P95       int64   `json:"p95"`
	P99       int64   `json:"p99"`
	ErrorRate float64 `json:"error_rate"`
}

// FetchCapacitySnapshots fetches snapshots for a run
func (s *SQLiteStorage) FetchCapacitySnapshots(runID string) ([]CapacitySnapshotRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rows, err := s.db.Query("SELECT run_id, ts, seq, vus, p95, p99, error_rate FROM capacity_snapshots WHERE run_id = ? ORDER BY seq ASC", runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []CapacitySnapshotRecord
	for rows.Next() {
		var c CapacitySnapshotRecord
		if err := rows.Scan(&c.RunID, &c.Ts, &c.Seq, &c.VUs, &c.P95, &c.P99, &c.ErrorRate); err == nil {
			list = append(list, c)
		}
	}
	return list, nil
}

// ThroughputSeriesRecord represents a throughput series point
type ThroughputSeriesRecord struct {
	RunID      string  `json:"run_id"`
	Ts         int64   `json:"ts"`
	Seq        int     `json:"seq"`
	CurrentRPS float64 `json:"current_rps"`
	AvgRPS     float64 `json:"avg_rps"`
	PeakRPS    float64 `json:"peak_rps"`
}

// FetchThroughputSeries fetches throughput series for a run
func (s *SQLiteStorage) FetchThroughputSeries(runID string) ([]ThroughputSeriesRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rows, err := s.db.Query("SELECT run_id, ts, seq, current_rps, avg_rps, peak_rps FROM throughput_series WHERE run_id = ? ORDER BY seq ASC", runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ThroughputSeriesRecord
	for rows.Next() {
		var t ThroughputSeriesRecord
		if err := rows.Scan(&t.RunID, &t.Ts, &t.Seq, &t.CurrentRPS, &t.AvgRPS, &t.PeakRPS); err == nil {
			list = append(list, t)
		}
	}
	return list, nil
}

// ErrorSeriesRecord represents an error series point
type ErrorSeriesRecord struct {
	RunID      string  `json:"run_id"`
	Ts         int64   `json:"ts"`
	Seq        int     `json:"seq"`
	ErrorCount int64   `json:"error_count"`
	ErrorRate  float64 `json:"error_rate"`
}

// FetchErrorSeries fetches error series for a run
func (s *SQLiteStorage) FetchErrorSeries(runID string) ([]ErrorSeriesRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rows, err := s.db.Query("SELECT run_id, ts, seq, error_count, error_rate FROM error_series WHERE run_id = ? ORDER BY seq ASC", runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ErrorSeriesRecord
	for rows.Next() {
		var e ErrorSeriesRecord
		if err := rows.Scan(&e.RunID, &e.Ts, &e.Seq, &e.ErrorCount, &e.ErrorRate); err == nil {
			list = append(list, e)
		}
	}
	return list, nil
}

// ComparisonResultRecord represents comparison outputs
type ComparisonResultRecord struct {
	RunIDA                string    `json:"run_id_a"`
	RunIDB                string    `json:"run_id_b"`
	P95Delta              int64     `json:"p95_delta"`
	P99Delta              int64     `json:"p99_delta"`
	P999Delta             int64     `json:"p999_delta"`
	PeakRPSDelta          float64   `json:"peak_rps_delta"`
	ErrorRateDelta        float64   `json:"error_rate_delta"`
	SafeCapacityDelta     int       `json:"safe_capacity_delta"`
	CriticalCapacityDelta int       `json:"critical_capacity_delta"`
	Timestamp             time.Time `json:"timestamp"`
}

// FetchComparisonResult checks if a comparison exists in DB
func (s *SQLiteStorage) FetchComparisonResult(runIDA, runIDB string) (*ComparisonResultRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	row := s.db.QueryRow("SELECT run_id_a, run_id_b, p95_delta, p99_delta, p999_delta, peak_rps_delta, error_rate_delta, safe_capacity_delta, critical_capacity_delta, timestamp FROM comparison_results WHERE run_id_a = ? AND run_id_b = ?", runIDA, runIDB)
	
	var c ComparisonResultRecord
	err := row.Scan(&c.RunIDA, &c.RunIDB, &c.P95Delta, &c.P99Delta, &c.P999Delta, &c.PeakRPSDelta, &c.ErrorRateDelta, &c.SafeCapacityDelta, &c.CriticalCapacityDelta, &c.Timestamp)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
