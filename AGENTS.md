# AI Base - Agent Guidelines

## Development Commands

### Frontend (React + Vite)
- `bun run dev` - Start development server
- `bun run build` - Build for production (runs TypeScript check + Vite build)
- `bun run lint` - Run ESLint
- `bun run preview` - Preview production build

### Backend (Bun + TypeScript)
- `bun run src/server/index.ts` - Start backend server
- `bun run start` - Start backend server (alias)

## Code Style Guidelines

### TypeScript Configuration
- Strict mode enabled with `noUncheckedIndexedAccess`, `noImplicitOverride`
- ES2022 target with React JSX (ESNext for backend)
- Path aliases: `@/*` maps to `./src/*` in frontend

### Import Style
- Use absolute imports with `@/` prefix for internal modules
- Group imports: React libraries first, then external packages, then internal modules
- Example: `import { useState } from "react"; import { WSClient } from "@/lib/ws/ws-client";`

### Component Patterns
- Use shadcn/ui components with class-variance-authority (CVA)
- Utility function `cn()` for className merging (clsx + tailwind-merge)
- Forward refs and compound component patterns for UI components

### Error Handling
- Use try-catch blocks with proper error typing
- Return error states in hooks (error: string | null)
- Handle WebSocket errors with specific error message types

### Naming Conventions
- Components: PascalCase (Button, ChatInterface)
- Hooks: camelCase with `use` prefix (useChat, useAudioRecording)
- Functions: camelCase, descriptive names
- Constants: UPPER_SNAKE_CASE for exports

### File Organization
- Components in `src/components/` with feature-based folders
- Hooks in `src/hooks/`
- Utilities in `src/lib/`
- Types in `src/lib/types/`

### Page Layout Standards

All pages MUST follow consistent layout patterns to ensure proper spacing and prevent navigation overlap.

**Key Constants** (from `src/lib/layout-constants.ts`):
- Navigation offset: `60px` - accounts for absolute positioned navigation elements
- Mobile horizontal padding: `16px` (`px-4`)
- Desktop horizontal padding: `24px` (`px-6` @ md breakpoint)

**Standard Page Pattern**:
```tsx
<div className="flex h-screen-mobile flex-col">
  {/* Optional: PageActionGroup for action buttons */}

  <div className="flex-1 overflow-hidden">
    <div className="h-full px-4 pt-[60px] md:px-6 pb-4 overflow-y-auto">
      {/* Page content */}
    </div>
  </div>
</div>
```

**Layout Utilities** (from `src/index.css`):
- `.h-screen-mobile` - Uses `100dvh` for mobile browsers (accounts for browser UI)
- `.nav-offset` - Adds `padding-top: 60px` for navigation
- `.page-container` - Standard horizontal and bottom padding
- `.page-scrollable` - Full height with overflow

**CSS Classes Reference**:
- `h-screen-mobile` - Full viewport height (mobile-safe)
- `pt-[60px]` - Navigation offset (60px top padding)
- `px-4 md:px-6` - Responsive horizontal padding (16px mobile, 24px desktop)
- `pb-4 md:pb-6` - Responsive bottom padding (16px mobile, 24px desktop)

**Special Cases**:
- **Pages with headers**: Add `pt-[60px] md:pt-4` to header to account for navigation on mobile
- **Todo panel positioning**: Use `mt-[60px]` to account for navigation offset
- **Error alerts**: Use `mt-[60px]` when positioning below navigation

**Pages Using This Pattern**:
1. `extension-editor.tsx` - Header with navigation offset
2. `extensions-settings.tsx` - Standard pattern
3. `embed-settings.tsx` - Standard pattern
4. `memory-editor.tsx` - Standard pattern
5. `conversation-history.tsx` - Standard pattern
6. `files-manager.tsx` - Standard pattern
7. `context-editor.tsx` - Standard pattern
8. `main-chat.tsx` - Already correctly implemented

### WebSocket Architecture
- Real-time communication using custom WSClient/WSServer classes
- Event-driven architecture with typed message handling
- Connection state management with reconnection logic

