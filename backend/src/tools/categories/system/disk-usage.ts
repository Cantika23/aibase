import { TypedTool, ToolParameterSchema } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Disk Usage Tool - Get disk usage statistics
 */
export class DiskUsageTool extends TypedTool {
  name = 'disk_usage';
  description = 'Get disk usage statistics for specified paths';

  parameterSchema: Record<string, ToolParameterSchema> = {
    path: {
      type: 'string',
      description: 'Path to analyze disk usage for (default: current working directory)',
      required: false
    },
    recursive: {
      type: 'boolean',
      description: 'Analyze directories recursively (default: true)',
      required: false
    },
    max_depth: {
      type: 'number',
      description: 'Maximum depth for recursive analysis (default: 3)',
      minimum: 1,
      maximum: 10,
      required: false
    },
    format: {
      type: 'string',
      description: 'Format for disk sizes',
      enum: ['bytes', 'kb', 'mb', 'gb'],
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to analyze disk usage for (default: current working directory)'
      },
      recursive: {
        type: 'boolean',
        description: 'Analyze directories recursively (default: true)'
      },
      max_depth: {
        type: 'number',
        description: 'Maximum depth for recursive analysis (default: 3)',
        minimum: 1,
        maximum: 10
      },
      format: {
        type: 'string',
        description: 'Format for disk sizes',
        enum: ['bytes', 'kb', 'mb', 'gb']
      }
    }
  };

  protected async executeTyped(args: {
    path?: string;
    recursive?: boolean;
    max_depth?: number;
    format?: string;
  }): Promise<any> {
    const {
      path: targetPath = process.cwd(),
      recursive = true,
      max_depth = 3,
      format = 'mb'
    } = args;

    try {
      const resolvedPath = path.resolve(targetPath);
      const stats = await fs.stat(resolvedPath);

      if (!stats.isDirectory()) {
        throw new Error(`Path "${resolvedPath}" is not a directory`);
      }

      const diskUsage = recursive
        ? await this.calculateRecursiveDiskUsage(resolvedPath, 0, max_depth)
        : await this.calculateSingleLevelDiskUsage(resolvedPath);

      // Get system disk info if available
      const systemDiskInfo = await this.getSystemDiskInfo(resolvedPath);

      return {
        timestamp: new Date().toISOString(),
        path: resolvedPath,
        format,
        recursive,
        max_depth,
        disk_usage: this.formatDiskUsage(diskUsage, format),
        system_disk: systemDiskInfo,
        platform: process.platform
      };
    } catch (error) {
      throw new Error(`Failed to get disk usage: ${(error as Error).message}`);
    }
  }

  private async calculateRecursiveDiskUsage(dirPath: string, currentDepth: number, maxDepth: number): Promise<any> {
    const usage = {
      total_size: 0,
      file_count: 0,
      directory_count: 0,
      files: [] as any[],
      directories: [] as any[]
    };

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const fileStats = await fs.stat(fullPath);
          usage.total_size += fileStats.size;
          usage.file_count++;

          if (currentDepth < 2) { // Only include files from first few levels
            usage.files.push({
              name: entry.name,
              size: fileStats.size,
              type: 'file'
            });
          }
        } else if (entry.isDirectory() && currentDepth < maxDepth) {
          usage.directory_count++;
          const dirStats = await fs.stat(fullPath);

          if (currentDepth < 2) { // Only include directories from first few levels
            const subUsage = await this.calculateRecursiveDiskUsage(fullPath, currentDepth + 1, maxDepth);
            usage.directories.push({
              name: entry.name,
              size: subUsage.total_size,
              file_count: subUsage.file_count,
              directory_count: subUsage.directory_count,
              type: 'directory'
            });

            usage.total_size += subUsage.total_size;
            usage.file_count += subUsage.file_count;
            usage.directory_count += subUsage.directory_count;
          } else {
            // For deeper levels, just get directory size without detailed breakdown
            try {
              const subUsage = await this.calculateRecursiveDiskUsage(fullPath, currentDepth + 1, maxDepth);
              usage.total_size += subUsage.total_size;
              usage.file_count += subUsage.file_count;
              usage.directory_count += subUsage.directory_count;
            } catch (error) {
              // Skip directories we can't access
              console.warn(`Could not access directory "${fullPath}":`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Could not read directory "${dirPath}":`, error);
    }

    return usage;
  }

  private async calculateSingleLevelDiskUsage(dirPath: string): Promise<any> {
    const usage = {
      total_size: 0,
      file_count: 0,
      directory_count: 0,
      files: [] as any[],
      directories: [] as any[]
    };

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const fileStats = await fs.stat(fullPath);
          usage.total_size += fileStats.size;
          usage.file_count++;

          usage.files.push({
            name: entry.name,
            size: fileStats.size,
            type: 'file'
          });
        } else if (entry.isDirectory()) {
          usage.directory_count++;
          const dirStats = await fs.stat(fullPath);

          usage.directories.push({
            name: entry.name,
            size: 0, // Not calculating recursively
            file_count: 0,
            directory_count: 0,
            type: 'directory'
          });
        }
      }
    } catch (error) {
      console.warn(`Could not read directory "${dirPath}":`, error);
    }

    return usage;
  }

  private async getSystemDiskInfo(targetPath: string): Promise<any> {
    const systemInfo: any = {
      total: 0,
      used: 0,
      available: 0,
      usage_percentage: 0
    };

    try {
      if (process.platform === 'linux') {
        const { exec } = await import('child_process');
        const util = await import('util');
        const execAsync = util.promisify(exec);

        try {
          const { stdout } = await execAsync(`df -h "${targetPath}"`);
          const lines = stdout.trim().split('\n');

          if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/);
            if (parts.length >= 6) {
              systemInfo.total = this.parseDiskSize(parts[1]);
              systemInfo.used = this.parseDiskSize(parts[2]);
              systemInfo.available = this.parseDiskSize(parts[3]);
              systemInfo.usage_percentage = parseFloat(parts[4].replace('%', ''));
            }
          }
        } catch (error) {
          console.warn('Could not get Linux disk info:', error);
        }
      } else if (process.platform === 'darwin') {
        const { exec } = await import('child_process');
        const util = await import('util');
        const execAsync = util.promisify(exec);

        try {
          const { stdout } = await execAsync(`df -h "${targetPath}"`);
          const lines = stdout.trim().split('\n');

          if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/);
            if (parts.length >= 6) {
              systemInfo.total = this.parseDiskSize(parts[1]);
              systemInfo.used = this.parseDiskSize(parts[2]);
              systemInfo.available = this.parseDiskSize(parts[3]);
              systemInfo.usage_percentage = parseFloat(parts[4].replace('%', ''));
            }
          }
        } catch (error) {
          console.warn('Could not get macOS disk info:', error);
        }
      }
    } catch (error) {
      console.warn('Could not get system disk info:', error);
    }

    return systemInfo;
  }

  private parseDiskSize(sizeStr: string): number {
    const size = parseFloat(sizeStr);
    if (sizeStr.includes('K')) return size * 1024;
    if (sizeStr.includes('M')) return size * 1024 * 1024;
    if (sizeStr.includes('G')) return size * 1024 * 1024 * 1024;
    if (sizeStr.includes('T')) return size * 1024 * 1024 * 1024 * 1024;
    return size;
  }

  private formatDiskUsage(usage: any, format: string): any {
    const formatted = {
      ...usage,
      total_size: this.formatBytes(usage.total_size, format),
      average_file_size: usage.file_count > 0 ? this.formatBytes(usage.total_size / usage.file_count, format) : 0
    };

    // Format file and directory sizes
    formatted.files = usage.files.map((file: any) => ({
      ...file,
      size: this.formatBytes(file.size, format)
    }));

    formatted.directories = usage.directories.map((dir: any) => ({
      ...dir,
      size: this.formatBytes(dir.size, format)
    }));

    return formatted;
  }

  private formatBytes(bytes: number, format: string): number {
    if (format === 'bytes') return bytes;
    if (format === 'kb') return Math.round(bytes / 1024);
    if (format === 'mb') return Math.round(bytes / (1024 * 1024));
    if (format === 'gb') return Math.round(bytes / (1024 * 1024 * 1024) * 100) / 100;

    return bytes;
  }
}