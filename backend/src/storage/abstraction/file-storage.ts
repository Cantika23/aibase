/**
 * File Storage Abstraction Layer
 * 
 * Provides a unified interface for different file storage backends:
 * - Local filesystem (default, current implementation)
 * - S3-compatible storage (MinIO, AWS S3, etc.)
 * - Azure Blob Storage
 * - Google Cloud Storage
 */

// ============================================================================
// Types
// ============================================================================

export interface FileMetadata {
  contentType: string;
  size: number;
  lastModified: Date;
  etag?: string;
  customMetadata?: Record<string, string>;
}

export interface StoredFile {
  key: string;           // Unique identifier (path in local fs, key in S3)
  url: string;           // Public or presigned URL
  metadata: FileMetadata;
}

export interface FileStorageConfig {
  type: 'local' | 's3' | 'azure' | 'gcs';
  
  // Local filesystem options
  local?: {
    basePath: string;
  };
  
  // S3-compatible options (works with AWS S3, MinIO, etc.)
  s3?: {
    endpoint?: string;           // Optional: for MinIO or custom S3
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;    // Required for MinIO
    presignedUrlExpiry?: number; // Seconds (default: 3600)
    publicUrlPrefix?: string;    // CDN or direct S3 URL prefix
  };
  
  // Azure Blob Storage
  azure?: {
    connectionString: string;
    container: string;
  };
  
  // Google Cloud Storage
  gcs?: {
    projectId: string;
    bucket: string;
    keyFilename?: string;        // Path to service account key file
  };
}

export interface ListOptions {
  prefix?: string;
  maxResults?: number;
  continuationToken?: string;
}

export interface ListResult {
  files: StoredFile[];
  continuationToken?: string;
  hasMore: boolean;
}

// ============================================================================
// Abstract File Storage Interface
// ============================================================================

export abstract class AbstractFileStorage {
  protected config: FileStorageConfig;

  constructor(config: FileStorageConfig) {
    this.config = config;
  }

  /**
   * Initialize the storage connection
   */
  abstract initialize(): Promise<void>;

  /**
   * Store a file
   * @param key Unique identifier for the file
   * @param data File content (Buffer or ReadableStream)
   * @param metadata File metadata
   * @returns Stored file info
   */
  abstract put(
    key: string,
    data: Buffer | ReadableStream<Uint8Array>,
    metadata?: Partial<FileMetadata>
  ): Promise<StoredFile>;

  /**
   * Retrieve a file
   * @param key File identifier
   * @returns File content as Buffer
   */
  abstract get(key: string): Promise<Buffer>;

  /**
   * Get a readable stream for a file (for large files)
   * @param key File identifier
   * @returns Readable stream
   */
  abstract getStream(key: string): Promise<ReadableStream<Uint8Array>>;

  /**
   * Get file metadata without downloading content
   * @param key File identifier
   * @returns File metadata or null if not found
   */
  abstract head(key: string): Promise<FileMetadata | null>;

  /**
   * Check if file exists
   * @param key File identifier
   */
  abstract exists(key: string): Promise<boolean>;

  /**
   * Delete a file
   * @param key File identifier
   */
  abstract delete(key: string): Promise<void>;

  /**
   * Delete multiple files
   * @param keys Array of file identifiers
   */
  abstract deleteMany(keys: string[]): Promise<void>;

  /**
   * List files with optional prefix
   * @param options List options
   */
  abstract list(options?: ListOptions): Promise<ListResult>;

  /**
   * Get a public URL for a file (if public access is enabled)
   * @param key File identifier
   */
  abstract getPublicUrl(key: string): string;

  /**
   * Generate a presigned URL for temporary access
   * @param key File identifier
   * @param expirySeconds URL expiration time in seconds
   * @param operation 'read' | 'write' | 'delete'
   */
  abstract getPresignedUrl(
    key: string,
    expirySeconds?: number,
    operation?: 'read' | 'write' | 'delete'
  ): Promise<string>;

  /**
   * Copy a file within storage
   * @param sourceKey Source file identifier
   * @param destKey Destination file identifier
   */
  abstract copy(sourceKey: string, destKey: string): Promise<void>;

  /**
   * Move/rename a file
   * @param sourceKey Source file identifier
   * @param destKey Destination file identifier
   */
  async move(sourceKey: string, destKey: string): Promise<void> {
    await this.copy(sourceKey, destKey);
    await this.delete(sourceKey);
  }

  /**
   * Close connection and cleanup
   */
  abstract close(): Promise<void>;

  /**
   * Get storage type
   */
  getType(): FileStorageConfig['type'] {
    return this.config.type;
  }

  /**
   * Sanitize a key to be safe for storage
   * Removes dangerous characters and normalizes path separators
   */
  protected sanitizeKey(key: string): string {
    // Remove leading/trailing slashes
    key = key.replace(/^\/+|\/+$/g, '');
    
    // Replace backslashes with forward slashes
    key = key.replace(/\\/g, '/');
    
    // Remove parent directory references
    key = key.replace(/\.\.\//g, '');
    key = key.replace(/\.\\/g, '');
    
    // Collapse multiple slashes
    key = key.replace(/\/+/g, '/');
    
    return key;
  }
}

// ============================================================================
// Factory
// ============================================================================

let globalFileStorage: AbstractFileStorage | null = null;

export async function createFileStorage(config: FileStorageConfig): Promise<AbstractFileStorage> {
  let storage: AbstractFileStorage;

  switch (config.type) {
    case 'local':
      const { LocalFileStorage } = require('../adapters/local-file-storage');
      storage = new LocalFileStorage(config);
      break;
    
    case 's3':
      const { S3FileStorage } = require('../adapters/s3-file-storage');
      storage = new S3FileStorage(config);
      break;
    
    case 'azure':
      const { AzureFileStorage } = require('../adapters/azure-file-storage');
      storage = new AzureFileStorage(config);
      break;
    
    case 'gcs':
      const { GCSFileStorage } = require('../adapters/gcs-file-storage');
      storage = new GCSFileStorage(config);
      break;
    
    default:
      throw new Error(`Unknown file storage type: ${(config as any).type}`);
  }

  await storage.initialize();
  return storage;
}

export function setGlobalFileStorage(storage: AbstractFileStorage): void {
  globalFileStorage = storage;
}

export function getGlobalFileStorage(): AbstractFileStorage {
  if (!globalFileStorage) {
    throw new Error('Global file storage not initialized. Call setGlobalFileStorage() first.');
  }
  return globalFileStorage;
}

export function clearGlobalFileStorage(): void {
  globalFileStorage = null;
}
