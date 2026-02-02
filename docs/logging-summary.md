# Logging System Migration - Summary

## Migration Complete ✅

All codebase files have been migrated to use the centralized logging system.

## Statistics

### Frontend
- **Files Modified**: 40+
- **Console Statements Replaced**: 200+
- **Pattern**: `useLogger()` hook for components, `logger.*` for modules

### Backend
- **Files Modified**: 50+
- **Console Statements Replaced**: 300+
- **Pattern**: `createLogger()` for feature-based modules

## Files Modified by Category

### Frontend

#### Core Libraries
- `lib/ws/ws-client.ts`
- `lib/ws/ws-connection-manager.ts`
- `lib/ws/ws-emitter.ts`
- `lib/ws/active-tab-manager.ts`
- `lib/embed-api.ts`
- `lib/extension-dependency-loader.ts`
- `lib/image-save.ts`
- `lib/message-persistence.ts`
- `lib/setup.ts`

#### Hooks
- `hooks/use-chat.ts`
- `hooks/use-websocket-handlers.ts`
- `hooks/use-message-submission.ts`
- `hooks/use-memory.ts`
- `hooks/use-audio-recording.ts`
- `hooks/use-visualization-save.ts`

#### Stores
- `stores/conversation-store.ts`
- `stores/tenant-store.ts`
- `stores/admin-store.ts`

#### Components (Pages)
- `components/pages/admin-setup.tsx`
- `components/pages/conversation-history.tsx`
- `components/pages/developer-api.tsx`
- `components/pages/embed-chat.tsx`
- `components/pages/embed-settings.tsx`
- `components/pages/extension-ai-creator.tsx`
- `components/pages/extension-editor.tsx`
- `components/pages/extensions-settings.tsx`
- `components/pages/file-detail.tsx`
- `components/pages/files-manager.tsx`
- `components/pages/whatsapp-settings.tsx`

#### Components (UI)
- `components/ui/chat/tools/tool-call.tsx`
- `components/ui/chat/tools/extension-inspector-registry.tsx`
- `components/ui/chat/tools/extension-component-registry.tsx`
- `components/ui/chat/tools/extension-inspector.tsx`
- `components/ui/script-details-dialog.tsx`
- `components/ui/file-preview-dialog.tsx`
- `components/ui/audio-visualizer.tsx`
- `components/ui/embed-conversation-list.tsx`
- `components/ui/token-status.tsx`
- `components/project/project-route-handler.tsx`

### Backend

#### WebSocket
- `ws/entry.ts`
- `ws/events.ts`
- `ws/msg-persistance.ts`

#### Server Handlers
- `server/index.ts`
- `server/whatsapp-handler.ts`
- `server/whatsapp-ws.ts`
- `server/upload-handler.ts`
- `server/extension-generator-handler.ts`
- `server/logs-handler.ts` (new file)

#### LLM
- `llm/conversation.ts`
- `llm/context.ts`
- `llm/conversation-title-generator.ts`

#### Storage
- `storage/chat-history-storage.ts`
- `storage/category-storage.ts`
- `storage/chat-compaction.ts`
- `storage/extension-storage.ts`
- `storage/file-context-storage.ts`
- `storage/file-storage.ts`
- `storage/project-storage.ts`
- `storage/session-storage.ts`
- `storage/tenant-storage.ts`
- `storage/user-storage.ts`
- `storage/migration/migrator.ts`
- `storage/storage-factory.ts`
- `storage/storage-config.ts`
- `storage/adapters/sqlite.ts`
- `storage/adapters/memory-cache.ts`

