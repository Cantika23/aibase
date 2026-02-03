/**
 * Centralized Logging Configuration
 * 
 * Reads from logging.json in the project root.
 * Controls logging based on three dimensions:
 * 1. Executable name - Which executable is running (backend, frontend, etc.)
 * 2. Type (level) - Log severity level (trace, debug, info, warn, error, fatal)
 * 3. Category - The component/category (Server, Auth, Database, etc.)
 * 
 * Configuration File: logging.json (in project root)
 * 
 * Example logging.json:
 * {
 *   "enabled": true,
 *   "filters": [
 *     { "executable": "backend", "level": "info", "categories": ["Server", "Auth"] },
 *     { "executable": "*", "level": "warn", "categories": ["*"] }
 *   ]
 * }
 * 
 * Environment Variables (optional overrides):
 * - LOG_CONFIG_PATH: Path to logging.json (default: ./logging.json)
 * - LOG_ENABLED: Override the enabled setting (true/false)
 * - LOG_EXECUTABLE: Override executable name (auto-detected if not set)
 */

import { env } from 'process';
import { readFileSync, existsSync, watch } from 'fs';
import { resolve, dirname } from 'path';

/** Log severity levels in order of increasing priority */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = typeof LOG_LEVELS[number];

/** Category group mappings - maps detailed categories to simplified groups */
export const CATEGORY_GROUPS: Record<string, string> = {
  // Core
  'Server': 'Core', 'Setup': 'Core', 'FrontendLogs': 'Core', 'Logging': 'Core', 'LogConfig': 'Core',
  // WebSocket
  'WebSocketServer': 'WebSocket', 'WSEvents': 'WebSocket', 'WhatsAppWS': 'WebSocket', 'MessagePersistence': 'WebSocket',
  // Auth
  'Auth': 'Auth', 'AuthService': 'Auth', 'EmbedAuth': 'Auth',
  // Storage
  'UserStorage': 'Storage', 'SessionStorage': 'Storage', 'TenantStorage': 'Storage', 'ProjectStorage': 'Storage',
  'FileStorage': 'Storage', 'FileContextStorage': 'Storage', 'CategoryStorage': 'Storage', 'ChatHistoryStorage': 'Storage',
  'ExtensionStorage': 'Storage', 'StorageFactory': 'Storage', 'StorageConfig': 'Storage', 'SQLiteAdapter': 'Storage',
  'MemoryCache': 'Storage', 'ChatCompaction': 'Storage',
  // Migration
  'Migration': 'Migration', 'Migrator': 'Migration',
  // LLM
  'Conversation': 'LLM', 'Conversations': 'LLM', 'TitleGenerator': 'LLM', 'TitleGeneratorUtil': 'LLM',
  'ContextBuilder': 'LLM', 'LLMHandler': 'LLM',
  // Extensions
  'Extensions': 'Extension', 'ExtensionGenerator': 'Extension', 'ExtensionGeneratorService': 'Extension',
  'ExtensionLoader': 'Extension', 'ExtensionWorker': 'Extension', 'ExtensionHooks': 'Extension',
  'ExtensionContext': 'Extension', 'ExtensionUI': 'Extension', 'ExtensionDependency': 'Extension',
  'ExtensionCreator': 'Extension', 'ExcelExtension': 'Extension', 'PowerPointExtension': 'Extension',
  'PDFExtension': 'Extension', 'WordExtension': 'Extension', 'ImageExtension': 'Extension',
  // Tools
  'ScriptTool': 'Tools', 'ScriptRuntime': 'Tools', 'DependencyBundler': 'Tools', 'OutputStorage': 'Tools', 'PeekOutput': 'Tools',
  // Handlers
  'Projects': 'Handlers', 'Categories': 'Handlers', 'Files': 'Handlers', 'Upload': 'Handlers',
  'Memory': 'Handlers', 'Context': 'Handlers', 'Tenant': 'Handlers', 'Embed': 'Handlers',
  'ImageSave': 'Handlers', 'FileContextAPI': 'Handlers', 'WhatsAppHandler': 'Handlers',
  // Middleware
  'TenantCheck': 'Middleware',
};

/** Get the group for a category */
export function getCategoryGroup(category: string): string {
  return CATEGORY_GROUPS[category] || category;
}

/** Priority map for level comparison (higher = more severe) */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/** Category filter - object with category names as keys and boolean values */
export type CategoryFilter = Record<string, boolean>;

/** Individual filter rule from config */
export interface LogFilter {
  /** Executable name pattern (e.g., "backend", "*", "start.*") */
  executable: string;
  /** Minimum log level (e.g., "info", "debug") */
  level: LogLevel;
  /** Category filters - object with boolean values */
  categories: CategoryFilter;
}

