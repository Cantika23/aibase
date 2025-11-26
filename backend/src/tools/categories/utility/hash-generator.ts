import { TypedTool, ToolParameterSchema } from '../../types';
import * as crypto from 'crypto';

/**
 * Hash Generator Tool - Generate cryptographic hashes
 */
export class HashGeneratorTool extends TypedTool {
  name = 'hash_generator';
  description = 'Generate cryptographic hashes of text using various algorithms';

  parameterSchema: Record<string, ToolParameterSchema> = {
    algorithm: {
      type: 'string',
      description: 'Hash algorithm to use',
      enum: ['md5', 'sha1', 'sha256', 'sha512'],
      required: true
    },
    text: {
      type: 'string',
      description: 'Text to hash',
      required: true
    },
    encoding: {
      type: 'string',
      description: 'Output encoding',
      enum: ['hex', 'base64', 'binary'],
      required: false
    },
    salt: {
      type: 'string',
      description: 'Optional salt to prepend to the text',
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      algorithm: {
        type: 'string',
        description: 'Hash algorithm to use',
        enum: ['md5', 'sha1', 'sha256', 'sha512']
      },
      text: {
        type: 'string',
        description: 'Text to hash'
      },
      encoding: {
        type: 'string',
        description: 'Output encoding',
        enum: ['hex', 'base64', 'binary']
      },
      salt: {
        type: 'string',
        description: 'Optional salt to prepend to the text'
      }
    },
    required: ['algorithm', 'text']
  };

  protected async executeTyped(args: {
    algorithm: string;
    text: string;
    encoding?: string;
    salt?: string;
  }): Promise<any> {
    const { algorithm, text, encoding = 'hex', salt } = args;

    const textToHash = salt ? salt + text : text;

    try {
      let hash: string;

      switch (algorithm) {
        case 'md5':
          hash = crypto.createHash('md5').update(textToHash).digest(encoding as crypto.BinaryToTextEncoding);
          break;
        case 'sha1':
          hash = crypto.createHash('sha1').update(textToHash).digest(encoding as crypto.BinaryToTextEncoding);
          break;
        case 'sha256':
          hash = crypto.createHash('sha256').update(textToHash).digest(encoding as crypto.BinaryToTextEncoding);
          break;
        case 'sha512':
          hash = crypto.createHash('sha512').update(textToHash).digest(encoding as crypto.BinaryToTextEncoding);
          break;
        default:
          throw new Error(`Unsupported algorithm: ${algorithm}`);
      }

      return {
        algorithm,
        original_text: text,
        salt: salt || null,
        text_to_hash: textToHash,
        hash,
        encoding,
        length: hash.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Hash generation failed: ${(error as Error).message}`);
    }
  }
}