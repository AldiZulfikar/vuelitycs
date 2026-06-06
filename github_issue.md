# GitHub Issue: Feature Revision & Enhancements

## Title
feat: Remove redundant run buttons and add Gatling-like Workload Profile Visualization

## Description

To streamline the Vuelitycs UX and provide better execution transparency, we need to implement the following adjustments:

### 1. Remove Redundant Action Buttons
With the implementation of the **Scenario Wizard** tab, the standalone action buttons on the top right of the main dashboard:
- `Load HTTP Scenario`
- `Load Browser Scenario`

are now redundant and should be removed from the user interface.

### 2. Implement Workload Profile Visualization
When executing a scenario with ramping concurrency (e.g., `vus: 100`, `ramp_up_seconds: 30`, and `duration_seconds: 60`), users need to see the expected workload pattern visualized as a line chart.

**Expected visualization style (similar to Gatling):**
```
VU Concurrency
│
│            ________________ (Steady State)
│           /
│          / (Ramp-up Phase)
│_________/
└────────────────────────────── Time (Seconds)
```

#### Technical Scope:
- **UI Update (`dashboard.html` / `app.js`):**
  - Add a **Workload Profile** card/chart section in the Live Overview or charts grid.
  - Render a line chart representing the active target VUs over the timeline of the test.
  - Calculate the coordinates dynamically based on:
    - `ramp_up_seconds` (Linear ramp from 0 to target `vus`)
    - `duration_seconds` (Steady state at target `vus`)
- **Backend API / Telemetry Integration:**
  - Ensure the target VUs schedule is populated during execution stages and available to the chart generator.