#### Tools & Extensions
- `tools/extensions/extension-loader.ts`
- `tools/extensions/extension-hooks.ts`
- `tools/extensions/extension-worker.ts`
- `tools/extensions/extension-context.ts`
- `tools/extensions/script-runtime.ts`
- `tools/definition/script-tool.ts`
- `tools/extensions/shared/output-storage.ts`
- `tools/extensions/shared/peek-output.ts`
- `tools/extensions/defaults/excel/index.ts`
- `tools/extensions/defaults/pdf/index.ts`
- `tools/extensions/defaults/word/index.ts`
- `tools/extensions/defaults/powerpoint/index.ts`
- `tools/extensions/defaults/image/index.ts`
- `tools/extensions/defaults/extension-creator/index.ts`

#### Services & Middleware
- `services/extension-generator.ts`
- `middleware/tenant-check.ts`
- `utils/title-generator.ts`

## New Files Created

### Shared Types
- `backend/src/lib/types/logs.ts`
- `frontend/src/lib/types/logs.ts`

### Logger Implementation
- `backend/src/server/logs-handler.ts`
- `frontend/src/lib/logger.ts`
- `frontend/src/hooks/use-logger.ts`
- `frontend/src/components/providers/logger-provider.tsx`

### Documentation
- `docs/logging-system.md`
- `docs/logging-examples.tsx`
- `docs/logging-migration-guide.md`
- `docs/logging-summary.md` (this file)

## Intentionally Kept as console.*

### Frontend
1. **`stores/auth-store.ts`** (12 console calls)
   - Reason: Circular dependency risk
   - The logger reads auth token from localStorage managed by this store

2. **`main.tsx`** (1 console call)
   - Reason: Early app initialization
   - Loaded before logger is configured

3. **`hooks/use-auth.ts`** (1 console call)
   - Reason: Has explicit comment about circular dependency

4. **`components/ui/chat/tools/extension-component-registry.tsx`**
   - Reason: Intentionally wrapping console for extension debugging proxy

### Backend
1. **Scripts (`scripts/*`)**
   - Reason: One-off CLI tools
   - Files: `create-root-user.ts`, `migrate-*.ts`

2. **JSDoc Documentation**
   - Reason: Examples for extension developers
   - Files: `script-runtime.ts`, `peek-output.ts`, `extension-creator/index.ts`

## Usage Examples

### Frontend Component
```typescript
import { useLogger } from '@/hooks/use-logger';

function ChatComponent() {
  const log = useLogger('chat');
  
  useEffect(() => {
    log.info('Component mounted');
  }, [log]);
  
  const handleSend = (message: string) => {
    log.info('Sending message', { messageLength: message.length });
  };
}
```

### Frontend Module
```typescript
import { logger } from '@/lib/logger';

logger.websocket.info('Connected');
logger.api.error('Request failed', { error: String(error) });
```

### Backend
```typescript
import { createLogger } from '../utils/logger';
const logger = createLogger('MyFeature');

logger.info('Message');
logger.error({ error }, 'Error occurred');
```

## Configuration

Default config in development:
```typescript
{
  minLevel: 'info',
  enabledFeatures: ['general', 'chat', 'files', 'auth', 'websocket', 
                    'extensions', 'memory', 'ui', 'api'],
  sendToBackend: true,      // Only in dev
  consoleOutput: true,
  batchSize: 10,
  flushInterval: 5000,
}
```

## Next Steps

1. **Monitor logs** in development to ensure proper log levels
2. **Adjust minLevel** in production if needed (default: 'info')
3. **Add more features** if needed by extending `LogFeature` type
4. **Update AGENTS.md** when adding new logging patterns

## Troubleshooting

### Logs not appearing in backend
- Check `sendToBackend: true` in config
- Verify authentication token is set
- Check browser network tab for `POST /api/logs`
- Ensure running in development mode

### Too many logs
- Increase `minLevel` (e.g., 'warn' instead of 'info')
- Reduce `enabledFeatures`
- Use `log.trace()` for high-frequency events

### Circular dependency errors
- Don't import logger in auth-store
- Keep console.* in low-level storage modules if needed
- Use direct localStorage reads for auth token (already implemented)
