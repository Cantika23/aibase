import { Tool } from '../llm/conversation';
import { ToolMetadata } from './types';
import { createDefaultMetadata } from './registry/tool-metadata';

/**
 * Get Current Time Tool - Built-in time utility
 */
export class GetCurrentTimeTool extends Tool {
  name = 'get_current_time';
  description = 'Get the current date and time';
  parameters = { type: 'object', properties: {} };

  async execute(): Promise<string> {
    return new Date().toISOString();
  }
}

/**
 * Calculate Tool - Built-in calculator
 */
export class CalculateTool extends Tool {
  name = 'calculate';
  description = 'Perform basic arithmetic operations';
  parameters = {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4")',
      },
    },
    required: ['expression'],
  };

  async execute(args: { expression: string }): Promise<string> {
    try {
      // Safe evaluation - only allow numbers and basic operators
      const sanitizedExpression = args.expression.replace(/[^0-9+\-*/().\s]/g, '');

      if (sanitizedExpression !== args.expression) {
        throw new Error('Invalid characters in expression');
      }

      const result = Function('"use strict"; return (' + sanitizedExpression + ')')();
      return `Result: ${result}`;
    } catch (error) {
      throw new Error(`Invalid expression: ${args.expression}`);
    }
  }
}

/**
 * Get all built-in tools
 */
export function getBuiltinTools(): Tool[] {
  return [
    new GetCurrentTimeTool(),
    new CalculateTool()
  ];
}

/**
 * Get metadata for built-in tools
 */
export function getBuiltinToolMetadata(toolName: string): ToolMetadata | null {
  const metadataMap: Record<string, ToolMetadata> = {
    'get_current_time': createToolMetadata(
      'get_current_time',
      'utility',
      'Get the current date and time',
      {
        tags: ['time', 'date'],
        permissions: [],
        dependencies: []
      }
    ),
    'calculate': createToolMetadata(
      'calculate',
      'utility',
      'Perform basic arithmetic operations',
      {
        tags: ['math', 'calculator'],
        permissions: [],
        dependencies: []
      }
    )
  };

  return metadataMap[toolName] || null;
}