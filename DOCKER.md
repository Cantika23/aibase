# Docker Deployment Guide

## Quick Start with Dockerfile Only

### 1. Build the Image

```bash
docker build -t aibase .
```

### 2. Prepare Environment Variables

Create a `.env` file in the project root (optional but recommended):

```bash
cp .env.example .env
# Edit .env with your configuration
```

**Important:** Set `WHATSAPP_API_URL` based on your setup:

```bash
# For local development (aimeow on host)
WHATSAPP_API_URL=http://host.docker.internal:7031/api/v1

# For Linux Docker (aimeow on host)
WHATSAPP_API_URL=http://172.17.0.1:7031/api/v1

# For production (aimeow in separate container)
WHATSAPP_API_URL=http://aimeow-container:7031/api/v1
```

### 3. Run the Container

**Option A: Using .env file**
```bash
docker run -d \
  --name aibase \
  -p 5040:5040 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  aibase
```

**Option B: Passing environment variables directly**
```bash
docker run -d \
  --name aibase \
  -p 5040:5040 \
  -v $(pwd)/data:/app/data \
  -e OPENAI_API_KEY=your-key-here \
  -e WHATSAPP_API_URL=http://host.docker.internal:7031/api/v1 \
  aibase
```

**Option C: Using host.docker.internal (Docker Desktop for Mac/Windows)**
```bash
docker run -d \
  --name aibase \
  -p 5040:5040 \
  -v $(pwd)/data:/app/data \
  --add-host=host.docker.internal:host-gateway \
  -e WHATSAPP_API_URL=http://host.docker.internal:7031/api/v1 \
  aibase
```

### 4. Access the Application

Open your browser: `http://localhost:5040`

## Managing the Container

**View logs:**
```bash
docker logs -f aibase
```

**Stop the container:**
```bash
docker stop aibase
```

**Start the container:**
```bash
docker start aibase
```

**Remove the container:**
```bash
docker rm -f aibase
```

**Rebuild after code changes:**
```bash
docker build -t aibase .
docker stop aibase
docker rm aibase
docker run -d --name aibase -p 5040:5040 -v $(pwd)/data:/app/data --env-file .env aibase
```

## Docker Compose (Alternative)

For multi-container setup (AIBase + aimeow), see `docker-compose.example.yml`:

```bash
# Copy and modify the example file
cp docker-compose.example.yml docker-compose.yml

# Update environment variables in docker-compose.yml

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Troubleshooting

### WhatsApp Connection Refused

**Problem:** `[WhatsApp WS] Error fetching client status: Connection refused`

**Solution:** Set `WHATSAPP_API_URL` to point to your aimeow service:

1. **aimeow on host machine (Docker Desktop Mac/Windows):**
   ```bash
   -e WHATSAPP_API_URL=http://host.docker.internal:7031/api/v1
   ```

2. **aimeow on host machine (Linux Docker):**
   ```bash
   # Find your Docker bridge IP
   ip addr show docker0
   # Use that IP, usually 172.17.0.1
   -e WHATSAPP_API_URL=http://172.17.0.1:7031/api/v1
   ```

3. **aimeow in separate Docker container:**
   ```bash
   # Use container name as hostname
   -e WHATSAPP_API_URL=http://aimeow:7031/api/v1
   ```

### Container Exits Immediately

**Check logs:**
```bash
docker logs aibase
```

**Common issues:**
- Missing required environment variables (OPENAI_API_KEY)
- Port 5040 already in use
- Volume permission issues

### Data Persistence

The `/app/data` directory is mounted as a volume to persist:
- Conversation history
- Uploaded files
- User data
- SQLite databases

Make sure to mount this volume or your data will be lost when the container is removed.
