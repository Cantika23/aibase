import { TypedTool, ToolParameterSchema } from '../../types';

/**
 * JSON Processor Tool - Process and transform JSON data
 */
export class JsonProcessorTool extends TypedTool {
  name = 'json_processor';
  description = 'Parse, validate, and transform JSON data';

  parameterSchema: Record<string, ToolParameterSchema> = {
    operation: {
      type: 'string',
      description: 'Operation to perform on the JSON data',
      enum: ['parse', 'stringify', 'validate', 'extract', 'merge', 'query'],
      required: true
    },
    data: {
      type: 'string',
      description: 'JSON string or data to process',
      required: false
    },
    data2: {
      type: 'string',
      description: 'Second JSON string for merge operation',
      required: false
    },
    path: {
      type: 'string',
      description: 'JSONPath expression for query operation (e.g., "$.users[0].name")',
      required: false
    },
    pretty: {
      type: 'boolean',
      description: 'Pretty print the JSON output (for stringify operation)',
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform on the JSON data',
        enum: ['parse', 'stringify', 'validate', 'extract', 'merge', 'query']
      },
      data: {
        type: 'string',
        description: 'JSON string or data to process'
      },
      data2: {
        type: 'string',
        description: 'Second JSON string for merge operation'
      },
      path: {
        type: 'string',
        description: 'JSONPath expression for query operation (e.g., "$.users[0].name")'
      },
      pretty: {
        type: 'boolean',
        description: 'Pretty print the JSON output (for stringify operation)'
      }
    },
    required: ['operation']
  };

  protected async executeTyped(args: {
    operation: string;
    data?: string;
    data2?: string;
    path?: string;
    pretty?: boolean;
  }): Promise<any> {
    const { operation, data, data2, path: jsonPath, pretty = false } = args;

    switch (operation) {
      case 'parse':
        return this.parseJSON(data);

      case 'stringify':
        return this.stringifyJSON(data, pretty);

      case 'validate':
        return this.validateJSON(data);

      case 'extract':
        return this.extractFromJSON(data, jsonPath);

      case 'merge':
        return this.mergeJSON(data, data2);

      case 'query':
        return this.queryJSON(data, jsonPath);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private parseJSON(data?: string): any {
    if (!data) {
      throw new Error('Data is required for parse operation');
    }

    try {
      const parsed = JSON.parse(data);
      return {
        success: true,
        parsed,
        type: this.getValueType(parsed),
        size: this.getObjectSize(parsed)
      };
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }
  }

  private stringifyJSON(data?: string, pretty: boolean = false): any {
    if (!data) {
      throw new Error('Data is required for stringify operation');
    }

    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(data);
      const stringified = JSON.stringify(parsed, null, pretty ? 2 : 0);

      return {
        success: true,
        original: data,
        stringified,
        pretty,
        size: stringified.length
      };
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }
  }

  private validateJSON(data?: string): any {
    if (!data) {
      throw new Error('Data is required for validate operation');
    }

    try {
      JSON.parse(data);
      return {
        valid: true,
        message: 'Valid JSON format'
      };
    } catch (error) {
      return {
        valid: false,
        error: (error as Error).message,
        message: 'Invalid JSON format'
      };
    }
  }

  private extractFromJSON(data?: string, jsonPath?: string): any {
    if (!data) {
      throw new Error('Data is required for extract operation');
    }

    if (!jsonPath) {
      throw new Error('Path is required for extract operation');
    }

    try {
      const parsed = JSON.parse(data);
      const result = this.extractValue(parsed, jsonPath);

      return {
        success: true,
        path: jsonPath,
        extracted: result,
        type: this.getValueType(result)
      };
    } catch (error) {
      throw new Error(`Extraction failed: ${(error as Error).message}`);
    }
  }

  private mergeJSON(data?: string, data2?: string): any {
    if (!data || !data2) {
      throw new Error('Both data and data2 are required for merge operation');
    }

    try {
      const parsed1 = JSON.parse(data);
      const parsed2 = JSON.parse(data2);

      if (typeof parsed1 !== 'object' || Array.isArray(parsed1)) {
        throw new Error('First JSON must be an object for merge operation');
      }

      if (typeof parsed2 !== 'object' || Array.isArray(parsed2)) {
        throw new Error('Second JSON must be an object for merge operation');
      }

      const merged = { ...parsed1, ...parsed2 };

      return {
        success: true,
        merged,
        original1_keys: Object.keys(parsed1),
        original2_keys: Object.keys(parsed2),
        merged_keys: Object.keys(merged)
      };
    } catch (error) {
      throw new Error(`Merge failed: ${(error as Error).message}`);
    }
  }

  private queryJSON(data?: string, jsonPath?: string): any {
    // Simple query implementation - in a real implementation, use a JSONPath library
    return this.extractFromJSON(data, jsonPath);
  }

  private extractValue(obj: any, path: string): any {
    // Simple path extraction - handles basic dot notation and array indices
    const parts = path.replace(/^\$\.?/, '').split('.');
    let current = obj;

    for (const part of parts) {
      if (part.includes('[') && part.includes(']')) {
        // Handle array access
        const [key, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''));

        if (key && current[key]) {
          current = current[key];
        }

        if (current && Array.isArray(current)) {
          current = current[index];
        }
      } else {
        current = current[part];
      }

      if (current === undefined || current === null) {
        return undefined;
      }
    }

    return current;
  }

  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private getObjectSize(obj: any): number {
    return JSON.stringify(obj).length;
  }
}