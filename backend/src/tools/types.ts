import { Tool } from '../llm/conversation';

/**
 * Tool parameter schema for validation
 */
export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  properties?: Record<string, ToolParameterSchema>;
  items?: ToolParameterSchema;
}

/**
 * Tool metadata for registry management
 */
export interface ToolMetadata {
  name: string;
  category: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  dependencies: string[];
  configuration?: Record<string, any>;
  permissions: string[];
  enabled: boolean;
  experimental: boolean;
}

/**
 * Standardized tool result format
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTime: number;
    timestamp: string;
    toolVersion: string;
    cacheHit?: boolean;
  };
}

/**
 * Tool error information
 */
export interface ToolErrorInfo {
  code: string;
  message: string;
  details?: any;
  toolName?: string;
  timestamp: string;
}

/**
 * Execution metadata for tool calls
 */
export interface ExecutionMetadata {
  executionTime: number;
  timestamp: string;
  toolVersion: string;
  cacheHit?: boolean;
  memoryUsage?: number;
  parameters?: any;
}

/**
 * Tool error codes
 */
export const TOOL_ERROR_CODES = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  API_KEY_MISSING: 'API_KEY_MISSING',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
  SYSTEM_ACCESS_DENIED: 'SYSTEM_ACCESS_DENIED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION'
} as const;

/**
 * Enhanced tool error class
 */
export class ToolError extends Error {
  constructor(
    public toolName: string,
    public code: keyof typeof TOOL_ERROR_CODES,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ToolError';
  }

  toJSON(): ToolErrorInfo {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      toolName: this.toolName,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Abstract base class for tools with parameter validation
 */
export abstract class TypedTool extends Tool {
  abstract parameterSchema: Record<string, ToolParameterSchema>;

  /**
   * Validate parameters against schema
   */
  validateParameters(args: any): boolean {
    try {
      return this.validateAgainstSchema(args, this.parameters);
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute with validation and error handling
   */
  async execute(args: any): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate parameters
      if (!this.validateParameters(args)) {
        throw new ToolError(this.name, 'INVALID_PARAMETERS', 'Parameter validation failed', { args });
      }

      // Execute the tool
      const result = await this.executeTyped(args);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: new Date().toISOString(),
          toolVersion: '1.0.0'
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const toolError = error instanceof ToolError ? error : new ToolError(
        this.name,
        'EXTERNAL_API_ERROR',
        error instanceof Error ? error.message : String(error)
      );

      return {
        success: false,
        error: toolError.toJSON(),
        metadata: {
          executionTime,
          timestamp: new Date().toISOString(),
          toolVersion: '1.0.0'
        }
      };
    }
  }

  /**
   * Abstract method for actual tool implementation
   */
  protected abstract executeTyped(args: any): Promise<any>;

  /**
   * Validate arguments against JSON schema
   */
  private validateAgainstSchema(args: any, schema: Record<string, any>): boolean {
    // Basic validation - in production, use a proper JSON schema validator
    if (schema.required && Array.isArray(schema.required)) {
      for (const required of schema.required) {
        if (!(required in args)) {
          return false;
        }
      }
    }

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in args) {
          const value = args[key];
          const paramSchema = propSchema as ToolParameterSchema;

          // Type validation
          if (paramSchema.type === 'string' && typeof value !== 'string') {
            return false;
          }
          if (paramSchema.type === 'number' && typeof value !== 'number') {
            return false;
          }
          if (paramSchema.type === 'boolean' && typeof value !== 'boolean') {
            return false;
          }
          if (paramSchema.type === 'array' && !Array.isArray(value)) {
            return false;
          }
          if (paramSchema.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
            return false;
          }

          // Range validation for numbers
          if (paramSchema.type === 'number') {
            if (paramSchema.minimum !== undefined && value < paramSchema.minimum) {
              return false;
            }
            if (paramSchema.maximum !== undefined && value > paramSchema.maximum) {
              return false;
            }
          }

          // Pattern validation for strings
          if (paramSchema.type === 'string' && paramSchema.pattern) {
            const regex = new RegExp(paramSchema.pattern);
            if (!regex.test(value)) {
              return false;
            }
          }

          // Enum validation
          if (paramSchema.enum && !paramSchema.enum.includes(value)) {
            return false;
          }
        }
      }
    }

    return true;
  }
}

/**
 * Tool cache interface
 */
export interface IToolCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Cache entry for tool results
 */
interface CacheEntry<T> {
  value: T;
  expiry: number;
}

/**
 * In-memory tool cache implementation
 */
export class ToolCache implements IToolCache {
  private cache = new Map<string, CacheEntry<any>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlMs: number = 300000): Promise<void> {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Test result for tool testing
 */
export interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  duration: number;
  details?: any;
}

/**
 * Tool testing framework interface
 */
export interface IToolTester {
  testTool(tool: Tool): Promise<TestResult[]>;
  testParameterValidation(tool: Tool): TestResult;
  testExecution(tool: Tool): Promise<TestResult>;
  testErrorHandling(tool: Tool): Promise<TestResult>;
}