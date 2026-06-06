package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"vuelitycs/pkg/dashboard"
	"vuelitycs/pkg/event"
	"vuelitycs/pkg/metrics"
	"vuelitycs/pkg/scenario"
)

const banner = `
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
`

func main() {
	runCmd := flag.NewFlagSet("run", flag.ExitOnError)
	scenPath := runCmd.String("f", "scenario.json", "Path to scenario JSON configuration")
	port := runCmd.Int("port", 8080, "Dashboard HTTP port")

	controllerCmd := flag.NewFlagSet("controller", flag.ExitOnError)
	ctrlPort := controllerCmd.Int("port", 8080, "Controller HTTP port")

	agentCmd := flag.NewFlagSet("agent", flag.ExitOnError)
	agentCtrlAddr := agentCmd.String("controller", "http://localhost:8080", "Controller HTTP API address")

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "run":
		_ = runCmd.Parse(os.Args[2:])
		runStandalone(*scenPath, *port)
	case "controller":
		_ = controllerCmd.Parse(os.Args[2:])
		runController(*ctrlPort)
	case "agent":
		_ = agentCmd.Parse(os.Args[2:])
		runAgent(*agentCtrlAddr)
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Print(banner)
	fmt.Println("Usage:")
	fmt.Println("  vuelitycs run -f <scenario.json> [--port 8080]  - Execute a local standalone test run")
	fmt.Println("  vuelitycs controller [--port 8080]               - Run as a central UI and aggregation orchestrator")
	fmt.Println("  vuelitycs agent [--controller <addr>]            - Run as a distributed agent node")
	fmt.Println()
}

func runStandalone(scenPath string, port int) {
	fmt.Print(banner)
	fmt.Printf("Starting Standalone Engine Node on port :%d...\n", port)

	// 1. Initialize core channels and Event Bus
	eventBus := event.NewEventBus()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 2. Load and parse scenario DSL
	scen, err := scenario.LoadScenario(scenPath)
	if err != nil {
		fmt.Printf("[-] Configuration Error: Failed to load %s: %v\n", scenPath, err)
		fmt.Println("[*] Tip: You can run our dashboard and build scenarios interactively using 'vuelitycs controller'")
		os.Exit(1)
	}

	// 3. Start embedded dashboard web server
	dashServer := dashboard.NewDashboardServer(eventBus)
	dashServer.StartTelemetryBroadcaster(ctx)
	
	mux := dashServer.HandlerRoutes()
	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("[-] Dashboard Web Server failed: %v\n", err)
		}
	}()

	fmt.Printf("[+] Dashboard Web UI is running at http://localhost:%d/\n", port)
	fmt.Printf("[+] Target Scenario: %s | Protocol: %s | VUs: %d | Duration: %ds\n", 
		scen.Name, scen.Protocol, scen.VUs, scen.DurationSeconds)
	fmt.Println("[+] Executing... Observe live streaming details on the Web UI.")

	// 4. Setup Console logs terminal printer
	evChan := eventBus.SubscribeAll()
	var successCount, failedCount int64
	hdr := metrics.NewHDRHistogram(1, 600000000)

	go func() {
		for ev := range evChan {
			switch ev.Type {
			case event.SCENARIO_STARTED:
				fmt.Printf("[SCENARIO] Started: %s\n", ev.Payload)
			case event.SCENARIO_COMPLETED:
				fmt.Printf("[SCENARIO] Completed: %s\n", ev.Payload)
			case event.VU_STARTED:
				fmt.Printf("[VU] %s is online\n", ev.Source)
			case event.VU_STOPPED:
				fmt.Printf("[VU] %s is offline\n", ev.Source)
			case event.REQUEST_COMPLETED:
				successCount++
				if payload, ok := ev.Payload.(event.RequestPayload); ok {
					hdr.RecordValue(payload.LatencyMicro)
					fmt.Printf("[OK] %-40s | Latency: %8.2fms | Status: %d\n", 
						payload.Name, float64(payload.LatencyMicro)/1000.0, payload.Status)
				}
			case event.REQUEST_FAILED:
				failedCount++
				if payload, ok := ev.Payload.(event.RequestPayload); ok {
					hdr.RecordValue(payload.LatencyMicro)
					fmt.Printf("[ERR] %-40s | Latency: %8.2fms | Error: %s\n", 
						payload.Name, float64(payload.LatencyMicro)/1000.0, payload.Error)
				}
			}
		}
	}()

	// 5. Trigger Scenario Execution
	runner := scenario.NewRunner(scen, eventBus)
	
	// Trap Ctrl+C signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\n[-] Termination signal received. Aborting scenario gracefully...")
		cancel()
	}()

	errRun := runner.Run(ctx)
	if errRun != nil {
		fmt.Printf("[-] Run failed: %v\n", errRun)
	}

	// 6. Print final console metrics report
	eventBus.Unsubscribe(evChan)
	printFinalReport(scen.Name, successCount, failedCount, hdr)

	// Keep dashboard server running so user can inspect final result charts
	fmt.Printf("\n[+] Test complete. Dashboard server remains open at http://localhost:%d/\n", port)
	fmt.Println("[+] Press Ctrl+C to exit completely.")
	
	// Wait for terminal close signal
	<-sigChan
	fmt.Println("[-] Shutting down dashboard. Goodbye!")
	_ = server.Shutdown(context.Background())
}

