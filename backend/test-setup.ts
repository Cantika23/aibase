import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, mkdirSync, existsSync } from 'fs';

// Test data directory
let testDataDir: string | null = null;

// Global test configuration
beforeAll(async () => {
  // Create temporary directory for test data
  testDataDir = join(tmpdir(), `aibase-test-${Date.now()}`);
  
  // Create base directory structure for all tools
  mkdirSync(`${testDataDir}/data`, { recursive: true });
  mkdirSync(`${testDataDir}/projects`, { recursive: true });
  
  console.log(`✅ Test setup complete - Data dir: ${testDataDir}`);
});

afterAll(async () => {
  // Cleanup test directory
  if (testDataDir && existsSync(testDataDir)) {
    rmSync(testDataDir, { recursive: true, force: true });
  }
  
  console.log('✅ Test cleanup complete');
});

beforeEach(async () => {
  // Ensure clean state before each test
  // Individual test cleanup is handled in afterEach
});

afterEach(async () => {
  // Cleanup any temporary files created during test
  // This will be implemented as needed in individual tests
});

// Utility function to create tool directories
export const createToolDirectories = (projectId: string, convId: string) => {
  if (!testDataDir) {
    throw new Error('Test setup not initialized');
  }
  
  // TodoTool & MemoryTool paths
  const dataPath = `${testDataDir}/data/${projectId}`;
  mkdirSync(dataPath, { recursive: true });
  mkdirSync(`${dataPath}/${convId}`, { recursive: true });
  
  // FileTool paths  
  const projectsPath = `${testDataDir}/projects/${projectId}/conversations/${convId}/files`;
  mkdirSync(projectsPath, { recursive: true });
};

// Utility function to cleanup tool directories
export const cleanupToolDirectories = (projectId: string) => {
  if (!testDataDir) return;
  
  try {
    rmSync(`${testDataDir}/data/${projectId}`, { recursive: true, force: true });
    rmSync(`${testDataDir}/projects/${projectId}`, { recursive: true, force: true });
  } catch (error) {
    // Directories might not exist, ignore
  }
};

// Export test utilities for other files to use
export const getTestDataDir = () => {
  if (!testDataDir) {
    throw new Error('Test setup not initialized');
  }
  return testDataDir;
};