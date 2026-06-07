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
    // Chart.js Timeline Setups
    // ==========================================================================

    // Chart 1: Latency Timeline (Corrected vs Raw)
    const ctxLatency = document.getElementById('chart-live-latency').getContext('2d');
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
                    pointRadius: 0
                },
                {
                    label: 'P95 Latency (ms)',
                    data: [],
                    borderColor: '#8B5CF6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0
                },
                {
                    label: 'P99 Corrected (ms)',
                    data: [],
                    borderColor: '#EC4899',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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
    const ctxThroughput = document.getElementById('chart-live-throughput').getContext('2d');
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
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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
    const ctxCapacity = document.getElementById('chart-live-capacity').getContext('2d');
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
                    yAxisID: 'y'
                },
                {
                    label: 'P99 Latency (ms)',
                    data: [],
                    borderColor: '#EC4899',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Error Rate (%)',
                    data: [],
                    borderColor: '#EF4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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
    const ctxWorkload = document.getElementById('chart-live-workload').getContext('2d');
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
                    tension: 0.1
                },
                {
                    label: 'Active VU',
                    data: [],
                    borderColor: '#10B981',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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
        
        // Update Latency
        chartLatency.data.labels.push(timeLabel);
        chartLatency.data.datasets[0].data.push(p50Us / 1000);
        chartLatency.data.datasets[1].data.push(p95Us / 1000);
        chartLatency.data.datasets[2].data.push(p99Us / 1000);
        if (chartLatency.data.labels.length > 40) {
            chartLatency.data.labels.shift();
            chartLatency.data.datasets.forEach(d => d.data.shift());
        }
        chartLatency.update();

        // Update Throughput
        chartThroughput.data.labels.push(timeLabel);
        chartThroughput.data.datasets[0].data.push(currentRps);
        if (chartThroughput.data.labels.length > 40) {
            chartThroughput.data.labels.shift();
            chartThroughput.data.datasets[0].data.shift();
        }
        chartThroughput.update();

        // Update Capacity (VUs vs Latency & Errors)
        chartCapacity.data.labels.push(activeVUs);
        chartCapacity.data.datasets[0].data.push(p95Us / 1000);
        chartCapacity.data.datasets[1].data.push(p99Us / 1000);
        chartCapacity.data.datasets[2].data.push(errorRatePct);
        if (chartCapacity.data.labels.length > 40) {
            chartCapacity.data.labels.shift();
            chartCapacity.data.datasets.forEach(d => d.data.shift());
        }
        chartCapacity.update();

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
            chartWorkload.update();
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
            lblEngineStatus.parentElement.querySelector('.status-indicator').className = "status-indicator online";
        };

        sseSource.onerror = () => {
            lblEngineStatus.textContent = "Connection Lost. Retrying...";
            lblEngineStatus.parentElement.querySelector('.status-indicator').className = "status-indicator offline";
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
                if (isCorrected) {
                    appendTerminalLine(`[CO-CORRECTED] ${ev.payload.name} - ${formatLatency(ev.payload.latency_micro)}`, 'vu-msg');
                } else {
                    appendTerminalLine(`[SUCCESS] ${ev.payload.name} - ${formatLatency(ev.payload.latency_micro)} (HTTP ${ev.payload.status || 200})`, 'req-success');
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
            lblCapacitySaturation.textContent = (m.capacity.saturation_index * 100).toFixed(0) + '%';
            
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
            if (!resp.ok) {
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
            historyTableBody.innerHTML = `<tr><td colspan="15" class="text-center">No runs recorded in SQLite yet. Deploy your first scenario!</td></tr>`;
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
                </tr>
            `;
        }).join('');
    }

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

            viewCompResult.classList.remove('hide');
        } catch (err) {
            console.error("Comparison execution error:", err);
            alert("Error comparing runs: " + err.message);
        }
    });

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
    // Scenario Wizard Logic
    // ==========================================================================
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
        if (!val) return;
        
        let proto = 'HTTP';
        let type = 'LOAD';
        let rps = 100, think = 500, peak = 1.5;
        
        switch (val) {
            case 'login-api': rps = 50; think = 1000; type = 'LOAD'; break;
            case 'search-api': rps = 300; think = 200; type = 'LOAD'; break;
            case 'checkout-stress': rps = 200; think = 500; peak = 2.0; type = 'STRESS'; break;
            case 'kafka-producer': rps = 1000; think = 10; proto = 'Kafka'; type = 'VOLUME'; break;
            case 'kafka-consumer': rps = 500; think = 50; proto = 'Kafka'; type = 'LOAD'; break;
            case 'db-bench': rps = 500; think = 50; proto = 'Database'; type = 'STRESS'; break;
            case 'browser-audit': rps = 5; think = 5000; proto = 'Browser'; type = 'LOAD'; break;
        }
        
        document.getElementById('wiz-target-rps').value = rps;
        document.getElementById('wiz-think-time').value = think;
        document.getElementById('wiz-peak-mult').value = peak;
        
        const pBtn = Array.from(groupWizProtocol.querySelectorAll('.wizard-btn')).find(b => b.dataset.protocol === proto);
        if (pBtn) pBtn.click();
        
        const tBtn = Array.from(groupWizType.querySelectorAll('.wizard-btn')).find(b => b.dataset.type === type);
        if (tBtn) tBtn.click();
        
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
        if (activeWizTestType === 'STRESS' || activeWizTestType === 'VOLUME') { dur = 120; ramp = 30; }
        else if (activeWizTestType === 'SPIKE') { dur = 30; ramp = 5; }
        else if (activeWizTestType === 'SOAK') { dur = 600; ramp = 60; }
        
        document.getElementById('wiz-duration').value = dur;
        document.getElementById('wiz-ramp-up').value = ramp;
        
        updatePreview();
    });

    // Epic 4: Scenario Preview
    function updatePreview() {
        const vus = document.getElementById('wiz-vus').value || 0;
        const dur = document.getElementById('wiz-duration').value || 0;
        const ramp = document.getElementById('wiz-ramp-up').value || 0;
        const pacing = document.getElementById('wiz-pacing').value || 100;
        const estPeakRPS = Math.round((vus / (pacing / 1000)));
        const hasSla = document.getElementById('wiz-sla-p95').value || document.getElementById('wiz-sla-error').value;
        
        const previewText = `• Protocol: ${activeWizProtocol}
• Test Type: ${activeWizTestType}
• Workload: Ramps to ${vus} VUs over ${ramp}s, holds for ${dur}s.
• Estimated Peak RPS: ~${estPeakRPS} req/sec
• SLAs Configured: ${hasSla ? 'Yes' : 'No'}`;

        const previewEl = document.getElementById('wiz-preview-text');
        if(previewEl) previewEl.textContent = previewText;
    }

    document.querySelectorAll('.wizard-input-field').forEach(el => el.addEventListener('input', updatePreview));
    groupWizProtocol.addEventListener('click', updatePreview);
    groupWizType.addEventListener('click', updatePreview);
    
    // Initial preview render
    updatePreview();

    btnWizGenerate.addEventListener('click', async () => {
        const vus = parseInt(document.getElementById('wiz-vus').value) || 10;
        const duration = parseInt(document.getElementById('wiz-duration').value) || 15;
        const rampUp = parseInt(document.getElementById('wiz-ramp-up').value) || 3;
        const pacing = parseInt(document.getElementById('wiz-pacing').value) || 100;

        const configObj = {};
        if (activeWizProtocol === 'HTTP') {
            configObj.method = document.getElementById('wiz-http-method').value;
            configObj.url = document.getElementById('wiz-http-url').value;
            configObj.headers = { "User-Agent": "Vuelitycs-Platform/2.0" };
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

        const payload = {
            name: `Wizard ${activeWizProtocol} ${activeWizTestType} Test`,
            protocol: activeWizProtocol,
            test_type: activeWizTestType,
            vus: vus,
            duration_seconds: duration,
            ramp_up_seconds: rampUp,
            pacing_ms: pacing,
            slas: Object.keys(slas).length > 0 ? slas : undefined,
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
                txtDsl.value = JSON.stringify(scen, null, 2);
                appendTerminalLine(`Generated scenario config using Wizard and loaded to editor.`, 'system-msg');
                // Navigate back to dashboard
                navigateTo('dashboard');
            } else {
                alert("Failed to generate: " + scen.error);
            }
        } catch (err) {
            console.error("Wizard generation error:", err);
            alert("Wizard generation connection error: " + err.message);
        }
    });
});
