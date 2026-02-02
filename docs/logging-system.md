# Centralized Logging System

A feature-based logging system that works across both backend and frontend, with frontend logs sent to the backend in development mode.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend       │     │   Log Files     │
│                 │     │                 │     │                 │
│  ┌───────────┐  │     │  ┌───────────┐  │     │  ┌───────────┐  │
│  │ logger.ts │──┼────▶│  │ logs-     │──┼────▶│  │ backend.  │  │
│  │ (batches) │  │     │  │ handler.ts│  │     │  │ log       │  │
│  └───────────┘  │     │  └───────────┘  │     │  └───────────┘  │
│        │        │     │        │        │     │                 │
│  ┌─────▼─────┐  │     │  ┌─────▼─────┐  │     │  ┌───────────┐  │
│  │ Console   │  │     │  │ pino      │──┼────▶│  │ backend-  │  │
│  │ (styled)  │  │     │  │ logger    │  │     │  │ error.log │  │
│  └───────────┘  │     │  └───────────┘  │     │  └───────────┘  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Quick Start

### 1. Wrap your app with LoggerProvider

```tsx
// App.tsx
import { LoggerProvider, LoggerControls } from '@/components/providers';

function App() {
  return (
    <LoggerProvider
      config={{
        minLevel: 'info',
        enabledFeatures: ['chat', 'websocket', 'auth'],
        sendToBackend: true,  // Only in dev
        consoleOutput: true,
      }}
    >
      <YourApp />
      <LoggerControls />  {/* Dev-only floating panel */}
    </LoggerProvider>
  );
}
```

### 2. Use the logger in components

```tsx
// ChatComponent.tsx
import { useLogger } from '@/hooks/use-logger';

function ChatComponent() {
  const log = useLogger('chat');

  useEffect(() => {
    log.info('Chat component mounted');
  }, []);

  const handleSend = (message: string) => {
    log.info('Sending message', { messageLength: message.length });
    
    try {
      // ... send logic
      log.debug('Message sent successfully', { messageId: '123' });
    } catch (error) {
      log.error('Failed to send message', { error: String(error) });
    }
  };

  return <div>...</div>;
}
```

### 3. Or use the direct logger API

```tsx
// Anywhere in your code
import { logger } from '@/lib/logger';

// Quick access to feature loggers
logger.chat.info('User started typing');
logger.websocket.debug('Connection established', { connectionId: 'ws-123' });
logger.auth.warn('Token expiring soon');
logger.api.error('Request failed', { status: 500 });

// Or create custom feature logger
const myLogger = logger.for('custom-feature');
myLogger.info('Custom log');
```

## Features

### Feature-Based Logging

Available features:
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

### Log Levels

Priority order (low to high):
1. `trace` - Very detailed debugging
2. `debug` - Debug information
3. `info` - General information
4. `warn` - Warnings
5. `error` - Errors
6. `fatal` - Critical errors

### Configuration Options

```typescript
interface LoggerConfig {
  minLevel: LogLevel;           // Minimum level to log
  enabledFeatures: LogFeature[]; // Which features to enable
  sendToBackend: boolean;       // Send to backend (dev only)
  backendEndpoint: string;      // Endpoint URL
  batchSize: number;            // Batch size before sending
  flushInterval: number;        // Flush interval in ms
  consoleOutput: boolean;       // Also log to console
}
```

## React Hooks

### useLogger(feature, options)

Main hook for feature logging:

```tsx
const log = useLogger('chat', {
  context: { roomId: 'room-123' },  // Added to all logs
  includeComponentName: true,        // Auto-detect component
});

log.info('Message');
log.error('Error', { extra: 'data' });
```

### useLifecycleLogger(feature, componentName)

Log component mount/unmount:

```tsx
function MyComponent() {
  useLifecycleLogger('ui', 'MyComponent');
  // Logs: "MyComponent mounted"
  return <div>...</div>;
}
```

### usePerformanceLogger(feature)

Measure operation performance:

```tsx
function MyComponent() {
  const perf = usePerformanceLogger('chat');

  const handleClick = () => {
    perf.measure('send_message', () => {
      // Expensive operation
      return result;
    });
    // Logs: "Operation completed: send_message { duration: "45.23ms" }"
  };
}
```

