# WebSocket LLM Communication Library

A modular TypeScript library for bidirectional WebSocket communication with LLM conversation systems. Built for Bun runtime with comprehensive error handling, reconnection logic, and real-time streaming capabilities.

## Features

- 🚀 **Real-time bidirectional communication** via WebSocket
- 🔄 **Automatic reconnection** with exponential backoff
- 📡 **Message streaming** for LLM responses
- 🛠️ **Tool integration** with real-time notifications
- 💾 **Session management** and conversation history
- 📊 **Connection monitoring** and statistics
- 🎯 **Type-safe** with full TypeScript support
- ⚡ **Optimized for Bun** runtime

## Quick Start

### Server Setup

```typescript
import { WSServer } from './ws';

const server = new WSServer({
  port: 3001,
  hostname: 'localhost',
  maxConnections: 50,
  conversationOptions: {
    systemPrompt: 'You are a helpful AI assistant.',
    maxHistoryLength: 20
  }
});

await server.start();
console.log('Server running on ws://localhost:3001/ws');
```

### Client Setup

```typescript
import { WSClient } from './ws';

const client = new WSClient({
  url: 'ws://localhost:3001/ws',
  reconnectAttempts: 5,
  reconnectDelay: 2000
});

// Setup event handlers
client.onLLMChunk(({ chunk }) => {
  process.stdout.write(chunk); // Stream response in real-time
});

client.onToolCall(({ toolName }) => {
  console.log(`Using tool: ${toolName}`);
});

// Connect and send message
await client.connect();
await client.sendMessage('What time is it?');
```

## API Reference

### WSClient

#### Constructor Options
```typescript
interface WSClientOptions {
  url: string;
  reconnectAttempts?: number;      // Default: 5
  reconnectDelay?: number;         // Default: 1000ms
  heartbeatInterval?: number;      // Default: 30000ms
  timeout?: number;                // Default: 10000ms
  protocols?: string[];            // WebSocket protocols
}
```

#### Methods
- `connect(): Promise<void>` - Connect to server
- `disconnect(): void` - Disconnect from server
- `sendMessage(text: string, options?: UserMessageData['options']): Promise<any>` - Send message
- `sendControl(control: ControlMessage): void` - Send control command
- `abort(): void` - Abort current processing
- `clearHistory(): void` - Clear conversation history
- `isConnected(): boolean` - Check connection status
- `getStats(): ConnectionStats` - Get connection statistics

#### Events
- `onConnected(handler: EventHandler)` - Connection established
- `onDisconnected(handler: EventHandler)` - Connection closed
- `onError(handler: ErrorEventHandler)` - Connection error
- `onReconnecting(handler: EventHandler)` - Reconnection attempt
- `onLLMChunk(handler: EventHandler)` - Streaming response chunk
- `onLLMComplete(handler: EventHandler)` - Complete response received
- `onToolCall(handler: EventHandler)` - Tool execution started
- `onToolResult(handler: EventHandler)` - Tool execution completed
- `onStatusChange(handler: EventHandler)` - Status change

### WSServer

#### Constructor Options
```typescript
interface WSServerOptions {
  port?: number;                   // Default: 3000
  hostname?: string;               // Default: 'localhost'
  maxConnections?: number;         // Default: 100
  heartbeatInterval?: number;      // Default: 30000ms
  enableCompression?: boolean;     // Default: true
  conversationOptions?: any;       // Conversation class options
}
```

#### Methods
- `start(): Promise<void>` - Start server
- `stop(): Promise<void>` - Stop server
- `sendToClient(convId: string, message: WSMessage): boolean` - Send to specific conversation
- `broadcast(message: WSMessage, excludeConvId?: string): number` - Broadcast to all
- `getActiveSessions(): SessionInfo[]` - Get active sessions
- `getConnectionCount(): number` - Get connection count

#### Events
- `onStarted(handler: EventHandler)` - Server started
- `onStopped(handler: EventHandler)` - Server stopped
- `onClientConnected(handler: EventHandler)` - Client connected
- `onClientDisconnected(handler: EventHandler)` - Client disconnected
- `onClientError(handler: EventHandler)` - Client error

## Message Protocol

### Client to Server Messages

#### User Message
```typescript
{
  type: 'user_message',
  id: 'msg_123',
  data: {
    text: 'Hello, how are you?',
    options?: {
      temperature?: 0.7,
      maxTokens?: 1000,
      tools?: string[]
    }
  }
}
```

#### Control Message
```typescript
{
  type: 'control',
  id: 'msg_124',
  data: {
    type: 'abort' | 'pause' | 'resume' | 'clear_history' | 'get_history' | 'get_status'
  }
}
```

### Server to Client Messages

#### LLM Chunk
```typescript
{
  type: 'llm_chunk',
  id: 'msg_125',
  data: {
    chunk: 'Hello! I',
    isComplete: false
  }
}
```

#### LLM Complete
```typescript
{
  type: 'llm_complete',
  id: 'msg_126',
  data: {
    fullText: 'Hello! I am doing well, thank you!'
  }
}
```

#### Tool Call
```typescript
{
  type: 'tool_call',
  id: 'msg_127',
  data: {
    toolCallId: 'tool_123',
    toolName: 'get_current_time',
    args: {},
    status: 'start' | 'complete' | 'error'
  }
}
```

## Examples

### Basic Chat Application

```typescript
// server.ts
import { WSServer } from './ws';

const server = new WSServer({ port: 3001 });
await server.start();

// client.ts
import { WSClient } from './ws';

const client = new WSClient({ url: 'ws://localhost:3001/ws' });

client.onLLMChunk(({ chunk }) => {
  process.stdout.write(chunk);
});

await client.connect();
await client.sendMessage('Hello!');
```

### Tool Integration

The server automatically provides default tools:
- `get_current_time` - Get current date/time
- `calculate` - Perform arithmetic calculations

### Error Handling

```typescript
client.onCommunicationError(({ code, message }) => {
  console.error(`Error ${code}: ${message}`);
});

client.onError((error) => {
  console.error('Connection error:', error);
});
```

## Running Examples

```bash
# Start server example
bun run examples/ws-server-example.ts

# Start client example (in another terminal)
bun run examples/ws-client-example.ts

# Run integration tests
bun run examples/ws-integration-test.ts
```

## Browser Usage

The library works in browsers with WebSocket support:

```html
<script type="module">
  import { WSClient } from './ws/index.js';

  const client = new WSClient({ url: 'ws://localhost:3001/ws' });
  client.onLLMChunk(({ chunk }) => {
    document.getElementById('response').textContent += chunk;
  });

  await client.connect();
</script>
```

## Architecture

```
┌─────────────┐ WebSocket Messages ┌─────────────┐
│   Client    │ ←────────────────→ │   Server    │
│             │                    │             │
│ WSClient    │                    │ WSServer    │
│             │                    │             │
└─────────────┘                    └─────────────┘
       │                                 │
       │ Event System                   │ Conversation
       │                                 │ Classes
       ▼                                 ▼
┌─────────────┐                    ┌─────────────┐
│ EventEmitter│                    │ Conversation │
└─────────────┘                    │    + Tools   │
                                    └─────────────┘
```

## Requirements

- **Bun** runtime
- **TypeScript** 5.0+
- **WebSocket** support
- **OpenAI API** key (for LLM functionality)

## License

MIT License - see LICENSE file for details.