func runController(port int) {
	fmt.Print(banner)
	fmt.Printf("Starting Central UI and Aggregation Controller Node on port :%d...\n", port)

	eventBus := event.NewEventBus()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	dashServer := dashboard.NewDashboardServer(eventBus)
	dashServer.StartTelemetryBroadcaster(ctx)
	
	mux := dashServer.HandlerRoutes()
	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\n[-] Stopping Controller Node...")
		cancel()
		_ = server.Shutdown(context.Background())
	}()

	fmt.Printf("[+] Dashboard available at http://localhost:%d/\n", port)
	fmt.Println("[+] Waiting for Scenarios to be deployed via API/UI or Agents to connect...")
	
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Printf("[-] Controller Web Server error: %v\n", err)
	}
}

func runAgent(controllerAddr string) {
	fmt.Print(banner)
	fmt.Printf("Starting Distributed Worker Agent Node. Targeting Controller: %s\n", controllerAddr)
	fmt.Println("[*] Note: Distributed controller-agent cluster configurations are managed via REST API.")
	
	// Keep agent running as a process
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan
	fmt.Println("[-] Shutting down Agent Node. Goodbye!")
}

func printFinalReport(name string, success, failed int64, hdr *metrics.HDRHistogram) {
	total := success + failed
	successRate := 0.0
	if total > 0 {
		successRate = (float64(success) / float64(total)) * 100.0
	}

	fmt.Println("\n========================================================================")
	fmt.Printf("                       FINAL PERFORMANCE REPORT                         \n")
	fmt.Printf(" Scenario:  %s\n", name)
	fmt.Printf(" Timestamp: %s\n", time.Now().Format(time.RFC1123))
	fmt.Println("========================================================================")
	fmt.Printf(" Total Requests:     %d\n", total)
	fmt.Printf(" Successful:         %d\n", success)
	fmt.Printf(" Failed:             %d\n", failed)
	fmt.Printf(" Success Rate:       %.2f%%\n", successRate)
	fmt.Println("------------------------------------------------------------------------")
	fmt.Printf(" Min Latency:        %10.2fms\n", float64(hdr.Min())/1000.0)
	fmt.Printf(" P50 Percentile:     %10.2fms\n", float64(hdr.ValueAtPercentile(50.0))/1000.0)
	fmt.Printf(" P90 Percentile:     %10.2fms\n", float64(hdr.ValueAtPercentile(90.0))/1000.0)
	fmt.Printf(" P95 Percentile:     %10.2fms\n", float64(hdr.ValueAtPercentile(95.0))/1000.0)
	fmt.Printf(" P99 Percentile:     %10.2fms\n", float64(hdr.ValueAtPercentile(99.0))/1000.0)
	fmt.Printf(" P99.9 Percentile:   %10.2fms\n", float64(hdr.ValueAtPercentile(99.9))/1000.0)
	fmt.Printf(" P99.99 Percentile:  %10.2fms\n", float64(hdr.ValueAtPercentile(99.99))/1000.0)
	fmt.Printf(" Max Latency:        %10.2fms\n", float64(hdr.Max())/1000.0)
	fmt.Printf(" Mean Latency:       %10.2fms\n", hdr.Mean()/1000.0)
	fmt.Println("========================================================================")
}
