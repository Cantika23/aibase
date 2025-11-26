import { TypedTool, ToolParameterSchema } from '../../types';
import { getToolConfig } from '../../config';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File Writer Tool - Safely write text files
 */
export class FileWriterTool extends TypedTool {
  name = 'file_writer';
  description = 'Write content to a text file in allowed directories';

  parameterSchema: Record<string, ToolParameterSchema> = {
    file_path: {
      type: 'string',
      description: 'Path to the file to write',
      required: true
    },
    content: {
      type: 'string',
      description: 'Content to write to the file',
      required: true
    },
    encoding: {
      type: 'string',
      description: 'File encoding (default: utf8)',
      enum: ['utf8', 'ascii', 'base64', 'hex'],
      required: false
    },
    mode: {
      type: 'string',
      description: 'Write mode: "write" (overwrite) or "append"',
      enum: ['write', 'append'],
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file to write'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf8)',
        enum: ['utf8', 'ascii', 'base64', 'hex']
      },
      mode: {
        type: 'string',
        description: 'Write mode: "write" (overwrite) or "append"',
        enum: ['write', 'append']
      }
    },
    required: ['file_path', 'content']
  };

  protected async executeTyped(args: {
    file_path: string;
    content: string;
    encoding?: string;
    mode?: string;
  }): Promise<any> {
    const { file_path, content, encoding = 'utf8', mode = 'write' } = args;
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

    // Create directory if it doesn't exist
    const directory = path.dirname(resolvedPath);
    await fs.mkdir(directory, { recursive: true });

    try {
      // Check content size
      const contentSize = Buffer.byteLength(content, encoding as BufferEncoding);
      if (contentSize > config.fileAccess.maxFileSize) {
        throw new Error(`Content size ${contentSize} bytes exceeds maximum allowed size ${config.fileAccess.maxFileSize} bytes`);
      }

      // Write file
      if (mode === 'append') {
        await fs.appendFile(resolvedPath, content, encoding as BufferEncoding);
      } else {
        await fs.writeFile(resolvedPath, content, encoding as BufferEncoding);
      }

      // Get file stats after writing
      const stats = await fs.stat(resolvedPath);

      return {
        success: true,
        file_path: resolvedPath,
        mode,
        encoding,
        size: stats.size,
        last_modified: stats.mtime.toISOString(),
        bytes_written: contentSize
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied: ${resolvedPath}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'ENOSPC') {
        throw new Error(`No space left on device: ${resolvedPath}`);
      }
      throw error;
    }
  }
}