# Development script to run backend and frontend concurrently on Windows

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Function to write error and exit
function Error-Exit {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

# Function to write warning
function Warn {
    param([string]$Message)
    Write-Host "WARNING: $Message" -ForegroundColor Yellow
}

# Function to write success
function Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

# Function to cleanup background processes
function Cleanup {
    # Stop all background jobs
    Get-Job | Stop-Job
    Get-Job | Remove-Job

    # Also try to kill the processes by name
    $processes = @("bun", "aimeow.win.exe")
    foreach ($proc in $processes) {
        Get-Process $proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }

    exit
}

# Trap Ctrl+C to run cleanup
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }
trap { Cleanup }

# Check if .env file exists
$envFile = Join-Path $ScriptDir ".env"
if (-not (Test-Path $envFile)) {
    Error-Exit ".env file not found. Please copy .env.example to .env and configure it."
}

# Load .env file
Get-Content $envFile | ForEach-Object {
    if ($_ -notmatch '^#' -and $_ -match '^(.+?)=(.*)$') {
        $name = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Function to check required environment variables
function Check-RequiredEnv {
    $missingVars = @()

    $apiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY")
    if ([string]::IsNullOrEmpty($apiKey) -or $apiKey -eq "your-zai-api-key" -or $apiKey -eq "your-openrouter-api-key") {
        $missingVars += "OPENAI_API_KEY"
    }

    $baseUrl = [Environment]::GetEnvironmentVariable("OPENAI_BASE_URL")
    if ([string]::IsNullOrEmpty($baseUrl)) {
        $missingVars += "OPENAI_BASE_URL"
    }

    $model = [Environment]::GetEnvironmentVariable("OPENAI_MODEL")
    if ([string]::IsNullOrEmpty($model)) {
        $missingVars += "OPENAI_MODEL"
    }

    if ($missingVars.Count -gt 0) {
        Write-Host ""
        Error-Exit "Missing or invalid required environment variables:
  - $($missingVars -join "`n  - ")

Please configure these variables in your .env file."
    }

    Success "Environment variables validated"
}

# Function to check and install dependencies
function Check-And-InstallDependencies {
    param(
        [string]$Dir,
        [string]$Name
    )

    Write-Host "Checking $Name dependencies..."

    $nodeModules = Join-Path $Dir "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Warn "$Name node_modules not found. Installing..."
        Push-Location $Dir
        bun install
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            Error-Exit "Failed to install $Name dependencies"
        }
        Pop-Location
        Success "$Name dependencies installed"
    } else {
        Success "$Name dependencies OK"
    }
}

# Run checks
Check-RequiredEnv
Check-And-InstallDependencies (Join-Path $ScriptDir "backend") "Backend"
Check-And-InstallDependencies (Join-Path $ScriptDir "frontend") "Frontend"

Write-Host ""

# Array to store background jobs
$jobs = @()

# Check if AIMEOW is enabled
if ($env:AIMEOW -eq "true") {
    $AimeowDir = Join-Path $ScriptDir "bins\aimeow"
    $AimeowBinary = Join-Path $AimeowDir "aimeow.win.exe"

    # Check if we need to build (check all .go files)
    $NeedBuild = $false
    if (!(Test-Path $AimeowBinary)) {
        $NeedBuild = $true
    } else {
        $binaryTime = (Get-Item $AimeowBinary).LastWriteTime
        # Check if any .go file is newer than the binary
        $goFiles = Get-ChildItem -Path $AimeowDir -Filter "*.go"
        foreach ($file in $goFiles) {
            if ($file.LastWriteTime -gt $binaryTime) {
                $NeedBuild = $true
                break
            }
        }
    }

    # Build aimeow if needed
    if ($NeedBuild) {
        Push-Location $AimeowDir
        go build -ldflags="-s -w" -o aimeow.win.exe .
        if ($LASTEXITCODE -ne 0) {
            exit 1
        }
        Pop-Location
    }

    # Create aimeow data directory
    $AimeowDataDir = Join-Path $ScriptDir "data\services\whatsapp"
    $AimeowFilesDir = Join-Path $AimeowDataDir "files"
    if (!(Test-Path $AimeowFilesDir)) {
        New-Item -ItemType Directory -Path $AimeowFilesDir -Force | Out-Null
    }

    # Start aimeow service
    $env:PORT = "7031"
    $env:BASE_URL = "http://localhost:7031"
    $env:CALLBACK_URL = "http://localhost:5040/api/whatsapp/webhook"
    $env:DATA_DIR = "."

    Push-Location $AimeowDataDir
    $aimeowJob = Start-Job -ScriptBlock {
        param($BinaryPath)
        & $BinaryPath 2>&1 | ForEach-Object { Write-Host $_ }
    } -ArgumentList $AimeowBinary
    $jobs += $aimeowJob
    Pop-Location
}

# Start backend with hot-reload
Push-Location $ScriptDir
$backendJob = Start-Job -ScriptBlock {
    param($ProjectDir)
    Set-Location $ProjectDir
    bun --watch --env-file=.env run backend/src/server/index.ts 2>&1 | ForEach-Object { Write-Host $_ }
} -ArgumentList $ScriptDir
$jobs += $backendJob
Pop-Location

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend
$frontendDir = Join-Path $ScriptDir "frontend"
Push-Location $frontendDir
$frontendJob = Start-Job -ScriptBlock {
    param($FrontendDir)
    Set-Location $FrontendDir
    bun run dev 2>&1 | ForEach-Object { Write-Host $_ }
} -ArgumentList $frontendDir
$jobs += $frontendJob
Pop-Location

# Stream output from all jobs
try {
    while ($jobs | Where-Object { $_.State -eq "Running" }) {
        foreach ($job in $jobs) {
            Receive-Job $job -WriteEvents -ErrorAction SilentlyContinue
        }
        Start-Sleep -Milliseconds 100
    }
} finally {
    Cleanup
}
