import { Tool } from '../../../llm/conversation';
import { ToolMetadata } from '../../types';
import { createDefaultMetadata } from '../../registry/tool-metadata';

// Import tools
import { TextManipulationTool } from './text-manipulation';
import { HashGeneratorTool } from './hash-generator';
import { UrlEncoderTool } from './url-encoder';
import { Base64ConverterTool } from './base64-converter';
import { RegexTesterTool } from './regex-tester';

/**
 * Get all utility tools
 */
export async function getTools(): Promise<Tool[]> {
  const tools: Tool[] = [
    new TextManipulationTool(),
    new HashGeneratorTool(),
    new UrlEncoderTool(),
    new Base64ConverterTool(),
    new RegexTesterTool()
  ];

  return tools;
}

/**
 * Get metadata for all utility tools
 */
export function getToolMetadata(toolName: string): ToolMetadata | null {
  const metadataMap: Record<string, ToolMetadata> = {
    'text_manipulation': createDefaultMetadata(
      'text_manipulation',
      'utility',
      'Manipulate and transform text strings',
      {
        tags: ['text', 'string', 'transform'],
        permissions: [],
        dependencies: []
      }
    ),
    'hash_generator': createDefaultMetadata(
      'hash_generator',
      'utility',
      'Generate cryptographic hashes of text',
      {
        tags: ['hash', 'crypto', 'security'],
        permissions: [],
        dependencies: []
      }
    ),
    'url_encoder': createDefaultMetadata(
      'url_encoder',
      'utility',
      'Encode and decode URLs and URL components',
      {
        tags: ['url', 'encode', 'decode'],
        permissions: [],
        dependencies: []
      }
    ),
    'base64_converter': createDefaultMetadata(
      'base64_converter',
      'utility',
      'Convert between Base64 and text/URL encodings',
      {
        tags: ['base64', 'encode', 'decode'],
        permissions: [],
        dependencies: []
      }
    ),
    'regex_tester': createDefaultMetadata(
      'regex_tester',
      'utility',
      'Test and validate regular expressions',
      {
        tags: ['regex', 'pattern', 'validate'],
        permissions: [],
        dependencies: []
      }
    )
  };

  return metadataMap[toolName] || null;
}