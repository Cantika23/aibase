# Logging Migration Guide

## Overview

This document describes the centralized logging system that has been implemented across the AI Base codebase.

## What Was Changed

### Frontend Migration

All frontend files have been migrated from `console.log/error/warn` to the centralized logger:

#### Hooks (`src/hooks/`)
- `use-chat.ts` → `useLogger('chat')`
- `use-websocket-handlers.ts` → `useLogger('websocket')`
- `use-message-submission.ts` → `useLogger('chat')`
- `use-memory.ts` → `useLogger('memory')`
- `use-audio-recording.ts` → `useLogger('ui')`
- `use-visualization-save.ts` → `useLogger('files')`
- `use-auth.ts` → Kept as console.* (circular dependency risk)

#### Libraries (`src/lib/`)
- `ws/ws-client.ts` → `logger.websocket.*`
- `ws/ws-connection-manager.ts` → `logger.websocket.*`
- `ws/ws-emitter.ts` → `logger.websocket.*`
- `ws/active-tab-manager.ts` → `logger.ui.*`
- `embed-api.ts` → `logger.api.*`
- `extension-dependency-loader.ts` → `logger.extensions.*`
- `image-save.ts` → `logger.files.*`
- `message-persistence.ts` → `logger.chat.*`
- `setup.ts` → `logger.general.*`

#### Stores (`src/stores/`)
- `conversation-store.ts` → `logger.chat.*`
- `tenant-store.ts` → `logger.auth.*`
- `admin-store.ts` → `logger.auth.*`
- `auth-store.ts` → Kept as console.* (circular dependency risk - logger reads from localStorage managed by this store)

#### Components (`src/components/`)
All page components and UI components migrated to use `useLogger()` hook with appropriate feature.

### Backend Migration

All backend files have been migrated from `console.log/error/warn` to pino logger:

#### WebSocket (`src/ws/`)
- `entry.ts` → `createLogger('WebSocketServer')`
- `events.ts` → `createLogger('WSEvents')`
- `msg-persistance.ts` → `createLogger('MessagePersistence')`

#### Server Handlers (`src/server/`)
- `index.ts` → Uses existing `logger` import
- `whatsapp-handler.ts` → `createLogger('WhatsAppHandler')`
- `whatsapp-ws.ts` → `createLogger('WhatsAppWS')`
- `upload-handler.ts` → `createLogger('UploadHandler')`
- `extension-generator-handler.ts` → `createLogger('ExtensionGenerator')`
- `logs-handler.ts` → `createLogger('FrontendLogs')`

#### LLM (`src/llm/`)
- `conversation.ts` → `createLogger('Conversation')`
- `context.ts` → `createLogger('ContextBuilder')`
- `conversation-title-generator.ts` → `createLogger('TitleGenerator')`

#### Storage (`src/storage/`)
All storage files migrated:
- `chat-history-storage.ts`
- `category-storage.ts`
- `chat-compaction.ts`
- `extension-storage.ts`
- `file-context-storage.ts`
- `file-storage.ts`
- `project-storage.ts`
- `session-storage.ts`
- `tenant-storage.ts`
- `user-storage.ts`
- `migration/migrator.ts`
- `storage-factory.ts`
- `storage-config.ts`
- Adapters: `sqlite.ts`, `memory-cache.ts`

#### Tools & Extensions (`src/tools/`)
All extension files migrated:
- `extension-loader.ts`
- `extension-hooks.ts`
- `extension-worker.ts`
- `extension-context.ts`
- `script-runtime.ts`
- `definition/script-tool.ts`
- `shared/output-storage.ts`
- `shared/peek-output.ts`
- Defaults: `excel/index.ts`, `pdf/index.ts`, `word/index.ts`, `powerpoint/index.ts`, `image/index.ts`, `extension-creator/index.ts`

#### Services (`src/services/`)
- `extension-generator.ts` → `createLogger('ExtensionGeneratorService')`

#### Middleware (`src/middleware/`)
- `tenant-check.ts` → `createLogger('TenantCheck')`

