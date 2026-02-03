# Logging Categories Reference

This file documents all logging categories organized by their filter groups.

## Category Groups (for filtering)

Use these high-level groups in `logging.json` filters:

| Group | Color | Description |
|-------|-------|-------------|
| `Core` | Magenta | Server core, setup, logging system |
| `WebSocket` | Blue | WebSocket server, events, WhatsApp WS |
| `Auth` | Yellow | Authentication handlers and services |
| `Storage` | Green | All storage adapters and factories |
| `LLM` | Cyan | LLM conversations and context |
| `Extension` | Magenta | Extension system and default extensions |
| `Tools` | White | Script runtime and tooling |
| `Handlers` | Cyan | HTTP request handlers |
| `Middleware` | Yellow | Middleware components |
| `Migration` | Yellow | Database migrations |

## Backend Categories by Group

### Core
| Category | File |
|----------|------|
| `Server` | `server/index.ts` |
| `Setup` | `server/setup-handler.ts` |
| `FrontendLogs` | `server/logs-handler.ts` |
| `Logging` | `utils/logger.ts` |
| `LogConfig` | `utils/logging-config.ts` |

### WebSocket
| Category | File |
|----------|------|
| `WebSocketServer` | `ws/entry.ts` |
| `WSEvents` | `ws/events.ts` |
| `WhatsAppWS` | `server/whatsapp-ws.ts` |
| `MessagePersistence` | `ws/msg-persistance.ts` |

### Auth
| Category | File |
|----------|------|
| `Auth` | `server/auth-handler.ts` |
| `AuthService` | `services/auth-service.ts` |
| `EmbedAuth` | `server/embed-auth-handler.ts` |

### Storage
| Category | File |
|----------|------|
| `UserStorage` | `storage/user-storage.ts` |
| `SessionStorage` | `storage/session-storage.ts` |
| `TenantStorage` | `storage/tenant-storage.ts` |
| `ProjectStorage` | `storage/project-storage.ts` |
| `FileStorage` | `storage/file-storage.ts` |
| `FileContextStorage` | `storage/file-context-storage.ts` |
| `CategoryStorage` | `storage/category-storage.ts` |
| `ChatHistoryStorage` | `storage/chat-history-storage.ts` |
| `ExtensionStorage` | `storage/extension-storage.ts` |
| `StorageFactory` | `storage/storage-factory.ts` |
| `StorageConfig` | `storage/storage-config.ts` |
| `SQLiteAdapter` | `storage/adapters/sqlite.ts` |
| `MemoryCache` | `storage/adapters/memory-cache.ts` |
| `ChatCompaction` | `storage/chat-compaction.ts` |

### Migration
| Category | File |
|----------|------|
| `Migration` | `scripts/migrate-embed-conversations.ts` |
| `Migrator` | `storage/migration/migrator.ts` |

### LLM
| Category | File |
|----------|------|
| `Conversation` | `llm/conversation.ts` |
| `Conversations` | `server/conversations-handler.ts` |
| `TitleGenerator` | `llm/conversation-title-generator.ts` |
| `TitleGeneratorUtil` | `utils/title-generator.ts` |
| `ContextBuilder` | `llm/context.ts` |
| `LLMHandler` | `server/llm-handler.ts` |

### Extension
| Category | File |
|----------|------|
| `Extensions` | `server/extensions-handler.ts` |
| `ExtensionGenerator` | `server/extension-generator-handler.ts` |
| `ExtensionGeneratorService` | `services/extension-generator.ts` |
| `ExtensionLoader` | `tools/extensions/extension-loader.ts` |
| `ExtensionWorker` | `tools/extensions/extension-worker.ts` |
| `ExtensionHooks` | `tools/extensions/extension-hooks.ts` |
| `ExtensionContext` | `tools/extensions/extension-context.ts` |
| `ExtensionUI` | `server/extension-ui-handler.ts` |
| `ExtensionDependency` | `server/extension-dependency-handler.ts` |
| `ExtensionCreator` | `tools/extensions/defaults/extension-creator/index.ts` |
| `ExcelExtension` | `tools/extensions/defaults/excel/index.ts` |
| `PowerPointExtension` | `tools/extensions/defaults/powerpoint/index.ts` |
| `PDFExtension` | `tools/extensions/defaults/pdf/index.ts` |
| `WordExtension` | `tools/extensions/defaults/word/index.ts` |
| `ImageExtension` | `tools/extensions/defaults/image/index.ts` |

### Tools
| Category | File |
|----------|------|
| `ScriptTool` | `tools/definition/script-tool.ts` |
| `ScriptRuntime` | `tools/extensions/script-runtime.ts` |
| `DependencyBundler` | `tools/extensions/dependency-bundler.ts` |
| `OutputStorage` | `tools/extensions/shared/output-storage.ts` |
| `PeekOutput` | `tools/extensions/shared/peek-output.ts` |

### Handlers
| Category | File |
|----------|------|
| `Projects` | `server/projects-handler.ts` |
| `Categories` | `server/categories-handler.ts` |
| `Files` | `server/files-handler.ts` |
| `Upload` | `server/upload-handler.ts` |
| `Memory` | `server/memory-handler.ts` |
| `Context` | `server/context-handler.ts` |
| `Tenant` | `server/tenant-handler.ts` |
| `Embed` | `server/embed-handler.ts` |
| `ImageSave` | `server/image-save-handler.ts` |
| `FileContextAPI` | `server/file-context-handler.ts` |
| `WhatsAppHandler` | `server/whatsapp-handler.ts` |

### Middleware
| Category | File |
|----------|------|
| `TenantCheck` | `middleware/tenant-check.ts` |

## Frontend Categories

| Category | Color | Description |
|----------|-------|-------------|
| `general` | White | General application |
| `chat` | Blue | Chat/conversations |
| `files` | Green | File operations |
| `auth` | Yellow | Authentication |
| `websocket` | Cyan | WebSocket connections |
| `extensions` | Magenta | Extension system |
| `ui` | Magenta | UI components |
| `api` | Cyan | API calls |

## Example Filters

### Log all Storage operations
```json
{
  "executable": "backend",
  "level": "debug",
  "categories": ["Storage"]
}
```

### Log specific categories
```json
{
  "executable": "backend",
  "level": "info",
  "categories": ["Auth", "WebSocketServer", "UserStorage"]
}
```

### Log multiple groups
```json
{
  "executable": "backend",
  "level": "info",
  "categories": ["Core", "Auth", "Storage", "LLM"]
}
```

### Frontend + Backend errors
```json
{
  "executable": "*",
  "level": "error",
  "categories": ["*"]
}
```
