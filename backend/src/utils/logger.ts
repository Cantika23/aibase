import pino from 'pino';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import { PATHS } from '../config/paths';
import {
  getLoggingConfig,
  shouldLog,
  isLevelEnabled,
  type LogLevel,
  reloadLoggingConfig,
  getLoggingDebugInfo,
  getConfigFilePath,
} from './logging-config';

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create logs directory if it doesn't exist
const logsDir = process.env.LOGS_DIR || PATHS.BACKEND_LOGS;

// Ensure logs directory exists
mkdir(logsDir, { recursive: true }).catch(() => {});

// Log file paths
const logFile = join(logsDir, 'backend.log');
const errorLogFile = join(logsDir, 'backend-error.log');

// Category group mappings - maps detailed categories to simplified groups
// This allows filtering by high-level groups while maintaining detailed category names
const categoryGroups: Record<string, string> = {
  // Core
  'Server': 'Core',
  'Setup': 'Core',
  'FrontendLogs': 'Core',
  'Logging': 'Core',
  'LogConfig': 'Core',
  
  // WebSocket
  'WebSocketServer': 'WebSocket',
  'WSEvents': 'WebSocket',
  'WhatsAppWS': 'WebSocket',
  'MessagePersistence': 'WebSocket',
  
  // Auth
  'Auth': 'Auth',
  'AuthService': 'Auth',
  'EmbedAuth': 'Auth',
  
  // Storage
  'UserStorage': 'Storage',
  'SessionStorage': 'Storage',
  'TenantStorage': 'Storage',
  'ProjectStorage': 'Storage',
  'FileStorage': 'Storage',
  'FileContextStorage': 'Storage',
  'CategoryStorage': 'Storage',
  'ChatHistoryStorage': 'Storage',
  'ExtensionStorage': 'Storage',
  'StorageFactory': 'Storage',
  'StorageConfig': 'Storage',
  'SQLiteAdapter': 'Storage',
  'MemoryCache': 'Storage',
  'ChatCompaction': 'Storage',
  
  // Migration
  'Migration': 'Migration',
  'Migrator': 'Migration',
  
  // LLM
  'Conversation': 'LLM',
  'Conversations': 'LLM',
  'TitleGenerator': 'LLM',
  'TitleGeneratorUtil': 'LLM',
  'ContextBuilder': 'LLM',
  'LLMHandler': 'LLM',
  
  // Extensions
  'Extensions': 'Extension',
  'ExtensionGenerator': 'Extension',
  'ExtensionGeneratorService': 'Extension',
  'ExtensionLoader': 'Extension',
  'ExtensionWorker': 'Extension',
  'ExtensionHooks': 'Extension',
  'ExtensionContext': 'Extension',
  'ExtensionUI': 'Extension',
  'ExtensionDependency': 'Extension',
  'ExtensionCreator': 'Extension',
  
  // Tools
  'ScriptTool': 'Tools',
  'ScriptRuntime': 'Tools',
  'DependencyBundler': 'Tools',
  'OutputStorage': 'Tools',
  'PeekOutput': 'Tools',
  
  // Default Extensions
  'ExcelExtension': 'Extension',
  'PowerPointExtension': 'Extension',
  'PDFExtension': 'Extension',
  'WordExtension': 'Extension',
  'ImageExtension': 'Extension',
  
  // Handlers
  'Projects': 'Handlers',
  'Categories': 'Handlers',
  'Files': 'Handlers',
  'Upload': 'Handlers',
  'Memory': 'Handlers',
  'Context': 'Handlers',
  'Tenant': 'Handlers',
  'Embed': 'Handlers',
  'ImageSave': 'Handlers',
  'FileContextAPI': 'Handlers',
  'WhatsAppHandler': 'Handlers',
  
  // Middleware
  'TenantCheck': 'Middleware',
};

// Group colors for display
const groupColors: Record<string, string> = {
  'Core': 'magenta',
  'WebSocket': 'blue',
  'Auth': 'yellow',
  'Storage': 'green',
  'LLM': 'cyan',
  'Extension': 'magenta',
  'Tools': 'white',
  'Handlers': 'cyan',
  'Middleware': 'yellow',
  'Migration': 'yellow',
};

// Get the group for a category, returns the category itself if no mapping exists
function getCategoryGroup(category: string): string {
  return categoryGroups[category] || category;
}

// Get color for a category (uses group color)
function getCategoryColor(category: string): string {
  const config = getLoggingConfig();
  const group = getCategoryGroup(category);
  
  // Check config-defined colors first (for groups)
  if (config.categoryColors?.[group]) {
    return config.categoryColors[group];
  }
  
  // Fall back to built-in group colors
  return groupColors[group] || 'white';
}

