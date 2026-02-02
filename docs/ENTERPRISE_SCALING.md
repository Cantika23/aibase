# Enterprise Scaling Guide

This guide explains how to scale AIBase from a single-node deployment to enterprise scale using the abstraction layer.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AIBase Application                             │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   API Layer  │  │  WebSocket   │  │   Tool System │  │   LLM       │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │                 │        │
│  ┌──────▼─────────────────▼──────────────────▼─────────────────▼──────┐ │
│  │                    Storage Abstraction Layer                       │ │
│  │                                                                    │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │ │
│  │  │   Database      │  │  File Storage   │  │  Cache/Session  │    │ │
│  │  │   Interface     │  │   Interface     │  │  Interface      │    │ │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘    │ │
│  └───────────┼────────────────────┼────────────────────┼─────────────┘ │
└──────────────┼────────────────────┼────────────────────┼───────────────┘
               │                    │                    │
    ┌──────────┴────────┐  ┌────────┴────────┐  ┌───────┴────────┐
    │   SQLite (dev)    │  │  Local FS (dev) │  │  Memory (dev)  │
    │   PostgreSQL      │  │  S3 / Azure     │  │  Redis/Valkey  │
    │   (enterprise)    │  │  / GCS          │  │  (enterprise)  │
    └───────────────────┘  └─────────────────┘  └────────────────┘
```

## Quick Start

### 1. Development (Default)

No configuration needed. Uses SQLite, local filesystem, and in-memory cache:

```bash
./start.macos
```

### 2. Enterprise Configuration

Set environment variables in `.env`:

```bash
# Database: SQLite → PostgreSQL
DB_TYPE=postgresql
DB_PG_HOST=postgres.internal
DB_PG_DATABASE=aibase
DB_PG_USERNAME=aibase
DB_PG_PASSWORD=secure-password

# Files: Local → S3
FILE_STORAGE_TYPE=s3
FILE_STORAGE_S3_BUCKET=aibase-files
FILE_STORAGE_S3_REGION=us-east-1
FILE_STORAGE_S3_ACCESS_KEY=AKIA...
FILE_STORAGE_S3_SECRET_KEY=...

# Cache: Memory → Redis
CACHE_TYPE=redis
CACHE_REDIS_HOST=redis.internal
CACHE_REDIS_PORT=6379
```

## Storage Backends

### Database

| Backend | Use Case | Scale |
|---------|----------|-------|
| **SQLite** (default) | Single node, development | ~10K users |
| **PostgreSQL** | Multi-node, production | Unlimited |

#### SQLite → PostgreSQL Migration

```bash
# 1. Configure PostgreSQL in .env
export DB_TYPE=postgresql
export DB_PG_HOST=localhost
export DB_PG_DATABASE=aibase
export DB_PG_USERNAME=aibase
export DB_PG_PASSWORD=password

# 2. Run migration
bun run backend/src/scripts/migrate-storage.ts --database-only

# 3. Verify
bun run backend/src/scripts/migrate-storage.ts --database-only --dry-run
```

### File Storage

| Backend | Use Case | Scale |
|---------|----------|-------|
| **Local** (default) | Single node, development | Disk limit |
| **S3** | Multi-node, CDN | Unlimited |
| **Azure Blob** | Azure deployments | Unlimited |
| **GCS** | GCP deployments | Unlimited |

#### Local → S3 Migration

```bash
# 1. Configure S3 in .env
export FILE_STORAGE_TYPE=s3
export FILE_STORAGE_S3_BUCKET=my-bucket
export FILE_STORAGE_S3_REGION=us-east-1
export FILE_STORAGE_S3_ACCESS_KEY=...
export FILE_STORAGE_S3_SECRET_KEY=...

# 2. Run migration
bun run backend/src/scripts/migrate-storage.ts --files-only

