package main

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"

	"github.com/fatih/color"
)

const version = "1.0.0"

func showProgress(step int, total int, description string) {
	percentage := (step * 100) / total
	barWidth := 40
	filled := (percentage * barWidth) / 100

	bar := strings.Repeat("█", filled) + strings.Repeat("░", barWidth-filled)

	// Clear line and print progress with cyan color (ANSI code: \033[36m)
	fmt.Printf("\r\033[K\033[36m[%s] %d%% - %s\033[0m", bar, percentage, description)

	if step == total {
		fmt.Println()
	}
}

func main() {
	color.Cyan("AIBase Development Environment v%s\n", version)
	color.Cyan("=====================================\n\n")

	totalSteps := 6
	currentStep := 0

	// Get project root (parent of bins/)
	projectRoot, err := getProjectRoot()
	if err != nil {
		color.Red("Error: %v\n", err)
		os.Exit(1)
	}

	// Setup paths
	dataDir := filepath.Join(projectRoot, "data")
	bunBinPath := filepath.Join(dataDir, "bun")
	qdrantBinDir := filepath.Join(dataDir, "qdrant")

	// Create necessary directories
	if err := os.MkdirAll(bunBinPath, 0755); err != nil {
		color.Red("Error creating bun directory: %v\n", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(qdrantBinDir, 0755); err != nil {
		color.Red("Error creating qdrant directory: %v\n", err)
		os.Exit(1)
	}

	// Step 1: Download Bun if not exists
	currentStep++
	showProgress(currentStep, totalSteps, "Checking Bun installation...")
	bunExecutable, err := ensureBun(bunBinPath)
	if err != nil {
		fmt.Println()
		color.Red("Error ensuring Bun: %v\n", err)
		os.Exit(1)
	}

	// Step 2: Install dependencies for backend and frontend
	currentStep++
	showProgress(currentStep, totalSteps, "Installing dependencies...")
	if err := installDependencies(projectRoot, bunExecutable); err != nil {
		fmt.Println()
		color.Red("Error installing dependencies: %v\n", err)
		os.Exit(1)
	}

	// Step 3: Build frontend
	currentStep++
	showProgress(currentStep, totalSteps, "Building frontend...")
	if err := buildFrontend(projectRoot, bunExecutable); err != nil {
		fmt.Println()
		color.Red("Error building frontend: %v\n", err)
		os.Exit(1)
	}

	// Step 4: Download service binaries (Qdrant)
	currentStep++
	showProgress(currentStep, totalSteps, "Checking service binaries...")
	qdrantBinary, err := ensureServiceBinaries(qdrantBinDir)
	if err != nil {
		fmt.Println()
		color.Red("Error ensuring service binaries: %v\n", err)
		os.Exit(1)
	}

	// Clean up any processes using our ports
	killProcessesOnPorts()

	// Step 5: Start all processes
	currentStep++
	showProgress(currentStep, totalSteps, "Starting services...")
	orch := NewOrchestrator(projectRoot, bunExecutable)

	// Add processes
	// Qdrant service
	qdrantDataDir := filepath.Join(dataDir, "qdrant")
	qdrantStoragePath := filepath.Join(qdrantDataDir, "storage")
	qdrantLogsPath := filepath.Join(qdrantDataDir, "logs")

	// Create qdrant directories
	os.MkdirAll(qdrantStoragePath, 0755)
	os.MkdirAll(qdrantLogsPath, 0755)

	// Create minimal config file to suppress warnings
	qdrantConfigDir := filepath.Join(qdrantDataDir, "config")
	os.MkdirAll(qdrantConfigDir, 0755)
	createQdrantConfig(qdrantConfigDir, qdrantStoragePath)

	qdrantEnv := []string{
		"QDRANT__SERVICE__HTTP_PORT=6333",
		"QDRANT__SERVICE__GRPC_PORT=6334",
		fmt.Sprintf("QDRANT__STORAGE__STORAGE_PATH=%s", qdrantStoragePath),
	}
	orch.AddProcess("qdrant", qdrantDataDir, qdrantBinary, []string{}, qdrantEnv, qdrantLogsPath)

	// Backend serves the built frontend on port 5040
	// Backend runs from project root so data/ is accessible
	backendLogsPath := filepath.Join(dataDir, "backend", "logs")
	os.MkdirAll(backendLogsPath, 0755)
	backendEnv := []string{
		"NODE_ENV=production",
	}
	orch.AddProcess("backend", projectRoot, bunExecutable, []string{"backend/src/server/index.ts"}, backendEnv, backendLogsPath)

	// Start all processes
	if err := orch.Start(); err != nil {
		fmt.Println()
		color.Red("Error starting processes: %v\n", err)
		os.Exit(1)
	}

	// Step 6: All services ready
	currentStep++
	showProgress(currentStep, totalSteps, "All services ready!")
	fmt.Println()

	color.Green("\n✓ All services started successfully\n")
	color.Cyan("\n→ Backend URL: http://localhost:5040\n")
	color.Cyan("\nPress Ctrl+C to stop all services\n\n")

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan

	color.Yellow("\n\n→ Shutting down...\n")
	if err := orch.Stop(); err != nil {
		color.Red("Error during shutdown: %v\n", err)
		os.Exit(1)
	}

	color.Green("✓ Shutdown complete\n")
}

// installDependencies installs dependencies for backend and frontend
func installDependencies(projectRoot, bunExecutable string) error {
	// Install backend dependencies
	backendDir := filepath.Join(projectRoot, "backend")

	cmd := exec.Command(bunExecutable, "install")
	cmd.Dir = backendDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("backend install failed: %w\n%s", err, string(output))
	}

	// Install frontend dependencies
	frontendDir := filepath.Join(projectRoot, "frontend")

	cmd = exec.Command(bunExecutable, "install")
	cmd.Dir = frontendDir
	output, err = cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("frontend install failed: %w\n%s", err, string(output))
	}

	return nil
}

