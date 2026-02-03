# Centralized Logging System

A unified logging configuration shared across all executables (TypeScript backend/frontend, Go applications).

## Overview

The logging system is controlled by a single configuration file `logging.json` in the project root. This allows consistent logging behavior across different languages and executables.

## Configuration File

### Location
- **Primary**: `./logging.json` (project root)
- **Custom**: Set via `LOG_CONFIG_PATH` environment variable

### Basic Structure

```json
{
  "$schema": "./logging.schema.json",
  "enabled": true,
  "filters": [
    {
      "executable": "backend",
      "level": "info",
      "categories": ["Storage", "LLM", "Auth"]
    },
    {
      "executable": "frontend",
      "level": "info",
      "categories": ["chat", "auth", "api"]
    }
  ],
  "outputs": {
    "console": { "enabled": true, "colorize": true },
    "file": { "enabled": true, "path": "./logs" }
  }
}
```

## Category Groups

Categories are organized into **groups** for simplified filtering. You can filter by group or specific category.

| Group | Description | Example Categories |
|-------|-------------|-------------------|
| `Core` | Server core and setup | `Server`, `Setup`, `FrontendLogs` |
| `WebSocket` | WebSocket and real-time | `WebSocketServer`, `WSEvents`, `WhatsAppWS` |
| `Auth` | Authentication | `Auth`, `AuthService`, `EmbedAuth` |
| `Storage` | All storage layers | `UserStorage`, `FileStorage`, `SQLiteAdapter` |
| `LLM` | LLM and conversations | `Conversation`, `TitleGenerator`, `ContextBuilder` |
| `Extension` | Extension system | `ExtensionLoader`, `ExcelExtension`, `PDFExtension` |
| `Tools` | Script and tool runtime | `ScriptTool`, `DependencyBundler` |
| `Handlers` | HTTP handlers | `Projects`, `Files`, `Upload`, `Tenant` |
| `Middleware` | Middleware components | `TenantCheck` |
| `Migration` | Database migrations | `Migration`, `Migrator` |

### Frontend Categories

| Category | Description |
|----------|-------------|
| `general` | General application logs |
| `chat` | Chat/conversation related |
| `files` | File operations |
| `auth` | Authentication |
| `websocket` | WebSocket connections |
| `extensions` | Extension system |
| `ui` | UI components |
| `api` | API calls |

## Filter System

Filters determine which logs are output. A log is output if **ANY** filter matches.

### Filter Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `executable` | string | Executable name pattern | `"backend"`, `"*"`, `"start.*"` |
| `level` | string | Minimum log level | `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`, `"fatal"` |
| `categories` | string[] | Category/group patterns | `["Storage"]`, `["*Handler"]`, `["*"]` |

### Pattern Matching

#### Executable Patterns
- `"backend"` - Exact match
- `"*"` - Matches any executable
- `"start.*"` - Matches executables starting with "start."

#### Category Patterns
- `"*"` - Matches all
- `"Storage"` - Matches the Storage group (all storage categories)
- `"UserStorage"` - Matches specific category
- `"*Storage"` - Matches categories ending with "Storage"

### Filter Examples

```json
{
  "filters": [
    // Backend: debug+ for Storage and LLM groups
    {
      "executable": "backend",
      "level": "debug",
      "categories": ["Storage", "LLM"]
    },
    // Frontend: info+ for all frontend categories
    {
      "executable": "frontend",
      "level": "info",
      "categories": ["*"]
    },
    // All executables: error+ only
    {
      "executable": "*",
      "level": "error",
      "categories": ["*"]
    }
  ]
}
```

## Usage by Language

### TypeScript (Backend)

```typescript
import { createLogger } from './utils/logger';

const logger = createLogger('UserStorage');  // Maps to Storage group

logger.trace('Detailed trace');
logger.debug('Debug info');
logger.info('User loaded', { userId: '123' });
logger.warn('Deprecated call');
logger.error('Failed to load');
logger.fatal('Cannot continue');
```

### TypeScript (Frontend)

```typescript
import { logger } from '@/lib/logger';

// Using pre-defined feature loggers
logger.chat.info('Message sent');
logger.auth.error('Login failed', { reason: 'invalid_password' });

// Or create custom category logger
const myLogger = logger.for('chat');
myLogger.debug('Debug info');
```

With React hooks:

```typescript
import { useLogger } from '@/hooks/use-logger';

function MyComponent() {
  const log = useLogger('ui', { includeComponentName: true });
  
  useEffect(() => {
    log.info('Component mounted');
  }, []);
}
```

## Log Output Format

```
HH:MM:SS.mmm [EXECUTABLE] [Category:id] Message
    extraField=value
```

Example:
```
00:01:37.390 [BACKEND] [UserStorage:user-123] User loaded
00:01:38.123 [BACKEND] [ExtensionUI:chart] Extension cached
00:01:39.456 [FRONTEND] [websocket] Connected
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `LOG_CONFIG_PATH` | Path to logging.json | `/etc/myapp/logging.json` |
| `LOG_ENABLED` | Override enabled setting | `false` |
| `LOG_EXECUTABLE` | Override executable name | `my-custom-app` |

## Log Levels

| Level | Priority | Use Case |
|-------|----------|----------|
| `trace` | 0 | Very detailed debugging, high-frequency events |
| `debug` | 1 | Development information, state changes |
| `info` | 2 | Important business events, user actions |
| `warn` | 3 | Recoverable issues, deprecated usage |
| `error` | 4 | Failures affecting user experience |
| `fatal` | 5 | System-wide failures, cannot continue |

## Category Colors

Categories have colors for console output (defined in `logging.json`):

| Group | Color |
|-------|-------|
| Core | Magenta |
| WebSocket | Blue |
| Auth | Yellow |
| Storage | Green |
| LLM | Cyan |
| Extension | Magenta |
| Tools | White |
| Handlers | Cyan |
| Middleware | Yellow |
| Migration | Yellow |

## Hot Reload

The TypeScript implementation watches `logging.json` for changes and reloads automatically. Go applications need to call `logging.Reload()` or restart.

## Disabling Logging

To completely disable logging:

```json
{
  "enabled": false
}
```

Or via environment variable:
```bash
LOG_ENABLED=false npm run dev
```

## See Also

- [`logging-categories.md`](./logging-categories.md) - Complete category reference
