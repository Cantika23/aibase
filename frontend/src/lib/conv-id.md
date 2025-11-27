# Conversation ID Management

This document describes the conversation ID management system implemented in the frontend application.

## Overview

The conversation ID system provides a persistent way to identify and track individual client sessions across browser restarts and page reloads. This is useful for:

- Maintaining conversation history continuity
- Debugging and troubleshooting
- Analytics and user tracking
- Server-side session management

## Architecture

### Core Components

1. **`ConvIdManager`** (`/src/lib/conv-id.ts`)
   - Static class for conversation ID operations
   - Handles localStorage persistence
   - Provides utility methods for ID management

2. **`useConvId`** Hook (`/src/lib/conv-id.ts`)
   - React hook for component integration
   - Provides reactive state management
   - Handles cross-tab synchronization

3. **Integration Points**
   - **WSClient** (`/src/lib/ws/ws-client.ts`) - Uses conversation ID for WebSocket connections
   - **ShadcnChatInterface** (`/src/components/shadcn-chat-interface.tsx`) - Main UI component with conversation ID awareness

## Usage

### Basic Usage

```typescript
import { ConvIdManager } from '@/lib/conv-id';

// Get current conversation ID (generates one if doesn't exist)
const convId = ConvIdManager.getConvId();

// Set a specific conversation ID
ConvIdManager.setConvId('custom-conv-id');

// Generate a new conversation ID
const newId = ConvIdManager.generateConvId();

// Check if conversation ID exists
const hasId = ConvIdManager.hasConvId();

// Clear stored conversation ID
ConvIdManager.clearConvId();
```

### React Hook Usage

```typescript
import { useConvId } from '@/lib/conv-id';

function MyComponent() {
  const {
    convId,            // Current conversation ID
    setConvId,          // Set a specific conversation ID
    generateNewConvId,   // Generate and set new ID
    clearConvId,        // Clear stored ID
    hasConvId,          // Boolean flag
    metadata           // Debug metadata
  } = useConvId();

  return (
    <div>
      <p>Conversation ID: {convId}</p>
      <button onClick={generateNewConvId}>
        Generate New ID
      </button>
    </div>
  );
}
```

## Storage Details

- **Storage Mechanism**: `localStorage`
- **Storage Key**: `ws_conv_id`
- **ID Format**: `client_${timestamp}_${randomString}`
- **Persistence**: Survives browser restarts and page reloads
- **Cross-tab Sync**: Changes are synchronized across browser tabs

## Debug Features

The development environment includes a debug component (`ConvIdDebug`) that displays:

- Current conversation ID
- Storage status (stored vs generated)
- Browser environment detection
- Manual ID management controls

### Debug Component Usage

```typescript
import { ConvIdDebug } from '@/components/debug/conv-id-debug';

// Only renders in development mode
<ConvIdDebug />
```

## Integration Examples

### WebSocket Integration

The WebSocket client automatically includes the conversation ID in:

1. **Connection URL**: `?convId=conv_123_abc`
2. **Message Metadata**: All messages include `convId` in their metadata
3. **State Management**: Connection state tracks the active conversation ID

### Message Metadata

```typescript
{
  type: "user_message",
  id: "msg_123_456",
  data: { text: "Hello" },
  metadata: {
    timestamp: 1634567890,
    convId: "conv_123_abc",
    sequence: 1
  }
}
```

## Security Considerations

- Client IDs are **not** security tokens
- They are **not** used for authentication
- They are **public** and can be shared
- Do not rely on conversation IDs for sensitive operations

## Best Practices

1. **Always use the utility functions** rather than direct localStorage access
2. **Handle the case** where conversation ID might not be available (server-side rendering)
3. **Use the React hook** for component-level integration
4. **Leverage the debug component** during development
5. **Consider cross-tab scenarios** when implementing features

## Troubleshooting

### Common Issues

1. **Missing Client ID in Production**
   - Check if localStorage is available
   - Verify browser privacy settings
   - Check for localStorage quota issues

2. **Multiple Client IDs**
   - Ensure consistent usage of `ConvIdManager`
   - Check for accidental localStorage clears
   - Verify cross-tab synchronization

3. **Debug Component Not Showing**
   - Verify `NODE_ENV` is set to "development"
   - Check if the component is properly imported
   - Ensure the component is not behind conditional rendering

### Logging

The system logs conversation ID information during WebSocket initialization:

```
ShadcnChatInterface: Initializing with Client ID: client_123_abc
ShadcnChatInterface: Client metadata: {
  convId: "conv_123_abc",
  hasStoredId: true,
  isBrowserEnvironment: true
}
```

## Migration Notes

If migrating from a previous system:

1. The storage key (`ws_conv_id`) remains the same for backward compatibility
2. The ID format is compatible with existing implementations
3. Existing conversation IDs will be preserved and continue to work