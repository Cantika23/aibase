/**
 * HTTP file upload handler
 * Handles multipart/form-data file uploads
 * 
 * ARCHITECTURE: Non-blocking upload with async post-processing
 * 1. File is saved synchronously (blocking)
 * 2. Response is returned immediately with file info
 * 3. Post-processing (thumbnail, extension hooks) runs asynchronously
 * 4. Real-time updates sent via WebSocket
 */

import { FileStorage, type FileScope } from '../storage/file-storage';
import { ProjectStorage } from '../storage/project-storage';
import { FileContextStorage } from '../storage/file-context-storage';
import { createLogger } from '../utils/logger';
import sharp from 'sharp';
import * as path from 'path';
import { extensionHookRegistry } from '../tools/extensions/extension-hooks';
import { ExtensionLoader } from '../tools/extensions/extension-loader';
import type { WSServer } from '../ws/entry';
import { getProjectFilesDir } from '../config/paths';

const logger = createLogger('Upload');

/**
 * Track async processing jobs for potential future monitoring/cancellation
 */
const activeProcessingJobs = new Map<string, AbortController>();

/**
 * Track pending files per conversation
 * Key: convId, Value: Set of file names still being processed
 */
const pendingFilesByConversation = new Map<string, Set<string>>();

/**
 * Resolvers for waiting on file processing
 * Key: `${convId}:${fileName}`, Value: array of resolve functions
 */
const fileProcessingResolvers = new Map<string, Array<() => void>>();

/**
 * Check if a file is currently being processed
 */
export function isFileProcessing(convId: string, fileName: string): boolean {
  const pendingFiles = pendingFilesByConversation.get(convId);
  return pendingFiles ? pendingFiles.has(fileName) : false;
}

/**
 * Wait for a specific file to finish processing
 */
export async function waitForFileProcessing(convId: string, fileName: string): Promise<void> {
  if (!isFileProcessing(convId, fileName)) {
    return; // File not being processed
  }

  const key = `${convId}:${fileName}`;
  return new Promise((resolve) => {
    const resolvers = fileProcessingResolvers.get(key) || [];
    resolvers.push(resolve);
    fileProcessingResolvers.set(key, resolvers);
    logger.debug({ convId, fileName }, 'Added resolver waiting for file processing');
  });
}

/**
 * Mark a file as pending processing
 */
function markFilePending(convId: string, fileName: string): void {
  const pendingFiles = pendingFilesByConversation.get(convId) || new Set();
  pendingFiles.add(fileName);
  pendingFilesByConversation.set(convId, pendingFiles);
  logger.debug({ convId, fileName }, 'Marked file as pending');
}

/**
 * Mark a file as processing complete and notify waiters
 */
function markFileComplete(convId: string, fileName: string): void {
  const pendingFiles = pendingFilesByConversation.get(convId);
  if (pendingFiles) {
    pendingFiles.delete(fileName);
    if (pendingFiles.size === 0) {
      pendingFilesByConversation.delete(convId);
    }
    logger.debug({ convId, fileName }, 'Marked file as complete');
  }

  // Notify all waiters
  const key = `${convId}:${fileName}`;
  const resolvers = fileProcessingResolvers.get(key);
  if (resolvers) {
    resolvers.forEach(resolve => resolve());
    fileProcessingResolvers.delete(key);
    logger.debug({ convId, fileName, count: resolvers.length }, 'Notified waiters of file completion');
  }
}

/**
 * Get all pending files for a conversation
 */
export function getPendingFiles(convId: string): string[] {
  const pendingFiles = pendingFilesByConversation.get(convId);
  return pendingFiles ? Array.from(pendingFiles) : [];
}

/**
 * Ensure extensions are loaded for a project (for hooks to be registered)
 *
 * Note: We create a new ExtensionLoader instance each time to ensure hooks
 * are properly registered for the current request context.
 */
async function ensureExtensionsLoaded(projectId: string): Promise<void> {
  try {
    const extensionLoader = new ExtensionLoader();

    // Load extensions (this registers hooks)
    await extensionLoader.loadExtensions(projectId);

    logger.info({ projectId }, 'Extensions loaded for hook registration');
  } catch (error) {
    logger.warn({ projectId, error }, 'Failed to load extensions, hooks may not be available');
  }
}

/**
 * Broadcast file update to clients
 * Used to notify frontend of async processing completion
 */
function broadcastFileUpdate(
  wsServer: WSServer | undefined, 
  convId: string, 
  fileInfo: UploadedFileInfo,
  updateType: 'thumbnail' | 'description' | 'complete' = 'complete'
) {
  if (!wsServer) return;

  try {
    wsServer.broadcastToConv(convId, {
      type: 'file_update',
      id: `file_update_${Date.now()}`,
      data: { 
        file: fileInfo,
        updateType,
      },
      metadata: { timestamp: Date.now() },
    });
    logger.debug({ fileName: fileInfo.name, updateType }, 'Broadcasted file update');
  } catch (error) {
    logger.warn({ error }, 'Failed to broadcast file update');
  }
}

