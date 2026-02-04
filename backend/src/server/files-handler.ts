/**
 * Handler for file management API endpoints
 */

import { FileStorage, type FileScope } from "../storage/file-storage";
import { ProjectStorage } from "../storage/project-storage";
import { ChatHistoryStorage } from "../storage/chat-history-storage";
import { createLogger } from "../utils/logger";
import { extensionHookRegistry } from "../tools/extensions/extension-hooks";
import { ExtensionLoader } from "../tools/extensions/extension-loader";
import { getProjectFilesDir } from "../config/paths";
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger("Files");

const fileStorage = FileStorage.getInstance();
const projectStorage = ProjectStorage.getInstance();
const chatHistoryStorage = ChatHistoryStorage.getInstance();

export interface FileWithConversation {
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
  url: string;
  thumbnailUrl?: string;
  scope: FileScope;
  description?: string;
  title?: string;
  processingError?: string;
}

/**
 * Handle GET /api/files?projectId={id} - Get all files for a project
 */
export async function handleGetProjectFiles(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return Response.json(
        {
          success: false,
          error: "projectId query parameter is required",
        },
        { status: 400 }
      );
    }

    // Get project to retrieve tenant_id
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    const tenantId = project.tenant_id ?? 'default';

    // List files directly from project files directory (flat structure)
    const files = await fileStorage.listFiles('', projectId, tenantId);

    logger.info({ projectId, fileCount: files.length, files: files.map(f => f.name) }, 'Files found in project');

    // Map files to response format with new URL structure
    const filesWithUrls = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: file.uploadedAt,
      url: `/api/files/${projectId}/${file.name}`,
      thumbnailUrl: file.thumbnailUrl,
      scope: file.scope,
      description: file.description,
      title: file.title,
      processingError: file.processingError,
    }));

    // Sort by upload date (most recent first)
    filesWithUrls.sort((a, b) => b.uploadedAt - a.uploadedAt);

    return Response.json({
      success: true,
      data: { files: filesWithUrls },
    });
  } catch (error) {
    logger.error({ error }, "Error getting project files");
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project files",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /api/conversations/:convId/files?projectId={id} - Get files for a specific conversation
 */
export async function handleGetConversationFiles(
  req: Request,
  convId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return Response.json(
        {
          success: false,
          error: "projectId query parameter is required",
        },
        { status: 400 }
      );
    }

    // Get project to retrieve tenant_id
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    const tenantId = project.tenant_id ?? 'default';

    // Get files for the conversation
    const files = await fileStorage.listFiles(convId, projectId, tenantId);

    const filesWithUrls = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: file.uploadedAt,
      convId,
      url: `/api/files/${projectId}/${convId}/${file.name}`,
      thumbnailUrl: file.thumbnailUrl,
      scope: file.scope,
      description: file.description,
      title: file.title,
      processingError: file.processingError,
    }));

    return Response.json({
      success: true,
      data: { files: filesWithUrls },
    });
  } catch (error) {
    logger.error({ error }, "Error getting conversation files");
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get conversation files",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle PATCH /api/files/:projectId/:fileName/rename - Rename a file
 */
export async function handleRenameFile(
  req: Request,
  projectId: string,
  fileName: string
): Promise<Response> {
  try {
    const body = await req.json() as { newName?: unknown };
    const { newName } = body;

    if (!newName) {
      return Response.json(
        {
          success: false,
          error: "newName is required in request body",
        },
        { status: 400 }
      );
    }

    // Get project to retrieve tenant_id
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    const tenantId = project.tenant_id ?? 'default';

    await fileStorage.renameFile('', fileName, newName as string, projectId, tenantId);

    return Response.json({
      success: true,
      message: "File renamed successfully",
      data: {
        oldName: fileName,
        newName,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error renaming file");
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to rename file",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle POST /api/files/move - Move a file to a different conversation
 */
export async function handleMoveFile(req: Request): Promise<Response> {
  try {
    const body = await req.json() as {
      projectId?: unknown;
      fromConvId?: unknown;
      toConvId?: unknown;
      fileName?: unknown;
    };
    const { projectId, fromConvId, toConvId, fileName } = body;

    if (!projectId || !fromConvId || !toConvId || !fileName) {
      return Response.json(
        {
          success: false,
          error: "projectId, fromConvId, toConvId, and fileName are required",
        },
        { status: 400 }
      );
    }

    // Get project to retrieve tenant_id
    const project = projectStorage.getById(projectId as string);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    const tenantId = project.tenant_id ?? 'default';

    await fileStorage.moveFile(fromConvId as string, toConvId as string, fileName as string, projectId as string, tenantId);

    return Response.json({
      success: true,
      message: "File moved successfully",
      data: {
        fromConvId,
        toConvId,
        fileName,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error moving file");
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to move file",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE /api/files/:projectId/:fileName - Delete a specific file
 */
export async function handleDeleteFile(
  req: Request,
  projectId: string,
  fileName: string
): Promise<Response> {
  try {
    // Get project to retrieve tenant_id
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    const tenantId = project.tenant_id ?? 'default';

    await fileStorage.deleteFile('', fileName, projectId, tenantId);

    return Response.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    logger.error({ error }, "Error deleting file");
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete file",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle PATCH /api/files/:projectId/:fileName/description - Update file description
 */
export async function handleUpdateFileDescription(
  req: Request,
  projectId: string,
  fileName: string
): Promise<Response> {
  try {
    const body = await req.json() as { description?: string; title?: string };
    const { description, title } = body;

    if (description === undefined && title === undefined) {
      return Response.json(
        {
          success: false,
          error: "description or title is required in request body",
        },
        { status: 400 }
      );
    }

    // Get project to retrieve tenant_id
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    const tenantId = project.tenant_id ?? 'default';

    // Update file metadata
    await fileStorage.updateFileMeta('', fileName, projectId, tenantId, {
      ...(description !== undefined && { description }),
      ...(title !== undefined && { title }),
    });

    return Response.json({
      success: true,
      message: "File description updated successfully",
      data: { description, title },
    });
  } catch (error) {
    logger.error({ error }, "Error updating file description");
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update file description",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle POST /api/files/:projectId/:fileName/regenerate - Regenerate file description
 */
export async function handleRegenerateFileDescription(
  req: Request,
  projectId: string,
  fileName: string
): Promise<Response> {
  try {
    // Get project to retrieve tenant_id
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    const tenantId = project.tenant_id ?? 'default';

    // Get file info
    const filePath = path.join(getProjectFilesDir(projectId, tenantId), fileName);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return Response.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    // Get file stats
    const stats = await fs.stat(filePath);

    // Try to determine mime type from extension
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    const fileType = mimeTypes[ext] || 'application/octet-stream';

    // Load extensions
    try {
      const extensionLoader = new ExtensionLoader();
      await extensionLoader.loadExtensions(projectId);
      logger.info({ projectId }, 'Extensions loaded for regeneration');
    } catch (error) {
      logger.warn({ projectId, error }, 'Failed to load extensions');
    }

    // Execute extension hooks
    const hookResult = await extensionHookRegistry.executeHook('afterFileUpload', {
      convId: '', // No specific conversation for regeneration
      projectId,
      fileName,
      filePath,
      fileType,
      fileSize: stats.size,
    });

    let fileDescription: string | undefined;
    let fileTitle: string | undefined;

    if (hookResult?.description && typeof hookResult.description === 'string') {
      fileDescription = hookResult.description;
      logger.info({ fileName, description: fileDescription.substring(0, 100) }, 'Regenerated description');

      if (hookResult.title && typeof hookResult.title === 'string') {
        fileTitle = hookResult.title;
      }

      // Update file metadata, clear any previous error
      await fileStorage.updateFileMeta('', fileName, projectId, tenantId, {
        description: fileDescription,
        title: fileTitle,
        processingError: undefined,
      });
    } else {
      logger.info({ fileName }, 'No description generated by hooks');
    }

    return Response.json({
      success: true,
      message: fileDescription ? "Description regenerated successfully" : "No description generated",
      data: {
        description: fileDescription,
        title: fileTitle,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error }, "Error regenerating file description");
    
    // Save error to file metadata
    try {
      await fileStorage.updateFileMeta('', fileName, projectId, tenantId, {
        processingError: errorMessage,
      });
    } catch (updateError) {
      logger.error({ error: updateError }, "Failed to save processing error to metadata");
    }
    
    return Response.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
