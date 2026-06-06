# Vuelitycs

**Vuelitycs** is a high-precision, microsecond-first, multi-protocol **Performance Engineering Platform** designed to transition load testing from static metric reporting to dynamic system capacity and bottleneck analytics.

```
========================================================================
  _   _ _ _   _ _      _   _         
 | | | (_) | (_) |    | | (_)        
 | | | |_| |_ _| |   _| |_ _  ___  ___
 | | | | | __| | |  / /  __| |/ __/ __|
 \ \_/ / | |_| | |_/ /| |_| | (__\__ \
  \___/|_|\__|_|\__/_/  \__|_|\___|___/

   Performance Engineering Platform  v2.0
   Microsecond-First • Histogram-First • Multi-Protocol
========================================================================
```

---

## 🚀 Key Features

### 1. High-Precision HDR Histogram Engine
- Captures latencies with microsecond-level precision.
- Zero-allocation metric collection during test execution.
- Generates dynamic percentile reports (P50, P90, P95, P99, P99.9, P99.99).

### 2. Coordinated Omission (CO) Correction
- Automatic detection of client-side pacing queuing delays.
- Tracks both **Raw** and **Corrected** latency spectrums to prevent skewed performance statistics under saturation.

### 3. Saturation Index & Capacity Engineering
- **Saturation Index:** Computes `observed_rps / (vus * (1000/pacing_ms))` to measure workload pacing efficiency.
- **Capacity Classification:** Automatically determines safe system boundaries:
  - **Safe Capacity (VU):** Maximum concurrency where latency remains healthy (< 100ms P95) and error rate is below 1%.
  - **Inflection Point (VU):** Concurrency level where the throughput stops scaling linearly (saturation threshold).
  - **Critical Capacity (VU):** Concurrency level where latency degrades severely (> 500ms P95) or error rates exceed 5%.
  - **Classification States:** Healthy (Green), Warning (Amber), and Critical (Red) markers.

### 4. Interactive Scenario Wizard
- Guided DSL generation supporting multiple protocols:
  - **HTTP** (endpoints, methods, headers, body)
  - **Headless Browser** (Chrome DevTools Protocol using `chromedp` for Web Vitals like FCP, LCP, TTI)
  - **Kafka** (brokers, topics)
  - **Database** (driver, connection DSN, SQL queries)

### 5. Multi-Chart Telemetry Grid
- **Live Latency:** Side-by-side comparison of P50, P95, and P99 Corrected vs Raw Latencies.
- **Throughput Timeline:** Real-time RPS tracking over time.
- **Capacity Timeline:** Compares Active VUs on the X-axis against Latency (ms) and Error Rates (%) on dual Y-axes.

### 6. Side-by-Side Run Comparison & Regression
- Select any two historical runs (Baseline vs Target).
- Instantly analyzes performance deltas: P95 latency shifts, Peak RPS changes, Error rates, and Safe capacity variance.

---

## 🛠️ Architecture

Vuelitycs supports three deployment topologies:

1. **Standalone (`vuelitycs run`)**: Runs local test scenarios using a JSON-defined DSL file and spawns a local web dashboard.
2. **Central Controller (`vuelitycs controller`)**: Spawns the orchestration UI, processes test executions deployed via API/UI, and acts as the central SQLite aggregator.
3. **Agent Node (`vuelitycs agent`)**: Runs as a distributed worker instance waiting to execute instructions from the controller.

---

## ⚙️ Getting Started

### Prerequisites
- Go 1.20+
- Chrome/Chromium installed (optional, only required for headless browser UI testing)

### Installation
Clone the repository and build the binary:
```bash
go build -o vuelitycs cmd/perfforge/main.go
```

### Usage Modes

#### 1. Central Controller (Web Dashboard UI)
Start the central dashboard server (runs by default on port `8080` or custom port):
```bash
./vuelitycs controller --port 8085
```
Access the dashboard in your web browser at `http://localhost:8085/`.

#### 2. Local Standalone execution
Run a specific scenario DSL config file:
```bash
./vuelitycs run -f scenario.json --port 8080
```

---

## 📂 Project Structure

```
├── cmd/
│   └── perfforge/         # Binary entrypoint and command routers
├── pkg/
│   ├── dashboard/         # Embedded HTTP dashboard, SSE broadcaster, and UI templates
│   ├── event/             # Global event bus and IMF specification payloads
│   ├── metrics/           # HDR Histogram, CO correction, and pacing helpers
│   ├── plugin/            # HTTP, chromedp Browser, Kafka, and SQL execution drivers
│   ├── scenario/          # DSL Parsers, schedulers, and execution loop runtimes
│   └── storage/           # SQLite schema, migrations, and analytical query layers
└── vuelitycs.db           # SQLite database for execution and comparison records
```

---

## 📝 DSL Scenario Example

```json
{
  "name": "HTTP Load Test Profile",
  "protocol": "HTTP",
  "test_type": "LOAD",
  "vus": 10,
  "duration_seconds": 15,
  "ramp_up_seconds": 3,
  "pacing_ms": 100,
  "config": {
    "method": "GET",
    "url": "https://httpbin.org/get",
    "headers": {
      "User-Agent": "Vuelitycs-Platform/2.0"
    }
  }
}
```
