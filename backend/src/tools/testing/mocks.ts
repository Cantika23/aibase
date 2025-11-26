import { Tool } from '../../llm/conversation';
import { ToolMetadata, TestResult, IToolTester } from '../types';
import { createDefaultMetadata } from '../registry/tool-metadata';

/**
 * Mock Weather Tool for testing
 */
export class MockWeatherTool extends Tool {
  name = 'weather';
  description = 'Mock weather tool for testing';
  parameters = {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'Location to get weather for'
      }
    },
    required: ['location']
  };

  async execute(args: { location: string }): Promise<any> {
    return {
      location: args.location,
      temperature: 72,
      condition: 'sunny',
      humidity: 65,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Mock Calculator Tool for testing
 */
export class MockCalculatorTool extends Tool {
  name = 'calculate';
  description = 'Mock calculator tool for testing';
  parameters = {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate'
      }
    },
    required: ['expression']
  };

  async execute(args: { expression: string }): Promise<string> {
    // Simple mock implementation
    if (args.expression === '2 + 2') {
      return 'Result: 4';
    }
    if (args.expression === '10 * 5') {
      return 'Result: 50';
    }
    return `Mock result for: ${args.expression}`;
  }
}

/**
 * Mock File Reader Tool for testing
 */
export class MockFileReaderTool extends Tool {
  name = 'file_reader';
  description = 'Mock file reader tool for testing';
  parameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to file to read'
      }
    },
    required: ['file_path']
  };

  async execute(args: { file_path: string }): Promise<any> {
    return {
      file_path: args.file_path,
      content: 'Mock file content',
      size: 17,
      encoding: 'utf8',
      last_modified: new Date().toISOString()
    };
  }
}

/**
 * Tool Tester Implementation
 */
export class ToolTester implements IToolTester {
  async testTool(tool: Tool): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test parameter validation
    results.push(this.testParameterValidation(tool));

    // Test execution
    results.push(await this.testExecution(tool));

    // Test error handling
    results.push(await this.testErrorHandling(tool));

    return results;
  }

  testParameterValidation(tool: Tool): TestResult {
    const startTime = Date.now();

    try {
      // Test that required parameters are defined
      if (!tool.parameters || !tool.parameters.properties) {
        return {
          testName: 'parameter_validation',
          passed: false,
          message: 'Tool parameters not properly defined',
          duration: Date.now() - startTime
        };
      }

      const requiredParams = tool.parameters.required || [];
      const properties = tool.parameters.properties;

      // Check if all required parameters exist
      const missingParams = requiredParams.filter((param: string) => !properties[param]);

      if (missingParams.length > 0) {
        return {
          testName: 'parameter_validation',
          passed: false,
          message: `Missing required parameters: ${missingParams.join(', ')}`,
          duration: Date.now() - startTime
        };
      }

      return {
        testName: 'parameter_validation',
        passed: true,
        message: 'Parameter validation passed',
        duration: Date.now() - startTime,
        details: {
          required_params: requiredParams,
          total_params: Object.keys(properties).length
        }
      };
    } catch (error) {
      return {
        testName: 'parameter_validation',
        passed: false,
        message: `Parameter validation error: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  async testExecution(tool: Tool): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Generate mock arguments based on tool parameters
      const mockArgs = this.generateMockArgs(tool.parameters);

      // Test execution with mock data
      const result = await tool.execute(mockArgs);

      return {
        testName: 'execution',
        passed: true,
        message: 'Tool execution successful',
        duration: Date.now() - startTime,
        details: {
          mock_args: mockArgs,
          result_type: typeof result,
          result_keys: result && typeof result === 'object' ? Object.keys(result) : []
        }
      };
    } catch (error) {
      return {
        testName: 'execution',
        passed: false,
        message: `Tool execution failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  async testErrorHandling(tool: Tool): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test with invalid arguments
      const invalidArgs = { invalid_param: 'test' };

      try {
        await tool.execute(invalidArgs);

        // If we get here, the tool didn't throw an error for invalid params
        return {
          testName: 'error_handling',
          passed: false,
          message: 'Tool should have thrown error for invalid parameters',
          duration: Date.now() - startTime
        };
      } catch (error) {
        // This is expected - tool should handle invalid parameters
        return {
          testName: 'error_handling',
          passed: true,
          message: 'Tool properly handled invalid parameters',
          duration: Date.now() - startTime,
          details: {
            error_message: (error as Error).message
          }
        };
      }
    } catch (error) {
      return {
        testName: 'error_handling',
        passed: false,
        message: `Error handling test failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private generateMockArgs(parameters: any): any {
    const args: any = {};

    if (!parameters || !parameters.properties) {
      return args;
    }

    const properties = parameters.properties;

    for (const [key, schema] of Object.entries(properties)) {
      const paramSchema = schema as any;

      // Generate mock data based on parameter type
      switch (paramSchema.type) {
        case 'string':
          if (paramSchema.enum) {
            args[key] = paramSchema.enum[0];
          } else if (key.includes('email')) {
            args[key] = 'test@example.com';
          } else if (key.includes('url')) {
            args[key] = 'https://example.com';
          } else {
            args[key] = `mock_${key}`;
          }
          break;
        case 'number':
          args[key] = paramSchema.minimum || 0;
          break;
        case 'boolean':
          args[key] = true;
          break;
        case 'array':
          args[key] = [];
          break;
        case 'object':
          args[key] = {};
          break;
        default:
          args[key] = 'mock_value';
      }
    }

    return args;
  }
}

/**
 * Get mock tools for testing
 */
export function getMockTools(): Tool[] {
  return [
    new MockWeatherTool(),
    new MockCalculatorTool(),
    new MockFileReaderTool()
  ];
}

/**
 * Get mock tool metadata
 */
export function getMockToolMetadata(toolName: string): ToolMetadata | null {
  const metadataMap: Record<string, ToolMetadata> = {
    'weather': createDefaultMetadata(
      'weather',
      'mock',
      'Mock weather tool for testing',
      { tags: ['weather', 'mock'], dependencies: [] }
    ),
    'calculate': createDefaultMetadata(
      'calculate',
      'mock',
      'Mock calculator tool for testing',
      { tags: ['math', 'mock'], dependencies: [] }
    ),
    'file_reader': createDefaultMetadata(
      'file_reader',
      'mock',
      'Mock file reader tool for testing',
      { tags: ['file', 'mock'], dependencies: [] }
    )
  };

  return metadataMap[toolName] || null;
}