### useRenderLogger(feature, componentName, logEvery)

Track render counts (dev only):

```tsx
function MyComponent() {
  useRenderLogger('ui', 'MyComponent', 5);  // Log every 5 renders
  return <div>...</div>;
}
```

### useLoggerConfig()

Access and modify logger configuration:

```tsx
function Settings() {
  const { 
    config, 
    setMinLevel, 
    toggleFeature,
    flush,
    pendingCount 
  } = useLoggerConfig();

  return (
    <button onClick={() => setMinLevel('debug')}>
      Enable Debug
    </button>
  );
}
```

## Backend Integration

### Log Endpoint

Frontend logs are sent to `POST /api/logs` (development only).

### Log Format in Backend

Frontend logs appear in backend logs with `[Frontend:{feature}]` prefix:

```
[2024-01-15T10:30:00.000Z] INFO: [Frontend:chat] User started typing {
  _frontend: {
    userAgent: "Mozilla/5.0...",
    url: "http://localhost:5173/chat",
    userId: "123",
    sessionId: "session_...",
    timestamp: "2024-01-15T10:30:00.000Z"
  },
  _feature: "chat",
  messageLength: 42
}
```

### Security

- Endpoint only available in `NODE_ENV !== 'production'`
- Requires valid session token
- Validates authentication before processing

## Development Tools

### LoggerControls Component

A floating panel for controlling logging settings in development:

```tsx
<LoggerControls />
```

Features:
- Toggle log levels
- Enable/disable features
- Toggle backend sending
- Toggle console output
- Manual flush/clear

### Browser Console Output

Styled console output with color-coded levels:

- 🔵 `info` - Blue
- 🟡 `warn` - Yellow  
- 🔴 `error` - Red
- ⚫ `debug/trace` - Gray

## Advanced Usage

### Custom Logger Instance

```typescript
import { FeatureLogger } from '@/lib/logger';

class MyService {
  private logger: FeatureLogger;

  constructor() {
    this.logger = new FeatureLogger('custom');
  }

  doSomething() {
    this.logger.info('Doing something');
  }
}
```

### Conditional Logging

```typescript
// Only in specific environments
if (import.meta.env.DEV) {
  logger.general.debug('Debug info');
}

// Only for specific users
if (user.isAdmin) {
  logger.auth.trace('Admin action', { action });
}
```

### Batching & Flushing

```typescript
// Configure batching
logger.configure({
  batchSize: 20,        // Send every 20 logs
  flushInterval: 10000, // Or every 10 seconds
});

// Manual flush
await logger.flush();

// Check pending
console.log(logger.getPendingCount());

// Clear without sending
logger.clearPending();
```

### Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.api.error('Operation failed', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: { operationId: 'op-123' },
  });
}
```

## Migration Guide

### From console.log

```typescript
// Before
console.log('[Chat] Message sent', { id: 123 });

// After
import { logger } from '@/lib/logger';
logger.chat.info('Message sent', { id: 123 });
```

### From inline logging

```typescript
// Before
function MyComponent() {
  useEffect(() => {
    console.log('Component mounted');
  }, []);
}

// After
import { useLifecycleLogger } from '@/hooks/use-logger';

function MyComponent() {
  useLifecycleLogger('ui', 'MyComponent');
}
```

## Best Practices

1. **Use appropriate log levels**: Don't spam with `error` for non-errors
2. **Add context**: Include relevant IDs, state info
3. **Feature categorization**: Use the most specific feature
4. **Structured data**: Use objects instead of string concatenation
5. **Sensitive data**: Never log passwords, tokens, PII
6. **Performance**: Use `debug` level for high-frequency logs
7. **Cleanup**: Remove or downgrade debug logs before production

## Troubleshooting

### Logs not appearing in backend

1. Check `sendToBackend: true` in config
2. Verify authentication token is set
3. Check browser network tab for `POST /api/logs`
4. Ensure running in development mode

### Too many logs

1. Increase `minLevel` (e.g., 'warn' instead of 'info')
2. Reduce `enabledFeatures`
3. Use batching with higher `batchSize`

### Missing component names

Enable `includeComponentName: true` in `useLogger` options.
