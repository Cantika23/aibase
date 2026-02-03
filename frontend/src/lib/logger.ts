/**
 * Centralized feature-based logger for frontend
 * Sends logs to backend in development mode
 */

import type {
  LogLevel,
  LogFeature,
  LogEntry,
  LoggerConfig,
} from './types/logs';
import { LOG_LEVEL_PRIORITY, shouldLog } from './types/logs';

/**
 * Get auth token from localStorage (Zustand persist storage)
 * We read directly from localStorage to avoid circular dependencies with auth store
 */
function getAuthToken(): string | null {
  try {
    const storage = localStorage.getItem('auth-storage');
    if (storage) {
      const parsed = JSON.parse(storage);
      return parsed.state?.token || null;
    }
  } catch {
    // Ignore localStorage errors (e.g., private browsing mode)
  }
  return null;
}

/** Default logger configuration - logging disabled by default */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'fatal',  // Only fatal errors (effectively disabled)
  enabledFeatures: [], // No features enabled by default
  sendToBackend: false, // Never send to backend by default
  backendEndpoint: '/api/logs',
  batchSize: 10,
  flushInterval: 5000,
  consoleOutput: false, // Console output disabled by default
};

/** Current logger configuration */
let config: LoggerConfig = { ...DEFAULT_CONFIG };

/** Pending logs queue */
const pendingLogs: LogEntry[] = [];

/** Flush timer */
let flushTimer: ReturnType<typeof setInterval> | null = null;

/** Session ID for tracking */
let sessionId = '';

/**
 * Generate or retrieve session ID
 */
function getSessionId(): string {
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
  return sessionId;
}

/**
 * Get user ID from auth store if available
 */
function getUserId(): string | undefined {
  try {
    // Try to get from auth store
    const { useAuthStore } = require('../stores/auth-store');
    return useAuthStore.getState().user?.id;
  } catch {
    return undefined;
  }
}

/**
 * Flush pending logs to backend
 */
async function flushLogs(): Promise<void> {
  if (pendingLogs.length === 0 || !config.sendToBackend) return;

  const logsToSend = [...pendingLogs];
  pendingLogs.length = 0;

  try {
    const token = getAuthToken();
    if (!token) {
      // Re-queue logs if no token
      pendingLogs.push(...logsToSend);
      return;
    }

    const response = await fetch(config.backendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ logs: logsToSend }),
    });

    if (!response.ok) {
      // Re-queue on failure
      pendingLogs.push(...logsToSend);
    }
  } catch (error) {
    // Re-queue on network failure
    pendingLogs.push(...logsToSend);
  }
}

/**
 * Start the flush timer
 */
function startFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushLogs();
  }, config.flushInterval);
}

/**
 * Stop the flush timer
 */
