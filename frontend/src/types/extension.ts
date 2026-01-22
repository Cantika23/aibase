/**
 * Extension type definitions
 */

export interface ExtensionMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  category: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Extension {
  metadata: ExtensionMetadata;
  code: string;
}

export interface CreateExtensionData {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  code: string;
  enabled?: boolean;
}

export interface UpdateExtensionData {
  name?: string;
  description?: string;
  author?: string;
  version?: string;
  code?: string;
  enabled?: boolean;
}
