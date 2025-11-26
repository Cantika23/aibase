import { TypedTool, ToolParameterSchema } from '../../types';

/**
 * Memory Stats Tool - Get system memory usage statistics
 */
export class MemoryStatsTool extends TypedTool {
  name = 'memory_stats';
  description = 'Get system memory usage statistics and information';

  parameterSchema: Record<string, ToolParameterSchema> = {
    format: {
      type: 'string',
      description: 'Format for memory sizes',
      enum: ['bytes', 'kb', 'mb', 'gb', 'percentage'],
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Format for memory sizes',
        enum: ['bytes', 'kb', 'mb', 'gb', 'percentage']
      }
    }
  };

  protected async executeTyped(args: { format?: string }): Promise<any> {
    const { format = 'mb' } = args;

    try {
      // Get Node.js process memory usage
      const processUsage = process.memoryUsage();

      // Get system memory info (platform-specific)
      const systemMemory = await this.getSystemMemory();

      // Format values based on requested format
      const formattedProcessUsage = this.formatMemoryValues(processUsage, format);
      const formattedSystemMemory = this.formatMemoryValues(systemMemory, format);

      return {
        timestamp: new Date().toISOString(),
        format,
        process_memory: {
          ...formattedProcessUsage,
          heap_used_percentage: (processUsage.heapUsed / processUsage.heapTotal) * 100
        },
        system_memory: {
          ...formattedSystemMemory,
          usage_percentage: systemMemory.used ? (systemMemory.used / systemMemory.total) * 100 : null
        },
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      };
    } catch (error) {
      throw new Error(`Failed to get memory stats: ${(error as Error).message}`);
    }
  }

  private async getSystemMemory(): Promise<any> {
    const systemMemory: any = {
      total: 0,
      used: 0,
      free: 0
    };

    try {
      if (process.platform === 'linux') {
        // Read from /proc/meminfo on Linux
        const fs = await import('fs/promises');
        const memInfo = await fs.readFile('/proc/meminfo', 'utf8');

        const lines = memInfo.split('\n');
        const memTotal = this.parseMemInfoLine(lines.find(line => line.startsWith('MemTotal')));
        const memAvailable = this.parseMemInfoLine(lines.find(line => line.startsWith('MemAvailable')));

        systemMemory.total = memTotal * 1024; // Convert KB to bytes
        systemMemory.free = (memAvailable || memTotal * 0.1) * 1024; // Estimate if not available
        systemMemory.used = systemMemory.total - systemMemory.free;
      } else if (process.platform === 'darwin') {
        // Use system command on macOS
        const { exec } = await import('child_process');
        const util = await import('util');
        const execAsync = util.promisify(exec);

        try {
          const { stdout } = await execAsync('vm_stat | grep "Pages free\\|Pages active\\|Pages inactive\\|Pages wired"');
          const lines = stdout.trim().split('\n');

          let totalPages = 0;
          let freePages = 0;

          lines.forEach(line => {
            const match = line.match(/:\s*(\d+)/);
            if (match) {
              const pages = parseInt(match[1]);
              totalPages += pages;
              if (line.includes('Pages free')) {
                freePages = pages;
              }
            }
          });

          const pageSize = 4096; // Standard page size
          systemMemory.total = totalPages * pageSize;
          systemMemory.free = freePages * pageSize;
          systemMemory.used = systemMemory.total - systemMemory.free;
        } catch (error) {
          console.warn('Could not get macOS memory stats:', error);
        }
      }
    } catch (error) {
      console.warn('Could not get system memory stats:', error);
    }

    return systemMemory;
  }

  private parseMemInfoLine(line: string | undefined): number {
    if (!line) return 0;

    const match = line.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private formatMemoryValues(values: any, format: string): any {
    const formatted: any = {};

    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'number') {
        formatted[key] = this.formatBytes(value, format);
      } else {
        formatted[key] = value;
      }
    }

    return formatted;
  }

  private formatBytes(bytes: number, format: string): number {
    if (format === 'bytes') return bytes;
    if (format === 'kb') return Math.round(bytes / 1024);
    if (format === 'mb') return Math.round(bytes / (1024 * 1024));
    if (format === 'gb') return Math.round(bytes / (1024 * 1024 * 1024) * 100) / 100;
    if (format === 'percentage') return Math.round((bytes / (1024 * 1024 * 1024)) * 100); // Assume 1GB base for percentage

    return bytes;
  }
}