// Executable colors - each executable gets a unique color
const executableColors: Record<string, string> = {
  'backend': 'brightMagenta',
  'frontend': 'brightBlue',
  'start-macos': 'brightGreen',
  'start-linux': 'brightYellow',
  'start-win': 'brightCyan',
  'app': 'brightWhite',
};

// Get color for executable name
function getExecutableColor(executable: string): string {
  // Check for exact match first
  if (executableColors[executable]) {
    return executableColors[executable];
  }
  
  // Check for pattern matches (e.g., "start.macos" matches "start-macos")
  const normalized = executable.toLowerCase().replace(/[._]/g, '-');
  if (executableColors[normalized]) {
    return executableColors[normalized];
  }
  
  // Assign colors based on hash of name for unknown executables
  const colors = ['brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite'];
  let hash = 0;
  for (let i = 0; i < executable.length; i++) {
    hash = ((hash << 5) - hash) + executable.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}

// Common identifier fields to extract into category display
const ID_FIELDS = [
  'extensionId',
  'convId',
  'conversationId',
  'userId',
  'projectId',
  'tenantId',
  'fileId',
  'categoryId',
  'messageId',
  'sessionId',
  'connectionKey',
  'tabId',
  'operationId',
  'requestId',
  'jobId',
  'taskId',
  'component',
  'event',
];

/**
 * Extract identifier fields from log object to append to category
 * Returns formatted string like "Category:value1:value2" or just "Category"
 */
function extractCategorySuffix(rest: Record<string, any>): string {
  const parts: string[] = [];
  
  for (const field of ID_FIELDS) {
    if (rest[field] !== undefined && rest[field] !== null) {
      const value = String(rest[field]);
      // Limit length to keep output clean
      const truncated = value.length > 30 ? value.substring(0, 27) + '...' : value;
      parts.push(truncated);
    }
  }
  
  return parts.join(':');
}

// Custom pretty print with color-coded categories
function prettyPrint(logObject: any): string {
  const { level, time, msg, context, ...rest } = logObject;

  // Level names and colors
  const levels: Record<number, { name: string; color: string }> = {
    10: { name: 'TRACE', color: '\x1b[0;90m' }, // gray
    20: { name: 'DEBUG', color: '\x1b[0;90m' }, // gray
    30: { name: 'INFO', color: '\x1b[0;36m' },  // cyan
    40: { name: 'WARN', color: '\x1b[0;33m' },  // yellow
    50: { name: 'ERROR', color: '\x1b[0;31m' }, // red
    60: { name: 'FATAL', color: '\x1b[0;35m' }, // magenta
  };

  const levelInfo = levels[level] || { name: 'INFO', color: '\x1b[0;36m' };

  // Get colors for context and executable
  const contextColor = getCategoryColor(context || 'App');
  const config = getLoggingConfig();
  const executableColor = getExecutableColor(config.executable);
  const executableName = config.executable.toUpperCase();
  
  const colorMap: Record<string, string> = {
    black: '\x1b[0;30m',
    red: '\x1b[0;31m',
    green: '\x1b[0;32m',
    yellow: '\x1b[0;33m',
    blue: '\x1b[0;34m',
    magenta: '\x1b[0;35m',
    cyan: '\x1b[0;36m',
    white: '\x1b[0;37m',
    brightBlack: '\x1b[1;30m',
    brightRed: '\x1b[1;31m',
    brightGreen: '\x1b[1;32m',
    brightYellow: '\x1b[1;33m',
    brightBlue: '\x1b[1;34m',
    brightMagenta: '\x1b[1;35m',
    brightCyan: '\x1b[1;36m',
    brightWhite: '\x1b[1;37m',
  };

  const categoryColorCode = colorMap[contextColor] || colorMap.white;
  const executableColorCode = colorMap[executableColor] || colorMap.brightWhite;
  const reset = '\x1b[0m';

  // Format time
  const timeStr = new Date(time).toISOString().substring(11, 23); // HH:MM:SS.mmm

  // Build category display with identifier suffixes
  const baseCategory = context || 'App';
  const categorySuffix = extractCategorySuffix(rest);
  const fullCategory = categorySuffix ? `${baseCategory}:${categorySuffix}` : baseCategory;

  // Build output: HH:MM:SS.mmm [EXECUTABLE] [Category:suffix] Message
  // Executable has its own unique color based on executable name
  let output = `${timeStr} ${executableColorCode}[${executableName}]${reset} ${categoryColorCode}[${fullCategory}]${reset}`;

  if (msg) {
    output += ` ${msg}`;
  }

  // Add extra fields if present (excluding pid, hostname, and extracted id fields)
  const extractedFields = new Set(ID_FIELDS);
  const keys = Object.keys(rest).filter(k => 
    k !== 'pid' && 
    k !== 'hostname' && 
    !extractedFields.has(k)
  );
  
  if (keys.length > 0) {
    const extras = keys.map(k => {
      const v = rest[k];
      if (k === 'error' && v instanceof Error) {
        return `${k}=${v.stack || v.message}`;
      }
      if (typeof v === 'object') {
        return `${k}=${JSON.stringify(v)}`;
      }
      return `${k}=${v}`;
    }).join(' ');
    output += ` | ${extras}`;
  }

  return output;
}

// Write to stdout with pretty formatting in development
function writeToStdout() {
  return {
    write(data: any) {
      try {
        const logObject = JSON.parse(data.toString());
        const context = logObject.context || 'App';
        const level = logObject.level;
        
        // Map pino level numbers to our LogLevel strings
        const levelMap: Record<number, LogLevel> = {
          10: 'trace',
          20: 'debug',
          30: 'info',
          40: 'warn',
          50: 'error',
          60: 'fatal',
        };
        const logLevel = levelMap[level] || 'info';

        // Check if this log should be output using centralized config
        if (!shouldLog(logLevel, context)) {
          return; // Skip this log entry
        }

        const formatted = prettyPrint(logObject);
        process.stdout.write(formatted + '\n');
      } catch (e) {
        // Fallback: write raw data if parsing fails
        process.stdout.write(data.toString() + '\n');
      }
    },
  };
}

// Create file write streams
const fileStream = createWriteStream(logFile, { flags: 'a' });
const errorFileStream = createWriteStream(errorLogFile, { flags: 'a' });

// Create streams based on environment
const streams = isDevelopment
  ? [
      { level: 'trace', stream: writeToStdout() },
      { level: 'trace', stream: fileStream },
    ]
  : [
      { level: 'error', stream: errorFileStream },
      { level: 'info', stream: fileStream },
    ];

// Base pino instance without context (internal use only)
const baseLogger = pino(
  {
    level: 'trace', // Let our centralized config handle filtering
    formatters: {
      level: (label) => {
        return { level: label };
      },
      log(object) {
        // Add timestamp to all logs
        return { ...object, time: new Date().toISOString() };
      },
    },
    timestamp: false, // We add it in the formatter
    serializers: {
      error: pino.stdSerializers.err,
    },
  },
  pino.multistream(streams)
);

/**
 * Create a logger with a mandatory category/context.
 * All log entries must have a category for proper color-coding and organization.
 *
 * @param context - The category name for this logger (e.g., 'Server', 'Auth', 'Database')
 * @returns A pino logger instance with the context attached
 *
 * @example
 * ```typescript
 * const logger = createLogger('MyModule');
 * logger.info('Hello world'); // Output: HH:MM:SS.mmm [BACKEND] [MyModule] Hello world
 * ```
 */
export function createLogger(context: string): pino.Logger {
  if (!context || context.trim() === '') {
    throw new Error('Logger category/context is required. Please provide a meaningful category name (e.g., "Server", "Auth", "Database").');
  }

  // Check if logging is completely disabled
  const config = getLoggingConfig();
  if (!config.enabled) {
    // Return a no-op logger that does nothing
    return createNoOpLogger();
  }

  return baseLogger.child({ context });
}

/**
 * Create a no-op logger that does nothing (used when logging is disabled)
 */
function createNoOpLogger(): pino.Logger {
  const noop = () => {};
  return {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    silent: noop,
    level: 'silent',
  } as unknown as pino.Logger;
}

/**
 * Check if a specific log level and category combination is enabled.
 * Useful for guarding expensive log operations.
 *
 * @param level - The log level to check
 * @param category - The category to check (defaults to checking if any category at this level is enabled)
 * @returns true if logging is enabled for this combination
 *
 * @example
 * ```typescript
 * const logger = createLogger('Server');
 * if (isLoggingEnabled('debug')) {
 *   logger.debug('Expensive debug info:', computeExpensiveData());
 * }
 * ```
 */
export function isLoggingEnabled(level: LogLevel, category?: string): boolean {
  if (category) {
    return shouldLog(level, category);
  }
  return isLevelEnabled(level);
}

/**
 * Get current logging configuration for debugging
 */
export function getLoggerConfig(): Record<string, unknown> {
  return {
    ...getLoggingDebugInfo(),
    configFile: getConfigFilePath(),
  };
}

/**
 * Reload logging configuration from file
 * Call this if logging.json changes at runtime
 */
export function reloadLoggerConfig(): void {
  reloadLoggingConfig();
  
  // Log the reload
  const config = getLoggingConfig();
  if (config.enabled) {
    baseLogger.info({ context: 'Logging' }, 'Logging configuration reloaded from ' + getConfigFilePath());
  }
}

// Export the base logger for special cases only (not recommended for direct use)
// Use createLogger() instead to ensure proper categorization
export { baseLogger as logger };

// Default export is a function, enforcing category usage
export default createLogger;