# 3. For MinIO (self-hosted S3)
export FILE_STORAGE_S3_ENDPOINT=http://minio:9000
export FILE_STORAGE_S3_FORCE_PATH_STYLE=true
```

### Cache & Sessions

| Backend | Use Case | Scale |
|---------|----------|-------|
| **Memory** (default) | Single node, development | 1 node only |
| **Redis** | Multi-node, shared sessions | Unlimited nodes |
| **Valkey** | AWS ElastiCache | Unlimited nodes |

#### Memory → Redis Migration

Sessions are recreated on login, so cache migration is typically not needed. Just switch:

```bash
export CACHE_TYPE=redis
export CACHE_REDIS_HOST=redis.internal
export CACHE_REDIS_PORT=6379
```

## Migration Phases

### Phase 0: Assessment

```bash
# Check current storage stats
bun run backend/src/scripts/migrate-storage.ts --dry-run
```

### Phase 1: Database Migration

1. **Set up PostgreSQL**:
   ```sql
   CREATE DATABASE aibase;
   CREATE USER aibase WITH ENCRYPTED PASSWORD 'secure-password';
   GRANT ALL PRIVILEGES ON DATABASE aibase TO aibase;
   ```

2. **Migrate data**:
   ```bash
   bun run backend/src/scripts/migrate-storage.ts --database-only
   ```

3. **Update app configuration**:
   ```bash
   # Update .env
   DB_TYPE=postgresql
   DB_PG_HOST=...
   ```

4. **Restart app**:
   ```bash
   ./start.macos
   ```

### Phase 2: File Storage Migration

1. **Set up S3 bucket** (or MinIO):
   ```bash
   # AWS
   aws s3 mb s3://aibase-files
   
   # MinIO
   mc mb minio/aibase-files
   ```

2. **Migrate files**:
   ```bash
   bun run backend/src/scripts/migrate-storage.ts --files-only
   ```

3. **Update app configuration**:
   ```bash
   # Update .env
   FILE_STORAGE_TYPE=s3
   FILE_STORAGE_S3_BUCKET=aibase-files
   ```

### Phase 3: Cache Migration

1. **Set up Redis**:
   ```bash
   docker run -d --name redis -p 6379:6379 redis:7-alpine
   ```

2. **Update app configuration** (no data migration needed):
   ```bash
   # Update .env
   CACHE_TYPE=redis
   CACHE_REDIS_HOST=localhost
   ```

3. **Restart app** - users will need to re-login (sessions not migrated)

## Kubernetes Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aibase
spec:
  replicas: 3  # Multiple instances!
  template:
    spec:
      containers:
      - name: aibase
        image: aibase:latest
        env:
        # Database
        - name: DB_TYPE
          value: postgresql
        - name: DB_PG_HOST
          value: postgres-service
        - name: DB_PG_DATABASE
          value: aibase
        - name: DB_PG_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: DB_PG_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        
        # File Storage
        - name: FILE_STORAGE_TYPE
          value: s3
        - name: FILE_STORAGE_S3_BUCKET
          value: aibase-files
        - name: FILE_STORAGE_S3_REGION
          value: us-east-1
        - name: FILE_STORAGE_S3_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: s3-credentials
              key: access-key
        
        # Cache
        - name: CACHE_TYPE
          value: redis
        - name: CACHE_REDIS_HOST
          value: redis-service
        
        ports:
        - containerPort: 5040
---
apiVersion: v1
kind: Service
metadata:
  name: aibase-service
spec:
  selector:
    app: aibase
  ports:
  - port: 80
    targetPort: 5040
  type: LoadBalancer
```

## Docker Compose Example

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5040:5040"
    environment:
      - DB_TYPE=postgresql
      - DB_PG_HOST=postgres
      - DB_PG_DATABASE=aibase
      - DB_PG_USERNAME=aibase
      - DB_PG_PASSWORD=password
      - FILE_STORAGE_TYPE=s3
      - FILE_STORAGE_S3_ENDPOINT=http://minio:9000
      - FILE_STORAGE_S3_BUCKET=aibase
      - FILE_STORAGE_S3_FORCE_PATH_STYLE=true
      - CACHE_TYPE=redis
      - CACHE_REDIS_HOST=redis
    depends_on:
      - postgres
      - minio
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: aibase
      POSTGRES_PASSWORD: password
      POSTGRES_DB: aibase
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    volumes:
      - minio_data:/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  minio_data:
  redis_data:
```

## Rollback Strategy

If migration fails:

```bash
# 1. Stop the app
pkill -f start.macos

# 2. Revert .env to previous settings
git checkout .env

# 3. Restart with old settings
./start.macos
```

## Performance Comparison

| Metric | SQLite/Local/Memory | PostgreSQL/S3/Redis |
|--------|--------------------|---------------------|
| Max Users | ~10,000 | Unlimited |
| Concurrent Connections | ~100 | 10,000+ |
| File Storage | Single disk | Unlimited + CDN |
| Session Sharing | Single node | All nodes |
| High Availability | No | Yes |
| Horizontal Scaling | No | Yes |

## Troubleshooting

### Migration fails with "table already exists"

```bash
# Drop target tables and retry
psql -h localhost -U aibase -c "DROP TABLE IF EXISTS users, sessions, tenants, projects CASCADE;"
bun run backend/src/scripts/migrate-storage.ts --database-only
```

### S3 upload fails with permissions error

```bash
# Check S3 bucket policy
aws s3api get-bucket-policy --bucket aibase-files

# Ensure IAM user has correct permissions:
# - s3:PutObject
# - s3:GetObject
# - s3:DeleteObject
# - s3:ListBucket
```

### Redis connection refused

```bash
# Check Redis is running
docker ps | grep redis

# Test connection
redis-cli -h localhost -p 6379 ping

# Should return: PONG
```

## Support Matrix

| Feature | SQLite | PostgreSQL | Local FS | S3 | Memory | Redis |
|---------|--------|------------|----------|-----|--------|-------|
| Transactions | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Migrations | ✅ | ✅ | N/A | N/A | N/A | N/A |
| Backup | File copy | pg_dump | File copy | S3 versioning | ❌ | Redis SAVE |
| Encryption | ❌ | ✅ (TDE) | ❌ | ✅ (SSE) | ❌ | ❌ |
| Compression | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |

## Summary

| Deployment Size | Recommended Stack |
|-----------------|-------------------|
| **Development** | SQLite + Local + Memory |
| **Small Team** | SQLite + Local + Redis |
| **SMB** | PostgreSQL + S3 + Redis |
| **Enterprise** | PostgreSQL + S3 + Redis (clustered) |
