# Vuelitycs Sprint 3 GitHub Issues Templates

Use these templates to create issues in your GitHub repository: [https://github.com/AldiZulfikar/vuelitycs/issues](https://github.com/AldiZulfikar/vuelitycs/issues).

---

## 📋 Issue 1: feat(wizard): Smart Scenario Wizard (Epic 1)

### Title
`feat(wizard): Smart Scenario Wizard with business target input and auto workload calculations`

### Description
Transform the Scenario Wizard from a basic DSL generator into an intelligent workload builder. This allows users to input high-level business goals (RPS, concurrency targets, think time) and automatically calculates the appropriate load test parameters.

#### Features to Implement:
1. **Business Target Inputs:**
   - **Expected Concurrent Users:** Target user count.
   - **Expected TPS/RPS:** Target transactions/requests per second.
   - **Think Time (ms):** Expected delay between user actions.
   - **Peak Multiplier:** Coeffecient for spike calculations (e.g. 1.5x or 2.0x).
2. **Automatic Workload Calculation:**
   - **Suggested VU:** Calculated as `Expected Concurrent Users` or derived from `Expected RPS` and `Think Time`.
   - **Suggested Ramp-up (seconds):** Safe duration to scale active VUs.
   - **Suggested Duration (seconds):** Steady-state test run duration.
3. **User Override Capability:**
   - Suggest values automatically, but keep input fields editable so users can tweak computed values manually.
4. **DSL Compatibility:**
   - The generated output must remain fully compatible with the current JSON DSL engine schema.

### Acceptance Criteria
- [ ] Users can enter business target inputs without knowing lower-level technical parameters.
- [ ] The wizard generates suggested workload parameters in real time.
- [ ] The generated DSL compiles and runs against the current execution engine.

---

## 📋 Issue 2: feat(sla): SLA & SLO Validation Engine (Epic 2)

### Title
`feat(sla): Add SLA/SLO definition and validation engine`

### Description
Implement a threshold-based assessment suite (PASS/FAIL) to evaluate test runs against user-defined Performance SLAs.

#### Features to Implement:
1. **SLA Configuration UI:**
   - Inputs in Scenario Wizard:
     - P95 Latency Threshold (ms)
     - P99 Latency Threshold (ms)
     - Max Error Rate Threshold (%)
     - Min Throughput (RPS)
2. **Evaluation Logic:**
   - Post-test evaluation of SQLite results against the criteria.
   - Store run SLA status (`PASS` / `FAIL`) in the `runs` table.
3. **Visual Indicators:**
   - SLA Summary Badge in the History Table and Run Details.
   - Highlighting specific metrics (in red) that violated target thresholds.

### Acceptance Criteria
- [ ] Users can set SLA limits in the Scenario specification.
- [ ] The run history displays a clear visual `PASS` or `FAIL` badge for each execution.
- [ ] Non-compliant metrics are visually highlighted on the dashboard/details page.

---

## 📋 Issue 3: feat(wizard): Scenario Template Library (Epic 3)

### Title
`feat(wizard): Reusable Scenario Template Library`

### Description
Speed up scenario configuration by providing predefined templates for common load testing scenarios.

#### Templates to Include:
1. **Login API Load Test:** Simulated authentication flow.
2. **Search API Load Test:** High read workload.
3. **Checkout Stress Test:** Ramp to high transaction load.
4. **Kafka Producer Benchmark:** Raw throughput test.
5. **Kafka Consumer Benchmark:** Message consumption pacing.
6. **Database Benchmark:** Read/write SQL simulation.
7. **Browser Performance Audit:** Web Vital Headless browser pacing.

### Acceptance Criteria
- [ ] The wizard has a "Templates" selector dropdown or grid.
- [ ] Selecting a template populates the form inputs instantly.
- [ ] The template can be fully customized by the user prior to generation.

---

## 📋 Issue 4: feat(preview): Scenario Workload Preview (Epic 4)

### Title
`feat(preview): Interactive Scenario Preview and Projection Card`

### Description
Provide a preview of the workload profile and capacity projection *before* deploying or generating the DSL.

#### Features to Implement:
1. **Scenario Summary Card:**
   - Shows Protocol (HTTP, Browser, Kafka, etc.)
   - Test Type summary.
2. **Workload Summary:**
   - Ramp-up duration, total runtime, steady-state target.
3. **Estimated Peak RPS:** Calculated prediction based on pacing and VUs.

### Acceptance Criteria
- [ ] A preview panel is rendered in the wizard prior to clicking "Generate & Apply".
- [ ] Key projections (estimated load, peak capacity) are updated dynamically as form fields change.

---

## 📋 Issue 5: feat(recommendation): Recommendation Engine v1 (Epic 5)

### Title
`feat(recommendation): Automatic Post-Run Recommendation Engine`

### Description
Analyze the historical telemetry in SQLite automatically after each run to produce action-oriented engineering insights.

#### Features to Implement:
1. **Telemetry Analysis Routines:**
   - **Bottleneck Detection:** Identifies when latency begins growing exponentially.
   - **Capacity Recommendation:** Recommends safe VU operating limits based on latency/error thresholds.
   - **Error Spike Detection:** Correlates VU count with sudden error rate surges.
2. **Recommendation Cards:**
   - Displayed at the end of a test run on the dashboard.

### Acceptance Criteria
- [ ] Post-test execution automatically renders at least one analytical recommendation.
- [ ] Insight generation runs autonomously without requiring user requests.

---

## 📋 Issue 6: feat(scenario): Scenario Management (Epic 6)

### Title
`feat(scenario): CRUD interface for Scenario Management`

### Description
Provide persistence capabilities for Scenario Configurations so users can save, load, and manage their test scripts.

#### Features to Implement:
1. **Database Schema Update:**
   - Create a `scenarios` table to store scenario names, configs (JSON), and timestamps.
2. **Dashboard UI Panel:**
   - List saved scenarios.
   - Action buttons: Save, Load, Duplicate, Delete.
   - Text Search input to filter scenarios.

### Acceptance Criteria
- [ ] User can save scenarios to the SQLite database.
- [ ] Saved scenarios can be loaded into the editor with one click.
- [ ] Scenarios can be duplicated or deleted from the dashboard.

---

## 📋 Issue 7: feat(scenario): Scenario Versioning & Audit History (Epic 7)

### Title
`feat(scenario): Scenario Versioning and Comparison`

### Description
Manage the evolution of scenario configurations over time, tracking changes and allowing rollback capabilities.

#### Features to Implement:
1. **Version History:**
   - Incremental version numbering (`v1`, `v2`, `v3`) for each scenario edit.
2. **Comparison:**
   - View text diffs of scenario JSON changes.
3. **Rollback:**
   - Select a previous version and restore it as the active config.

### Acceptance Criteria
- [ ] Editing a saved scenario commits a new version to the history list.
- [ ] Users can view differences between versions.
- [ ] Rollback reverts the active scenario state immediately.

---

## 📋 Issue 8: feat(metadata): Run Release Tracking & Metadata (Epic 8)

### Title
`feat(metadata): Add release tracking metadata to execution runs`

### Description
Link test results with target release contexts by storing additional metadata tags with each run.

#### Metadata Fields to Store:
- **Application Version:** e.g., `v2.4.1`
- **Build Number:** e.g., `#1084`
- **Environment:** e.g., `Staging`, `Production`
- **Release Tag:** e.g., `sprint-3-rc1`
- **Executed By:** User identity.
- **Notes:** Text summary of the test purpose.

### Acceptance Criteria
- [ ] Metadata fields are input-ready in the starting view.
- [ ] Metadata is saved in the SQLite `runs` table.
- [ ] Metadata displays in the Run History table and Comparison dropdown details.

---

## 📋 Issue 9: feat(regression): Automated Regression Analysis (Epic 9)

### Title
`feat(regression): Automated Regression Detection V2 for Run Comparison`

### Description
Automatically evaluate performance deviations when comparing two runs (Baseline vs Target) and output clear degradation statuses.

#### Regression Rules:
- **FAIL** if Latency increases by > 10%.
- **FAIL** if Error Rate increases by > 2%.
- **FAIL** if Throughput decreases by > 15%.

### Acceptance Criteria
- [ ] Comparison report displays status classification: `PASS`, `WARNING`, or `FAIL`.
- [ ] Deviation deltas are highlighted and explained in plain English.

---

## 📋 Issue 10: feat(charts): Capacity Heatmap Visualization (Epic 10)

### Title
`feat(charts): Capacity Heatmap Zones (Safe vs Critical)`

### Description
Render color-coded capacity limits as zones in the telemetry dashboards and comparison screens.

#### Heatmap Zones:
- **Green Zone:** Safe capacity threshold (e.g., 0 – 50 VU)
- **Yellow Zone:** Warning capacity threshold (e.g., 51 – 80 VU)
- **Red Zone:** Saturation / Critical capacity threshold (e.g., 81+ VU)

### Acceptance Criteria
- [ ] The dashboard charts (like Capacity timeline) show background color zones or threshold lines.
- [ ] Heatmaps are rendered in both Live Telemetry and History Comparison pages.

---

## 📋 Issue 11: feat(report): Executive PDF Report Export (Epic 11)

### Title
`feat(report): Executive PDF Performance Report Generator`

### Description
Build an export function to download a structured, professional PDF summary of a performance run.

#### PDF Sections:
1. Executive Summary
2. SLA Compliance status
3. Capacity safe limit classification
4. Percentile latencies and Throughput timelines
5. Recommendations and next steps

### Acceptance Criteria
- [ ] An "Export PDF Report" button is available on completed run pages.
- [ ] The generated PDF contains clean layouts, formatted charts, and summary reports.
