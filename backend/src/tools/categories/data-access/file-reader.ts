import { TypedTool, ToolParameterSchema } from '../../types';
import { getToolConfig } from '../../config';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File Reader Tool - Safely read text files
 */
export class FileReaderTool extends TypedTool {
  name = 'file_reader';
  description = 'Read the contents of a text file from allowed directories';

  parameterSchema: Record<string, ToolParameterSchema> = {
    file_path: {
      type: 'string',
      description: 'Path to the file to read',
      required: true
    },
    encoding: {
      type: 'string',
      description: 'File encoding (default: utf8)',
      enum: ['utf8', 'ascii', 'base64', 'hex'],
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file to read'
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf8)',
        enum: ['utf8', 'ascii', 'base64', 'hex']
      }
    },
    required: ['file_path']
  };

  protected async executeTyped(args: {
    file_path: string;
    encoding?: string;
  }): Promise<any> {
    const { file_path, encoding = 'utf8' } = args;
    const config = getToolConfig();

    // Validate file path is in allowed directories
    const resolvedPath = path.resolve(file_path);
    const isAllowed = config.fileAccess.allowedPaths.some(allowedPath => {
      const resolvedAllowedPath = path.resolve(allowedPath);
      return resolvedPath.startsWith(resolvedAllowedPath);
    });

    if (!isAllowed) {
      throw new Error(`File path "${file_path}" is not in allowed directories: ${config.fileAccess.allowedPaths.join(', ')}`);
    }

    // Check file extension
    const fileExtension = path.extname(resolvedPath).toLowerCase();
    if (!config.fileAccess.allowedExtensions.includes(fileExtension)) {
      throw new Error(`File extension "${fileExtension}" is not allowed. Allowed extensions: ${config.fileAccess.allowedExtensions.join(', ')}`);
    }

    try {
      // Check if file exists
      const stats = await fs.stat(resolvedPath);

      if (stats.isDirectory()) {
        throw new Error('Path points to a directory, not a file');
      }

      // Check file size
      if (stats.size > config.fileAccess.maxFileSize) {
        throw new Error(`File size ${stats.size} bytes exceeds maximum allowed size ${config.fileAccess.maxFileSize} bytes`);
      }

      // Read file content
      const content = await fs.readFile(resolvedPath, encoding as BufferEncoding);

      return {
        success: true,
        file_path: resolvedPath,
        content,
        size: stats.size,
        encoding,
        last_modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString()
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${resolvedPath}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied: ${resolvedPath}`);
      }
      throw error;
    }
  }
}