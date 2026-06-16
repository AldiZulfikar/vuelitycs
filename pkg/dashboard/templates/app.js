/* ==========================================================================
   Vuelitycs Dashboard Client Logic (Sprint 2 Performance Engineering Platform)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const txtDsl = document.getElementById('txt-scenario-dsl');
    const btnStart = document.getElementById('btn-start-test');
    const btnStop = document.getElementById('btn-stop-test');
    
    // Overview Panel
    const lblOverviewName = document.getElementById('lbl-overview-name');
    const lblOverviewProtocol = document.getElementById('lbl-overview-protocol');
    const lblOverviewType = document.getElementById('lbl-overview-type');
    const lblOverviewStage = document.getElementById('lbl-overview-stage');
    const lblOverviewDuration = document.getElementById('lbl-overview-duration');
    const lblOverviewCurVus = document.getElementById('lbl-overview-cur-vus');
    const lblOverviewTarVus = document.getElementById('lbl-overview-tar-vus');

    // Throughput Widget
    const lblCounterRps = document.getElementById('lbl-counter-rps');
    const lblCounterAvgRps = document.getElementById('lbl-counter-avg-rps');
    const lblCounterPeakRps = document.getElementById('lbl-counter-peak-rps');

    // Capacity Widget
    const lblCapacitySafe = document.getElementById('lbl-capacity-safe');
    const lblCapacityInflection = document.getElementById('lbl-capacity-inflection');
    const lblCapacityCritical = document.getElementById('lbl-capacity-critical');
    const lblCapacitySaturation = document.getElementById('lbl-capacity-saturation');

    // Totals & Errors Widget
    const lblSuccess = document.getElementById('lbl-counter-success');
    const lblFailed = document.getElementById('lbl-counter-failed');
    const lblErrorRate = document.getElementById('lbl-counter-error-rate');
    const cardErrorRate = document.getElementById('card-error-rate');
    const iconErrorRate = document.getElementById('icon-error-rate');

    // Vitals Panel (Browser specific)
    const cardBrowserVitals = document.getElementById('card-browser-vitals');
    const lblFcp = document.getElementById('lbl-vital-fcp');
    const lblLcp = document.getElementById('lbl-vital-lcp');
    const lblTti = document.getElementById('lbl-vital-tti');
    const lblResource = document.getElementById('lbl-vital-resource');
    const barFcp = document.getElementById('bar-vital-fcp');
    const barLcp = document.getElementById('bar-vital-lcp');
    const barTti = document.getElementById('bar-vital-tti');
    const barResource = document.getElementById('bar-vital-resource');

    // Latency Table - Corrected
    const tblMin = document.getElementById('lbl-tbl-min');
    const tblP50 = document.getElementById('lbl-tbl-p50');
    const tblP90 = document.getElementById('lbl-tbl-p90');
    const tblP95 = document.getElementById('lbl-tbl-p95');
    const tblP99 = document.getElementById('lbl-tbl-p99');
    const tblP999 = document.getElementById('lbl-tbl-p999');
    const tblP9999 = document.getElementById('lbl-tbl-p9999');
    const tblMax = document.getElementById('lbl-tbl-max');
    const tblMean = document.getElementById('lbl-tbl-mean');

    // Latency Table - Raw
    const tblRawMin = document.getElementById('lbl-tbl-raw-min');
    const tblRawP50 = document.getElementById('lbl-tbl-raw-p50');
    const tblRawP90 = document.getElementById('lbl-tbl-raw-p90');
    const tblRawP95 = document.getElementById('lbl-tbl-raw-p95');
    const tblRawP99 = document.getElementById('lbl-tbl-raw-p99');
    const tblRawP999 = document.getElementById('lbl-tbl-raw-p999');
    const tblRawP9999 = document.getElementById('lbl-tbl-raw-p9999');
    const tblRawMax = document.getElementById('lbl-tbl-raw-max');
    const tblRawMean = document.getElementById('lbl-tbl-raw-mean');

    // Terminal & Navigation Views
    const terminal = document.getElementById('terminal-screen');
    const btnClearTerminal = document.getElementById('btn-clear-terminal');
    const btnNavDashboard = document.getElementById('btn-nav-dashboard');
    const btnNavHistory = document.getElementById('btn-nav-history');
    const btnNavComparison = document.getElementById('btn-nav-comparison');
    const btnNavWizard = document.getElementById('btn-nav-wizard');

    const panelDashboard = document.getElementById('panel-dashboard');
    const panelHistory = document.getElementById('panel-history');
    const panelComparison = document.getElementById('panel-comparison');
    const panelWizard = document.getElementById('panel-wizard');

    const historyTableBody = document.getElementById('history-table-body');
    const lblEngineStatus = document.getElementById('lbl-engine-status');

    let currentScenarioName = "HTTP Core Load Run";
    let currentTargetVUs = 15;

    // Preset Configurations
    const PRESET_HTTP = {
        name: "HTTP Core Load Run",
        protocol: "HTTP",
        vus: 15,
        duration_seconds: 20,
        ramp_up_seconds: 4,
        pacing_ms: 150,
        test_type: "LOAD",
        config: {
            url: "https://httpbin.org/get",
            method: "GET",
            headers: {
                "User-Agent": "Vuelitycs-Platform/2.0"
            }
        }
    };

    const PRESET_BROWSER = {
        name: "Browser Single-Page Load Test",
        protocol: "Browser",
        vus: 2,
        duration_seconds: 30,
        ramp_up_seconds: 4,
        pacing_ms: 4000,
        test_type: "LOAD",
        config: {
            url: "https://example.com",
            timeout_ms: 15000
        }
    };

    // View Navigation Router
    function navigateTo(tab) {
        // Remove active class from all links
        [btnNavDashboard, btnNavHistory, btnNavComparison, btnNavWizard].forEach(btn => btn.classList.remove('active'));
        // Hide all panels
        [panelDashboard, panelHistory, panelComparison, panelWizard].forEach(panel => panel.classList.add('hide'));

        if (tab === 'dashboard') {
            btnNavDashboard.classList.add('active');
            panelDashboard.classList.remove('hide');
            document.getElementById('lbl-page-title').textContent = "Performance Engineering Dashboard";
            document.getElementById('lbl-page-subtitle').textContent = "Vuelitycs high-precision telemetry & bottleneck analysis";
        } else if (tab === 'history') {
            btnNavHistory.classList.add('active');
            panelHistory.classList.remove('hide');
            document.getElementById('lbl-page-title').textContent = "Run Execution History";
            document.getElementById('lbl-page-subtitle').textContent = "Persistent record of all previous scenario executions";
            fetchHistory();
        } else if (tab === 'comparison') {
            btnNavComparison.classList.add('active');
            panelComparison.classList.remove('hide');
            document.getElementById('lbl-page-title').textContent = "Run Comparison & Regression";
            document.getElementById('lbl-page-subtitle').textContent = "Compare capacity safe limits, throughput, and error rates side-by-side";
            populateComparisonRuns();
        } else if (tab === 'wizard') {
            btnNavWizard.classList.add('active');
            panelWizard.classList.remove('hide');
            document.getElementById('lbl-page-title').textContent = "Scenario DSL Wizard";
            document.getElementById('lbl-page-subtitle').textContent = "Generate Vuelitycs DSL configurations using guided steps";
        }
    }

    btnNavDashboard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
    btnNavHistory.addEventListener('click', (e) => { e.preventDefault(); navigateTo('history'); });
    btnNavComparison.addEventListener('click', (e) => { e.preventDefault(); navigateTo('comparison'); });
    btnNavWizard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('wizard'); });

    btnClearTerminal.addEventListener('click', () => {
        terminal.innerHTML = '';
    });

    // ==========================================================================
    // Chart.js Timeline Setups (wrapped in try-catch to isolate crashes)
    // ==========================================================================

    // Chart 1: Latency Timeline (Corrected vs Raw)
    const ctxLatency = (document.getElementById('chart-live-latency') || document.createElement('canvas')).getContext('2d');
    const chartLatency = new Chart(ctxLatency, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'P50 Latency (ms)',
                    data: [],
                    borderColor: '#3B82F6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    spanGaps: true
                },
                {
                    label: 'P95 Latency (ms)',
                    data: [],
                    borderColor: '#8B5CF6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    spanGaps: true
                },
                {
                    label: 'P99 Corrected (ms)',
                    data: [],
                    borderColor: '#EC4899',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9CA3AF', font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Outfit' },
                        callback: function(v) { return v.toFixed(1) + 'ms'; }
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Chart 2: Throughput Timeline (RPS vs Time)
    const ctxThroughput = (document.getElementById('chart-live-throughput') || document.createElement('canvas')).getContext('2d');
    const chartThroughput = new Chart(ctxThroughput, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Throughput (RPS)',
                    data: [],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    fill: true,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9CA3AF', font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Outfit' },
                        callback: function(v) { return v.toFixed(1) + ' RPS'; }
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Chart 3: Capacity Timeline (VUs vs Latency & Errors)
    const ctxCapacity = (document.getElementById('chart-live-capacity') || document.createElement('canvas')).getContext('2d');
    const chartCapacity = new Chart(ctxCapacity, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'P95 Latency (ms)',
                    data: [],
                    borderColor: '#8B5CF6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y',
                    spanGaps: true
                },
                {
                    label: 'P99 Latency (ms)',
                    data: [],
                    borderColor: '#EC4899',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y',
                    spanGaps: true
                },
                {
                    label: 'Error Rate (%)',
                    data: [],
                    borderColor: '#EF4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1',
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9CA3AF', font: { family: 'Outfit' } },
                    title: { display: true, text: 'Active Virtual Users (VU)', color: '#9CA3AF', font: { family: 'Outfit' } }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Outfit' },
                        callback: function(v) { return v.toFixed(1) + 'ms'; }
                    },
                    title: { display: true, text: 'Latency (ms)', color: '#9CA3AF', font: { family: 'Outfit' } }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#EF4444',
                        font: { family: 'Outfit' },
                        callback: function(v) { return v.toFixed(2) + '%'; }
                    },
                    title: { display: true, text: 'Error Rate (%)', color: '#EF4444', font: { family: 'Outfit' } }
                }
            },
            plugins: { legend: { display: true, labels: { color: '#9CA3AF', font: { family: 'Outfit' } } } }
        }
    });

    let currentPlannedVUs = 0;

    // Chart 4: Workload Profile (Target VUs vs Time)
    const ctxWorkload = (document.getElementById('chart-live-workload') || document.createElement('canvas')).getContext('2d');
    const chartWorkload = new Chart(ctxWorkload, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Target VU',
                    data: [],
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true,
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Active VU',
                    data: [],
                    borderColor: '#10B981',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.3,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9CA3AF', font: { family: 'Outfit' } },
                    title: { display: true, text: 'Time (Seconds)', color: '#9CA3AF', font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Outfit' },
                        callback: function(v) { return v.toFixed(0) + ' VU'; }
                    },
                    title: { display: true, text: 'Virtual Users (VU)', color: '#9CA3AF', font: { family: 'Outfit' } }
                }
            },
            plugins: { legend: { display: true, labels: { color: '#9CA3AF', font: { family: 'Outfit' } } } }
        }
    });

    function setupWorkloadProfile(vus, rampUpSeconds, durationSeconds) {
        if (!vus) vus = 10;
        if (rampUpSeconds === undefined || rampUpSeconds === null) rampUpSeconds = 0;
        if (!durationSeconds) durationSeconds = 10;

        currentPlannedVUs = vus;

        const totalDuration = rampUpSeconds + durationSeconds;
        const labels = [];
        const targetData = [];
        const activeData = [];

        for (let t = 0; t <= totalDuration; t++) {
            labels.push(t + 's');
            if (t < rampUpSeconds) {
                targetData.push(Math.round(vus * (t / rampUpSeconds)));
            } else {
                targetData.push(vus);
            }
            activeData.push(null);
        }

        chartWorkload.data.labels = labels;
        chartWorkload.data.datasets[0].data = targetData;
        chartWorkload.data.datasets[1].data = activeData;
        chartWorkload.update();
    }

    function resetCharts() {
        [chartLatency, chartThroughput, chartCapacity, chartWorkload].forEach(c => {
            c.data.labels = [];
            c.data.datasets.forEach(d => d.data = []);
            c.update();
        });
    }

    function updateChartsData(seconds, activeVUs, p50Us, p95Us, p99Us, currentRps, errorRatePct) {
        const timeLabel = seconds + 's';
        
        // If last element is the same second, overwrite it to prevent duplicate points and useless updates
        if (chartLatency.data.labels.length > 0 && chartLatency.data.labels[chartLatency.data.labels.length - 1] === timeLabel) {
            const lastIdx = chartLatency.data.labels.length - 1;
            chartLatency.data.datasets[0].data[lastIdx] = p50Us / 1000;
            chartLatency.data.datasets[1].data[lastIdx] = p95Us / 1000;
            chartLatency.data.datasets[2].data[lastIdx] = p99Us / 1000;
            chartLatency.update('none');

            chartThroughput.data.datasets[0].data[lastIdx] = currentRps;
            chartThroughput.update('none');

            // Capacity chart labels are activeVUs
            chartCapacity.data.datasets[0].data[lastIdx] = p95Us / 1000;
            chartCapacity.data.datasets[1].data[lastIdx] = p99Us / 1000;
            chartCapacity.data.datasets[2].data[lastIdx] = errorRatePct;
            chartCapacity.update('none');

            if (chartWorkload.data.labels.length > 0) {
                const idx = seconds;
                if (idx >= 0 && idx < chartWorkload.data.datasets[1].data.length) {
                    chartWorkload.data.datasets[1].data[idx] = activeVUs;
                } else {
                    chartWorkload.data.datasets[1].data[idx] = activeVUs;
                }
                chartWorkload.update('none');
            }
            return;
        }

        // Update Latency
        chartLatency.data.labels.push(timeLabel);
        chartLatency.data.datasets[0].data.push(p50Us / 1000);
        chartLatency.data.datasets[1].data.push(p95Us / 1000);
        chartLatency.data.datasets[2].data.push(p99Us / 1000);
        if (chartLatency.data.labels.length > 40) {
            chartLatency.data.labels.shift();
            chartLatency.data.datasets.forEach(d => d.data.shift());
        }
        chartLatency.update('none');

        // Update Throughput
        chartThroughput.data.labels.push(timeLabel);
        chartThroughput.data.datasets[0].data.push(currentRps);
        if (chartThroughput.data.labels.length > 40) {
            chartThroughput.data.labels.shift();
            chartThroughput.data.datasets[0].data.shift();
        }
        chartThroughput.update('none');

        // Update Capacity (VUs vs Latency & Errors)
        chartCapacity.data.labels.push(activeVUs);
        chartCapacity.data.datasets[0].data.push(p95Us / 1000);
        chartCapacity.data.datasets[1].data.push(p99Us / 1000);
        chartCapacity.data.datasets[2].data.push(errorRatePct);
        if (chartCapacity.data.labels.length > 40) {
            chartCapacity.data.labels.shift();
            chartCapacity.data.datasets.forEach(d => d.data.shift());
        }
        chartCapacity.update('none');

        // Update Workload Profile
        if (chartWorkload.data.labels.length > 0) {
            const idx = seconds;
            if (idx >= 0 && idx < chartWorkload.data.datasets[1].data.length) {
                chartWorkload.data.datasets[1].data[idx] = activeVUs;
            } else {
                if (idx >= chartWorkload.data.labels.length) {
                    chartWorkload.data.labels.push(seconds + 's');
                    chartWorkload.data.datasets[0].data.push(currentPlannedVUs || activeVUs);
                }
                chartWorkload.data.datasets[1].data[idx] = activeVUs;
            }
            chartWorkload.update('none');
        }
    }

    // Server-Sent Events Telemetry Stream
    let sseSource = null;

    function connectSSE() {
        if (sseSource) {
            sseSource.close();
        }

        sseSource = new EventSource('/api/stream');

        sseSource.onopen = () => {
            lblEngineStatus.textContent = "Vuelitycs (Connected)";
            const indicator = lblEngineStatus.closest('.system-status')?.querySelector('.status-indicator');
            if (indicator) indicator.className = "status-indicator online";
        };

        sseSource.onerror = () => {
            lblEngineStatus.textContent = "Connection Lost. Retrying...";
            const indicator = lblEngineStatus.closest('.system-status')?.querySelector('.status-indicator');
            if (indicator) indicator.className = "status-indicator offline";
        };

        sseSource.onmessage = (event) => {
            try {
                const ev = JSON.parse(event.data);
                handleEvent(ev);
            } catch (err) {
                console.error("SSE parse error:", err);
            }
        };
    }

    // Connect immediately
    connectSSE();

    // Event Handler Hub
    function handleEvent(ev) {
        switch (ev.type) {
            case 'SCENARIO_STARTED':
                resetCharts();
                lblSuccess.textContent = '0';
                lblFailed.textContent = '0';
                lblErrorRate.textContent = '0.00%';
                lblCounterRps.textContent = '0.0';
                lblCounterAvgRps.textContent = '0.0';
                lblCounterPeakRps.textContent = '0.0';
                
                // Reset capacity widget UI
                lblCapacitySafe.textContent = '0 VU';
                lblCapacityInflection.textContent = '0 VU';
                lblCapacityCritical.textContent = '0 VU';
                lblCapacitySaturation.textContent = '0%';

                btnStart.classList.add('hide');
                btnStop.classList.remove('hide');
                
                currentScenarioName = ev.payload.name || "HTTP Core Load Run";
                currentTargetVUs = ev.payload.target_vus || 15;
                
                lblOverviewName.textContent = currentScenarioName;
                lblOverviewProtocol.textContent = ev.payload.protocol || "HTTP";
                lblOverviewType.textContent = ev.payload.test_type || "LOAD";
                lblOverviewStage.textContent = "RAMP_UP";
                lblOverviewDuration.textContent = "0s";
                lblOverviewCurVus.textContent = "0";
                lblOverviewTarVus.textContent = currentTargetVUs;

                appendTerminalLine(`>>> Scenario Started: ${currentScenarioName} (${ev.payload.protocol}) with ${currentTargetVUs} VUs`, 'start-msg');
                
                if (ev.payload.protocol === 'Browser') {
                    cardBrowserVitals.classList.remove('hide');
                } else {
                    cardBrowserVitals.classList.add('hide');
                }
                break;

            case 'STAGE_TRANSITION':
                if (ev.payload && ev.payload.new_stage) {
                    lblOverviewStage.textContent = ev.payload.new_stage;
                    appendTerminalLine(`>>> Stage Transition: ${ev.payload.old_stage} -> ${ev.payload.new_stage}`, 'vu-msg');
                }
                break;

            case 'SCENARIO_COMPLETED':
                btnStart.classList.remove('hide');
                btnStop.classList.add('hide');
                lblOverviewStage.textContent = "COMPLETE";
                appendTerminalLine(`<<< Scenario Completed successfully in ${(ev.payload.elapsed_ms / 1000).toFixed(2)}s`, 'complete-msg');
                setTimeout(fetchHistory, 1000);
                
                // Epic 5: Generate Recommendations
                generateRecommendations();
                break;

            case 'VU_STARTED':
                appendTerminalLine(`VU ${ev.source} active`, 'vu-msg');
                break;

            case 'VU_STOPPED':
                appendTerminalLine(`VU ${ev.source} stopped`, 'vu-msg');
                break;

            case 'REQUEST_COMPLETED':
                // Check if this was a Coordinated Omission backfilled request
                const isCorrected = ev.payload.tags && ev.payload.tags.corrected === "true";
                // Only print 5% of successful requests to terminal to prevent browser CPU freeze under high load
                if (Math.random() <= 0.05) {
                    if (isCorrected) {
                        appendTerminalLine(`[CO-CORRECTED] ${ev.payload.name} - ${formatLatency(ev.payload.latency_micro)}`, 'vu-msg');
                    } else {
                        appendTerminalLine(`[SUCCESS] ${ev.payload.name} - ${formatLatency(ev.payload.latency_micro)} (HTTP ${ev.payload.status || 200})`, 'req-success');
                    }
                }
                break;

            case 'REQUEST_FAILED':
                appendTerminalLine(`[FAILED] ${ev.payload.name} - error: ${ev.payload.error}`, 'req-failed');
                break;

            case 'METRICS_SUMMARY':
                updateMetricsUI(ev.payload);
                break;
        }
    }

    function updateMetricsUI(m) {
        // Overview Card update
        lblOverviewDuration.textContent = m.elapsed_seconds + 's';
        lblOverviewCurVus.textContent = m.active_vus;
        lblOverviewTarVus.textContent = currentTargetVUs;

        if (m.imf && m.imf.envelope) {
            lblOverviewStage.textContent = m.imf.envelope.stage;
            lblOverviewProtocol.textContent = m.imf.envelope.module;
            lblOverviewType.textContent = m.imf.envelope.test_type;
        }

        // Totals
        lblSuccess.textContent = m.success_count;
        lblFailed.textContent = m.failed_count;
        
        // Error Rate Widget (with threshold color coding)
        const errorRateVal = m.error_rate || 0.0;
        lblErrorRate.textContent = errorRateVal.toFixed(2) + '%';
        if (errorRateVal <= 1.0) {
            cardErrorRate.className = "card glass-card counter-card border-success";
            iconErrorRate.className = "counter-icon bg-green";
        } else if (errorRateVal <= 5.0) {
            cardErrorRate.className = "card glass-card counter-card border-warning";
            iconErrorRate.className = "counter-icon bg-amber";
        } else {
            cardErrorRate.className = "card glass-card counter-card border-critical";
            iconErrorRate.className = "counter-icon bg-red";
        }

        // Throughput Widget (Current, Average, Peak)
        let rpsVal = m.rps;
        let peakRpsVal = m.rps * 1.15;
        if (m.imf && m.imf.throughput && m.imf.throughput.throughput) {
            const tp = m.imf.throughput.throughput;
            rpsVal = tp.current_rps;
            lblCounterRps.textContent = tp.current_rps.toFixed(1);
            lblCounterAvgRps.textContent = tp.avg_rps.toFixed(1);
            lblCounterPeakRps.textContent = tp.peak_rps.toFixed(1);
            peakRpsVal = tp.peak_rps;
        } else {
            lblCounterRps.textContent = m.rps.toFixed(1);
            lblCounterAvgRps.textContent = m.rps.toFixed(1);
            lblCounterPeakRps.textContent = peakRpsVal.toFixed(1);
        }

        // Capacity Widget
        if (m.capacity) {
            lblCapacitySafe.textContent = m.capacity.safe_vus + ' VU';
            lblCapacityInflection.textContent = m.capacity.inflection_vus + ' VU';
            lblCapacityCritical.textContent = m.capacity.critical_vus + ' VU';
            const saturationPct = m.capacity.saturation_index * 100;
            lblCapacitySaturation.textContent = saturationPct.toFixed(0) + '%';
            
            // Epic 10: Update Heatmap Pointer
            const heatmapPointer = document.getElementById('heatmap-pointer');
            const heatmapText = document.getElementById('heatmap-saturation-val');
            if (heatmapPointer && heatmapText) {
                // Clamp between 0% and 100%
                let leftPos = saturationPct;
                if (leftPos > 100) leftPos = 100;
                if (leftPos < 0) leftPos = 0;
                
                heatmapPointer.style.left = `${leftPos}%`;
                heatmapText.textContent = `${saturationPct.toFixed(2)}%`;
                
                // Colorize text
                if (leftPos <= 50) heatmapText.style.color = '#10B981';
                else if (leftPos <= 80) heatmapText.style.color = '#F59E0B';
                else heatmapText.style.color = '#EF4444';
            }
            
            // Highlight saturation colors
            const satClass = m.capacity.saturation_class || "Healthy";
            const satElement = lblCapacitySaturation.parentElement.parentElement;
            if (satClass === "Healthy") {
                satElement.className = "card glass-card counter-card border-success";
            } else if (satClass === "Warning") {
                satElement.className = "card glass-card counter-card border-warning";
            } else {
                satElement.className = "card glass-card counter-card border-critical";
            }
        }

        // Latency Table - Corrected
        tblMin.textContent = formatLatency(m.latency.min);
        tblP50.textContent = formatLatency(m.latency.p50);
        tblP90.textContent = formatLatency(m.latency.p90);
        tblP95.textContent = formatLatency(m.latency.p95);
        tblP99.textContent = formatLatency(m.latency.p99);
        tblP999.textContent = formatLatency(m.latency.p999);
        tblP9999.textContent = formatLatency(m.latency.p9999);
        tblMax.textContent = formatLatency(m.latency.max);
        tblMean.textContent = formatLatency(m.latency.mean);

        // Latency Table - Raw
        if (m.raw_latency) {
            tblRawMin.textContent = formatLatency(m.raw_latency.min);
            tblRawP50.textContent = formatLatency(m.raw_latency.p50);
            tblRawP90.textContent = formatLatency(m.raw_latency.p90);
            tblRawP95.textContent = formatLatency(m.raw_latency.p95);
            tblRawP99.textContent = formatLatency(m.raw_latency.p99);
            tblRawP999.textContent = formatLatency(m.raw_latency.p999);
            tblRawP9999.textContent = formatLatency(m.raw_latency.p9999);
            tblRawMax.textContent = formatLatency(m.raw_latency.max);
            tblRawMean.textContent = formatLatency(m.raw_latency.mean);
        }

        // Dynamic Charting
        if (m.scenario_config && chartWorkload.data.datasets[0].data.length === 0) {
            setupWorkloadProfile(m.scenario_config.vus, m.scenario_config.ramp_up_seconds, m.scenario_config.duration_seconds);
        }
        updateChartsData(m.elapsed_seconds, m.active_vus, m.latency.p50, m.latency.p95, m.latency.p99, rpsVal, errorRateVal);

        // Core Web Vitals
        if (m.browser && m.browser.active) {
            updateBrowserVitals(m.browser);
        }
    }

    function updateBrowserVitals(b) {
        const fcpS = b.avg_fcp / 1000000;
        const lcpS = b.avg_lcp / 1000000;
        const ttiS = b.avg_tti / 1000000;
        const resS = b.avg_resource_load_time / 1000000;

        lblFcp.textContent = fcpS.toFixed(2) + 's';
        lblLcp.textContent = lcpS.toFixed(2) + 's';
        lblTti.textContent = ttiS.toFixed(2) + 's';
        lblResource.textContent = resS.toFixed(2) + 's';

        barFcp.style.width = Math.min((fcpS / 5) * 100, 100) + '%';
        barLcp.style.width = Math.min((lcpS / 5) * 100, 100) + '%';
        barTti.style.width = Math.min((ttiS / 8) * 100, 100) + '%';
        barResource.style.width = Math.min((resS / 5) * 100, 100) + '%';
    }

    function formatLatency(micro) {
        if (micro === undefined || micro === null) {
            return '0µs';
        }
        if (micro < 1000) {
            return micro + 'µs';
        }
        const ms = micro / 1000;
        if (ms < 1000) {
            return ms.toFixed(2) + 'ms';
        }
        return (ms / 1000).toFixed(2) + 's';
    }

    function appendTerminalLine(text, className) {
        const line = document.createElement('div');
        line.className = `terminal-line ${className}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;

        // Keep last 150 terminal lines
        while (terminal.childElementCount > 150) {
            terminal.removeChild(terminal.firstChild);
        }
    }

    // Deploy and Start API Call
    btnStart.addEventListener('click', async () => {
        let dslContent = txtDsl.value;
        let parsed = null;
        try {
            parsed = JSON.parse(dslContent);
        } catch (e) {
            alert("JSON DSL Syntax Error: " + e.message);
            return;
        }

        resetCharts();
        setupWorkloadProfile(parsed.vus, parsed.ramp_up_seconds, parsed.duration_seconds);

        appendTerminalLine("Deploying Scenario DSL payload to engine...", "system-msg");

        try {
            const resp = await fetch('/api/scenario/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: dslContent
            });

            const data = await resp.json();
            if (resp.ok) {
                navigateTo('dashboard');
            } else {
                appendTerminalLine(`Deployment Error: ${data.error}`, 'req-failed');
                alert("Execution Failed: " + data.error);
            }
        } catch (err) {
            appendTerminalLine(`Deployment network failure: ${err.message}`, 'req-failed');
        }
    });

    // Abort API Call
    btnStop.addEventListener('click', async () => {
        appendTerminalLine("Requesting execution abort...", "system-msg");
        try {
            const resp = await fetch('/api/scenario/stop', { method: 'POST' });
            const data = await resp.json();
            if (resp.ok) {
                appendTerminalLine("Scenario cancelled by user.", "req-failed");
            } else {
                appendTerminalLine(`Abort Error: ${data.error}`, 'req-failed');
            }
        } catch (err) {
            appendTerminalLine(`Abort request failed: ${err.message}`, 'req-failed');
        }
    });

    // History API Call
    async function fetchHistory() {
        try {
            const resp = await fetch('/api/history');
            if (resp.ok) {
                const data = await resp.json();
                renderHistory(data);
            }
        } catch (err) {
            console.error("Failed to load execution history:", err);
        }
    }

    function renderHistory(runs) {
        if (!runs || runs.length === 0) {
            historyTableBody.innerHTML = `<tr><td colspan="18" class="text-center">No runs recorded in SQLite yet. Deploy your first scenario!</td></tr>`;
            return;
        }

        historyTableBody.innerHTML = runs.map(run => {
            const date = new Date(run.timestamp).toLocaleString();
            const errorRate = (run.error_rate * 100).toFixed(2) + '%';
            
            return `
                <tr>
                    <td><strong><small>${run.run_id.substring(0, 8)}...</small></strong></td>
                    <td><small>${run.scenario_id}</small></td>
                    <td><small>${run.scenario_name || ''}</small></td>
                    <td><span class="badge badge-purple">${run.test_type}</span></td>
                    <td>${formatLatency(run.p95_latency_micro)}</td>
                    <td>${formatLatency(run.p99_latency_micro)}</td>
                    <td>${run.peak_rps.toFixed(1)}</td>
                    <td><span style="color: ${run.error_rate > 0.05 ? '#EF4444' : (run.error_rate > 0.01 ? '#F59E0B' : '#10B981')}">${errorRate}</span></td>
                    <td>${run.duration_seconds}s</td>
                    <td><span class="badge ${run.status === 'success' ? 'badge-green' : 'badge-purple'}">${run.status}</span></td>
                    <td>${run.safe_capacity} VU</td>
                    <td>${run.critical_capacity} VU</td>
                    <td>${run.inflection_point} VU</td>
                    <td>${(run.saturation_index * 100).toFixed(0)}%</td>
                    <td>${date}</td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button class="btn btn-secondary" onclick="window.downloadReport('${run.run_id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem; background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.3); color: #93C5FD;" title="Download Report JSON">
                                <svg style="width: 12px; height: 12px; fill: none; stroke: currentColor;" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Report
                            </button>
                            <button class="btn btn-danger" onclick="window.deleteHistory('${run.run_id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem; background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #FCA5A5;" title="Delete Run History">
                                <svg style="width: 12px; height: 12px; fill: none; stroke: currentColor;" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.downloadReport = function(runId) {
        window.location.href = `/api/history/report?run_id=${runId}`;
    };

    window.deleteHistory = async function(runId) {
        if (!confirm(`Are you sure you want to delete run history for ID ${runId.substring(0, 8)}...? This will permanently wipe all series telemetry from database.`)) {
            return;
        }

        try {
            const resp = await fetch(`/api/history?run_id=${runId}`, {
                method: 'DELETE'
            });
            if (resp.ok) {
                await fetchHistory();
                if (window.populateComparisonRuns) {
                    await populateComparisonRuns();
                }
                appendTerminalLine(`Deleted run ${runId.substring(0, 8)}... from execution history.`, 'system-msg');
            } else {
                const data = await resp.json();
                alert("Delete failed: " + data.error);
            }
        } catch (err) {
            console.error("Delete connection error:", err);
            alert("Failed to delete: " + err.message);
        }
    };

    // ==========================================================================
    // Run Comparison Engine Logic
    // ==========================================================================
    const selectRunA = document.getElementById('select-run-a');
    const selectRunB = document.getElementById('select-run-b');
    const btnCompare = document.getElementById('btn-run-comparison');
    const viewCompResult = document.getElementById('comparison-results-view');

    async function populateComparisonRuns() {
        try {
            const resp = await fetch('/api/history');
            if (resp.ok) {
                const runs = await resp.json();
                if (!runs || runs.length === 0) {
                    selectRunA.innerHTML = '<option value="">No runs available</option>';
                    selectRunB.innerHTML = '<option value="">No runs available</option>';
                    return;
                }
                const optionsHTML = runs.map(run => {
                    const date = new Date(run.timestamp).toLocaleTimeString();
                    const name = run.scenario_name || run.scenario_id || 'Unknown';
                    return `<option value="${run.run_id}">${run.test_type} - ${name} - ${run.run_id.substring(0, 8)} (${date}, p95: ${formatLatency(run.p95_latency_micro)})</option>`;
                }).join('');
                selectRunA.innerHTML = optionsHTML;
                selectRunB.innerHTML = optionsHTML;
                if (runs.length > 1) {
                    selectRunB.selectedIndex = 1; // baseline first, target second
                }
            }
        } catch (err) {
            console.error("Failed to populate runs:", err);
        }
    }

    btnCompare.addEventListener('click', async () => {
        const runA = selectRunA.value;
        const runB = selectRunB.value;
        if (!runA || !runB) {
            alert("Please select both runs to compare.");
            return;
        }

        try {
            const resp = await fetch(`/api/comparison?run_a=${runA}&run_b=${runB}`);
            const delta = await resp.json();
            if (!resp.ok) {
                alert("Comparison failed: " + delta.error);
                return;
            }

            // Fetch details to render side-by-side table
            const rA = await (await fetch('/api/history')).json();
            const detailA = rA.find(r => r.run_id === runA);
            const detailB = rA.find(r => r.run_id === runB);

            if (!detailA || !detailB) {
                alert("Failed to find details for selected runs.");
                return;
            }

            // Populate delta values
            document.getElementById('comp-val-p95').textContent = formatDeltaLatency(delta.p95_delta);
            document.getElementById('comp-val-p99').textContent = formatDeltaLatency(delta.p99_delta);
            document.getElementById('comp-val-rps').textContent = formatDeltaValue(delta.peak_rps_delta, ' RPS');
            document.getElementById('comp-val-errors').textContent = formatDeltaValue(delta.error_rate_delta * 100, '%');
            document.getElementById('comp-val-safe').textContent = formatDeltaValue(delta.safe_capacity_delta, ' VU');
            document.getElementById('comp-val-critical').textContent = formatDeltaValue(delta.critical_capacity_delta, ' VU');

            // Format card colors based on delta values
            setColorDelta('card-comp-p95', delta.p95_delta, true); // lower is better
            setColorDelta('card-comp-p99', delta.p99_delta, true); // lower is better
            setColorDelta('card-comp-rps', delta.peak_rps_delta, false); // higher is better
            setColorDelta('card-comp-errors', delta.error_rate_delta, true); // lower is better
            setColorDelta('card-comp-safe', delta.safe_capacity_delta, false); // higher is better
            setColorDelta('card-comp-critical', delta.critical_capacity_delta, false); // higher is better

            // Fill Side-by-Side Table
            fillCompTableRow('p95', formatLatency(detailA.p95_latency_micro), formatLatency(detailB.p95_latency_micro), formatDeltaLatency(delta.p95_delta), delta.p95_delta <= 0);
            fillCompTableRow('p99', formatLatency(detailA.p99_latency_micro), formatLatency(detailB.p99_latency_micro), formatDeltaLatency(delta.p99_delta), delta.p99_delta <= 0);
            fillCompTableRow('p999', formatLatency(detailA.p999_latency_micro), formatLatency(detailB.p999_latency_micro), formatDeltaLatency(delta.p999_delta), delta.p999_delta <= 0);
            
            fillCompTableRow('rps', detailA.peak_rps.toFixed(1) + ' RPS', detailB.peak_rps.toFixed(1) + ' RPS', formatDeltaValue(delta.peak_rps_delta, ' RPS'), delta.peak_rps_delta >= 0);
            fillCompTableRow('errors', (detailA.error_rate * 100).toFixed(2) + '%', (detailB.error_rate * 100).toFixed(2) + '%', formatDeltaValue(delta.error_rate_delta * 100, '%'), delta.error_rate_delta <= 0);
            fillCompTableRow('safe', detailA.safe_capacity + ' VU', detailB.safe_capacity + ' VU', formatDeltaValue(delta.safe_capacity_delta, ' VU'), delta.safe_capacity_delta >= 0);
            fillCompTableRow('critical', detailA.critical_capacity + ' VU', detailB.critical_capacity + ' VU', formatDeltaValue(delta.critical_capacity_delta, ' VU'), delta.critical_capacity_delta >= 0);

            // Epic 9: Regression Analysis V2
            let statusComp = "PASS";
            let statusColor = "bg-green";
            const latencyPct = detailA.p95_latency_micro > 0 ? (delta.p95_delta / detailA.p95_latency_micro) * 100 : 0;
            const errIncrease = delta.error_rate_delta * 100;
            const rpsPct = detailA.peak_rps > 0 ? (delta.peak_rps_delta / detailA.peak_rps) * 100 : 0;
            
            let issues = [];
            if (latencyPct > 10) { issues.push(`Latency +${latencyPct.toFixed(1)}%`); }
            if (errIncrease > 2) { issues.push(`Errors +${errIncrease.toFixed(1)}%`); }
            if (rpsPct < -15) { issues.push(`RPS ${rpsPct.toFixed(1)}%`); }
            
            if (issues.length > 0) {
                statusComp = "FAIL: " + issues.join(", ");
                statusColor = "bg-red";
            } else if (latencyPct > 5 || rpsPct < -5) {
                statusComp = "WARNING";
                statusColor = "bg-yellow";
            }
            
            const badge = document.getElementById('comp-regression-status');
            if (badge) {
                badge.textContent = statusComp;
                badge.className = `badge ${statusColor}`;
            }

            viewCompResult.classList.remove('hide');
        } catch (err) {
            console.error("Comparison execution error:", err);
            alert("Error comparing runs: " + err.message);
        }
    });

    // Epic 11: Executive PDF Report Export
    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', () => {
            if (viewCompResult.classList.contains('hide')) {
                alert("Please run a comparison first before exporting the report.");
                return;
            }
            // Trigger native print dialog which allows "Save as PDF"
            window.print();
        });
    }

    function formatDeltaLatency(val) {
        const sign = val > 0 ? '+' : '';
        return sign + formatLatency(val);
    }

    function formatDeltaValue(val, suffix) {
        const sign = val > 0 ? '+' : '';
        return sign + val.toFixed(1) + suffix;
    }

    function setColorDelta(cardID, val, lowerIsBetter) {
        const card = document.getElementById(cardID);
        if (!card) return;
        const isGood = lowerIsBetter ? val <= 0 : val >= 0;
        if (val === 0) {
            card.className = "card glass-card counter-card";
        } else if (isGood) {
            card.className = "card glass-card counter-card border-success";
        } else {
            card.className = "card glass-card counter-card border-critical";
        }
    }

    function fillCompTableRow(metric, a, b, diff, isGood) {
        document.getElementById(`comp-tbl-a-${metric}`).textContent = a;
        document.getElementById(`comp-tbl-b-${metric}`).textContent = b;
        const cellDiff = document.getElementById(`comp-tbl-d-${metric}`);
        cellDiff.textContent = diff;
        cellDiff.style.color = isGood ? '#10B981' : '#EF4444';
    }

    // ==========================================================================
    // Scenario Wizard Logic (isolated in try-catch)
    // ==========================================================================
    try {
    let activeWizProtocol = 'HTTP';
    let activeWizTestType = 'LOAD';

    const groupWizProtocol = document.getElementById('group-wiz-protocol');
    const groupWizType = document.getElementById('group-wiz-type');
    const btnWizGenerate = document.getElementById('btn-wizard-generate');

    // Handle Protocol Selector Buttons
    groupWizProtocol.addEventListener('click', (e) => {
        const btn = e.target.closest('.wizard-btn');
        if (!btn) return;
        groupWizProtocol.querySelectorAll('.wizard-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeWizProtocol = btn.dataset.protocol;
        
        // Hide all option subforms
        document.querySelectorAll('.wiz-proto-opt').forEach(opt => opt.classList.add('hide'));
        // Show selected options subform
        const selectOpt = document.getElementById(`wiz-opt-${activeWizProtocol.toLowerCase()}`);
        if (selectOpt) selectOpt.classList.remove('hide');
    });

    // Handle Test Type Buttons
    groupWizType.addEventListener('click', (e) => {
        const btn = e.target.closest('.wizard-btn');
        if (!btn) return;
        groupWizType.querySelectorAll('.wizard-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeWizTestType = btn.dataset.type;
    });

    // Epic 3: Template Library
    const wizTemplate = document.getElementById('wiz-template');
    wizTemplate.addEventListener('change', (e) => {
        const val = e.target.value;
        const metaDiv = document.getElementById('wiz-template-meta');
        if (!val) {
            if (metaDiv) metaDiv.classList.add('hide');
            return;
        }
        
        let name = "Wizard HTTP Load Test";
        let proto = 'HTTP';
        let type = 'LOAD';
        let rps = 100, think = 500, peak = 1.5;
        let httpMethod = 'GET';
        let httpUrl = 'https://httpbin.org/get';
        let httpHeaders = '';
        let httpBody = '';

        let meta = {
            title: "-",
            purpose: "-",
            suitable: "-",
            runtime: "-",
            env: "-"
        };
        
        switch (val) {
            case 'login-api':
                name = 'Login API Load Test';
                rps = 50; think = 1000; type = 'LOAD';
                httpMethod = 'POST';
                httpUrl = 'https://httpbin.org/post';
                httpHeaders = '{\n  "Content-Type": "application/json"\n}';
                httpBody = '{\n  "username": "user1",\n  "password": "password123"\n}';
                meta = {
                    title: "Login API Load Test Template",
                    purpose: "Validate authentication service resilience under concurrent user requests.",
                    suitable: "Single API endpoint performance verification.",
                    runtime: "5 minutes",
                    env: "STAGING / PRE-PROD"
                };
                break;
            case 'search-api':
                name = 'Search API Load Test';
                rps = 300; think = 200; type = 'LOAD';
                httpMethod = 'GET';
                httpUrl = 'https://httpbin.org/get?q=vuelitycs';
                httpHeaders = '{\n  "Accept": "application/json"\n}';
                httpBody = '';
                meta = {
                    title: "Search API Load Test Template",
                    purpose: "Assess read-heavy search endpoint performance and caching effectiveness.",
                    suitable: "Read query scalability testing.",
                    runtime: "5 minutes",
                    env: "STAGING / PROD (Off-peak)"
                };
                break;
            case 'checkout-stress':
                name = 'Checkout Stress Test';
                rps = 200; think = 500; peak = 2.0; type = 'STRESS';
                httpMethod = 'POST';
                httpUrl = 'https://httpbin.org/post';
                httpHeaders = '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer sample_token"\n}';
                httpBody = '{\n  "cart_id": "cart_9988",\n  "items": [101, 102]\n}';
                meta = {
                    title: "Checkout Stress Test Template",
                    purpose: "Push the checkout transaction process to its breaking limit.",
                    suitable: "Database transaction lock check & failure isolation.",
                    runtime: "2 minutes",
                    env: "STAGING (Isolated)"
                };
                break;
            case 'kafka-producer':
                name = 'Kafka Producer Benchmark';
                rps = 1000; think = 10; proto = 'Kafka'; type = 'VOLUME';
                meta = {
                    title: "Kafka Producer Benchmark Template",
                    purpose: "Determine queue injection and ingestion limits for message throughput.",
                    suitable: "Event pipeline throughput testing.",
                    runtime: "2 minutes",
                    env: "DEV / STAGING"
                };
                break;
            case 'kafka-consumer':
                name = 'Kafka Consumer Benchmark';
                rps = 500; think = 50; proto = 'Kafka'; type = 'LOAD';
                meta = {
                    title: "Kafka Consumer Benchmark Template",
                    purpose: "Assess queue consumption latency and processing rates.",
                    suitable: "Consumer group backpressure profiling.",
                    runtime: "5 minutes",
                    env: "STAGING"
                };
                break;
            case 'db-bench':
                name = 'Database Benchmark';
                rps = 500; think = 50; proto = 'Database'; type = 'STRESS';
                meta = {
                    title: "Database Benchmark Template",
                    purpose: "Stress database query executors and connection pool configuration.",
                    suitable: "Query profile optimizations.",
                    runtime: "2 minutes",
                    env: "DEV / STAGING"
                };
                break;
            case 'browser-audit':
                name = 'Browser Performance Audit';
                rps = 5; think = 5000; proto = 'Browser'; type = 'LOAD';
                meta = {
                    title: "Browser Performance Audit Template",
                    purpose: "Measure user experience vitals (FCP, LCP, TTI) under active pages.",
                    suitable: "Core Web Vitals auditing.",
                    runtime: "5 minutes",
                    env: "DEV / STAGING"
                };
                break;
        }

        // Render metadata
        if (metaDiv) {
            document.getElementById('wiz-template-title').textContent = meta.title;
            document.getElementById('wiz-template-purpose').textContent = meta.purpose;
            document.getElementById('wiz-template-suitable').textContent = meta.suitable;
            document.getElementById('wiz-template-runtime').textContent = meta.runtime;
            document.getElementById('wiz-template-env').textContent = meta.env;
            metaDiv.classList.remove('hide');
        }
        
        document.getElementById('wiz-scenario-name').value = name;
        document.getElementById('wiz-target-rps').value = rps;
        document.getElementById('wiz-think-time').value = think;
        document.getElementById('wiz-peak-mult').value = peak;
        
        const pBtn = Array.from(groupWizProtocol.querySelectorAll('.wizard-btn')).find(b => b.dataset.protocol === proto);
        if (pBtn) pBtn.click();
        
        const tBtn = Array.from(groupWizType.querySelectorAll('.wizard-btn')).find(b => b.dataset.type === type);
        if (tBtn) tBtn.click();
        
        if (proto === 'HTTP') {
            document.getElementById('wiz-http-method').value = httpMethod;
            document.getElementById('wiz-http-url').value = httpUrl;
            document.getElementById('wiz-http-headers').value = httpHeaders;
            document.getElementById('wiz-http-body').value = httpBody;
        }
        
        btnCalcWorkload.click();
    });

    // Epic 1: Workload Calculation
    const btnCalcWorkload = document.getElementById('btn-calc-workload');
    btnCalcWorkload.addEventListener('click', () => {
        const rps = parseFloat(document.getElementById('wiz-target-rps').value) || 100;
        const think = parseFloat(document.getElementById('wiz-think-time').value) || 500;
        const peak = parseFloat(document.getElementById('wiz-peak-mult').value) || 1.5;
        
        const computedVUs = Math.ceil((rps * (think / 1000)) * peak);
        
        document.getElementById('wiz-vus').value = computedVUs;
        document.getElementById('wiz-pacing').value = think;
        
        let dur = 60, ramp = 10;
        let unit = 'sec';
        if (activeWizTestType === 'STRESS' || activeWizTestType === 'VOLUME') { dur = 120; ramp = 30; }
        else if (activeWizTestType === 'SPIKE') { dur = 30; ramp = 5; }
        else if (activeWizTestType === 'SOAK') { dur = 10; ramp = 60; unit = 'min'; }
        
        document.getElementById('wiz-duration').value = dur;
        document.getElementById('wiz-duration-unit').value = unit;
        document.getElementById('wiz-ramp-up').value = ramp;
        
        updatePreview();
    });

    // JMeter Style Workload Profile Estimator Chart (bzam-concurrent user style)
    function drawWorkloadProfile() {
        const canvas = document.getElementById('wiz-workload-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const vus = parseInt(document.getElementById('wiz-vus').value) || 0;
        const durInput = parseInt(document.getElementById('wiz-duration').value) || 0;
        const durUnit = document.getElementById('wiz-duration-unit').value;
        const dur = durUnit === 'min' ? durInput * 60 : durInput;
        const ramp = parseInt(document.getElementById('wiz-ramp-up').value) || 0;

        const padLeft = 55;
        const padRight = 25;
        const padTop = 25;
        const padBottom = 30;
        const graphW = width - padLeft - padRight;
        const graphH = height - padTop - padBottom;

        if (vus <= 0 || dur <= 0) {
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Adjust Target VUs and Duration to visualize profile', width / 2, height / 2);
            return;
        }

        // Draw dark grid lines and ticks matching ticks count
        const xTicksCount = 5;
        const yTicksCount = 4;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        // Vertical grid lines
        for (let i = 1; i < xTicksCount; i++) {
            const ratio = i / xTicksCount;
            const x = padLeft + ratio * graphW;
            ctx.beginPath();
            ctx.moveTo(x, padTop);
            ctx.lineTo(x, height - padBottom);
            ctx.stroke();
        }
        // Horizontal grid lines
        for (let i = 1; i < yTicksCount; i++) {
            const ratio = i / yTicksCount;
            const y = padTop + (1.0 - ratio) * graphH;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + graphW, y);
            ctx.stroke();
        }

        let points = [];
        
        switch (activeWizTestType) {
            case 'LOAD':
                const rampRatio = Math.min(ramp / dur, 0.8);
                points.push({rX: 0, rY: 0});
                points.push({rX: rampRatio, rY: 1});
                points.push({rX: 0.95, rY: 1});
                points.push({rX: 1.0, rY: 0});
                break;

            case 'STRESS':
                points.push({rX: 0, rY: 0});
                points.push({rX: 0.1, rY: 0.33});
                points.push({rX: 0.3, rY: 0.33});
                points.push({rX: 0.4, rY: 0.66});
                points.push({rX: 0.6, rY: 0.66});
                points.push({rX: 0.7, rY: 1.0});
                points.push({rX: 0.95, rY: 1.0});
                points.push({rX: 1.0, rY: 0});
                break;

            case 'SPIKE':
                points.push({rX: 0, rY: 0});
                points.push({rX: 0.1, rY: 1.0});
                points.push({rX: 0.25, rY: 1.0});
                points.push({rX: 0.35, rY: 0});
                points.push({rX: 1.0, rY: 0});
                break;

            case 'SOAK':
                points.push({rX: 0, rY: 0});
                points.push({rX: 0.15, rY: 1.0});
                points.push({rX: 0.9, rY: 1.0});
                points.push({rX: 1.0, rY: 0});
                break;

            case 'VOLUME':
                points.push({rX: 0, rY: 0});
                points.push({rX: 0.25, rY: 1.0});
                points.push({rX: 0.95, rY: 1.0});
                points.push({rX: 1.0, rY: 0});
                break;

            case 'SCALABILITY':
                points.push({rX: 0, rY: 0});
                points.push({rX: 0.08, rY: 0.25});
                points.push({rX: 0.23, rY: 0.25});
                points.push({rX: 0.31, rY: 0.50});
                points.push({rX: 0.46, rY: 0.50});
                points.push({rX: 0.54, rY: 0.75});
                points.push({rX: 0.69, rY: 0.75});
                points.push({rX: 0.77, rY: 1.0});
                points.push({rX: 0.95, rY: 1.0});
                points.push({rX: 1.0, rY: 0});
                break;
                
            default:
                points.push({rX: 0, rY: 0});
                points.push({rX: 0.2, rY: 1});
                points.push({rX: 0.9, rY: 1});
                points.push({rX: 1.0, rY: 0});
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padLeft, padTop);
        ctx.lineTo(padLeft, height - padBottom);
        ctx.lineTo(width - padRight, height - padBottom);
        ctx.stroke();

        const coords = points.map(pt => {
            return {
                x: padLeft + pt.rX * graphW,
                y: padTop + (1.0 - pt.rY) * graphH
            };
        });

        ctx.beginPath();
        ctx.moveTo(padLeft, height - padBottom);
        coords.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.lineTo(padLeft + graphW, height - padBottom);
        ctx.closePath();
        
        const fillGradient = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
        fillGradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        fillGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        ctx.fillStyle = fillGradient;
        ctx.fill();

        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) {
            ctx.lineTo(coords[i].x, coords[i].y);
        }
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.fillStyle = '#34D399';
        coords.forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Y-axis VU labels & small tick marks
        ctx.fillStyle = '#E5E7EB';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= yTicksCount; i++) {
            const ratio = i / yTicksCount;
            const vuVal = Math.round(vus * ratio);
            const y = padTop + (1.0 - ratio) * graphH;
            
            // tick mark
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(padLeft - 4, y);
            ctx.lineTo(padLeft, y);
            ctx.stroke();

            ctx.fillText(vuVal + ' VU', padLeft - 8, y);
        }

        // Draw X-axis Time labels & small tick marks
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= xTicksCount; i++) {
            const ratio = i / xTicksCount;
            const tVal = Math.round(dur * ratio);
            const x = padLeft + ratio * graphW;

            // tick mark
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(x, height - padBottom);
            ctx.lineTo(x, height - padBottom + 4);
            ctx.stroke();

            let label = tVal + 's';
            if (tVal >= 60) {
                const mins = (tVal / 60).toFixed(1).replace('.0', '');
                label = `${tVal}s (${mins}m)`;
            }
            ctx.fillText(label, x, height - padBottom + 6);
        }

        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${activeWizTestType} Profile Workload Model`, padLeft + 10, padTop + 2);
    }

    // CSV Data Source State
    let uploadedCsvData = null;

    const csvFileEl = document.getElementById('wiz-csv-file');
    const csvDropzone = document.getElementById('wiz-csv-dropzone');
    const csvDropzoneText = document.getElementById('wiz-csv-dropzone-text');
    const csvSummary = document.getElementById('wiz-csv-summary');
    const csvNameVal = document.getElementById('wiz-csv-name-val');
    const csvRowsVal = document.getElementById('wiz-csv-rows-val');
    const csvVarsList = document.getElementById('wiz-csv-vars-list');

    function handleCsvFile(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert("File size exceeds 10MB limit.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) {
                alert("CSV file is empty.");
                return;
            }

            // Extract headers
            const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
            const rowCount = lines.length - 1;

            uploadedCsvData = {
                fileName: file.name,
                rowCount: rowCount,
                variables: headers
            };

            // Update UI Summary Panel
            if (csvNameVal) csvNameVal.textContent = file.name;
            if (csvRowsVal) csvRowsVal.textContent = rowCount.toLocaleString();
            if (csvVarsList) {
                csvVarsList.innerHTML = "";
                headers.forEach(h => {
                    const span = document.createElement('span');
                    span.className = "badge badge-purple";
                    span.style.marginRight = "0.25rem";
                    span.style.marginBottom = "0.25rem";
                    span.textContent = `{{${h}}}`;
                    csvVarsList.appendChild(span);
                });
            }

            if (csvDropzoneText) csvDropzoneText.textContent = `Uploaded: ${file.name}`;
            if (csvSummary) csvSummary.classList.remove('hide');
            updatePreview();
        };
        reader.readAsText(file);
    }

    if (csvDropzone) {
        csvDropzone.addEventListener('click', () => csvFileEl && csvFileEl.click());
        csvDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            csvDropzone.style.borderColor = "#10B981";
            csvDropzone.style.background = "rgba(16, 185, 129, 0.05)";
        });
        csvDropzone.addEventListener('dragleave', () => {
            csvDropzone.style.borderColor = "rgba(255,255,255,0.15)";
            csvDropzone.style.background = "rgba(0,0,0,0.15)";
        });
        csvDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            csvDropzone.style.borderColor = "rgba(255,255,255,0.15)";
            csvDropzone.style.background = "rgba(0,0,0,0.15)";
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleCsvFile(files[0]);
            }
        });
    }

    if (csvFileEl) {
        csvFileEl.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleCsvFile(e.target.files[0]);
            }
        });
    }

    // Authentication Toggles
    const authTypeEl = document.getElementById('wiz-auth-type');
    if (authTypeEl) {
        authTypeEl.addEventListener('change', () => {
            document.querySelectorAll('.wiz-auth-opt').forEach(el => el.classList.add('hide'));
            const selected = authTypeEl.value;
            if (selected !== 'none') {
                const optDiv = document.getElementById(`wiz-auth-opt-${selected}`);
                if (optDiv) optDiv.classList.remove('hide');
            }
            updatePreview();
        });
    }

    function setValidationStyle(elementId, status) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.style.borderColor = "";
        el.style.background = "";
        
        if (status === 'success') {
            el.style.borderColor = "#10B981";
            el.style.background = "rgba(16, 185, 129, 0.05)";
        } else if (status === 'warning') {
            el.style.borderColor = "#F59E0B";
            el.style.background = "rgba(245, 158, 11, 0.05)";
        } else if (status === 'error') {
            el.style.borderColor = "#EF4444";
            el.style.background = "rgba(239, 68, 68, 0.05)";
        }
    }

    function getSuggestedTemplates(proto, method, auth, type) {
        const list = [];
        if (proto === 'HTTP') {
            if (method === 'POST' && (auth === 'basic' || auth === 'bearer' || auth === 'oauth2')) {
                list.push({ id: 'login-api', name: 'Login API Load Test' });
            }
            if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
                list.push({ id: 'checkout-stress', name: 'Checkout Stress Test' });
            }
            list.push({ id: 'search-api', name: 'Search API Load Test' });
            if (auth !== 'none') {
                list.push({ id: 'login-api', name: 'Login API Load Test' });
            }
        } else if (proto === 'Kafka') {
            list.push({ id: 'kafka-producer', name: 'Kafka Producer Benchmark' });
            list.push({ id: 'kafka-consumer', name: 'Kafka Consumer Benchmark' });
        } else if (proto === 'Database') {
            list.push({ id: 'db-bench', name: 'Database Benchmark' });
        } else if (proto === 'Browser') {
            list.push({ id: 'browser-audit', name: 'Browser Performance Audit' });
        }
        return list;
    }

    // Epic 4: Scenario Preview
    function updatePreview() {
        const vusEl = document.getElementById('wiz-vus');
        const vus = vusEl ? (parseInt(vusEl.value) || 0) : 0;
        
        const durInputEl = document.getElementById('wiz-duration');
        const durInput = durInputEl ? (parseInt(durInputEl.value) || 0) : 0;
        
        const durUnitEl = document.getElementById('wiz-duration-unit');
        const durUnit = durUnitEl ? durUnitEl.value : 'sec';
        
        const dur = durUnit === 'min' ? durInput * 60 : durInput;
        
        const rampEl = document.getElementById('wiz-ramp-up');
        const ramp = rampEl ? (parseInt(rampEl.value) || 0) : 0;
        
        const pacingEl = document.getElementById('wiz-pacing');
        const pacing = pacingEl ? (parseInt(pacingEl.value) || 100) : 100;
        
        const estPeakRPS = Math.round((vus / (pacing / 1000)));
        
        const p95El = document.getElementById('wiz-sla-p95');
        const p95 = p95El ? p95El.value.trim() : '';
        
        const p99El = document.getElementById('wiz-sla-p99');
        const p99 = p99El ? p99El.value.trim() : '';
        
        const errRateEl = document.getElementById('wiz-sla-error');
        const errRate = errRateEl ? errRateEl.value : '';
        
        const minRpsEl = document.getElementById('wiz-sla-rps');
        const minRps = minRpsEl ? minRpsEl.value : '';
        
        const hasSla = p95 || p99 || errRate || minRps;

        const scenNameEl = document.getElementById('wiz-scenario-name');
        const scenName = scenNameEl ? (scenNameEl.value || "Wizard Generated Test") : "Wizard Generated Test";
        
        const previewText = `• Scenario Name: ${scenName}
• Protocol: ${activeWizProtocol}
• Test Type: ${activeWizTestType}
• Workload: Ramps to ${vus} VUs over ${ramp}s, holds for ${dur}s (${durUnit === 'min' ? durInput + 'm' : durInput + 's'}).
• Estimated Peak RPS: ~${estPeakRPS} req/sec
• SLAs Configured: ${hasSla ? 'Yes' : 'No'}`;

        const previewEl = document.getElementById('wiz-preview-text');
        if (previewEl) previewEl.textContent = previewText;

        // Draw profile estimate graph
        drawWorkloadProfile();

        // Epic 1: Health Breakdown & Real-Time Input Validation
        let scoreBreakdown = [];
        let warnings = [];
        let recommendations = [];
        let hasErrors = false;

        // URL / broker / DSN configuration check
        let targetUrl = "-";
        let httpMethod = "-";

        if (activeWizProtocol === 'HTTP') {
            const urlValEl = document.getElementById('wiz-http-url');
            const urlVal = urlValEl ? urlValEl.value.trim() : '';
            targetUrl = urlVal || "-";
            httpMethod = document.getElementById('wiz-http-method')?.value || "GET";
            
            if (!urlVal) {
                hasErrors = true;
                if (urlValEl) setValidationStyle('wiz-http-url', 'error');
                warnings.push("Target URL is empty.");
                scoreBreakdown.push({ val: -20, text: "Target URL Empty" });
            } else if (!urlVal.startsWith('http://') && !urlVal.startsWith('https://')) {
                hasErrors = true;
                if (urlValEl) setValidationStyle('wiz-http-url', 'error');
                warnings.push("Target URL must start with http:// or https:// (e.g. https://api.company.com)");
                scoreBreakdown.push({ val: -20, text: "Target URL Invalid" });
            } else {
                if (urlValEl) setValidationStyle('wiz-http-url', 'success');
                scoreBreakdown.push({ val: 20, text: "URL Valid" });
            }
        } else if (activeWizProtocol === 'Browser') {
            const urlValEl = document.getElementById('wiz-browser-url');
            const urlVal = urlValEl ? urlValEl.value.trim() : '';
            targetUrl = urlVal || "-";
            
            if (!urlVal) {
                hasErrors = true;
                if (urlValEl) setValidationStyle('wiz-browser-url', 'error');
                warnings.push("Browser Target URL is empty.");
                scoreBreakdown.push({ val: -20, text: "Browser URL Empty" });
            } else if (!urlVal.startsWith('http://') && !urlVal.startsWith('https://')) {
                hasErrors = true;
                if (urlValEl) setValidationStyle('wiz-browser-url', 'error');
                warnings.push("Browser Target URL must start with http:// or https://");
                scoreBreakdown.push({ val: -20, text: "Browser URL Invalid" });
            } else {
                if (urlValEl) setValidationStyle('wiz-browser-url', 'success');
                scoreBreakdown.push({ val: 20, text: "URL Valid" });
            }
        } else if (activeWizProtocol === 'Kafka') {
            const brokersEl = document.getElementById('wiz-kafka-brokers');
            targetUrl = brokersEl ? brokersEl.value.trim() : '';
            if (!targetUrl) {
                hasErrors = true;
                if (brokersEl) setValidationStyle('wiz-kafka-brokers', 'error');
                warnings.push("Kafka Brokers list is empty.");
                scoreBreakdown.push({ val: -20, text: "Kafka Brokers Missing" });
            } else {
                if (brokersEl) setValidationStyle('wiz-kafka-brokers', 'success');
                scoreBreakdown.push({ val: 20, text: "Kafka Brokers Configured" });
            }
        } else if (activeWizProtocol === 'Database') {
            const dsnEl = document.getElementById('wiz-db-dsn');
            targetUrl = dsnEl ? dsnEl.value.trim() : '';
            if (!targetUrl) {
                hasErrors = true;
                if (dsnEl) setValidationStyle('wiz-db-dsn', 'error');
                warnings.push("Database DSN is empty.");
                scoreBreakdown.push({ val: -20, text: "Database DSN Missing" });
            } else {
                if (dsnEl) setValidationStyle('wiz-db-dsn', 'success');
                scoreBreakdown.push({ val: 20, text: "Database DSN Configured" });
            }
        }

        // VU Validation
        if (vus <= 0) {
            hasErrors = true;
            setValidationStyle('wiz-vus', 'error');
            warnings.push("Target VUs must be greater than 0.");
            scoreBreakdown.push({ val: -25, text: "Target VUs <= 0" });
        } else {
            setValidationStyle('wiz-vus', 'success');
            scoreBreakdown.push({ val: 20, text: "Workload VUs Configured" });
        }

        // Duration / Ramp up Validation
        if (dur <= 0) {
            hasErrors = true;
            setValidationStyle('wiz-duration', 'error');
            warnings.push("Duration must be greater than 0.");
            scoreBreakdown.push({ val: -20, text: "Duration <= 0" });
        } else if (dur < ramp) {
            hasErrors = true;
            setValidationStyle('wiz-duration', 'error');
            warnings.push(`Duration (${dur}s) must be greater than or equal to Ramp Up (${ramp}s).`);
            scoreBreakdown.push({ val: -20, text: "Duration < Ramp Up" });
        } else {
            setValidationStyle('wiz-duration', 'success');
            scoreBreakdown.push({ val: 20, text: "Duration Valid" });
        }

        // Authentication Validation
        let authValid = true;
        const authType = document.getElementById('wiz-auth-type')?.value || 'none';
        if (authType === 'basic') {
            const user = document.getElementById('wiz-auth-basic-user')?.value.trim();
            const pass = document.getElementById('wiz-auth-basic-pass')?.value.trim();
            if (!user || !pass) authValid = false;
        } else if (authType === 'bearer') {
            const token = document.getElementById('wiz-auth-bearer-token')?.value.trim();
            if (!token) authValid = false;
        } else if (authType === 'apikey') {
            const name = document.getElementById('wiz-auth-apikey-name')?.value.trim();
            const val = document.getElementById('wiz-auth-apikey-value')?.value.trim();
            if (!name || !val) authValid = false;
        } else if (authType === 'oauth2') {
            const url = document.getElementById('wiz-auth-oauth-url')?.value.trim();
            const id = document.getElementById('wiz-auth-oauth-id')?.value.trim();
            const sec = document.getElementById('wiz-auth-oauth-secret')?.value.trim();
            if (!url || !id || !sec) authValid = false;
        }
        if (authValid) {
            scoreBreakdown.push({ val: 20, text: "Authentication Valid" });
        } else {
            hasErrors = true;
            warnings.push("Missing required authentication credentials.");
            scoreBreakdown.push({ val: -20, text: "Authentication Incomplete" });
        }

        // Metadata Validation
        const metaEnv = document.getElementById('wiz-meta-env')?.value || '';
        const metaVersion = document.getElementById('wiz-meta-version')?.value || '';
        // Optional metadata: not added to health assessment score breakdown


        // SLA Check (non-blocking)
        if (hasSla) {
            scoreBreakdown.push({ val: 20, text: "SLA Thresholds Present" });
        } else {
            warnings.push("SLA thresholds are missing.");
            recommendations.push("Configure SLA targets (P95/P99) to establish automatic pass/fail tracking.");
            scoreBreakdown.push({ val: -10, text: "SLA Thresholds Missing" });
        }

        // P95 / P99 Target Check
        if (p95 && p99 && parseFloat(p95) >= parseFloat(p99)) {
            hasErrors = true;
            setValidationStyle('wiz-sla-p95', 'error');
            setValidationStyle('wiz-sla-p99', 'error');
            warnings.push("SLA target conflict: P95 Latency must be less than P99 Latency.");
            scoreBreakdown.push({ val: -15, text: "SLA Threshold conflict" });
        } else {
            if (p95) setValidationStyle('wiz-sla-p95', 'success');
            if (p99) setValidationStyle('wiz-sla-p99', 'success');
        }

        // CSV Strategy validation
        const csvStrategy = document.getElementById('wiz-csv-strategy')?.value || 'sequential';
        if (csvStrategy !== 'sequential' && !uploadedCsvData) {
            hasErrors = true;
            setValidationStyle('wiz-csv-strategy', 'error');
            warnings.push("Data-driven strategy selected but no CSV file uploaded.");
            scoreBreakdown.push({ val: -15, text: "Data-driven CSV Missing" });
        } else {
            if (uploadedCsvData) {
                setValidationStyle('wiz-csv-strategy', 'success');
            } else {
                setValidationStyle('wiz-csv-strategy', 'warning');
            }
        }

        // Scenario Risk Analyzer (Epic 6)
        let risks = [];
        if (dur > 0) {
            if (activeWizTestType === 'LOAD' && dur < 300) {
                risks.push("Load test duration is too short (< 300 seconds) for realistic analysis.");
                scoreBreakdown.push({ val: -15, text: "Duration < 300 sec" });
            } else if (activeWizTestType === 'SOAK' && dur < 3600) {
                risks.push("Soak test duration is too short (< 3600 seconds) to detect memory leaks.");
                scoreBreakdown.push({ val: -15, text: "Duration too short (< 3600s)" });
            }
        }

        if (ramp <= 0) {
            risks.push("No ramp-up configured. Simulated users will shock the target instantly.");
            scoreBreakdown.push({ val: -10, text: "Missing ramp-up period" });
        } else if (activeWizTestType === 'LOAD' && ramp < (0.10 * dur)) {
            risks.push(`Ramp-up is too aggressive (${ramp}s is < 10% of total duration).`);
            scoreBreakdown.push({ val: -15, text: "Aggressive workload ramp-up" });
        } else if (activeWizTestType === 'SPIKE' && ramp > 30) {
            risks.push("Spike ramp-up is too slow (> 30s) to simulate a true spike.");
            scoreBreakdown.push({ val: -10, text: "Slow spike ramp-up" });
        } else if (activeWizTestType === 'SPIKE' && ramp < 10) {
            risks.push("Spike ramp-up is extremely sharp (< 10s), risk of engine network saturation.");
            scoreBreakdown.push({ val: -15, text: "Extremely sharp spike" });
        }

        if (activeWizProtocol === 'HTTP' && targetUrl.startsWith('http://')) {
            risks.push("Insecure HTTP protocol used instead of HTTPS.");
            scoreBreakdown.push({ val: -10, text: "Insecure target URL" });
        }

        if (activeWizProtocol === 'Browser' && vus > 10) {
            risks.push(`High Browser virtual user load (${vus} VUs) exceeds typical engine resource capacity.`);
            scoreBreakdown.push({ val: -15, text: "Browser VUs too high" });
        } else if (vus > 200) {
            risks.push(`High virtual user load (${vus} VUs) exceeds typical single node limit.`);
            scoreBreakdown.push({ val: -10, text: "High user volume load" });
        }

        if (uploadedCsvData) {
            const rows = uploadedCsvData.rows || 0;
            if (rows < vus) {
                risks.push(`CSV dataset contains only ${rows} records for ${vus} VUs. Data reuse collisions will happen.`);
                scoreBreakdown.push({ val: -15, text: "CSV rows < target VUs" });
            }
        }

        if (activeWizTestType === 'SPIKE') {
            risks.push("Spike test workload profile: sudden load changes may saturate engine network interfaces.");
        }

        // Calculate and clamp Health Score
        let score = scoreBreakdown.reduce((sum, item) => sum + item.val, 0);
        score = Math.max(0, Math.min(100, score));

        // Render Health Card
        const scoreEl = document.getElementById('wiz-health-score');
        const scoreCircle = document.getElementById('wiz-health-score-circle');
        const scoreBar = document.getElementById('wiz-health-score-bar');
        const statusTitle = document.getElementById('wiz-health-status-title');
        const warningsBadge = document.getElementById('wiz-health-warnings-badge');
        const healthCard = document.getElementById('card-scenario-health');

        if (scoreEl) scoreEl.textContent = score;

        let statusText = "Excellent";
        let color = "#10B981"; // emerald
        let bgLight = "rgba(16, 185, 129, 0.02)";
        let borderCol = "rgba(16, 185, 129, 0.08)";
        if (score < 50) {
            statusText = "Poor";
            color = "#EF4444"; // red
            bgLight = "rgba(239, 68, 68, 0.03)";
            borderCol = "rgba(239, 68, 68, 0.15)";
        } else if (score < 70) {
            statusText = "Fair";
            color = "#F59E0B"; // amber
            bgLight = "rgba(245, 158, 11, 0.03)";
            borderCol = "rgba(245, 158, 11, 0.15)";
        } else if (score < 90) {
            statusText = "Good";
            color = "#3B82F6"; // blue
            bgLight = "rgba(59, 130, 246, 0.03)";
            borderCol = "rgba(59, 130, 246, 0.15)";
        }

        if (statusTitle) statusTitle.textContent = `Status: ${statusText}`;
        if (scoreCircle) {
            scoreCircle.style.borderColor = color;
            scoreCircle.style.color = color;
        }
        if (scoreEl) scoreEl.style.color = color;
        if (scoreBar) {
            scoreBar.style.width = `${score}%`;
            scoreBar.style.backgroundColor = color;
        }
        if (warningsBadge) {
            warningsBadge.textContent = `${warnings.length} Warning${warnings.length !== 1 ? 's' : ''}`;
            warningsBadge.style.backgroundColor = color;
        }
        if (healthCard) {
            healthCard.style.backgroundColor = bgLight;
            healthCard.style.borderColor = borderCol;
        }

        // Render Health Breakdown list
        const breakdownListEl = document.getElementById('wiz-health-breakdown-list');
        if (breakdownListEl) {
            breakdownListEl.innerHTML = scoreBreakdown.map(item => {
                const isPositive = item.val >= 0;
                const itemColor = isPositive ? '#34D399' : '#F87171';
                const prefix = isPositive ? '+' : '';
                return `<li style="color: ${itemColor}; display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
                    <span>${item.text}</span>
                    <span>${prefix}${item.val}</span>
                </li>`;
            }).join('') + `
            <li style="border-top: 1px dashed rgba(255,255,255,0.15); margin-top: 0.4rem; padding-top: 0.4rem; font-weight: bold; color: var(--text-main); display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span>Final Score</span>
                <span style="color: ${color}">${score}</span>
            </li>`;
        }

        // Disable / Enable Wizard Generate Button if there are critical errors
        const genBtn = document.getElementById('btn-wizard-generate');
        if (genBtn) {
            genBtn.disabled = hasErrors;
            if (hasErrors) {
                genBtn.style.opacity = "0.5";
                genBtn.style.cursor = "not-allowed";
                genBtn.title = "Resolve validation errors before generating scenario.";
            } else {
                genBtn.style.opacity = "";
                genBtn.style.cursor = "";
                genBtn.title = "";
            }
        }

        // Epic 2: Scenario Complexity Score Breakdown
        let compBreakdown = [];
        if (activeWizProtocol === 'HTTP') {
            compBreakdown.push({ val: 5, text: "Protocol HTTP" });
        } else if (activeWizProtocol === 'Browser') {
            compBreakdown.push({ val: 15, text: "Protocol Browser (CDP)" });
        } else if (activeWizProtocol === 'Kafka') {
            compBreakdown.push({ val: 10, text: "Protocol Kafka Broker" });
        } else if (activeWizProtocol === 'Database') {
            compBreakdown.push({ val: 10, text: "Protocol Database Query" });
        }

        if (activeWizProtocol === 'HTTP') {
            const method = document.getElementById('wiz-http-method')?.value || 'GET';
            if (method !== 'GET') {
                compBreakdown.push({ val: 5, text: `${method} Payload` });
            }
        }

        if (authType !== 'none') {
            compBreakdown.push({ val: 5, text: "Authentication" });
        }

        if (uploadedCsvData) {
            compBreakdown.push({ val: 5, text: "Data Driven CSV Source" });
        }

        if (vus > 500) {
            compBreakdown.push({ val: 25, text: `${vus} Concurrent Users` });
        } else if (vus > 200) {
            compBreakdown.push({ val: 15, text: `${vus} Concurrent Users` });
        } else if (vus > 75) {
            compBreakdown.push({ val: 10, text: `${vus} Concurrent Users` });
        } else if (vus > 0) {
            compBreakdown.push({ val: 5, text: `${vus} Concurrent Users` });
        }

        if (metaEnv || metaVersion) {
            compBreakdown.push({ val: 4, text: "Metadata" });
        }

        const complexityScore = compBreakdown.reduce((sum, item) => sum + item.val, 0);
        const cappedComplexityScore = Math.min(100, complexityScore);

        let complexityLevel = "LOW";
        let complexityColor = "#10B981"; // emerald
        if (cappedComplexityScore >= 40) {
            complexityLevel = "HIGH";
            complexityColor = "#EF4444"; // red
        } else if (cappedComplexityScore >= 20) {
            complexityLevel = "MEDIUM";
            complexityColor = "#F59E0B"; // amber
        }

        const compScoreEl = document.getElementById('wiz-complexity-score');
        const compLevelEl = document.getElementById('wiz-complexity-level');
        const compCard = document.getElementById('card-scenario-complexity');
        if (compScoreEl) compScoreEl.textContent = cappedComplexityScore;
        if (compLevelEl) {
            compLevelEl.textContent = complexityLevel;
            compLevelEl.style.color = complexityColor;
        }
        if (compCard) {
            compCard.style.borderColor = complexityColor + "33"; // 20% alpha
        }

        // Render Complexity Breakdown list
        const compBreakdownListEl = document.getElementById('wiz-complexity-breakdown-list');
        if (compBreakdownListEl) {
            compBreakdownListEl.innerHTML = compBreakdown.map(item => `
                <li style="color: var(--text-muted); display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
                    <span>${item.text}</span>
                    <span style="color: #C084FC;">+${item.val}</span>
                </li>
            `).join('') + `
            <li style="border-top: 1px dashed rgba(255,255,255,0.15); margin-top: 0.4rem; padding-top: 0.4rem; font-weight: bold; color: var(--text-main); display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span>Total Index</span>
                <span style="color: ${complexityColor}">${cappedComplexityScore}</span>
            </li>`;
        }

        // Epic 6: Scenario Risk Analyzer
        const risksListEl = document.getElementById('wiz-risks-list');
        const risksCard = document.getElementById('card-scenario-risks');
        if (risksListEl) {
            if (risks.length === 0) {
                risksListEl.innerHTML = '<li style="color: #34D399; list-style-type: none; margin-left: -1.2rem;">✓ No performance risks detected</li>';
                if (risksCard) risksCard.classList.add('hide');
            } else {
                risksListEl.innerHTML = risks.map(r => `<li style="margin-bottom: 0.25rem;">⚠️ ${r}</li>`).join('');
                if (risksCard) risksCard.classList.remove('hide');
            }
        }

        // Epic 5: Capacity Forecast & Formulas
        let ramFormulaText = "";
        let rpsFormulaText = "";
        const estMemGB = activeWizProtocol === 'Browser' ? (vus * 400 / 1024) : (vus * 25 / 1024);
        
        // Safety margin of 25% to prevent OOM
        const requiredRAM = estMemGB * 1.25;
        
        // Standard RAM size selection
        let recommendedRAMVal = 1;
        const standardRAMSizes = [1, 2, 4, 8, 16, 32, 64, 128];
        for (const size of standardRAMSizes) {
            if (size >= requiredRAM) {
                recommendedRAMVal = size;
                break;
            }
            recommendedRAMVal = size;
        }
        if (activeWizProtocol === 'Browser' && recommendedRAMVal < 2) {
            recommendedRAMVal = 2;
        }

        // Map recommended RAM to appropriate CPU cores
        let recommendedCPUs = 1;
        if (recommendedRAMVal === 2) recommendedCPUs = 1;
        else if (recommendedRAMVal === 4) recommendedCPUs = 2;
        else if (recommendedRAMVal === 8) recommendedCPUs = 4;
        else if (recommendedRAMVal === 16) recommendedCPUs = 8;
        else if (recommendedRAMVal === 32) recommendedCPUs = 16;
        else if (recommendedRAMVal >= 64) recommendedCPUs = 32;

        const recCpuRam = `${recommendedCPUs} CPU / ${recommendedRAMVal} GB RAM`;

        if (activeWizProtocol === 'Browser') {
            ramFormulaText = `${vus} VU * 400 MB = ${(vus * 400).toLocaleString()} MB RAM`;
        } else {
            ramFormulaText = `${vus} VU * 25 MB = ${(vus * 25).toLocaleString()} MB RAM`;
        }

        const pacingSec = pacing / 1000;
        rpsFormulaText = `${vus} VU / ${pacingSec} sec = ${estPeakRPS} RPS`;

        // Update forecast elements
        const recEngineEl = document.getElementById('rec-engine-capacity');
        const recPeakRpsEl = document.getElementById('rec-peak-rps');
        if (recEngineEl) recEngineEl.textContent = recCpuRam;
        if (recPeakRpsEl) recPeakRpsEl.textContent = `~${estPeakRPS.toLocaleString()} RPS`;

        // Render Capacity Forecast explanation inside Pre-Deployment Report
        const forecastDetailEl = document.getElementById('summary-forecast-detail');
        if (forecastDetailEl) {
            const multiplier = activeWizProtocol === 'Browser' ? '400 MB' : '25 MB';
            const ramVal = activeWizProtocol === 'Browser' ? (vus * 400 / 1024).toFixed(1) + ' GB' : (vus * 25 / 1024).toFixed(1) + ' GB';
            forecastDetailEl.innerHTML = `Target VU : ${vus} \nThink Time : ${pacing} ms \nPredicted Peak RPS: ${vus} / ${pacingSec} sec = ${estPeakRPS} RPS \nEngine Recommendation: ${vus} VU × ${multiplier} ≈ ${ramVal} \nRAM Recommended: ${recCpuRam}`;
        }

        // Epic 7: Suggested Templates List
        const suggestedListEl = document.getElementById('wiz-suggested-templates-list');
        if (suggestedListEl) {
            const suggestions = getSuggestedTemplates(activeWizProtocol, httpMethod, authType, activeWizTestType);
            if (suggestions.length === 0) {
                suggestedListEl.innerHTML = '<li style="list-style-type: none; margin-left: -1.2rem; color: var(--text-muted);">No suggestions matching configurations</li>';
            } else {
                suggestedListEl.innerHTML = suggestions.map(t => `
                    <li style="margin-bottom: 0.3rem; list-style-type: none; margin-left: -1.2rem;">
                        <span class="badge badge-purple" style="cursor: pointer; padding: 0.2rem 0.5rem; border: 1px solid rgba(139, 92, 246, 0.4);" data-template-id="${t.id}">✦ ${t.name}</span>
                    </li>
                `).join('');
                suggestedListEl.querySelectorAll('[data-template-id]').forEach(el => {
                    el.addEventListener('click', () => {
                        const tid = el.getAttribute('data-template-id');
                        if (wizTemplate) {
                            wizTemplate.value = tid;
                            wizTemplate.dispatchEvent(new Event('change'));
                        }
                    });
                });
            }
        }

        // Epic 8: Pre-deployment Report Panel updates
        const sumProto = document.getElementById('summary-proto');
        const sumMethod = document.getElementById('summary-method');
        const sumTarget = document.getElementById('summary-target');
        const sumAuth = document.getElementById('summary-auth');
        const sumDatasource = document.getElementById('summary-datasource');
        const sumTestType = document.getElementById('summary-testtype');
        const sumVus = document.getElementById('summary-vus');
        const sumDuration = document.getElementById('summary-duration');
        
        const sumHealthScore = document.getElementById('summary-health');
        const sumComplexityLevel = document.getElementById('summary-complexity');
        const sumDeployStatus = document.getElementById('summary-deploy-status');
        const sumRiskText = document.getElementById('summary-risk-text');

        if (sumProto) sumProto.textContent = activeWizProtocol;
        if (sumMethod) sumMethod.textContent = activeWizProtocol === 'HTTP' ? httpMethod : "-";
        if (sumTarget) sumTarget.textContent = targetUrl;
        if (sumAuth) sumAuth.textContent = authType.toUpperCase();
        if (sumDatasource) sumDatasource.textContent = uploadedCsvData ? uploadedCsvData.fileName : "None";
        if (sumTestType) sumTestType.textContent = activeWizTestType;
        if (sumVus) sumVus.textContent = `${vus} VUs`;
        if (sumDuration) sumDuration.textContent = `${dur} sec (${durUnit === 'min' ? durInput + 'm' : durInput + 's'})`;
        
        if (sumHealthScore) {
            sumHealthScore.textContent = `${score} (${statusText})`;
            sumHealthScore.style.color = color;
        }
        if (sumComplexityLevel) {
            sumComplexityLevel.textContent = `${cappedComplexityScore} (${complexityLevel})`;
            sumComplexityLevel.style.color = complexityColor;
        }

        // Determine Pre-Deployment Gate Status
        let deployStatusText = "READY";
        let deployStatusColor = "#10B981"; // green
        
        let blockingReasonsList = [];
        if (hasErrors) {
            deployStatusText = "BLOCKED";
            deployStatusColor = "#EF4444"; // red
            if (!targetUrl || targetUrl === "-") blockingReasonsList.push("Target URL is missing");
            if (activeWizProtocol === 'HTTP' && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) blockingReasonsList.push("Invalid URL format");
            if (activeWizProtocol === 'Browser' && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) blockingReasonsList.push("Invalid Browser target URL format");
            if (vus <= 0) blockingReasonsList.push("Virtual User count must be greater than 0");
            if (dur <= 0) blockingReasonsList.push("Duration must be greater than 0");
            if (dur < ramp) blockingReasonsList.push("Duration cannot be less than Ramp Up time");
            if (!authValid) blockingReasonsList.push("Missing required fields for authentication configuration");
            if (csvStrategy !== 'sequential' && !uploadedCsvData) blockingReasonsList.push("CSV strategy configured but no CSV dataset loaded");
        } else if (warnings.length > 0 || score < 80) {
            if (score < 60) {
                deployStatusText = "BLOCKED";
                deployStatusColor = "#EF4444";
                blockingReasonsList.push(`Health score (${score}) is below deployment threshold (60)`);
            } else {
                deployStatusText = "READY WITH WARNING";
                deployStatusColor = "#F59E0B"; // amber
            }
        }

        // Update pre-run readiness gate elements
        const readStatusBadge = document.getElementById('readiness-status-badge');
        const readBlockingDiv = document.getElementById('readiness-blocking-reasons');
        const readBlockingUl = document.getElementById('readiness-blocking-list');

        if (readStatusBadge) {
            readStatusBadge.textContent = deployStatusText;
            readStatusBadge.style.backgroundColor = deployStatusColor;
        }
        if (sumDeployStatus) {
            sumDeployStatus.textContent = deployStatusText;
            sumDeployStatus.style.backgroundColor = deployStatusColor;
        }

        if (deployStatusText === "BLOCKED") {
            btnStart.disabled = true;
            btnStart.style.opacity = '0.5';
            btnStart.style.pointerEvents = 'none';
            if (readBlockingDiv) readBlockingDiv.classList.remove('hide');
            if (readBlockingUl) {
                readBlockingUl.innerHTML = blockingReasonsList.map(r => `<li>${r}</li>`).join('');
            }
        } else {
            btnStart.disabled = false;
            btnStart.style.opacity = '';
            btnStart.style.pointerEvents = '';
            if (readBlockingDiv) readBlockingDiv.classList.add('hide');
        }

        if (sumRiskText) {
            if (risks.length === 0) {
                sumRiskText.innerHTML = '<span style="color: #34D399;">✓ No major performance risks identified</span>';
            } else {
                sumRiskText.innerHTML = `<ul style="margin: 0; padding-left: 1rem; color: #FCA5A5;">
                    ${risks.map(r => `<li>${r}</li>`).join('')}
                </ul>`;
            }
        }
    }

    // Capture input updates for all inputs
    document.querySelectorAll('.wizard-input-field').forEach(el => {
        el.addEventListener('input', updatePreview);
        el.addEventListener('change', updatePreview);
    });
    groupWizProtocol.addEventListener('click', updatePreview);
    groupWizType.addEventListener('click', updatePreview);
    
    // Initial preview render
    updatePreview();

    btnWizGenerate.addEventListener('click', async () => {
        const scenName = document.getElementById('wiz-scenario-name').value || `Wizard ${activeWizProtocol} ${activeWizTestType} Test`;
        const vus = parseInt(document.getElementById('wiz-vus').value) || 10;
        const durInput = parseInt(document.getElementById('wiz-duration').value) || 15;
        const durUnit = document.getElementById('wiz-duration-unit').value;
        const duration = durUnit === 'min' ? durInput * 60 : durInput;
        const rampUp = parseInt(document.getElementById('wiz-ramp-up').value) || 3;
        const pacing = parseInt(document.getElementById('wiz-pacing').value) || 100;

        const configObj = {};
        if (activeWizProtocol === 'HTTP') {
            configObj.method = document.getElementById('wiz-http-method').value;
            configObj.url = document.getElementById('wiz-http-url').value;
            
            // Parse headers
            const headersVal = document.getElementById('wiz-http-headers').value.trim();
            if (headersVal) {
                try {
                    configObj.headers = JSON.parse(headersVal);
                } catch (e) {
                    alert("Headers must be valid JSON format: " + e.message);
                    return;
                }
            } else {
                configObj.headers = { "User-Agent": "Vuelitycs-Platform/2.0" };
            }

            // Message Body
            const bodyVal = document.getElementById('wiz-http-body').value.trim();
            if (bodyVal) {
                configObj.body = bodyVal;
            }
        } else if (activeWizProtocol === 'Browser') {
            configObj.url = document.getElementById('wiz-browser-url').value;
            configObj.timeout_ms = 15000;
        } else if (activeWizProtocol === 'Kafka') {
            configObj.brokers = document.getElementById('wiz-kafka-brokers').value;
            configObj.topic = document.getElementById('wiz-kafka-topic').value;
        } else if (activeWizProtocol === 'Database') {
            configObj.driver = document.getElementById('wiz-db-driver').value;
            configObj.dsn = document.getElementById('wiz-db-dsn').value;
            configObj.query = document.getElementById('wiz-db-query').value;
        }

        // Epic 2: SLA Configuration
        const p95 = document.getElementById('wiz-sla-p95').value;
        const p99 = document.getElementById('wiz-sla-p99').value;
        const errRate = document.getElementById('wiz-sla-error').value;
        const minRps = document.getElementById('wiz-sla-rps').value;
        
        const slas = {};
        if (p95) slas.p95_latency_ms = parseFloat(p95);
        if (p99) slas.p99_latency_ms = parseFloat(p99);
        if (errRate) slas.max_error_rate = parseFloat(errRate);
        if (minRps) slas.min_throughput = parseFloat(minRps);

        // Epic 8: Release Metadata
        const metadata = {
            environment: document.getElementById('wiz-meta-env')?.value || "",
            app_version: document.getElementById('wiz-meta-version')?.value || "",
            release_tag: document.getElementById('wiz-meta-tag')?.value || "",
            build_number: document.getElementById('wiz-meta-build')?.value || "",
            executed_by: document.getElementById('wiz-meta-user')?.value || "",
            notes: document.getElementById('wiz-meta-notes')?.value || ""
        };

        // Epic 2: Authentication Builder
        let authObj = null;
        const authType = document.getElementById('wiz-auth-type')?.value || 'none';
        if (authType !== 'none') {
            authObj = { type: authType };
            if (authType === 'basic') {
                authObj.username = document.getElementById('wiz-auth-basic-user').value;
                authObj.password = document.getElementById('wiz-auth-basic-pass').value; // Masked in input
            } else if (authType === 'bearer') {
                authObj.token = document.getElementById('wiz-auth-bearer-token').value; // Masked in input
            } else if (authType === 'apikey') {
                authObj.header_name = document.getElementById('wiz-auth-apikey-name').value;
                authObj.key_value = document.getElementById('wiz-auth-apikey-value').value; // Masked in input
            } else if (authType === 'oauth2') {
                authObj.token_url = document.getElementById('wiz-auth-oauth-url').value;
                authObj.client_id = document.getElementById('wiz-auth-oauth-id').value;
                authObj.client_secret = document.getElementById('wiz-auth-oauth-secret').value; // Masked in input
                authObj.scope = document.getElementById('wiz-auth-oauth-scope').value;
            }
        }

        // Epic 3: CSV Data Source
        let dsObj = null;
        if (uploadedCsvData) {
            const mappingObj = {};
            uploadedCsvData.variables.forEach(v => {
                mappingObj[v] = `{{${v}}}`;
            });
            dsObj = {
                type: "csv",
                file_name: uploadedCsvData.fileName,
                strategy: document.getElementById('wiz-csv-strategy').value,
                mapping: mappingObj
            };
        }

        const payload = {
            name: scenName,
            protocol: activeWizProtocol,
            test_type: activeWizTestType,
            vus: vus,
            duration_seconds: duration,
            ramp_up_seconds: rampUp,
            pacing_ms: pacing,
            slas: Object.keys(slas).length > 0 ? slas : undefined,
            metadata: metadata,
            auth: authObj || undefined,
            data_source: dsObj || undefined,
            config: configObj
        };

        try {
            const resp = await fetch('/api/wizard/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const scen = await resp.json();
            if (resp.ok) {
                // Clone and mask credentials in displayed/exported DSL Editor
                const displayScen = JSON.parse(JSON.stringify(scen));
                if (displayScen.auth) {
                    if (displayScen.auth.password) displayScen.auth.password = "********";
                    if (displayScen.auth.token) displayScen.auth.token = "********";
                    if (displayScen.auth.key_value) displayScen.auth.key_value = "********";
                    if (displayScen.auth.client_secret) displayScen.auth.client_secret = "********";
                }
                lastDslContent = txtDsl.value; // Store previous value as baseline for Diff Comparison
                txtDsl.value = JSON.stringify(displayScen, null, 2);
                runReadinessCheck(); // Update Pre-Run Readiness Checks
                appendTerminalLine(`Generated scenario config using Wizard and loaded to editor.`, 'system-msg');
                const specCard = document.querySelector('.config-card');
                if (specCard) {
                    specCard.classList.remove('flash-highlight');
                    void specCard.offsetWidth;
                    specCard.classList.add('flash-highlight');
                }
            } else {
                alert("Failed to generate: " + scen.error);
            }
        } catch (err) {
            console.error("Wizard generation error:", err);
            alert("Wizard generation connection error: " + err.message);
        }
    });

    // Epic 5: Recommendation Engine Logic
    window.generateRecommendations = function() {
        const safeVU = parseInt(lblCapacitySafe.textContent) || 0;
        const critVU = parseInt(lblCapacityCritical.textContent) || 0;
        const inflectionVU = parseInt(lblCapacityInflection.textContent) || 0;
        const errRateStr = lblErrorRate.textContent || "0%";
        const errRate = parseFloat(errRateStr) || 0;
        
        const list = document.getElementById('recommendation-list');
        const card = document.getElementById('card-recommendation');
        if (!list || !card) return;
        
        list.innerHTML = "";
        let recs = [];
        
        if (errRate > 5) {
            recs.push(`<li><strong style="color: #EF4444;">High Error Rate:</strong> System experienced ${errRateStr} errors. Consider inspecting backend logs or scaling compute resources. Next step: Run a lower Volume test to isolate error triggers.</li>`);
        }
        
        if (inflectionVU > 0) {
            recs.push(`<li><strong style="color: #F59E0B;">Latency Inflection:</strong> Latency degraded significantly at <strong>${inflectionVU} VUs</strong>. This is your primary bottleneck threshold.</li>`);
        }
        
        if (critVU > 0 && critVU < currentTargetVUs) {
            recs.push(`<li><strong style="color: #EF4444;">Capacity Exceeded:</strong> Target workload (${currentTargetVUs} VUs) exceeded critical capacity (${critVU} VUs). System was saturated. Recommend setting Max VUs to ${safeVU} in production.</li>`);
        } else if (safeVU > 0) {
            recs.push(`<li><strong style="color: #10B981;">Safe Operating Limit:</strong> System performs comfortably at <strong>${safeVU} VUs</strong>. This is the recommended baseline capacity.</li>`);
        }
        
        if (recs.length === 0) {
            recs.push(`<li><strong style="color: #3B82F6;">Stable Workload:</strong> No major bottlenecks detected. System successfully handled the target workload. Recommend increasing VUs by 25% for the next Stress Test.</li>`);
        }
        
        list.innerHTML = recs.join("");
        card.classList.remove('hide');
        list.innerHTML = recs.join("");
        card.classList.remove('hide');
    };

    // Epic 6 & 7: Scenario Management & Versioning
    const btnScenSave = document.getElementById('btn-scen-save');
    const btnScenLoad = document.getElementById('btn-scen-load');
    const btnScenDuplicate = document.getElementById('btn-scen-duplicate');
    const selectSavedScen = document.getElementById('select-saved-scenarios');
    
    let savedScenariosData = [];

    async function fetchScenarios() {
        if (!selectSavedScen) return;
        try {
            const resp = await fetch('/api/scenarios');
            if (resp.ok) {
                savedScenariosData = await resp.json();
                selectSavedScen.innerHTML = '<option value="">-- Select Saved Scenario --</option>';
                if (savedScenariosData) {
                    savedScenariosData.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.id;
                        opt.textContent = `${s.name} (${new Date(s.updated_at).toLocaleString()})`;
                        selectSavedScen.appendChild(opt);
                    });
                }
            }
        } catch (e) { console.error("Failed to fetch scenarios", e); }
    }

    let lastDslContent = txtDsl.value;

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function computeLineDiff(oldText, newText) {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        let html = '';
        const maxLen = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLen; i++) {
            const o = oldLines[i];
            const n = newLines[i];
            if (o === undefined) {
                html += `<div style="background: rgba(16, 185, 129, 0.15); color: #34D399; padding: 0.1rem 0.2rem;">+ ${escapeHtml(n)}</div>`;
            } else if (n === undefined) {
                html += `<div style="background: rgba(239, 68, 68, 0.15); color: #F87171; padding: 0.1rem 0.2rem;">- ${escapeHtml(o)}</div>`;
            } else if (o !== n) {
                html += `<div style="background: rgba(239, 68, 68, 0.15); color: #F87171; padding: 0.1rem 0.2rem;">- ${escapeHtml(o)}</div>`;
                html += `<div style="background: rgba(16, 185, 129, 0.15); color: #34D399; padding: 0.1rem 0.2rem;">+ ${escapeHtml(n)}</div>`;
            } else {
                html += `<div style="color: #9CA3AF; padding: 0.1rem 0.2rem;">  ${escapeHtml(n)}</div>`;
            }
        }
        return `<pre style="font-family: monospace; white-space: pre-wrap; margin: 0; line-height: 1.4; color: #D1D5DB;">${html}</pre>`;
    }

    function runReadinessCheck() {
        const dslText = txtDsl.value;
        let parsed = null;
        let jsonError = null;
        try {
            parsed = JSON.parse(dslText);
        } catch (e) {
            jsonError = e.message;
        }

        const checkDsl = document.getElementById('check-dsl');
        const checkUrl = document.getElementById('check-url');
        const checkAuth = document.getElementById('check-auth');
        const checkCsv = document.getElementById('check-csv');
        const checkThreshold = document.getElementById('check-threshold');
        const readinessStatus = document.getElementById('readiness-status-badge');
        const readBlockingDiv = document.getElementById('readiness-blocking-reasons');
        const readBlockingUl = document.getElementById('readiness-blocking-list');
        const sumDeployStatus = document.getElementById('summary-deploy-status');

        let blockingReasons = [];
        let warnings = [];

        // 1. DSL Syntax Check
        if (jsonError) {
            blockingReasons.push("DSL JSON parsing error: " + jsonError);
            if (checkDsl) {
                checkDsl.style.color = '#EF4444';
                checkDsl.innerHTML = `<span class="icon">✗</span> DSL Syntax Invalid: ${jsonError}`;
            }
            if (checkUrl) { checkUrl.style.color = '#EF4444'; checkUrl.innerHTML = `<span class="icon">✗</span> URL Check (Requires valid JSON)`; }
            if (checkAuth) { checkAuth.style.color = '#EF4444'; checkAuth.innerHTML = `<span class="icon">✗</span> Authentication Check (Requires valid JSON)`; }
            if (checkCsv) { checkCsv.style.color = '#EF4444'; checkCsv.innerHTML = `<span class="icon">✗</span> CSV Check (Requires valid JSON)`; }
            if (checkThreshold) { checkThreshold.style.color = '#EF4444'; checkThreshold.innerHTML = `<span class="icon">✗</span> Threshold Check (Requires valid JSON)`; }
            
            if (readinessStatus) {
                readinessStatus.textContent = 'BLOCKED';
                readinessStatus.style.backgroundColor = '#EF4444';
            }
            if (sumDeployStatus) {
                sumDeployStatus.textContent = 'BLOCKED';
                sumDeployStatus.style.backgroundColor = '#EF4444';
            }
            btnStart.disabled = true;
            btnStart.style.opacity = '0.5';
            btnStart.style.pointerEvents = 'none';
            if (readBlockingDiv) readBlockingDiv.classList.remove('hide');
            if (readBlockingUl) {
                readBlockingUl.innerHTML = `<li>DSL syntax invalid: ${jsonError}</li>`;
            }
            return;
        }

        // JSON is valid
        if (checkDsl) {
            checkDsl.style.color = '#10B981';
            checkDsl.innerHTML = `<span class="icon">✓</span> DSL Syntax Valid`;
        }

        // 2. URL validation
        let urlOk = true;
        const protocol = parsed.protocol || '';
        const config = parsed.config || {};
        let targetUrl = '';
        if (protocol === 'HTTP' || protocol === 'Browser') {
            targetUrl = config.url || '';
            if (!targetUrl) {
                urlOk = false;
                blockingReasons.push(`${protocol} Target URL is empty`);
            } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                urlOk = false;
                blockingReasons.push(`${protocol} Target URL missing http:// or https:// scheme`);
            }
        } else if (protocol === 'Kafka') {
            targetUrl = config.brokers || '';
            if (!targetUrl) {
                urlOk = false;
                blockingReasons.push("Kafka brokers list is empty");
            }
        } else if (protocol === 'Database') {
            targetUrl = config.dsn || '';
            if (!targetUrl) {
                urlOk = false;
                blockingReasons.push("Database DSN is empty");
            }
        } else {
            blockingReasons.push("Invalid or missing Protocol in DSL");
            urlOk = false;
        }

        if (urlOk) {
            if (checkUrl) {
                checkUrl.style.color = '#10B981';
                checkUrl.innerHTML = `<span class="icon">✓</span> URL Scheme & Format Valid`;
            }
        } else {
            if (checkUrl) {
                checkUrl.style.color = '#EF4444';
                checkUrl.innerHTML = `<span class="icon">✗</span> URL Scheme & Format Invalid`;
            }
        }

        // 3. Authentication validation
        let authOk = true;
        let authType = 'none';
        if (parsed.auth && parsed.auth.type && parsed.auth.type !== 'none') {
            authType = parsed.auth.type;
            const auth = parsed.auth;
            if (auth.type === 'basic' && (!auth.username || !auth.password)) authOk = false;
            else if (auth.type === 'bearer' && !auth.token) authOk = false;
            else if (auth.type === 'apikey' && (!auth.header_name || !auth.key_value)) authOk = false;
            else if (auth.type === 'oauth2' && (!auth.token_url || !auth.client_id || !auth.client_secret)) authOk = false;
        }
        if (authOk) {
            if (checkAuth) {
                checkAuth.style.color = '#10B981';
                checkAuth.innerHTML = `<span class="icon">✓</span> Authentication Valid (${authType.toUpperCase()})`;
            }
        } else {
            blockingReasons.push(`Authentication credentials incomplete for type ${authType}`);
            if (checkAuth) {
                checkAuth.style.color = '#EF4444';
                checkAuth.innerHTML = `<span class="icon">✗</span> Authentication Incomplete`;
            }
        }

        // 4. CSV validation
        let csvOk = true;
        let csvRequired = false;
        if (parsed.data_source && parsed.data_source.type === 'csv') {
            csvRequired = true;
            const fileName = parsed.data_source.file_name || '';
            if (!uploadedCsvData || uploadedCsvData.fileName !== fileName) {
                csvOk = false;
                blockingReasons.push(`Required CSV dataset "${fileName}" not loaded`);
            }
        }
        if (csvOk) {
            if (checkCsv) {
                checkCsv.style.color = '#10B981';
                checkCsv.innerHTML = `<span class="icon">✓</span> CSV Data Source Ready ${csvRequired ? `(${parsed.data_source.file_name})` : '(None Required)'}`;
            }
        } else {
            if (checkCsv) {
                checkCsv.style.color = '#EF4444';
                checkCsv.innerHTML = `<span class="icon">✗</span> CSV Dataset Not Loaded`;
            }
        }

        // 5. Threshold validation
        let threshOk = true;
        let hasSlas = false;
        if (parsed.slas) {
            hasSlas = true;
            const p95 = parsed.slas.p95_latency_ms;
            const p99 = parsed.slas.p99_latency_ms;
            if (p95 !== undefined && p99 !== undefined && parseFloat(p95) >= parseFloat(p99)) {
                threshOk = false;
                blockingReasons.push("SLA Target Conflict: P95 must be less than P99 latency");
            }
        }
        if (threshOk) {
            if (checkThreshold) {
                checkThreshold.style.color = hasSlas ? '#10B981' : '#F59E0B';
                checkThreshold.innerHTML = hasSlas ? `<span class="icon">✓</span> Threshold Valid (P95 < P99)` : `<span class="icon">⚠</span> SLA Thresholds Missing`;
            }
            if (!hasSlas) {
                warnings.push("SLA Thresholds Missing");
            }
        } else {
            if (checkThreshold) {
                checkThreshold.style.color = '#EF4444';
                checkThreshold.innerHTML = `<span class="icon">✗</span> Threshold Invalid (P95 >= P99)`;
            }
        }


        // Workload validation rules (VU > 0, Duration >= Ramp)
        const vus = parsed.vus !== undefined ? parseInt(parsed.vus) : 0;
        const dur = parsed.duration_seconds !== undefined ? parseInt(parsed.duration_seconds) : 0;
        const ramp = parsed.ramp_up_seconds !== undefined ? parseInt(parsed.ramp_up_seconds) : 0;
        if (vus <= 0) {
            blockingReasons.push("Virtual User (VU) count must be greater than 0");
        }
        if (dur <= 0) {
            blockingReasons.push("Duration must be greater than 0");
        } else if (dur < ramp) {
            blockingReasons.push("Duration cannot be less than Ramp Up time");
        }

        // Compute Health Score for this parsed DSL!
        let scoreBreakdown = [];
        // Target Config
        if (urlOk) scoreBreakdown.push({ val: 20, text: "URL Valid" });
        else scoreBreakdown.push({ val: -20, text: "URL Invalid" });

        // Auth
        if (authOk) scoreBreakdown.push({ val: 20, text: "Authentication Valid" });
        else scoreBreakdown.push({ val: -20, text: "Authentication Incomplete" });

        // Workload
        if (vus > 0 && dur >= ramp) scoreBreakdown.push({ val: 20, text: "Workload Configured" });
        else scoreBreakdown.push({ val: -20, text: "Workload Invalid" });

        // Metadata: Optional, not added to health assessment score breakdown


        // SLAs
        if (hasSlas) {
            if (threshOk) scoreBreakdown.push({ val: 20, text: "SLA Thresholds Present" });
            else scoreBreakdown.push({ val: -15, text: "SLA Threshold conflict" });
        } else {
            scoreBreakdown.push({ val: -10, text: "SLA Thresholds Missing" });
        }

        // Risks/Warnings checks on parsed DSL
        if (dur > 0) {
            if (parsed.test_type === 'LOAD' && dur < 300) {
                warnings.push("Duration < 300s");
                scoreBreakdown.push({ val: -15, text: "Duration < 300 sec" });
            } else if (parsed.test_type === 'SOAK' && dur < 3600) {
                warnings.push("Duration too short (< 3600s)");
                scoreBreakdown.push({ val: -15, text: "Duration too short (< 3600s)" });
            }
        }
        if (ramp <= 0) {
            warnings.push("Missing ramp-up period");
            scoreBreakdown.push({ val: -10, text: "Missing ramp-up period" });
        } else if (parsed.test_type === 'LOAD' && ramp < (0.10 * dur)) {
            warnings.push("Aggressive workload ramp-up");
            scoreBreakdown.push({ val: -15, text: "Aggressive workload ramp-up" });
        }
        if (protocol === 'HTTP' && targetUrl.startsWith('http://')) {
            warnings.push("Insecure target URL");
            scoreBreakdown.push({ val: -10, text: "Insecure target URL" });
        }
        if (protocol === 'Browser' && vus > 10) {
            warnings.push("Browser VUs too high");
            scoreBreakdown.push({ val: -15, text: "Browser VUs too high" });
        } else if (vus > 200) {
            warnings.push("High user volume load");
            scoreBreakdown.push({ val: -10, text: "High user volume load" });
        }

        let score = scoreBreakdown.reduce((sum, item) => sum + item.val, 0);
        score = Math.max(0, Math.min(100, score));

        // Gate Status Calculation
        let status = "READY";
        let statusColor = "#10B981"; // green

        if (blockingReasons.length > 0) {
            status = "BLOCKED";
            statusColor = "#EF4444"; // red
        } else if (warnings.length > 0 || score < 80) {
            if (score < 60) {
                status = "BLOCKED";
                statusColor = "#EF4444";
                blockingReasons.push(`Health score (${score}) is below deployment threshold (60)`);
            } else {
                status = "READY WITH WARNING";
                statusColor = "#F59E0B"; // amber
            }
        }

        if (readinessStatus) {
            readinessStatus.textContent = status;
            readinessStatus.style.backgroundColor = statusColor;
        }
        if (sumDeployStatus) {
            sumDeployStatus.textContent = status;
            sumDeployStatus.style.backgroundColor = statusColor;
        }

        if (status === "BLOCKED") {
            btnStart.disabled = true;
            btnStart.style.opacity = '0.5';
            btnStart.style.pointerEvents = 'none';
            if (readBlockingDiv) readBlockingDiv.classList.remove('hide');
            if (readBlockingUl) {
                readBlockingUl.innerHTML = blockingReasons.map(r => `<li>${r}</li>`).join('');
            }
        } else {
            btnStart.disabled = false;
            btnStart.style.opacity = '';
            btnStart.style.pointerEvents = '';
            if (readBlockingDiv) readBlockingDiv.classList.add('hide');
        }
    }

    if (txtDsl) {
        txtDsl.addEventListener('input', runReadinessCheck);
        txtDsl.addEventListener('change', runReadinessCheck);
    }

    const btnCompare = document.getElementById('btn-scen-compare');
    const diffPanel = document.getElementById('dsl-diff-panel');
    const diffContent = document.getElementById('dsl-diff-content');
    const btnCloseDiff = document.getElementById('btn-close-diff');

    if (btnCompare) {
        btnCompare.addEventListener('click', () => {
            const currentDsl = txtDsl.value;
            const diffHtml = computeLineDiff(lastDslContent, currentDsl);
            if (diffContent) diffContent.innerHTML = diffHtml;
            if (diffPanel) diffPanel.classList.remove('hide');
        });
    }

    if (btnCloseDiff) {
        btnCloseDiff.addEventListener('click', () => {
            if (diffPanel) diffPanel.classList.add('hide');
        });
    }

    if (btnScenSave) {
        btnScenSave.addEventListener('click', async () => {
            try {
                const configRaw = txtDsl.value;
                const configObj = JSON.parse(configRaw);
                const scenName = configObj.name || "Unnamed Scenario";
                const scenId = selectSavedScen.value || "";

                const resp = await fetch('/api/scenarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: scenId, name: scenName, config_json: configObj })
                });

                if (resp.ok) {
                    lastDslContent = configRaw;
                    appendTerminalLine(`Saved scenario: ${scenName}`, 'system-msg');
                    fetchScenarios();
                    runReadinessCheck();
                } else {
                    alert("Failed to save scenario");
                }
            } catch (err) {
                alert("Invalid JSON configuration. Cannot save.");
            }
        });
    }

    if (btnScenLoad) {
        btnScenLoad.addEventListener('click', () => {
            const scenId = selectSavedScen.value;
            if (!scenId) { alert("Please select a scenario to load."); return; }
            const scen = savedScenariosData.find(s => s.id === scenId);
            if (scen) {
                lastDslContent = txtDsl.value;
                txtDsl.value = JSON.stringify(JSON.parse(scen.config_json), null, 2);
                runReadinessCheck();
                appendTerminalLine(`Loaded scenario: ${scen.name}`, 'system-msg');
            }
        });
    }

    if (btnScenDuplicate) {
        btnScenDuplicate.addEventListener('click', () => {
            try {
                const configRaw = txtDsl.value;
                const configObj = JSON.parse(configRaw);
                configObj.name = configObj.name + " (Copy)";
                lastDslContent = txtDsl.value;
                txtDsl.value = JSON.stringify(configObj, null, 2);
                selectSavedScen.value = "";
                runReadinessCheck();
                appendTerminalLine(`Duplicated scenario. Click Save to persist.`, 'system-msg');
            } catch (err) {
                alert("Invalid JSON configuration.");
            }
        });
    }

    // Initial fetch and check
    fetchScenarios();
    runReadinessCheck();

    } catch (wizardInitError) {
        console.error('[Vuelitycs] Scenario Wizard initialization failed:', wizardInitError);
    }
});