### Logging Guidelines

The project uses a **centralized logging configuration** via `logging.json` in the project root. This file controls logging for **all executables** (backend, frontend, Go apps) based on three dimensions:

1. **Executable name** - Which binary is running (e.g., `backend`, `frontend`, `start.macos`)
2. **Level** - Minimum severity to log (`trace`, `debug`, `info`, `warn`, `error`, `fatal`)
3. **Category** - Component name (e.g., `Server`, `Auth`, `Database`)

#### Configuration File (`logging.json`)

Categories are organized into **groups** for simplified configuration:

| Group | Includes |
|-------|----------|
| `Core` | Server, Setup, Logging |
| `WebSocket` | WebSocketServer, WSEvents, WhatsAppWS |
| `Auth` | Auth, AuthService, EmbedAuth |
| `Storage` | *Storage, StorageFactory, SQLiteAdapter |
| `LLM` | Conversation, TitleGenerator, ContextBuilder |
| `Extension` | Extension*, ExcelExtension, PDFExtension, etc. |
| `Tools` | ScriptTool, DependencyBundler |
| `Handlers` | Projects, Files, Upload, Tenant, etc. |
| `Middleware` | TenantCheck |
| `Migration` | Migration, Migrator |

```json
{
  "enabled": true,
  "filters": [
    { "executable": "backend", "level": "info", "categories": ["Storage", "LLM", "Auth"] },
    { "executable": "*", "level": "warn", "categories": ["*"] }
  ]
}
```

**Pattern wildcards:**
- `"*"` - matches all
- `"prefix*"` - matches categories starting with "prefix"
- `"*suffix"` - matches categories ending with "suffix"

**Note:** You can filter by group name (e.g., `Storage`) or specific category (e.g., `UserStorage`). Both work!

#### Frontend Logging
```typescript
// ❌ DON'T use console.log
console.log('[Chat] Message sent', message);

// ✅ DO use the centralized logger
import { logger } from '@/lib/logger';
logger.chat.info('Message sent', { messageId: '123' });

// Or use the hook in components
import { useLogger } from '@/hooks/use-logger';
function MyComponent() {
  const log = useLogger('chat');
  log.info('Component mounted');
}
```

#### Backend Logging
```typescript
// ❌ DON'T use console.log
console.log('[Auth] User logged in');

// ✅ DO use the logger with category
import { createLogger } from '../utils/logger';
const logger = createLogger('Auth');
logger.info('User logged in');
logger.error({ error }, 'Login failed');
```

#### Go Logging
```go
// Initialize logging (usually in main())
import "yourproject/logging"
logging.Init("") // auto-detects executable name

// Create logger and use
log := logging.For("Server")
log.Info("Server starting", "port", 8080)
log.Error("Connection failed", "error", err)
```

#### Log Levels
- `trace` - Very detailed debugging (disabled in production)
- `debug` - Debug information (disabled in production)
- `info` - General information
- `warn` - Warnings
- `error` - Errors
- `fatal` - Critical errors

#### When to Use Each Level
- **trace**: High-frequency events (every render, every message received)
- **debug**: Development-only info (state changes, configuration)
- **info**: Important business events (user actions, API calls)
- **warn**: Recoverable issues (deprecated API usage, retry attempts)
- **error**: Failures that affect user experience (API errors, crashes)
- **fatal**: System-wide failures (database connection lost, cannot start)

#### Best Practices
1. Use descriptive category names (e.g., `UserService` not `US`)
2. Include relevant context (IDs, timestamps) but never PII/passwords
3. Use structured objects instead of string concatenation
4. Remove debug logs before production or use appropriate levels
5. Edit `logging.json` to control output - don't change code to disable logs

#### Environment Variable Overrides
- `LOG_CONFIG_PATH` - Path to `logging.json` (default: auto-detect)
- `LOG_ENABLED` - Override the enabled setting (`true`/`false`)
- `LOG_EXECUTABLE` - Override executable name (auto-detected if not set)

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync      # Beads workflow for session management and sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds