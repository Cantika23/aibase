#!/bin/bash

set -e

echo "Building aimeow cross-platform binaries..."

# Get the project root (2 levels up from bins/aimeow)
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AIMEOW_DIR="$(dirname "$0")"

# Build with stripped symbols for all platforms
echo "→ Building Windows binary..."
cd "$AIMEOW_DIR"
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o "aimeow.exe"

echo "→ Building Linux binary..."
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o "aimeow.linux"

echo "→ Building macOS binary..."
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o "aimeow.macos"

echo ""
echo "✓ Build complete!"
echo ""
ls -lh "$AIMEOW_DIR"/aimeow.*
