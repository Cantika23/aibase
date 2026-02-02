/**
 * @fileoverview Logging System Integration Examples
 * 
 * This file shows how to integrate the centralized logging system
 * into existing components.
 */

// ============================================================================
// 1. BASIC USAGE IN A COMPONENT
// ============================================================================

import { useLogger, useLifecycleLogger } from '@/hooks/use-logger';

function ChatMessageComponent({ message }: { message: string }) {
  // Create a logger for the 'chat' feature
  const log = useLogger('chat', {
    context: { component: 'ChatMessageComponent' },
  });

  // Log lifecycle events
  useLifecycleLogger('chat', 'ChatMessageComponent');

  const handleCopy = () => {
    log.info('Copying message to clipboard', { 
      messageLength: message.length 
    });
    
    try {
      navigator.clipboard.writeText(message);
      log.debug('Message copied successfully');
    } catch (error) {
      log.error('Failed to copy message', { error: String(error) });
    }
  };

  return <button onClick={handleCopy}>Copy</button>;
}

// ============================================================================
// 2. WEBSOCKET LOGGING (Integrating with existing WS client)
// ============================================================================

import { logger } from '@/lib/logger';

// In your WebSocket client code, replace console.log with logger:
class WSClientEnhanced {
  private log = logger.for('websocket');

  connect() {
    this.log.info('Connecting to WebSocket', { url: this.url });
    
    this.ws.onopen = () => {
      this.log.info('WebSocket connection established');
    };

    this.ws.onmessage = (event) => {
      this.log.debug('Message received', { 
        dataLength: event.data.length 
      });
    };

    this.ws.onerror = (error) => {
      this.log.error('WebSocket error', { error: String(error) });
    };

    this.ws.onclose = (event) => {
      this.log.warn('WebSocket closed', { 
        code: event.code, 
        reason: event.reason 
      });
    };
  }
}

// ============================================================================
// 3. API CALL LOGGING
// ============================================================================

import { usePerformanceLogger } from '@/hooks/use-logger';

function useFileUpload() {
  const perf = usePerformanceLogger('files');
  const log = useLogger('files');

  const uploadFile = async (file: File) => {
    log.info('Starting file upload', { 
      fileName: file.name, 
      fileSize: file.size 
    });

    return perf.measureAsync('file_upload', async () => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        log.error('Upload failed', { 
          status: response.status,
          statusText: response.statusText 
        });
        throw new Error('Upload failed');
      }

      const result = await response.json();
      log.info('Upload completed', { fileId: result.id });
      return result;
    });
  };

  return { uploadFile };
}

// ============================================================================
// 4. AUTH FLOW LOGGING
// ============================================================================

import { logger } from '@/lib/logger';

function useAuthWithLogging() {
  const log = useLogger('auth');

  const login = async (credentials: { email: string; password: string }) => {
    log.info('Login attempt', { email: credentials.email });

    try {
      const result = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!result.ok) {
        const error = await result.json();
        log.warn('Login failed', { 
          email: credentials.email,
          reason: error.message 
        });
        throw new Error(error.message);
      }

      const data = await result.json();
      log.info('Login successful', { userId: data.user.id });
      return data;
    } catch (error) {
      log.error('Login error', { 
        email: credentials.email,
        error: String(error) 
      });
      throw error;
    }
  };

  const logout = () => {
    log.info('User logging out');
    // ... logout logic
  };

  return { login, logout };
}

// ============================================================================
// 5. EXTENSION SYSTEM LOGGING
// ============================================================================

import { logger } from '@/lib/logger';

class ExtensionLoader {
  private log = logger.for('extensions');

  async loadExtension(extensionId: string) {
    this.log.info('Loading extension', { extensionId });

    try {
      const startTime = performance.now();
      const extension = await this.fetchExtension(extensionId);
      const loadTime = performance.now() - startTime;

      this.log.info('Extension loaded', { 
        extensionId,
        loadTime: `${loadTime.toFixed(2)}ms`,
        version: extension.version 
      });

      return extension;
    } catch (error) {
      this.log.error('Failed to load extension', { 
        extensionId,
        error: String(error) 
      });
      throw error;
    }
  }

