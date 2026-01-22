import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

// Test data generators
export const createTestFile = (fileName: string, content: string = 'test content', projectId: string, convId: string): string => {
  const testDir = getTestDataDir();
  const filePath = join(testDir, 'projects', projectId, 'conversations', convId, 'files', fileName);
  
  // Ensure directory exists
  const dir = join(testDir, 'projects', projectId, 'conversations', convId, 'files');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFileSync(filePath, content);
  return filePath;
};

// Create test metadata file for FileTool
export const createTestMetadata = (fileName: string, projectId: string, convId: string, options: {
  scope?: 'user' | 'public';
  size?: number;
  type?: string;
} = {}): string => {
  const testDir = getTestDataDir();
  const metadataPath = join(testDir, 'projects', projectId, 'conversations', convId, 'files', `.${fileName}.meta.md`);
  
  const {
    scope = 'user',
    size = 1024,
    type = 'text/plain'
  } = options;
  
  const metadata = `---
scope: "${scope}"
uploadedAt: ${Date.now()}
size: ${size}
type: "${type}"
---
`;
  
  writeFileSync(metadataPath, metadata);
  return metadataPath;
};

export const createTestTodo = (text: string, completed: boolean = false) => ({
  id: randomUUID(),
  text,
  checked: false, // Use 'checked' instead of 'completed' to match actual implementation
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const createTestMemory = (category: string, key: string, value: any) => ({
  category,
  key,
  value: JSON.stringify(value)
});

// Utility to create initial data files for tests
export const createInitialTodoData = (projectId: string, convId: string, todos: any[] = []) => {
  const testDir = getTestDataDir();
  const todoPath = join(testDir, 'data', projectId, convId, 'todos.json');
  
  const data = {
    items: todos,
    updatedAt: new Date().toISOString()
  };
  
  writeFileSync(todoPath, JSON.stringify(data, null, 2));
  return todoPath;
};

export const createInitialMemoryData = (projectId: string, data: Record<string, Record<string, any>> = {}) => {
  const testDir = getTestDataDir();
  const memoryPath = join(testDir, 'data', projectId, 'memory.json');
  
  writeFileSync(memoryPath, JSON.stringify(data, null, 2));
  return memoryPath;
};

// Mock utilities
export const createMockWebSocket = () => {
  const events: { event: string, data: any }[] = [];
  
  return {
    send: (data: any) => {
      events.push({ event: 'send', data });
    },
    broadcast: (data: any) => {
      events.push({ event: 'broadcast', data });
    },
    getEvents: () => events,
    clearEvents: () => { events.length = 0; }
  };
};

// Test configuration
export const testConfig = {
  timeout: 30000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFormats: ['.txt', '.md', '.json', '.csv', '.docx', '.pdf', '.xlsx', '.pptx']
};

// Helper to wait for async operations
export const wait = (ms: number = 100): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Import test utilities from setup
import { getTestDataDir, createToolDirectories, cleanupToolDirectories } from './test-setup';

// Re-export for use in tests
export { getTestDataDir, createToolDirectories, cleanupToolDirectories };