import pino from 'pino';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import { PATHS } from '../config/paths';

// Get log level from environment variable (default: 'info')
const logLevel = process.env.LOG_LEVEL || 'info';

// Executable name for log prefix (hardcoded as this is the backend service)
const EXECUTABLE_NAME = 'backend';

// Get log categories filter from environment variable (default: '*' = show all)
// Example: LOG_CATEGORIES=Server,WebSocket,Auth or LOG_CATEGORIES=*Storage
// Supports wildcard: *Storage matches any category ending with 'Storage'
const logCategoriesFilter = process.env.LOG_CATEGORIES || '*';

// Parse the filter into an array of patterns
const categoryPatterns = logCategoriesFilter === '*'
  ? ['*']  // Show all categories
  : logCategoriesFilter.split(',').map(s => s.trim()).filter(Boolean);

/**
 * Check if a category should be logged based on the filter patterns
 * @param context - The category name to check
 * @returns true if the category should be logged
 */
function shouldLogCategory(context: string): boolean {
  if (categoryPatterns.includes('*')) {
    return true;  // Show all categories
  }

  return categoryPatterns.some(pattern => {
    if (pattern.endsWith('*')) {
      // Wildcard suffix: 'Storage*' matches 'UserStorage', 'ProjectStorage', etc.
      const prefix = pattern.slice(0, -1);
      return context.startsWith(prefix);
    } else if (pattern.startsWith('*')) {
      // Wildcard prefix: '*Storage' matches 'UserStorage', 'ProjectStorage', etc.
      const suffix = pattern.slice(1);
      return context.endsWith(suffix);
    } else {
      // Exact match
      return context === pattern;
    }
  });
}

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create logs directory if it doesn't exist
const logsDir = process.env.LOGS_DIR || PATHS.BACKEND_LOGS;

// Ensure logs directory exists
mkdir(logsDir, { recursive: true }).catch(() => {});

// Log file paths
const logFile = join(logsDir, 'backend.log');
const errorLogFile = join(logsDir, 'backend-error.log');

// Color map for logger categories - each category gets its own color
const categoryColors: Record<string, string> = {
  // Server & Handlers
  'Server': 'magenta',
  'Auth': 'yellow',
  'Projects': 'cyan',
  'Conversations': 'blue',
  'Files': 'green',
  'Categories': 'magenta',
  'Extensions': 'cyan',
  'Embed': 'yellow',
  'EmbedAuth': 'yellow',
  'LLMHandler': 'blue',
  'Context': 'green',
  'Memory': 'green',
  'Upload': 'white',
  'Setup': 'yellow',
  'Tenant': 'magenta',
  'FrontendLogs': 'cyan',
  'ImageSave': 'green',
  'FileContextAPI': 'white',

  // WebSocket
  'WebSocketServer': 'blue',
  'WSEvents': 'cyan',
  'WhatsAppWS': 'green',
  'WhatsAppHandler': 'green',

  // LLM
  'Conversation': 'blue',
  'TitleGenerator': 'cyan',
  'ContextBuilder': 'yellow',

  // Storage
  'UserStorage': 'green',
  'SessionStorage': 'yellow',
  'TenantStorage': 'magenta',
  'ProjectStorage': 'cyan',
  'FileStorage': 'white',
  'FileContextStorage': 'green',
  'CategoryStorage': 'magenta',
  'ChatHistoryStorage': 'blue',
  'ChatCompaction': 'yellow',
  'ExtensionStorage': 'cyan',

  // Storage Factory & Config
  'StorageFactory': 'magenta',
  'StorageConfig': 'magenta',
  'Migration': 'yellow',
  'Migrator': 'yellow',

  // Storage Adapters
  'SQLiteAdapter': 'green',
  'MemoryCache': 'cyan',

  // Tools
  'ScriptTool': 'white',
  'ExtensionGenerator': 'cyan',
  'ExtensionDependency': 'yellow',
  'ExtensionGeneratorService': 'cyan',

  // Extension System
  'ExtensionHooks': 'magenta',
  'ExtensionWorker': 'blue',
  'ExtensionContext': 'yellow',
  'ExtensionLoader': 'cyan',
  'ExtensionUI': 'white',
  'ScriptRuntime': 'green',
  'OutputStorage': 'magenta',
  'PeekOutput': 'cyan',
  'DependencyBundler': 'yellow',

  // Default Extensions
  'ExcelExtension': 'green',
  'PowerPointExtension': 'yellow',
  'PDFExtension': 'red',
  'WordExtension': 'blue',
  'ImageExtension': 'magenta',
  'ExtensionCreator': 'cyan',

  // Middleware
  'TenantCheck': 'magenta',
  'MessagePersistence': 'green',

  // Utils
  'TitleGeneratorUtil': 'cyan',

  // Services
  'AuthService': 'yellow',
};

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

  // Get color for context
  const contextColor = (categoryColors[context] || 'white') as string;

  // Use executable name in logs
  const executableName = EXECUTABLE_NAME;
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
  const reset = '\x1b[0m';

  // Format time
  const timeStr = new Date(time).toISOString().substring(11, 23); // HH:MM:SS.mmm

  // Build output
  let output = `${timeStr} ${levelInfo.color}[${executableName}]${reset} ${categoryColorCode}[${context || 'App'}]${reset}`;

  if (msg) {
    output += ` ${msg}`;
  }

  // Add extra fields if present (excluding pid and hostname)
  const keys = Object.keys(rest).filter(k => k !== 'pid' && k !== 'hostname');
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
    output += `\n    ${extras}`;
  }

  return output;
}

// Write to stdout with pretty formatting in development
function writeToStdout() {
  return {
    write(data: any) {
      const logObject = JSON.parse(data.toString());
      const context = logObject.context || 'App';

      // Check if this category should be logged
      if (!shouldLogCategory(context)) {
        return;  // Skip this log entry
      }

      const formatted = prettyPrint(logObject);
      process.stdout.write(formatted + '\n');
    },
  };
}

// Create file write streams
const fileStream = createWriteStream(logFile, { flags: 'a' });
const errorFileStream = createWriteStream(errorLogFile, { flags: 'a' });

// Create streams based on environment
const streams = isDevelopment
  ? [
      { level: logLevel, stream: writeToStdout() },
      { level: logLevel, stream: fileStream },
    ]
  : [
      { level: 'error', stream: errorFileStream },
      { level: logLevel, stream: fileStream },
    ];

// Log filter info in development mode
if (isDevelopment && categoryPatterns.includes('*')) {
  // Show all categories - no filter message needed
} else if (isDevelopment) {
  console.log(`\x1b[0;90m🔍 Log Filter: Showing only categories matching: ${logCategoriesFilter}\x1b[0m`);
}

// Base pino instance without context (internal use only)
const baseLogger = pino(
  {
    level: logLevel,
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
 * logger.info('Hello world'); // Output: HH:MM:SS.mmm [INFO] [MyModule] Hello world
 * ```
 */
export function createLogger(context: string): pino.Logger {
  if (!context || context.trim() === '') {
    throw new Error('Logger category/context is required. Please provide a meaningful category name (e.g., "Server", "Auth", "Database").');
  }
  return baseLogger.child({ context });
}

// Export the base logger for special cases only (not recommended for direct use)
// Use createLogger() instead to ensure proper categorization
export { baseLogger as logger };

// Default export is a function, enforcing category usage
export default createLogger;