/** Output configuration */
export interface OutputConfig {
  enabled: boolean;
  colorize?: boolean;
  timestamp?: boolean;
  path?: string;
  maxSize?: string;
  maxFiles?: number;
}

/** Centralized logging configuration */
export interface LoggingConfig {
  /** Master switch - if false, no logging occurs */
  enabled: boolean;
  /** Name of the current executable */
  executable: string;
  /** List of filter rules to apply */
  filters: LogFilter[];
  /** Output destinations */
  outputs?: {
    console?: OutputConfig;
    file?: OutputConfig;
  };
  /** Category colors for display */
  categoryColors?: Record<string, string>;
}

/** Raw config from JSON file */
interface RawLoggingConfig {
  enabled?: boolean;
  filters?: Array<{
    executable?: string;
    level?: string;
    categories?: CategoryFilter;
  }>;
  outputs?: {
    console?: OutputConfig;
    file?: OutputConfig;
  };
  /** Category colors - { "Category": "color" } */
  categoryColors?: Record<string, string>;
}

/** Default configuration when file doesn't exist */
const DEFAULT_CONFIG: LoggingConfig = {
  enabled: true,
  executable: 'app',
  filters: [
    { executable: '*', level: 'info', categories: { '*': true } }
  ],
  outputs: {
    console: { enabled: true, colorize: true, timestamp: true },
    file: { enabled: true, path: './logs', maxSize: '10MB', maxFiles: 5 }
  }
};

/**
 * Get the path to the logging config file
 */
function getConfigPath(): string {
  // Check environment variable first
  if (env.LOG_CONFIG_PATH) {
    return resolve(env.LOG_CONFIG_PATH);
  }
  
  // Try to find logging.json in project root
  // Start from current working directory and look up
  let currentDir = process.cwd();
  
  while (currentDir !== '/') {
    const configPath = resolve(currentDir, 'logging.json');
    if (existsSync(configPath)) {
      return configPath;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  
  // Fallback to cwd
  return resolve(process.cwd(), 'logging.json');
}

/**
 * Auto-detect executable name from process
 */
function detectExecutable(): string {
  // Check override first
  if (env.LOG_EXECUTABLE) {
    return env.LOG_EXECUTABLE;
  }

  // Try to detect from process.argv
  const scriptPath = process.argv[1] || '';
  const scriptName = scriptPath.split('/').pop() || '';
  
  // Map known script names to executable names
  if (scriptName.includes('server') || scriptPath.includes('backend')) {
    return 'backend';
  }
  if (scriptName.includes('dev') || scriptPath.includes('vite')) {
    return 'frontend';
  }
  
  // Check if running from a binary
  const execPath = process.execPath.split('/').pop() || '';
  if (execPath === 'bun' || execPath === 'node') {
    return scriptName.replace(/\.(ts|js|mjs|cjs)$/, '') || 'app';
  }
  
  // Return the binary name (e.g., "start.macos", "start.linux")
  return execPath.replace(/\.(exe|macos|linux)$/, '').replace(/^start\./, 'start-');
}

/**
 * Parse a level string into a valid LogLevel
 */
function parseLevel(level: string): LogLevel {
  const normalized = level.toLowerCase().trim();
  if (LOG_LEVELS.includes(normalized as LogLevel)) {
    return normalized as LogLevel;
  }
  return 'info';
}

/**
 * Check if a category is enabled in the filter
 * @param category - The category to check
 * @param filterCategories - Object with category names as keys and boolean values
 * @returns true if the category is enabled
 */
function isCategoryEnabled(category: string, filterCategories: CategoryFilter): boolean {
  // Check exact match
  if (filterCategories[category] === true) {
    return true;
  }
  // Check wildcard "*"
  if (filterCategories['*'] === true) {
    return true;
  }
  // Check group match
  const group = getCategoryGroup(category);
  if (filterCategories[group] === true) {
    return true;
  }
  return false;
}

/**
 * Load and parse the logging.json file
 */
function loadConfigFile(): RawLoggingConfig | null {
  const configPath = getConfigPath();
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    // Remove comments (both // and /* */ style)
    const cleaned = content
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    return JSON.parse(cleaned) as RawLoggingConfig;
  } catch (error) {
    // If we can't parse, return null to use defaults
    console.error(`Failed to parse ${configPath}:`, error);
    return null;
  }
}

/**
 * Load logging configuration from file
 */
export function loadLoggingConfig(): LoggingConfig {
  const executable = detectExecutable();
  const rawConfig = loadConfigFile();
  
  // Master switch from environment overrides file
  const envEnabled = env.LOG_ENABLED;
  const enabled = envEnabled !== undefined 
    ? (envEnabled !== 'false' && envEnabled !== '0')
    : (rawConfig?.enabled !== false);
  
  // Parse filters
  let filters: LogFilter[] = [];
  
  if (rawConfig?.filters && rawConfig.filters.length > 0) {
    for (const rawFilter of rawConfig.filters) {
      filters.push({
        executable: rawFilter.executable || '*',
        level: parseLevel(rawFilter.level || 'info'),
        categories: rawFilter.categories || { '*': true },
      });
    }
  }
  
  // If no valid filters, use default
  if (filters.length === 0) {
    filters = [{ executable: '*', level: 'info', categories: { '*': true } }];
  }
  
  return {
    enabled,
    executable,
    filters,
    outputs: rawConfig?.outputs || DEFAULT_CONFIG.outputs,
    categoryColors: rawConfig?.categoryColors,
  };
}

/** Cached configuration */
let cachedConfig: LoggingConfig | null = null;
let configWatcher: ReturnType<typeof watch> | null = null;

/**
 * Get the current logging configuration
 */
export function getLoggingConfig(): LoggingConfig {
  if (!cachedConfig) {
    cachedConfig = loadLoggingConfig();
    setupConfigWatcher();
  }
  return cachedConfig;
}

/**
 * Setup file watcher for hot-reloading config
 */
function setupConfigWatcher(): void {
  if (configWatcher) return; // Already watching
  
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return;
  
  try {
    configWatcher = watch(configPath, (eventType) => {
      if (eventType === 'change') {
        // Reload config
        cachedConfig = loadLoggingConfig();
        // Log the reload (using console since logger might not be available)
        console.log(`[Logging] Configuration reloaded from ${configPath}`);
      }
    });
  } catch {
    // Ignore watch errors
  }
}

/**
 * Reload configuration from file
 */
export function reloadLoggingConfig(): LoggingConfig {
  cachedConfig = loadLoggingConfig();
  return cachedConfig;
}

/**
 * Check if executable name matches a pattern
 */
function executableMatches(current: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === current) return true;
  
  // Support wildcards in executable pattern
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(current);
  }
  
  return false;
}

