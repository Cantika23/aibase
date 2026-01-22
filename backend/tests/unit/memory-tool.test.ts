import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryTool } from '../../src/tools/definition/memory-tool';
import { getTestDataDir } from '../../test-setup';
import { mkdirSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';

describe('MemoryTool', () => {
  let memoryTool: MemoryTool;
  let testDataDir: string;
  let projectId: string;

  beforeEach(() => {
    testDataDir = getTestDataDir();
    projectId = `test-${randomUUID()}`;
    memoryTool = new MemoryTool();
    memoryTool.setProjectId(projectId);
  });

  afterEach(async () => {
    // Cleanup test data directory
    const memoryDir = `${testDataDir}/data/${projectId}`;
    try {
      rmSync(memoryDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('Memory Storage Operations', () => {
    it('should store data with set action', async () => {
      const setResult = await memoryTool.execute({
        action: 'set',
        category: 'test',
        key: 'sample',
        value: { message: 'Hello, World!' }
      });

      const result = JSON.parse(setResult);
      expect(result.action).toBe('created');
      expect(result.category).toBe('test');
      expect(result.key).toBe('sample');
      expect(result.value).toEqual({ message: 'Hello, World!' });
    });

    it('should handle multiple keys in same category', async () => {
      const category = 'credentials';
      const keys = [
        { key: 'postgres', value: { host: 'localhost', port: 5432 } },
        { key: 'mysql', value: { host: 'localhost', port: 3306 } },
        { key: 'redis', value: { host: 'localhost', port: 6379 } }
      ];

      // Store multiple keys
      for (const { key, value } of keys) {
        const result = await memoryTool.execute({
          action: 'set',
          category,
          key,
          value
        });
        const parsed = JSON.parse(result);
        expect(['created', 'updated']).toContain(parsed.action);
      }

      // Update one key to test update functionality
      const updateResult = await memoryTool.execute({
        action: 'set',
        category,
        key: 'postgres',
        value: { host: 'localhost', port: 5432, updated: true }
      });
      const updateParsed = JSON.parse(updateResult);
      expect(updateParsed.action).toBe('updated');
      expect(updateParsed.value.updated).toBe(true);
    });

    it('should throw error for missing required parameters', async () => {
      // Test missing key
      await expect(memoryTool.execute({
        action: 'set',
        category: 'test',
        value: 'some value'
      })).rejects.toThrow('key is required for set action');

      // Test missing value
      await expect(memoryTool.execute({
        action: 'set',
        category: 'test',
        key: 'key'
      })).rejects.toThrow('value is required for set action');
    });
  });

  describe('Memory Removal Operations', () => {
    beforeEach(async () => {
      // Setup test data
      await memoryTool.execute({
        action: 'set',
        category: 'test',
        key: 'key1',
        value: 'value-key1'
      });
      await memoryTool.execute({
        action: 'set',
        category: 'test',
        key: 'key2',
        value: 'value-key2'
      });
      await memoryTool.execute({
        action: 'set',
        category: 'test',
        key: 'key3',
        value: 'value-key3'
      });
    });

    it('should remove specific key from category', async () => {
      const removeResult = await memoryTool.execute({
        action: 'remove',
        category: 'test',
        key: 'key2'
      });

      const parsed = JSON.parse(removeResult);
      expect(parsed.action).toBe('removed');
      expect(parsed.category).toBe('test');
      expect(parsed.key).toBe('key2');
      expect(parsed.removedValue).toBe('value-key2');
    });

    it('should remove entire category', async () => {
      const removeResult = await memoryTool.execute({
        action: 'remove',
        category: 'test'
        // No key specified - removes entire category
      });

      const parsed = JSON.parse(removeResult);
      expect(parsed.action).toBe('removed');
      expect(parsed.category).toBe('test');
      expect(parsed.keysRemoved).toBeGreaterThanOrEqual(3); // All 3 keys removed
      expect(parsed.removedData).toEqual({
        key1: 'value-key1',
        key2: 'value-key2',
        key3: 'value-key3'
      });
    });

    it('should throw error for non-existent category', async () => {
      await expect(memoryTool.execute({
        action: 'remove',
        category: 'nonexistent'
      })).rejects.toThrow("Category 'nonexistent' not found");
    });

    it('should throw error for non-existent key', async () => {
      await expect(memoryTool.execute({
        action: 'remove',
        category: 'test',
        key: 'nonexistent'
      })).rejects.toThrow("Key 'nonexistent' not found in category 'test'");
    });
  });

  describe('Memory Persistence', () => {
    it('should persist data across tool instances', async () => {
      const category = 'persistence';
      const key = 'test';
      const value = { persistent: true };

      // Store data with first instance
      await memoryTool.execute({
        action: 'set',
        category,
        key,
        value
      });

      // Create new instance and verify data persists
      const newMemoryTool = new MemoryTool();
      newMemoryTool.setProjectId(projectId);

      // Try to update the data to verify it exists
      const updateResult = await newMemoryTool.execute({
        action: 'set',
        category,
        key,
        value: { persistent: true, updated: true }
      });

      const parsed = JSON.parse(updateResult);
      expect(parsed.action).toBe('updated');
      expect(parsed.oldValue).toEqual({ persistent: true });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown action', async () => {
      await expect(memoryTool.execute({
        action: 'unknown' as any,
        category: 'test'
      })).rejects.toThrow('Unknown action: unknown');
    });

    it('should handle complex JSON objects', async () => {
      const complexValue = {
        database: {
          host: 'localhost',
          port: 5432,
          credentials: {
            username: 'user',
            password: 'pass'
          }
        },
        features: ['feature1', 'feature2'],
        version: '1.0.0',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        count: 42,
        active: true,
        data: null
      };

      const setResult = await memoryTool.execute({
        action: 'set',
        category: 'complex',
        key: 'config',
        value: complexValue
      });

      const parsed = JSON.parse(setResult);
      expect(['created', 'updated']).toContain(parsed.action);
      
      // Date gets serialized to string, so compare with expected structure
      expect(parsed.value.database).toEqual(complexValue.database);
      expect(parsed.value.features).toEqual(complexValue.features);
      expect(parsed.value.version).toBe(complexValue.version);
      expect(parsed.value.count).toBe(complexValue.count);
      expect(parsed.value.active).toBe(complexValue.active);
      expect(parsed.value.data).toBe(complexValue.data);
      expect(typeof parsed.value.timestamp).toBe('string');
    });

    it('should handle arrays', async () => {
      const arrayValue = [1, 2, 3, { nested: 'object' }, ['nested', 'array']];

      const setResult = await memoryTool.execute({
        action: 'set',
        category: 'arrays',
        key: 'data',
        value: arrayValue
      });

      const parsed = JSON.parse(setResult);
      expect(parsed.action).toBe('created');
      expect(parsed.value).toEqual(arrayValue);
    });

    it('should handle special values', async () => {
      // Test empty string
      const result1 = await memoryTool.execute({
        action: 'set',
        category: 'special',
        key: 'empty',
        value: ''
      });
      expect(JSON.parse(result1).value).toBe('');

      // Test null
      const result2 = await memoryTool.execute({
        action: 'set',
        category: 'special',
        key: 'null',
        value: null
      });
      expect(JSON.parse(result2).value).toBe(null);

      // Test zero
      const result3 = await memoryTool.execute({
        action: 'set',
        category: 'special',
        key: 'zero',
        value: 0
      });
      expect(JSON.parse(result3).value).toBe(0);

      // Test false
      const result4 = await memoryTool.execute({
        action: 'set',
        category: 'special',
        key: 'false',
        value: false
      });
      expect(JSON.parse(result4).value).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty category name', async () => {
      // Empty category should work
      const result1 = await memoryTool.execute({
        action: 'set',
        category: '',
        key: 'key',
        value: 'value'
      });
      expect(JSON.parse(result1).category).toBe('');
    });

    it('should handle very large values', async () => {
      const largeValue = 'x'.repeat(10000); // 10KB string

      const result = await memoryTool.execute({
        action: 'set',
        category: 'large',
        key: 'big',
        value: largeValue
      });

      const parsed = JSON.parse(result);
      expect(parsed.action).toBe('created');
      expect(parsed.value).toBe(largeValue);
    });
  });
});