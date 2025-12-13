# AIBase Development Environment

Single-command development environment launcher for AIBase. This Go application automatically:
- Downloads and installs Bun runtime
- Downloads and installs service binaries (Qdrant)
- Starts all services (backend, frontend, databases) in parallel
- Manages process orchestration and graceful shutdown

## Quick Start

Build and run (first time):

```bash
cd bins/start
go build -o ../aibase-start
cd ..
./aibase-start
```

The launcher will:
1. Download Bun if not installed (to `bins/bun/`)
2. Install dependencies for backend and frontend (using downloaded Bun)
3. Build frontend for production (only if source files changed)
4. Download Qdrant if not installed (to `bins/qdrant/bin/`)
5. Start Qdrant vector database
6. Start backend server (serves built frontend on port 5040)

The frontend build is smart - it only rebuilds when source files are newer than the existing build.

Press `Ctrl+C` to stop all services.

## Supported Platforms

- macOS (Apple Silicon - arm64)
- macOS (Intel - x64)
- Linux (x64)
- Windows (x64)

## What Gets Downloaded

### Bun Runtime
- **Version**: 1.1.38
- **Location**: `bins/bun/`
- **Size**: ~40-50MB
- **Source**: [GitHub Releases](https://github.com/oven-sh/bun/releases)

### Qdrant Vector Database
- **Version**: 1.7.4
- **Location**: `bins/qdrant/bin/{platform}/`
- **Size**: ~100-200MB
- **Source**: [GitHub Releases](https://github.com/qdrant/qdrant/releases)

## Directory Structure

```
bins/
├── start/                  # Go source code
│   ├── main.go
│   ├── downloader.go       # Handles binary downloads
│   ├── orchestrator.go     # Process management
│   ├── go.mod
│   └── go.sum
├── aibase-start            # Compiled executable
├── bun/                    # Downloaded Bun runtime (gitignored)
│   └── bun                 # or bun.exe on Windows
└── qdrant/
    ├── bin/                # Downloaded Qdrant binaries (gitignored)
    │   ├── darwin-arm64/
    │   ├── darwin-x64/
    │   ├── linux-x64/
    │   └── windows-x64/
    └── README.md

data/bins/                  # Runtime data (in project root /data/)
└── qdrant/
    ├── storage/            # Vector database storage
    └── logs/               # Service logs (captured by orchestrator)
```

## Building from Source

### Prerequisites

- Go 1.23 or higher
- Internet connection (for downloading dependencies and binaries)
- UPX (optional, for compression): `brew install upx`

### Quick Build

Use the automated build script to build and compress binaries for all platforms:

```bash
cd bins/start
./build.sh
```

This script will:
1. Build optimized binaries for Windows, Linux, and macOS
2. Compress them with UPX (if installed)
3. Output to project root: `start.win.exe`, `start.linux`, `start.macos`

**Final sizes**: ~1.7-2 MB per binary (compressed)

### Manual Build

Build for the current platform:

```bash
cd bins/start
go mod download
go build -ldflags="-s -w" -o ../../start
```

Build for different platforms:

```bash
# Windows x64
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o ../../start.win.exe

# Linux x64
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o ../../start.linux

# macOS ARM64
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o ../../start.macos
```

**Build flags**:
- `-ldflags="-s -w"` - Strip debug symbols (reduces size from ~8MB to ~6MB)

### Optional: Compress with UPX

Further compress binaries (~6MB → ~2MB):

```bash
# Install UPX
brew install upx

# Compress binaries
upx --best --lzma --force start.win.exe
upx --best --lzma --force start.linux
upx --best --lzma --force --force-macos start.macos
```

## Services Managed

### Qdrant Vector Database
- **Port**: 6333 (HTTP), 6334 (gRPC)
- **Storage**: `/data/bins/qdrant/storage/`
- **Health**: http://localhost:6333/healthz
- **Dashboard**: http://localhost:6333/dashboard

### Backend Server
- **Port**: 5040
- **Serves**: Production-built frontend + API
- **Entry**: `backend/src/server/index.ts`
- **Frontend**: Built from `frontend/` and served as static files

## Configuration

Service configuration is hardcoded in the Go application:

### Qdrant
Environment variables set by orchestrator:
- `QDRANT__SERVICE__HTTP_PORT=6333`
- `QDRANT__SERVICE__GRPC_PORT=6334`
- `QDRANT__STORAGE__STORAGE_PATH=/data/bins/qdrant/storage`

To change ports or configuration, edit `bins/start/main.go` and rebuild.

## Process Output

All process output is color-coded and prefixed:
- **[qdrant]** - Cyan
- **[backend]** - Yellow
- **[frontend]** - Magenta

Standard output and errors from all processes are streamed to your terminal in real-time.

## Graceful Shutdown

When you press `Ctrl+C`:
1. Orchestrator catches SIGINT/SIGTERM
2. Sends interrupt signal to all processes
3. Waits for processes to exit gracefully
4. Force kills if they don't exit within timeout

All services shut down cleanly.

## Troubleshooting

### Binary downloads fail

- Check internet connection
- Verify GitHub is accessible
- Check available disk space
- Manual download: Place binaries in correct `bin/{platform}/` directory

### Port already in use

If ports 6333, 5040, or 5050 are already in use:
1. Stop conflicting services
2. Or modify ports in `bins/start/main.go` and rebuild

### Permission denied (Unix)

Make the executable runnable:

```bash
chmod +x bins/aibase-start
```

### Bun not found after download

The launcher extracts Bun from the downloaded archive automatically. If this fails:
1. Delete `bins/bun/` directory
2. Run launcher again
3. Check extraction logic in `bins/start/downloader.go`

### Process won't stop

Force kill all processes:

```bash
# macOS/Linux
pkill -f "bun.*server/index.ts"
pkill -f "bun.*run dev"
pkill qdrant

# Windows
taskkill /F /IM bun.exe
taskkill /F /IM qdrant.exe
```

## Development

### Adding New Services

To add a new service binary:

1. Add download URL function in `downloader.go`:
```go
func getMyServiceDownloadURL(platform Platform) (string, error) {
    // Return download URL for platform
}
```

2. Add ensure function in `downloader.go`:
```go
func ensureMyService(binsDir string) (string, error) {
    // Download and return binary path
}
```

3. Update `ensureServiceBinaries()` to call your function

4. Add process in `main.go`:
```go
myServiceBinary, err := ensureMyService(binsDir)
orch.AddProcess("myservice", dataDir, myServiceBinary, []string{}, nil)
```

5. Add color in `orchestrator.go`:
```go
case "myservice":
    return color.Blue
```

6. Rebuild: `go build -o ../aibase-start`

### Modifying Bun/Qdrant Versions

Update version constants in `downloader.go`:
- Bun: Change `version := "1.1.38"`
- Qdrant: Change `version := "v1.7.4"`

Then rebuild.

## Notes

- First run downloads binaries (~150-250MB total)
- Subsequent runs are fast (binaries cached)
- All downloaded files are in `bins/` (gitignored)
- Runtime data is in `/data/bins/` (gitignored)
- No need to install Bun or Qdrant separately
- Cross-platform compatible (macOS, Linux, Windows)