// buildFrontend builds the frontend for production (only if needed)
func buildFrontend(projectRoot, bunExecutable string) error {
	frontendDir := filepath.Join(projectRoot, "frontend")
	distDir := filepath.Join(frontendDir, "dist")

	// Check if dist directory exists
	distInfo, err := os.Stat(distDir)
	if err == nil && distInfo.IsDir() {
		// Dist exists, check if source files are newer
		needsRebuild, err := checkIfRebuildNeeded(frontendDir, distDir)
		if err != nil {
			// If we can't determine, rebuild to be safe
			needsRebuild = true
		}
		if !needsRebuild {
			return nil
		}
	}

	// Build frontend for production
	cmd := exec.Command(bunExecutable, "run", "build")
	cmd.Dir = frontendDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("frontend build failed: %w\n%s", err, string(output))
	}

	return nil
}

// checkIfRebuildNeeded checks if source files are newer than dist
func checkIfRebuildNeeded(frontendDir, distDir string) (bool, error) {
	// Get the oldest file in dist directory
	var oldestDistTime int64 = 9999999999

	err := filepath.Walk(distDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && info.ModTime().Unix() < oldestDistTime {
			oldestDistTime = info.ModTime().Unix()
		}
		return nil
	})
	if err != nil {
		return true, err
	}

	// Check if any source file is newer than the oldest dist file
	srcDirs := []string{"src", "public", "index.html", "vite.config.ts", "package.json"}

	for _, srcPath := range srcDirs {
		fullPath := filepath.Join(frontendDir, srcPath)
		info, err := os.Stat(fullPath)
		if err != nil {
			continue // Skip if doesn't exist
		}

		if info.IsDir() {
			// Walk directory
			err = filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
				if err != nil {
					return err
				}
				if !info.IsDir() && info.ModTime().Unix() > oldestDistTime {
					return fmt.Errorf("rebuild needed")
				}
				return nil
			})
			if err != nil && err.Error() == "rebuild needed" {
				return true, nil
			}
		} else {
			// Single file
			if info.ModTime().Unix() > oldestDistTime {
				return true, nil
			}
		}
	}

	return false, nil
}

// createQdrantConfig creates a minimal config file for Qdrant to suppress warnings
func createQdrantConfig(configDir, storagePath string) {
	configPath := filepath.Join(configDir, "config.yaml")
	devConfigPath := filepath.Join(configDir, "development.yaml")

	// Minimal config content
	configContent := `service:
  http_port: 6333
  grpc_port: 6334

storage:
  storage_path: ` + storagePath + `
`

	// Create main config if it doesn't exist
	if _, err := os.Stat(configPath); err != nil {
		os.WriteFile(configPath, []byte(configContent), 0644)
	}

	// Create development config if it doesn't exist (can be empty)
	if _, err := os.Stat(devConfigPath); err != nil {
		os.WriteFile(devConfigPath, []byte("# Development environment config\n"), 0644)
	}
}

// killProcessesOnPorts kills any processes using our required ports
func killProcessesOnPorts() {
	ports := []string{"5040", "6333", "6334"}

	for _, port := range ports {
		killProcessOnPort(port)
	}
}

// killProcessOnPort kills a process using the specified port
func killProcessOnPort(port string) {
	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		// Windows: use netstat and taskkill
		cmd = exec.Command("cmd", "/C", fmt.Sprintf("for /f \"tokens=5\" %%a in ('netstat -aon ^| findstr :%s') do taskkill /F /PID %%a", port))
	} else {
		// Unix-like (macOS, Linux): use lsof and kill
		cmd = exec.Command("sh", "-c", fmt.Sprintf("lsof -ti :%s | xargs -r kill -9 2>/dev/null || true", port))
	}

	// Run command silently - ignore errors if no process is found
	cmd.Run()
}

// getProjectRoot returns the project root directory
func getProjectRoot() (string, error) {
	// Get current executable path
	ex, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %w", err)
	}

	// Get directory of executable - the binary is at project root
	exPath := filepath.Dir(ex)

	projectRoot, err := filepath.Abs(exPath)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}

	return projectRoot, nil
}