export interface UploadedFileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: number;
  scope: FileScope;
  description?: string;
  title?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const THUMBNAIL_SIZE = 300; // pixels for the longest side

/**
 * Broadcast status message to all clients for a conversation
 */
function broadcastStatus(wsServer: WSServer | undefined, convId: string, status: string, message: string) {
  if (!wsServer) return;

  try {
    wsServer.broadcastToConv(convId, {
      type: 'status',
      id: `status_${Date.now()}`,
      data: { status, message },
      metadata: { timestamp: Date.now() },
    });
  } catch (error) {
    logger.warn({ error }, 'Failed to broadcast status');
  }
}

/**
 * Check if a file is an image based on its MIME type or extension
 */
function isImageFile(fileName: string, mimeType: string): boolean {
  const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif'];

  if (imageMimeTypes.includes(mimeType)) return true;

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext && imageExtensions.includes(ext)) return true;

  return false;
}

/**
 * Generate a thumbnail for an image
 */
async function generateThumbnail(
  imageBuffer: Buffer,
  fileName: string,
  projectId: string
): Promise<string | null> {
  try {
    // Create sharp instance from buffer
    const image = sharp(imageBuffer);

    // Get image metadata
    const metadata = await image.metadata();

    // Don't generate thumbnail if image is already smaller than thumbnail size
    if (metadata.width && metadata.width <= THUMBNAIL_SIZE && metadata.height && metadata.height <= THUMBNAIL_SIZE) {
      return null;
    }

    // Generate thumbnail filename
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const thumbnailFileName = `${baseName}.thumb${ext}`;

    // Get tenantId for this project
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);
    if (!project) {
      return null;
    }
    const tenantId = project.tenant_id ?? 'default';

    // Use centralized path config to ensure consistency
    const thumbnailPath = path.join(getProjectFilesDir(projectId, tenantId), thumbnailFileName);

    // Resize and save thumbnail
    await image
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFile(thumbnailPath);

    logger.info({ thumbnailPath }, 'Thumbnail generated');

    return `/api/files/${projectId}/${convId}/${thumbnailFileName}`;
  } catch (error) {
    logger.error({ error, fileName }, 'Failed to generate thumbnail');
    return null;
  }
}

/**
 * Process file asynchronously after upload completes
 * This runs in the background and sends real-time updates via WebSocket
 */