/**
 * Check if logging is enabled for a specific combination
 * 
 * @param level - The log level being logged
 * @param category - The category/component name
 * @returns true if this log should be output
 * 
 * @example
 * ```typescript
 * if (shouldLog('debug', 'Server')) {
 *   console.log('[Server] Debug message');
 * }
 * ```
 */
export function shouldLog(level: LogLevel, category: string): boolean {
  const config = getLoggingConfig();

  // Master switch check
  if (!config.enabled) {
    return false;
  }

  // Check each filter - if ANY filter matches, allow the log
  for (const filter of config.filters) {
    // Check executable match
    if (!executableMatches(config.executable, filter.executable)) {
      continue;
    }

    // Check level (must be >= filter level priority)
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[filter.level]) {
      continue;
    }

    // Check category match (handles object, array, and string formats)
    if (!isCategoryEnabled(category, filter.categories)) {
      continue;
    }

    // All conditions matched - allow this log
    return true;
  }

  // No filter matched - don't log
  return false;
}

/**
 * Check if a specific level is enabled for any category
 * Useful for avoiding expensive log preparation when logging is disabled
 */
export function isLevelEnabled(level: LogLevel): boolean {
  const config = getLoggingConfig();
  
  if (!config.enabled) return false;

  for (const filter of config.filters) {
    if (!executableMatches(config.executable, filter.executable)) {
      continue;
    }
    if (LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[filter.level]) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get debug info about the current logging configuration
 */
export function getLoggingDebugInfo(): Record<string, unknown> {
  const config = getLoggingConfig();
  return {
    configPath: getConfigPath(),
    enabled: config.enabled,
    executable: config.executable,
    filters: config.filters,
    outputs: config.outputs,
    categories: config.categories,
  };
}

/**
 * Programmatically configure logging (overrides file)
 * Useful for testing or runtime configuration changes
 */
export function configureLogging(config: Partial<LoggingConfig>): void {
  const current = getLoggingConfig();
  cachedConfig = {
    ...current,
    ...config,
    filters: config.filters || current.filters,
  };
}

/**
 * Reset configuration (clears cache, will reload from file on next access)
 */
export function resetLoggingConfig(): void {
  cachedConfig = null;
  if (configWatcher) {
    configWatcher.close();
    configWatcher = null;
  }
}

/**
 * Get the path to the current config file
 */
export function getConfigFilePath(): string {
  return getConfigPath();
}