function stopFlushTimer(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Queue a log for sending to backend
 */
function queueLog(log: LogEntry): void {
  if (!config.sendToBackend) return;

  pendingLogs.push(log);

  // Flush immediately if batch size reached
  if (pendingLogs.length >= config.batchSize) {
    flushLogs();
  }
}

/**
 * Output log to console
 */
function outputToConsole(log: LogEntry): void {
  if (!config.consoleOutput) return;

  const prefix = `[${log.feature.toUpperCase()}]`;
  const styles = getLogStyles(log.level);

  switch (log.level) {
    case 'trace':
      console.debug(`%c${prefix}`, styles, log.message, log.context || '');
      break;
    case 'debug':
      console.debug(`%c${prefix}`, styles, log.message, log.context || '');
      break;
    case 'info':
      console.log(`%c${prefix}`, styles, log.message, log.context || '');
      break;
    case 'warn':
      console.warn(`%c${prefix}`, styles, log.message, log.context || '');
      break;
    case 'error':
    case 'fatal':
      console.error(`%c${prefix}`, styles, log.message, log.context || '');
      break;
  }
}

/**
 * Get CSS styles for log level
 */
function getLogStyles(level: LogLevel): string {
  const colors: Record<LogLevel, string> = {
    trace: 'color: #9ca3af', // gray-400
    debug: 'color: #6b7280', // gray-500
    info: 'color: #3b82f6', // blue-500
    warn: 'color: #f59e0b', // amber-500
    error: 'color: #ef4444', // red-500
    fatal: 'color: #dc2626; font-weight: bold', // red-600
  };
  return colors[level] || '';
}

/**
 * Check if a log should be processed
 */
function isLogEnabled(level: LogLevel, feature: LogFeature): boolean {
  // Check level
  if (!shouldLog(level, config.minLevel)) return false;

  // Check feature
  if (!config.enabledFeatures.includes(feature)) return false;

  return true;
}

/**
 * Create a log entry and process it
 */
function createLog(
  level: LogLevel,
  feature: LogFeature,
  message: string,
  context?: Record<string, unknown>
): void {
  if (!isLogEnabled(level, feature)) return;

  const log: LogEntry = {
    level,
    feature,
    message,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId: getUserId(),
    sessionId: getSessionId(),
  };

  // Output to console
  outputToConsole(log);

  // Queue for backend (dev only)
  queueLog(log);
}

/**
 * Logger class for a specific feature
 */
export class FeatureLogger {
  constructor(private feature: LogFeature) {}

  trace(message: string, context?: Record<string, unknown>): void {
    createLog('trace', this.feature, message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    createLog('debug', this.feature, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    createLog('info', this.feature, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    createLog('warn', this.feature, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    createLog('error', this.feature, message, context);
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    createLog('fatal', this.feature, message, context);
  }
}

/**
 * Logger factory - creates loggers for specific features
 */
export const logger = {
  /** Get a logger for a specific feature */
  for(feature: LogFeature): FeatureLogger {
    return new FeatureLogger(feature);
  },

  /** Quick access to general logger */
  get general() {
    return new FeatureLogger('general');
  },

  /** Quick access to chat logger */
  get chat() {
    return new FeatureLogger('chat');
  },

  /** Quick access to files logger */
  get files() {
    return new FeatureLogger('files');
  },

  /** Quick access to auth logger */
  get auth() {
    return new FeatureLogger('auth');
  },

  /** Quick access to websocket logger */
  get websocket() {
    return new FeatureLogger('websocket');
  },

  /** Quick access to extensions logger */
  get extensions() {
    return new FeatureLogger('extensions');
  },

  /** Quick access to ui logger */
  get ui() {
    return new FeatureLogger('ui');
  },

  /** Quick access to api logger */
  get api() {
    return new FeatureLogger('api');
  },

  /** Update logger configuration */
  configure(newConfig: Partial<LoggerConfig>): void {
    config = { ...config, ...newConfig };

    // Start/stop timer based on sendToBackend setting
    if (config.sendToBackend) {
      startFlushTimer();
    } else {
      stopFlushTimer();
    }
  },

  /** Get current configuration */
  getConfig(): LoggerConfig {
    return { ...config };
  },

  /** Reset to default configuration */
  resetConfig(): void {
    config = { ...DEFAULT_CONFIG };
  },

  /** Force flush pending logs */
  flush(): Promise<void> {
    return flushLogs();
  },

  /** Get pending logs count */
  getPendingCount(): number {
    return pendingLogs.length;
  },

  /** Clear pending logs without sending */
  clearPending(): void {
    pendingLogs.length = 0;
  },
};

// Auto-start flush timer in dev mode
if (config.sendToBackend) {
  startFlushTimer();
}

// Flush on page unload
window.addEventListener('beforeunload', () => {
  if (pendingLogs.length > 0) {
    // Use fetch with keepalive for reliable delivery (sendBeacon doesn't support custom headers)
    const token = getAuthToken();
    if (token) {
      const blob = new Blob(
        [JSON.stringify({ logs: pendingLogs })],
        { type: 'application/json' }
      );
      // Use fetch with keepalive instead of sendBeacon to support auth headers
      fetch(config.backendEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: blob,
        keepalive: true,
      }).catch(() => {
        // Silently fail on unload - we've done our best
      });
    }
  }
});

export default logger;