async function processFileAsync(
  fileInfo: {
    fileId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    convId: string;
    projectId: string;
    tenantId: string;
    scope: FileScope;
    buffer: Buffer;
    storedFileName: string;
  },
  wsServer: WSServer | undefined
): Promise<void> {
  const { fileId, fileName, fileType, fileSize, convId, projectId, tenantId, scope, buffer, storedFileName } = fileInfo;
  const jobId = `process_${fileId}`;
  
  // Mark file as pending processing
  markFilePending(convId, storedFileName);
  
  // Create abort controller for this job
  const abortController = new AbortController();
  activeProcessingJobs.set(jobId, abortController);
  
  const fileStorage = FileStorage.getInstance();
  const filePath = path.join(getProjectFilesDir(projectId, tenantId), storedFileName);
  
  try {
    logger.info({ fileName, jobId }, '[UPLOAD-HANDLER] Starting async post-processing');
    
    // Step 1: Generate thumbnail for images
    let thumbnailUrl: string | undefined;
    const isImage = isImageFile(fileName, fileType);
    
    if (isImage) {
      broadcastStatus(wsServer, convId, 'processing', `Generating thumbnail for ${fileName}...`);
      try {
        thumbnailUrl = await generateThumbnail(buffer, fileName, projectId) || undefined;
        
        // Update metadata with thumbnail URL
        if (thumbnailUrl) {
          await fileStorage.updateFileMeta('', storedFileName, projectId, tenantId, { thumbnailUrl });
          logger.info({ fileName, thumbnailUrl }, '[UPLOAD-HANDLER] Thumbnail generated and saved');
          
          // Broadcast thumbnail update
          broadcastFileUpdate(wsServer, convId, {
            id: fileId,
            name: storedFileName,
            size: fileSize,
            type: fileType,
            url: `/api/files/${projectId}/${storedFileName}`,
            thumbnailUrl,
            uploadedAt: Date.now(),
            scope,
          }, 'thumbnail');
        }
      } catch (thumbError) {
        logger.warn({ error: thumbError, fileName }, '[UPLOAD-HANDLER] Thumbnail generation failed');
      }
    }
    
    // Step 2: Execute extension hooks for analysis
    broadcastStatus(wsServer, convId, 'processing', `Analyzing ${fileName}...`);
    logger.info({ fileName }, '[UPLOAD-HANDLER] Starting extension analysis for file');
    
    try {
      // Ensure extensions are loaded (hooks registered) before executing hooks
      await ensureExtensionsLoaded(projectId);
      
      const hookResult = await extensionHookRegistry.executeHook('afterFileUpload', {
        convId,
        projectId,
        fileName: storedFileName,
        filePath,
        fileType,
        fileSize,
      });
      
      logger.info({ fileName, hookResult }, '[UPLOAD-HANDLER] Extension hook execution result');
      
      let fileDescription: string | undefined;
      let fileTitle: string | undefined;
      
      if (hookResult?.description && typeof hookResult.description === 'string') {
        fileDescription = hookResult.description;
        logger.info({ fileName, description: fileDescription.substring(0, 100) }, '[UPLOAD-HANDLER] Extension hook generated description');
        
        if (hookResult.title && typeof hookResult.title === 'string') {
          fileTitle = hookResult.title;
          logger.info({ fileTitle }, '[UPLOAD-HANDLER] Extension hook generated title');
        }
        
        // Update file metadata with description and title
        try {
          await fileStorage.updateFileMeta('', storedFileName, projectId, tenantId, {
            description: fileDescription,
            title: fileTitle
          });
          logger.info({ fileTitle }, '[UPLOAD-HANDLER] File metadata updated with description and title');
          
          // Broadcast description update
          broadcastFileUpdate(wsServer, convId, {
            id: fileId,
            name: storedFileName,
            size: fileSize,
            type: fileType,
            url: `/api/files/${projectId}/${storedFileName}`,
            thumbnailUrl,
            uploadedAt: Date.now(),
            scope,
            description: fileDescription,
            title: fileTitle,
          }, 'description');
        } catch (updateError) {
          logger.error({ error: updateError }, '[UPLOAD-HANDLER] Failed to update file metadata');
        }
      } else {
        logger.info('[UPLOAD-HANDLER] Extension hook: No description generated');
      }
    } catch (hookError) {
      logger.error({ error: hookError, fileName }, '[UPLOAD-HANDLER] Extension hook execution failed');
    }
    
    // Step 3: Broadcast completion
    broadcastStatus(wsServer, convId, 'complete', `Successfully processed ${fileName}`);
    logger.info({ fileName }, '[UPLOAD-HANDLER] Async post-processing completed');
    
  } catch (error) {
    logger.error({ error, fileName }, '[UPLOAD-HANDLER] Async post-processing failed');
    broadcastStatus(wsServer, convId, 'error', `Failed to process ${fileName}`);
  } finally {
    activeProcessingJobs.delete(jobId);
    // Mark file as complete and notify all waiters
    markFileComplete(convId, storedFileName);
  }
}

/**
 * Handle file upload via HTTP POST
 * 
 * FLOW:
 * 1. File is saved synchronously (blocking)
 * 2. Response is returned immediately with file info
 * 3. Post-processing (thumbnail, extension hooks) runs asynchronously
 * 4. Real-time updates sent via WebSocket
 */
