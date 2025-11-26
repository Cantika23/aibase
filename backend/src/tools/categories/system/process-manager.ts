import { TypedTool, ToolParameterSchema } from '../../types';

/**
 * Process Manager Tool - Get system process information (read-only)
 */
export class ProcessManagerTool extends TypedTool {
  name = 'process_manager';
  description = 'Get system process information and statistics (read-only)';

  parameterSchema: Record<string, ToolParameterSchema> = {
    operation: {
      type: 'string',
      description: 'Operation to perform',
      enum: ['list', 'info', 'current', 'search', 'stats'],
      required: true
    },
    pid: {
      type: 'number',
      description: 'Process ID for info operation',
      required: false
    },
    name: {
      type: 'string',
      description: 'Process name to search for',
      required: false
    },
    limit: {
      type: 'number',
      description: 'Maximum number of processes to return (default: 20)',
      minimum: 1,
      maximum: 100,
      required: false
    },
    sort_by: {
      type: 'string',
      description: 'Field to sort processes by',
      enum: ['pid', 'name', 'cpu', 'memory'],
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['list', 'info', 'current', 'search', 'stats']
      },
      pid: {
        type: 'number',
        description: 'Process ID for info operation'
      },
      name: {
        type: 'string',
        description: 'Process name to search for'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of processes to return (default: 20)',
        minimum: 1,
        maximum: 100
      },
      sort_by: {
        type: 'string',
        description: 'Field to sort processes by',
        enum: ['pid', 'name', 'cpu', 'memory']
      }
    },
    required: ['operation']
  };

  protected async executeTyped(args: any): Promise<any> {
    const { operation, pid, name, limit = 20, sort_by = 'pid' } = args;

    switch (operation) {
      case 'list':
        return this.listProcesses(limit, sort_by);

      case 'info':
        return this.getProcessInfo(pid);

      case 'current':
        return this.getCurrentProcessInfo();

      case 'search':
        return this.searchProcesses(name, limit);

      case 'stats':
        return this.getProcessStats();

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private async listProcesses(limit: number, sortBy: string): Promise<any> {
    try {
      const processes = await this.getProcessList();
      const sortedProcesses = this.sortProcesses(processes, sortBy);
      const limitedProcesses = sortedProcesses.slice(0, limit);

      return {
        operation: 'list',
        total_processes: processes.length,
        returned_processes: limitedProcesses.length,
        sort_by: sortBy,
        processes: limitedProcesses,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to list processes: ${(error as Error).message}`);
    }
  }

  private async getProcessInfo(pid: number): Promise<any> {
    if (!pid) {
      throw new Error('PID is required for info operation');
    }

    try {
      const processes = await this.getProcessList();
      const process = processes.find(p => p.pid === pid);

      if (!process) {
        return {
          operation: 'info',
          pid,
          found: false,
          message: `Process with PID ${pid} not found`,
          timestamp: new Date().toISOString()
        };
      }

      return {
        operation: 'info',
        pid,
        found: true,
        process,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get process info: ${(error as Error).message}`);
    }
  }

  private async getCurrentProcessInfo(): Promise<any> {
    try {
      const currentProcess = {
        pid: process.pid,
        ppid: process.ppid,
        title: process.title,
        version: process.version,
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        uptime: process.uptime(),
        argv: process.argv,
        exec_argv: process.execArgv,
        exec_path: process.execPath,
        cwd: process.cwd()
      };

      return {
        operation: 'current',
        process: currentProcess,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get current process info: ${(error as Error).message}`);
    }
  }

  private async searchProcesses(name: string): Promise<any> {
    if (!name) {
      throw new Error('Process name is required for search operation');
    }

    try {
      const processes = await this.getProcessList();
      const searchTerm = name.toLowerCase();
      const matchingProcesses = processes.filter(p =>
        p.name.toLowerCase().includes(searchTerm)
      );

      return {
        operation: 'search',
        search_term: name,
        total_processes: processes.length,
        matching_processes: matchingProcesses.length,
        processes: matchingProcesses,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to search processes: ${(error as Error).message}`);
    }
  }

  private async getProcessStats(): Promise<any> {
    try {
      const processes = await this.getProcessList();
      const totalMemory = processes.reduce((sum, p) => sum + p.memory_usage, 0);
      const currentProcessMemory = process.memoryUsage();

      return {
        operation: 'stats',
        total_processes: processes.length,
        total_memory_usage: totalMemory,
        current_process_memory: currentProcessMemory,
        memory_usage_percentage: totalMemory > 0 ? (currentProcessMemory.heapUsed / totalMemory) * 100 : 0,
        process_platform: process.platform,
        node_version: process.version,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get process stats: ${(error as Error).message}`);
    }
  }

  private async getProcessList(): Promise<any[]> {
    // Return limited information about the current process and potential related processes
    // This is a simplified implementation that focuses on security and permission concerns

    const processes: any[] = [];

    // Add current process
    processes.push({
      pid: process.pid,
      name: process.title.split(' ')[0] || 'node',
      memory_usage: process.memoryUsage().heapUsed,
      cpu_usage: 0, // Would need more complex calculation
      start_time: new Date(Date.now() - process.uptime() * 1000).toISOString()
    });

    // Try to get limited process information on supported platforms
    try {
      if (process.platform === 'linux' || process.platform === 'darwin') {
        const { exec } = await import('child_process');
        const util = await import('util');
        const execAsync = util.promisify(exec);

        try {
          const command = process.platform === 'linux'
            ? 'ps -eo pid,comm,pmem,etime --no-headers'
            : 'ps -eo pid,comm,pmem,etime --no-headers';

          const { stdout } = await execAsync(command, { timeout: 5000 });
          const lines = stdout.trim().split('\n');

          for (const line of lines.slice(0, 50)) { // Limit to first 50 processes
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
              const pid = parseInt(parts[0]);
              const name = parts[1];
              const memPercent = parseFloat(parts[2]);
              const etime = parts[3];

              if (pid !== process.pid) { // Skip our own process since we already added it
                processes.push({
                  pid,
                  name,
                  memory_usage: 0, // We have percentage but not absolute value
                  cpu_usage: 0,
                  memory_percent: memPercent,
                  start_time: this.parseEtime(etime)
                });
              }
            }
          }
        } catch (error) {
          console.warn('Could not get process list:', error);
        }
      }
    } catch (error) {
      console.warn('Could not get system processes:', error);
    }

    return processes;
  }

  private sortProcesses(processes: any[], sortBy: string): any[] {
    return processes.sort((a, b) => {
      switch (sortBy) {
        case 'pid':
          return a.pid - b.pid;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'cpu':
          return (b.cpu_usage || 0) - (a.cpu_usage || 0);
        case 'memory':
          return (b.memory_usage || 0) - (a.memory_usage || 0);
        default:
          return a.pid - b.pid;
      }
    });
  }

  private parseEtime(etime: string): string {
    try {
      // Parse ps etime format (days-hours:minutes:seconds or minutes:seconds)
      const now = new Date();

      if (etime.includes('-')) {
        const [days, time] = etime.split('-');
        const [hours, minutes, seconds] = time.split(':').map(Number);
        const totalMs = (parseInt(days) * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds) * 1000;
        return new Date(now.getTime() - totalMs).toISOString();
      } else if (etime.includes(':')) {
        const parts = etime.split(':').map(Number);
        let totalSeconds = 0;

        if (parts.length === 3) {
          totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          totalSeconds = parts[0] * 60 + parts[1];
        }

        return new Date(now.getTime() - totalSeconds * 1000).toISOString();
      }

      return new Date().toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }
}