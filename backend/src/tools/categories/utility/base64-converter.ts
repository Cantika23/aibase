import { TypedTool, ToolParameterSchema } from '../../types';

/**
 * Base64 Converter Tool - Convert between Base64 and text/URL encodings
 */
export class Base64ConverterTool extends TypedTool {
  name = 'base64_converter';
  description = 'Convert between Base64 and text/URL encodings';

  parameterSchema: Record<string, ToolParameterSchema> = {
    operation: {
      type: 'string',
      description: 'Operation to perform',
      enum: ['encode', 'decode', 'encode_url', 'decode_url'],
      required: true
    },
    text: {
      type: 'string',
      description: 'Text to encode/decode',
      required: true
    }
  };

  parameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['encode', 'decode', 'encode_url', 'decode_url']
      },
      text: {
        type: 'string',
        description: 'Text to encode/decode'
      }
    },
    required: ['operation', 'text']
  };

  protected async executeTyped(args: {
    operation: string;
    text: string;
  }): Promise<any> {
    const { operation, text } = args;

    switch (operation) {
      case 'encode':
        return this.encode(text);

      case 'decode':
        return this.decode(text);

      case 'encode_url':
        return this.encodeUrl(text);

      case 'decode_url':
        return this.decodeUrl(text);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private encode(text: string): any {
    try {
      const encoded = Buffer.from(text, 'utf8').toString('base64');
      return {
        original: text,
        encoded,
        operation: 'encode',
        input_length: text.length,
        output_length: encoded.length
      };
    } catch (error) {
      throw new Error(`Base64 encoding failed: ${(error as Error).message}`);
    }
  }

  private decode(text: string): any {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      return {
        original: text,
        decoded,
        operation: 'decode',
        input_length: text.length,
        output_length: decoded.length
      };
    } catch (error) {
      throw new Error(`Base64 decoding failed: ${(error as Error).message}`);
    }
  }

  private encodeUrl(text: string): any {
    try {
      const encoded = Buffer.from(text, 'utf8').toString('base64url');
      return {
        original: text,
        encoded,
        operation: 'encode_url',
        input_length: text.length,
        output_length: encoded.length
      };
    } catch (error) {
      // Fallback for older Node.js versions that don't have base64url
      try {
        const base64 = Buffer.from(text, 'utf8').toString('base64');
        const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        return {
          original: text,
          encoded: base64url,
          operation: 'encode_url',
          input_length: text.length,
          output_length: base64url.length,
          note: 'Used fallback method for base64url encoding'
        };
      } catch (fallbackError) {
        throw new Error(`Base64 URL encoding failed: ${(fallbackError as Error).message}`);
      }
    }
  }

  private decodeUrl(text: string): any {
    try {
      const decoded = Buffer.from(text, 'base64url').toString('utf8');
      return {
        original: text,
        decoded,
        operation: 'decode_url',
        input_length: text.length,
        output_length: decoded.length
      };
    } catch (error) {
      // Fallback for older Node.js versions that don't have base64url
      try {
        // Add padding back if needed
        let base64 = text.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
          base64 += '=';
        }
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        return {
          original: text,
          decoded,
          operation: 'decode_url',
          input_length: text.length,
          output_length: decoded.length,
          note: 'Used fallback method for base64url decoding'
        };
      } catch (fallbackError) {
        throw new Error(`Base64 URL decoding failed: ${(fallbackError as Error).message}`);
      }
    }
  }
}