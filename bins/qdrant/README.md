# Qdrant Vector Database

High-performance vector similarity search engine for AIBase.

## Overview

Qdrant is a vector database designed for storing and searching high-dimensional vectors. It's used for semantic search, recommendation systems, and AI applications requiring similarity matching.

## Configuration

Configuration is managed in `config.ts`:

```typescript
export const qdrantConfig = {
  version: 'v1.7.4',        // Qdrant version to download
  port: 6333,               // HTTP API port
  grpcPort: 6334,           // gRPC API port
  apiKey: '',               // Optional API key for authentication
  autoStart: true,          // Start with binary manager
  restartOnCrash: true,     // Auto-restart on process crash
  maxRestartAttempts: 3,    // Max restart attempts before giving up
  healthCheckInterval: 30000, // Health check every 30 seconds
  healthCheckTimeout: 5000,   // Health check timeout 5 seconds
};
```

## API Endpoints

### HTTP API (Port 6333)

- Health check: `GET http://localhost:6333/healthz`
- API docs: `http://localhost:6333/dashboard` (when running)
- Collections: `http://localhost:6333/collections`

### gRPC API (Port 6334)

gRPC endpoint for high-performance operations.

## Storage Location

- **Data**: `/data/bins/qdrant/storage/`
- **Logs**: `/data/bins/qdrant/logs/qdrant.log`
- **Error logs**: `/data/bins/qdrant/logs/qdrant-error.log`

## Connecting from Backend

Once Qdrant is running, connect from your backend code:

```typescript
// Example using qdrant-client (you'll need to add it to dependencies)
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({
  url: 'http://localhost:6333',
  // apiKey: 'your-api-key', // If configured
});

// Example: Create a collection
await client.createCollection('my_collection', {
  vectors: {
    size: 384,
    distance: 'Cosine',
  },
});

// Example: Insert vectors
await client.upsert('my_collection', {
  points: [
    {
      id: 1,
      vector: [0.1, 0.2, 0.3, ...], // 384-dimensional vector
      payload: { text: 'Some document' },
    },
  ],
});

// Example: Search
const results = await client.search('my_collection', {
  vector: [0.1, 0.2, 0.3, ...],
  limit: 10,
});
```

## Environment Variables

Set in `config.ts` and passed to the Qdrant process:

- `QDRANT__SERVICE__HTTP_PORT`: HTTP API port (default: 6333)
- `QDRANT__SERVICE__GRPC_PORT`: gRPC API port (default: 6334)
- `QDRANT__SERVICE__API_KEY`: Optional API key
- `QDRANT__STORAGE__STORAGE_PATH`: Data storage path (auto-configured)

## Downloaded Binaries

Binaries are automatically downloaded for your platform:

- **macOS ARM (M1/M2/M3)**: `bin/darwin-arm64/qdrant`
- **macOS Intel**: `bin/darwin-x64/qdrant`
- **Linux x64**: `bin/linux-x64/qdrant`
- **Windows x64**: `bin/windows-x64/qdrant.exe`

Download source: [GitHub Releases](https://github.com/qdrant/qdrant/releases)

## Upgrading Version

To upgrade Qdrant:

1. Update `version` in `config.ts`
2. Delete the binary: `rm -rf bin/`
3. Restart: `bun run restart qdrant`

The new version will be automatically downloaded.

## Troubleshooting

### Port already in use

If port 6333 is already in use:

1. Change `port` in `config.ts`
2. Update `healthCheck.endpoint` accordingly
3. Restart Qdrant

### Binary download fails

- Check GitHub releases: https://github.com/qdrant/qdrant/releases/tag/v1.7.4
- Verify internet connection
- Manually download and place in `bin/<platform>/qdrant`

### Service crashes on startup

Check logs:

```bash
tail -f ../../data/bins/qdrant/logs/qdrant-error.log
```

Common issues:
- Insufficient permissions
- Corrupted storage (delete `/data/bins/qdrant/storage/`)
- Port conflict

### Health checks failing

Verify Qdrant is responding:

```bash
curl http://localhost:6333/healthz
```

Expected response: `{"title":"healthz","version":"1.7.4"}`

## Resources

- **Official Docs**: https://qdrant.tech/documentation/
- **GitHub**: https://github.com/qdrant/qdrant
- **API Reference**: https://qdrant.github.io/qdrant/redoc/index.html
- **Client Libraries**: https://qdrant.tech/documentation/interfaces/

## Notes

- First startup downloads ~100-200MB binary
- Storage grows with data size (starts empty)
- Default settings are optimized for development
- For production, consider tuning performance settings
