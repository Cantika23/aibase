/**
 * Local File System Storage Adapter
 * 
 * Stores files on the local filesystem.
 * This is the default file storage backend for single-node deployments.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AbstractFileStorage,
  type FileStorageConfig,
  type FileMetadata,
  type StoredFile,
  type ListOptions,
  type ListResult,
} from '../abstraction/file-storage';

export class LocalFileStorage extends AbstractFileStorage {
  private basePath: string;

  constructor(config: FileStorageConfig) {
    super(config);
    if (config.type !== 'local') {
      throw new Error('LocalFileStorage requires config.type to be "local"');
    }
    this.basePath = config.local!.basePath;
  }

  async initialize(): Promise<void> {
    // Ensure base directory exists
    await fs.mkdir(this.basePath, { recursive: true });
  }

  private getFullPath(key: string): string {
    const sanitizedKey = this.sanitizeKey(key);
    return path.join(this.basePath, sanitizedKey);
  }

  private getMetadataPath(filePath: string): string {
    return `${filePath}.meta.json`;
  }

  private async saveMetadata(filePath: string, metadata: FileMetadata): Promise<void> {
    const metaPath = this.getMetadataPath(filePath);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  private async loadMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const metaPath = this.getMetadataPath(filePath);
      const content = await fs.readFile(metaPath, 'utf-8');
      const data = JSON.parse(content);
      return {
        ...data,
        lastModified: new Date(data.lastModified),
      };
    } catch {
      return null;
    }
  }

  async put(
    key: string,
    data: Buffer | ReadableStream<Uint8Array>,
    metadata?: Partial<FileMetadata>
  ): Promise<StoredFile> {
    const sanitizedKey = this.sanitizeKey(key);
    const filePath = this.getFullPath(sanitizedKey);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Handle ReadableStream
    if (data instanceof ReadableStream) {
      const chunks: Uint8Array[] = [];
      const reader = data.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)), totalLength);
      await fs.writeFile(filePath, buffer);
    } else {
      await fs.writeFile(filePath, data);
    }
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Build metadata
    const fullMetadata: FileMetadata = {
      contentType: metadata?.contentType || 'application/octet-stream',
      size: stats.size,
      lastModified: stats.mtime,
      etag: this.generateETag(stats),
      customMetadata: metadata?.customMetadata,
    };
    
    // Save metadata
    await this.saveMetadata(filePath, fullMetadata);
    
    return {
      key: sanitizedKey,
      url: this.getPublicUrl(sanitizedKey),
      metadata: fullMetadata,
    };
  }

  async get(key: string): Promise<Buffer> {
    const filePath = this.getFullPath(key);
    return fs.readFile(filePath);
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array>> {
    const filePath = this.getFullPath(key);
    const file = await fs.open(filePath, 'r');
    
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const reader = file.createReadStream();
        reader.on('data', (chunk: string | Buffer) => {
          if (Buffer.isBuffer(chunk)) {
            controller.enqueue(new Uint8Array(chunk));
          } else {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        });
        reader.on('end', () => {
          controller.close();
          file.close();
        });
        reader.on('error', (err) => {
          controller.error(err);
          file.close();
        });
      },
      cancel() {
        file.close();
      },
    });
    
    return stream;
  }

  async head(key: string): Promise<FileMetadata | null> {
    const filePath = this.getFullPath(key);
    
    try {
      // Try to load saved metadata first
      const savedMetadata = await this.loadMetadata(filePath);
      if (savedMetadata) {
        return savedMetadata;
      }
      
      // Fall back to file stats
      const stats = await fs.stat(filePath);
      return {
        contentType: 'application/octet-stream',
        size: stats.size,
        lastModified: stats.mtime,
        etag: this.generateETag(stats),
      };
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFullPath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFullPath(key);
    await fs.unlink(filePath);
    
    // Also delete metadata if exists
    try {
      await fs.unlink(this.getMetadataPath(filePath));
    } catch {
      // Ignore if metadata doesn't exist
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.delete(key).catch(() => {})));
  }

  async list(options: ListOptions = {}): Promise<ListResult> {
    const prefix = options.prefix || '';
    const maxResults = options.maxResults || 1000;
    
    const searchDir = prefix 
      ? path.join(this.basePath, path.dirname(prefix))
      : this.basePath;
    
    const files: StoredFile[] = [];
    let hasMore = false;
    
    try {
      const entries = await fs.readdir(searchDir, { withFileTypes: true, recursive: true });
      
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name.endsWith('.meta.json')) continue;
        
        // Calculate relative key
        const fullPath = path.join(entry.parentPath || searchDir, entry.name);
        const relativeKey = path.relative(this.basePath, fullPath).replace(/\\/g, '/');
        
        // Filter by prefix
        if (prefix && !relativeKey.startsWith(prefix)) continue;
        
        // Check if we need to paginate
        if (files.length >= maxResults) {
          hasMore = true;
          break;
        }
        
        const metadata = await this.head(relativeKey);
        if (metadata) {
          files.push({
            key: relativeKey,
            url: this.getPublicUrl(relativeKey),
            metadata,
          });
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    return { files, hasMore };
  }

  getPublicUrl(key: string): string {
    // For local storage, return a relative path
    // The actual serving is handled by the HTTP server
    const sanitizedKey = this.sanitizeKey(key);
    return `/files/${sanitizedKey}`;
  }

  async getPresignedUrl(
    key: string,
    expirySeconds: number = 3600,
    operation: 'read' | 'write' | 'delete' = 'read'
  ): Promise<string> {
    // For local storage, we don't support true presigned URLs
    // Return the public URL with a local token for simple access control
    const sanitizedKey = this.sanitizeKey(key);
    const token = this.generateLocalToken(sanitizedKey, expirySeconds);
    return `/files/${sanitizedKey}?token=${token}&expires=${Date.now() + expirySeconds * 1000}`;
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const sourcePath = this.getFullPath(sourceKey);
    const destPath = this.getFullPath(destKey);
    
    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    
    await fs.copyFile(sourcePath, destPath);
    
    // Copy metadata if exists
    try {
      const sourceMeta = this.getMetadataPath(sourcePath);
      const destMeta = this.getMetadataPath(destPath);
      await fs.copyFile(sourceMeta, destMeta);
    } catch {
      // Ignore if metadata doesn't exist
    }
  }

  async close(): Promise<void> {
    // Nothing to close for local filesystem
  }

  private generateETag(stats: { mtime: Date; size: number }): string {
    return `"${stats.mtime.getTime().toString(36)}-${stats.size.toString(36)}"`;
  }

  private generateLocalToken(key: string, expirySeconds: number): string {
    // Simple token generation - in production, use proper HMAC
    const expires = Date.now() + expirySeconds * 1000;
    const data = `${key}:${expires}`;
    return Buffer.from(data).toString('base64url');
  }
}