  executeExtension(extensionId: string, params: unknown) {
    this.log.debug('Executing extension', { extensionId, params });
    
    try {
      const result = this.runExtension(extensionId, params);
      this.log.debug('Extension executed successfully', { extensionId });
      return result;
    } catch (error) {
      this.log.error('Extension execution failed', { 
        extensionId,
        error: String(error) 
      });
      throw error;
    }
  }
}

// ============================================================================
// 6. UI COMPONENT LOGGING
// ============================================================================

import { useRenderLogger, useLogger } from '@/hooks/use-logger';

function ExpensiveComponent({ data }: { data: unknown[] }) {
  // Track renders in development
  useRenderLogger('ui', 'ExpensiveComponent', 10);

  const log = useLogger('ui');

  const handleClick = () => {
    log.info('Button clicked', { 
      itemCount: data.length,
      timestamp: Date.now() 
    });
  };

  return (
    <div onClick={handleClick}>
      {data.length} items
    </div>
  );
}

// ============================================================================
// 7. APP SETUP WITH PROVIDER
// ============================================================================

import { LoggerProvider, LoggerControls } from '@/components/providers';
import { AppRouter } from '@/components/app-router';

function App() {
  return (
    <LoggerProvider
      config={{
        // Only log info and above
        minLevel: 'info',
        
        // Enable these features
        enabledFeatures: [
          'chat',
          'websocket',
          'auth',
          'files',
          'api',
        ],
        
        // Send to backend in dev mode
        sendToBackend: import.meta.env.DEV,
        
        // Also show in console
        consoleOutput: true,
        
        // Batch settings
        batchSize: 10,
        flushInterval: 5000,
      }}
    >
      <AppRouter />
      
      {/* Development-only controls */}
      {import.meta.env.DEV && <LoggerControls />}
    </LoggerProvider>
  );
}

// ============================================================================
// 8. MEMORY SYSTEM LOGGING
// ============================================================================

import { logger } from '@/lib/logger';

function useMemoryWithLogging() {
  const log = useLogger('memory');

  const saveToMemory = async (key: string, value: unknown) => {
    log.info('Saving to memory', { key, valueType: typeof value });

    try {
      await saveMemory(key, value);
      log.debug('Memory saved successfully', { key });
    } catch (error) {
      log.error('Failed to save memory', { key, error: String(error) });
      throw error;
    }
  };

  const loadFromMemory = async (key: string) => {
    log.debug('Loading from memory', { key });

    try {
      const value = await loadMemory(key);
      log.debug('Memory loaded', { key, hasValue: value != null });
      return value;
    } catch (error) {
      log.error('Failed to load memory', { key, error: String(error) });
      throw error;
    }
  };

  return { saveToMemory, loadFromMemory };
}

// ============================================================================
// 9. CONTEXT MANAGEMENT LOGGING
// ============================================================================

import { logger } from '@/lib/logger';

function useContextWithLogging() {
  const log = useLogger('context');

  const updateContext = (newContext: Record<string, unknown>) => {
    log.info('Updating context', { 
      keys: Object.keys(newContext),
      size: JSON.stringify(newContext).length 
    });

    try {
      setContext(prev => {
        const updated = { ...prev, ...newContext };
        log.debug('Context updated', { 
          previousKeys: Object.keys(prev),
          newKeys: Object.keys(updated) 
        });
        return updated;
      });
    } catch (error) {
      log.error('Context update failed', { error: String(error) });
      throw error;
    }
  };

  return { updateContext };
}

// ============================================================================
// 10. WHATSAPP INTEGRATION LOGGING
// ============================================================================

import { logger } from '@/lib/logger';

class WhatsAppService {
  private log = logger.for('whatsapp');

  async initialize() {
    this.log.info('Initializing WhatsApp service');
    
    try {
      await this.connect();
      this.log.info('WhatsApp service initialized');
    } catch (error) {
      this.log.error('WhatsApp initialization failed', { 
        error: String(error) 
      });
      throw error;
    }
  }

  onQRCode(qr: string) {
    this.log.info('QR code generated');
  }

  onReady() {
    this.log.info('WhatsApp client ready');
  }

  onMessage(message: unknown) {
    this.log.debug('Message received', { 
      from: (message as any).from,
      type: (message as any).type 
    });
  }

  onError(error: Error) {
    this.log.error('WhatsApp error', { 
      message: error.message,
      stack: error.stack 
    });
  }
}
