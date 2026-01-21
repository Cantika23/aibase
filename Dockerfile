# Multi-stage Dockerfile for full-stack application

# Stage 1: Build frontend
FROM oven/bun:alpine AS frontend-build

# Build frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install
COPY frontend/ ./
RUN bun run build

# Stage 2: Build aimeow binary
FROM golang:1.25-alpine AS aimeow-build

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Set working directory for aimeow
WORKDIR /app/bins/aimeow

# Copy aimeow source files
COPY bins/aimeow/go.mod bins/aimeow/go.sum ./
RUN go mod download

COPY bins/aimeow/ ./

# Install swag and generate docs
RUN go install github.com/swaggo/swag/cmd/swag@latest
RUN swag init

# Build aimeow for Linux
RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o aimeow.linux .

# Stage 3: Build start binary
FROM golang:1.25-alpine AS start-build

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Set working directory for start
WORKDIR /app/bins/start

# Copy start source files
COPY bins/start/ ./

# Build start for Linux
RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o start.linux .

# Stage 4: Production stage
FROM oven/bun:alpine

# Install DuckDB and Pandoc
RUN apk add --no-cache curl pandoc && \
    curl -L https://github.com/duckdb/duckdb/releases/download/v1.1.3/duckdb_cli-linux-amd64.zip -o /tmp/duckdb.zip && \
    unzip /tmp/duckdb.zip -d /tmp/ && \
    mv /tmp/duckdb /usr/local/bin/ && \
    chmod +x /usr/local/bin/duckdb && \
    rm /tmp/duckdb.zip && \
    apk del curl

WORKDIR /app

# Copy backend
COPY backend/package.json backend/bun.lockb* ./backend/
WORKDIR /app/backend
RUN bun install --frozen-lockfile --production
COPY backend/ ./

# Copy built frontend (backend will serve these files)
WORKDIR /app
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy aimeow binary from aimeow-build stage
COPY --from=aimeow-build /app/bins/aimeow/aimeow.linux ./bins/aimeow/
RUN chmod +x ./bins/aimeow/aimeow.linux

# Copy aimeow docs from aimeow-build stage
COPY --from=aimeow-build /app/bins/aimeow/docs ./bins/aimeow/docs

# Copy start binary from start-build stage
COPY --from=start-build /app/bins/start/start.linux ./
RUN chmod +x ./start.linux

# Copy .env file if it exists (for production configuration)
# Note: This is optional. You can also use --env-file or -e flags at runtime.
# Uncomment the next line if you want to bake .env into the image (NOT recommended for secrets)
# COPY .env ./

# Expose backend port and WhatsApp API port
EXPOSE 5040 7031

# Set environment to production (can be overridden)
ENV NODE_ENV=production

# Default WhatsApp API URL (can be overridden with -e flag or .env file)
ENV WHATSAPP_API_URL=http://localhost:7031/api/v1

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Define volume for persistent data
# This includes: todos, memory, uploaded files, and conversation data
VOLUME ["/app/data"]

# Start all services via start.linux (which runs backend, Qdrant, and aimeow)
CMD ["./start.linux"]
