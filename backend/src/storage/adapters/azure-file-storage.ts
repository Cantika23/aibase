/**
 * Azure Blob Storage Adapter
 * 
 * Enterprise file storage using Azure Blob Storage.
 * 
 * Installation:
 * ```bash
 * bun add @azure/storage-blob
 * ```
 */

import {
  AbstractFileStorage,
  type FileStorageConfig,
  type FileMetadata,
  type StoredFile,
  type ListOptions,
  type ListResult,
} from '../abstraction/file-storage';

export class AzureFileStorage extends AbstractFileStorage {
  constructor(config: FileStorageConfig) {
    super(config);
    if (config.type !== 'azure') {
      throw new Error('AzureFileStorage requires config.type to be "azure"');
    }
  }

  async initialize(): Promise<void> {
    throw new Error(
      'Azure adapter not implemented.\n' +
      'To use Azure Blob Storage, install dependencies and implement this adapter.\n' +
      'See docs/ENTERPRISE_SCALING.md for details.'
    );
  }

  async put(key: string, data: Buffer | ReadableStream<Uint8Array>, metadata?: Partial<FileMetadata>): Promise<StoredFile> { throw new Error('Not implemented'); }
  async get(key: string): Promise<Buffer> { throw new Error('Not implemented'); }
  async getStream(key: string): Promise<ReadableStream<Uint8Array>> { throw new Error('Not implemented'); }
  async head(key: string): Promise<FileMetadata | null> { throw new Error('Not implemented'); }
  async exists(key: string): Promise<boolean> { throw new Error('Not implemented'); }
  async delete(key: string): Promise<void> { throw new Error('Not implemented'); }
  async deleteMany(keys: string[]): Promise<void> { throw new Error('Not implemented'); }
  async list(options?: ListOptions): Promise<ListResult> { throw new Error('Not implemented'); }
  getPublicUrl(key: string): string { throw new Error('Not implemented'); }
  async getPresignedUrl(key: string, expirySeconds?: number, operation?: 'read' | 'write' | 'delete'): Promise<string> { throw new Error('Not implemented'); }
  async copy(sourceKey: string, destKey: string): Promise<void> { throw new Error('Not implemented'); }
  async close(): Promise<void> { }
}
