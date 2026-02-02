/**
 * Shared logging types for frontend-backend communication
 */

/** Log severity levels */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Feature domains for categorizing logs */
export type LogFeature = 
  | 'general'
  | 'chat'
  | 'files'
  | 'whatsapp'
  | 'auth'
  | 'websocket'
  | 'extensions'
  | 'memory'
  | 'context'
  | 'ui'
  | 'api';

/** Base log entry structure */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Feature/domain this log belongs to */
  feature: LogFeature;
  /** Log message */
  message: string;
  /** Optional context object with additional data */
  context?: Record<string, unknown>;
  /** Timestamp (ISO string) */
  timestamp: string;
  /** User agent (frontend only) */
  userAgent?: string;
  /** URL where log originated (frontend only) */
  url?: string;
  /** User ID if authenticated */
  userId?: string;
  /** Session ID */
  sessionId?: string;
}

/** Batch of log entries for efficient transmission */
export interface LogBatch {
  logs: LogEntry[];
}

/** Logger configuration options */
export interface LoggerConfig {
  /** Minimum log level to capture */
  minLevel: LogLevel;
  /** Features to enable logging for */
  enabledFeatures: LogFeature[];
  /** Whether to send logs to backend (frontend only) */
  sendToBackend: boolean;
  /** Backend endpoint URL (frontend only) */
  backendEndpoint: string;
  /** Batch size before sending (frontend only) */
  batchSize: number;
  /** Flush interval in ms (frontend only) */
  flushInterval: number;
  /** Whether to also log to console */
  consoleOutput: boolean;
}

/** Default log levels priority (lower = more verbose) */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/** Check if a log level should be logged based on minimum level */
export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}