#### Utilities (`src/utils/`)
- `title-generator.ts` → `createLogger('TitleGeneratorUtil')`

## Files Intentionally Left with console.*

### Frontend
1. **`src/stores/auth-store.ts`** - Logger reads auth token from localStorage which is managed by this store's persist. Importing logger would create circular dependency.
2. **`src/hooks/use-auth.ts`** - Has comment explaining circular dependency risk.
3. **`src/main.tsx`** - Single console.log for visualization libraries loaded (early app initialization).

### Backend
1. **Script files (`src/scripts/*`)** - One-off CLI migration scripts don't need structured logging.
2. **Documentation examples** - Console examples in JSDoc comments are intentional.

## How to Use the Logger

### Frontend

#### In React Components
```typescript
import { useLogger } from '@/hooks/use-logger';

function MyComponent() {
  const log = useLogger('feature'); // 'chat', 'websocket', 'auth', etc.
  
  useEffect(() => {
    log.info('Component mounted');
  }, [log]);
  
  const handleClick = () => {
    log.debug('Button clicked', { buttonId: 'save' });
    
    try {
      // ... do something
      log.info('Action completed');
    } catch (error) {
      log.error('Action failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  };
}
```

#### In Non-React Modules
```typescript
import { logger } from '@/lib/logger';

// Direct feature logger
logger.chat.info('Message sent', { messageId: '123' });
logger.websocket.error('Connection failed', { error: String(error) });

// Or create custom feature logger
const myLogger = logger.for('custom-feature');
myLogger.info('Custom log');
```

### Backend

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('MyFeature');

// pino format: context object first, then message string
logger.info('Simple message');
logger.info({ data }, 'Message with context');
logger.error({ error }, 'Error occurred');
logger.warn({ data }, 'Warning');
logger.debug({ data }, 'Debug info');
```

## Log Levels

### Priority Order (low to high)
1. `trace` - Very detailed debugging (high frequency)
2. `debug` - Debug information
3. `info` - General information (default in production)
4. `warn` - Warnings
5. `error` - Errors
6. `fatal` - Critical errors

### Guidelines
- Use `trace` for high-frequency logs (every WebSocket message, every chunk)
- Use `debug` for development-only info
- Use `info` for important business events
- Use `warn` for recoverable issues
- Use `error` for failures affecting user experience
- Use `fatal` for system-wide failures

## Features

### Frontend Features
- `general` - General application logs
- `chat` - Chat/conversation related
- `files` - File operations
- `whatsapp` - WhatsApp integration
- `auth` - Authentication
- `websocket` - WebSocket connections
- `extensions` - Extension system
- `memory` - Memory system
- `context` - Context management
- `ui` - UI components
- `api` - API calls

## Development Mode Features

In development mode (`import.meta.env.DEV`):
- Frontend logs are sent to backend via `/api/logs` endpoint
- Logs appear in browser console with color-coded levels
- Logs are batched for performance (default: 10 logs or 5 seconds)
- Development-only `LoggerControls` component available

## Configuration

```typescript
import { logger } from '@/lib/logger';

logger.configure({
  minLevel: 'debug',
  enabledFeatures: ['chat', 'websocket'],
  sendToBackend: true,
  consoleOutput: true,
  batchSize: 10,
  flushInterval: 5000,
});
```

## Testing Your Changes

After refactoring:
1. Run TypeScript check: `cd frontend && bun run build`
2. Run backend: `cd backend && bun run src/server/index.ts`
3. Check logs appear in:
   - Browser console (development)
   - `backend/logs/backend.log` (when `sendToBackend: true`)

## Migration Checklist

When refactoring existing code:
- [ ] Replace `console.log` with appropriate level (`log.debug()`, `log.info()`)
- [ ] Replace `console.error` with `log.error({ error: String(error) }, 'message')`
- [ ] Replace `console.warn` with `log.warn()`
- [ ] Convert multiple arguments to context object
- [ ] Never pass Error objects directly - convert to string
- [ ] Use appropriate feature name
- [ ] Add `log` to dependency arrays if used in useEffect
- [ ] Test that logs still appear