export async function handleFileUpload(req: Request, wsServer?: WSServer): Promise<Response> {
  logger.info('========================================');
  logger.info('[UPLOAD-HANDLER] File upload request received');
  
  try {
    // Get conversation ID and project ID from query params
    const url = new URL(req.url);
    const convId = url.searchParams.get('convId') ?? '';
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      return Response.json(
        { success: false, error: 'Missing projectId parameter' },
        { status: 400 }
      );
    }

    // Get project to retrieve tenant_id
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const files = formData.getAll('files');

    if (!files || files.length === 0) {
      return Response.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    // Get scope from form data, default to 'user'
    const scopeParam = formData.get('scope');
    const scope: FileScope = (scopeParam === 'public' || scopeParam === 'user') ? scopeParam : 'user';

    const fileStorage = FileStorage.getInstance();
    const uploadedFiles: UploadedFileInfo[] = [];
    const tenantId = project.tenant_id ?? 'default';
    
    // Collect file buffers for async processing
    const filesToProcess: Array<{
      fileId: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      buffer: Buffer;
      storedFileName: string;
    }> = [];

    // Phase 1: Synchronous file save (blocking)
    logger.info('[UPLOAD-HANDLER] Starting synchronous file save phase');
    
    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          {
            success: false,
            error: `File ${file.name} exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
          },
          { status: 413 }
        );
      }

      logger.info({
        file: file.name,
        size: file.size,
        type: file.type,
        scope
      }, 'Processing file (sync phase)');

      // Broadcast: Starting to save file
      broadcastStatus(wsServer, convId, 'processing', `Saving ${file.name}...`);

      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save file synchronously (no thumbnail yet - that happens async)
      const storedFile = await fileStorage.saveFile(
        convId,
        file.name,
        buffer,
        file.type,
        projectId,
        tenantId,
        scope,
        undefined // No thumbnail yet - generated async
      );

      // Generate unique ID for the file reference
      const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      // Add to response list
      uploadedFiles.push({
        id: fileId,
        name: storedFile.name,
        size: storedFile.size,
        type: storedFile.type,
        url: `/api/files/${projectId}/${storedFile.name}`,
        thumbnailUrl: undefined, // Will be updated async
        uploadedAt: storedFile.uploadedAt,
        scope: storedFile.scope,
        description: undefined, // Will be updated async
        title: undefined, // Will be updated async
      });

      // Queue for async processing
      filesToProcess.push({
        fileId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        buffer,
        storedFileName: storedFile.name,
      });

      logger.info({ path: storedFile.path, scope, fileId }, 'File saved synchronously');
    }

    // Phase 2: Return response immediately (file is saved)
    logger.info({ fileCount: uploadedFiles.length }, '[UPLOAD-HANDLER] Synchronous save complete, returning response');
    
    // Phase 3: Start async post-processing (don't await - run in background)
    if (filesToProcess.length > 0) {
      logger.info({ fileCount: filesToProcess.length }, '[UPLOAD-HANDLER] Starting async post-processing');
      
      // Fire-and-forget async processing for each file
      for (const fileInfo of filesToProcess) {
        processFileAsync(
          { ...fileInfo, convId, projectId, tenantId: String(tenantId), scope },
          wsServer
        ).catch(error => {
          logger.error({ error, fileName: fileInfo.fileName }, '[UPLOAD-HANDLER] Uncaught error in async processing');
        });
      }
    }

    // Phase 4: Auto-check logic (async, non-blocking)
    // Run this in background after response is sent
    (async () => {
      try {
        const fileContextStorage = FileContextStorage.getInstance();
        const allFiles = await fileStorage.listFiles(convId, projectId, tenantId);

        logger.info({ projectId, fileCount: allFiles.length }, '[UPLOAD-HANDLER] Total files in project');

        if (allFiles.length < 10) {
          logger.info({ uploadedFilesCount: uploadedFiles.length, totalFiles: allFiles.length }, '[UPLOAD-HANDLER] Auto-checking new files in context');
          await fileContextStorage.bulkSetFilesInContext(
            uploadedFiles.map(f => f.id),
            true,
            projectId,
            tenantId
          );
          logger.info({ uploadedFilesCount: uploadedFiles.length }, '[UPLOAD-HANDLER] Successfully auto-checked files in context');
        } else {
          logger.info({ totalFiles: allFiles.length }, '[UPLOAD-HANDLER] Not auto-checking files');
        }
      } catch (error) {
        // Log error but don't fail the upload
        logger.error({ error }, '[UPLOAD-HANDLER] Failed to auto-check files in context');
      }
    })();

    // Return success response immediately
    return Response.json({
      success: true,
      files: uploadedFiles,
      message: 'Files uploaded successfully. Post-processing in progress.',
    });

  } catch (error: any) {
    logger.error({ error }, 'Upload error');
    return Response.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle file download/retrieval
 */
export async function handleFileDownload(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');

    // Expected: /api/files/{projectId}/{fileName}
    if (pathParts.length < 5) {
      return new Response('Invalid file path', { status: 400 });
    }

    const projectId = pathParts[3];
    const fileName = pathParts[4];

    if (!projectId || !fileName) {
      return new Response('Invalid file path', { status: 400 });
    }

    // Get project to retrieve tenant_id
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);
    if (!project) {
      return new Response('Project not found', { status: 404 });
    }

    const fileStorage = FileStorage.getInstance();
    const tenantId = project.tenant_id ?? 'default';
    const fileBuffer = await fileStorage.getFile('', fileName, projectId!, tenantId);

    // Try to determine content type from extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    const contentType = getContentType(ext ?? 'application/octet-stream');

    // Convert Buffer to Uint8Array for Response
    const uint8Array = new Uint8Array(fileBuffer);

    return new Response(uint8Array, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    logger.error({ error }, 'Download error');
    if (error.code === 'ENOENT') {
      return new Response('File not found', { status: 404 });
    }
    return new Response('Download failed', { status: 500 });
  }
}

function getContentType(ext: string | undefined): string {
  const types: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'json': 'application/json',
    'csv': 'text/csv',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
  };

  return types[ext || ''] || 'application/octet-stream';
}
