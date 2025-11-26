import { TypedTool, ToolParameterSchema } from '../../types';

/**
 * URL Encoder Tool - Encode and decode URLs and URL components
 */
export class UrlEncoderTool extends TypedTool {
  name = 'url_encoder';
  description = 'Encode and decode URLs and URL components';

  parameterSchema: Record<string, ToolParameterSchema> = {
    operation: {
      type: 'string',
      description: 'Operation to perform',
      enum: ['encode', 'decode', 'encode_component', 'decode_component', 'parse_url', 'build_url'],
      required: true
    },
    text: {
      type: 'string',
      description: 'Text or URL to encode/decode',
      required: false
    },
    url: {
      type: 'string',
      description: 'URL to parse or components for building',
      required: false
    },
    protocol: {
      type: 'string',
      description: 'Protocol for building URL',
      required: false
    },
    hostname: {
      type: 'string',
      description: 'Hostname for building URL',
      required: false
    },
    port: {
      type: 'number',
      description: 'Port for building URL',
      required: false
    },
    pathname: {
      type: 'string',
      description: 'Path for building URL',
      required: false
    },
    search: {
      type: 'string',
      description: 'Search query for building URL',
      required: false
    },
    hash: {
      type: 'string',
      description: 'Hash fragment for building URL',
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['encode', 'decode', 'encode_component', 'decode_component', 'parse_url', 'build_url']
      },
      text: {
        type: 'string',
        description: 'Text or URL to encode/decode'
      },
      url: {
        type: 'string',
        description: 'URL to parse or components for building'
      },
      protocol: {
        type: 'string',
        description: 'Protocol for building URL'
      },
      hostname: {
        type: 'string',
        description: 'Hostname for building URL'
      },
      port: {
        type: 'number',
        description: 'Port for building URL'
      },
      pathname: {
        type: 'string',
        description: 'Path for building URL'
      },
      search: {
        type: 'string',
        description: 'Search query for building URL'
      },
      hash: {
        type: 'string',
        description: 'Hash fragment for building URL'
      }
    },
    required: ['operation']
  };

  protected async executeTyped(args: any): Promise<any> {
    const { operation, text, url, ...components } = args;

    switch (operation) {
      case 'encode':
        return this.encode(text);

      case 'decode':
        return this.decode(text);

      case 'encode_component':
        return this.encodeComponent(text);

      case 'decode_component':
        return this.decodeComponent(text);

      case 'parse_url':
        return this.parseUrl(url || text);

      case 'build_url':
        return this.buildUrl(components);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private encode(text: string): any {
    if (!text) {
      throw new Error('Text is required for encode operation');
    }

    try {
      const encoded = encodeURIComponent(text);
      return {
        original: text,
        encoded,
        operation: 'encode'
      };
    } catch (error) {
      throw new Error(`URL encoding failed: ${(error as Error).message}`);
    }
  }

  private decode(text: string): any {
    if (!text) {
      throw new Error('Text is required for decode operation');
    }

    try {
      const decoded = decodeURIComponent(text);
      return {
        original: text,
        decoded,
        operation: 'decode'
      };
    } catch (error) {
      throw new Error(`URL decoding failed: ${(error as Error).message}`);
    }
  }

  private encodeComponent(text: string): any {
    if (!text) {
      throw new Error('Text is required for encode_component operation');
    }

    try {
      const encoded = encodeURIComponent(text);
      return {
        original: text,
        encoded,
        operation: 'encode_component'
      };
    } catch (error) {
      throw new Error(`URL component encoding failed: ${(error as Error).message}`);
    }
  }

  private decodeComponent(text: string): any {
    if (!text) {
      throw new Error('Text is required for decode_component operation');
    }

    try {
      const decoded = decodeURIComponent(text);
      return {
        original: text,
        decoded,
        operation: 'decode_component'
      };
    } catch (error) {
      throw new Error(`URL component decoding failed: ${(error as Error).message}`);
    }
  }

  private parseUrl(url: string): any {
    if (!url) {
      throw new Error('URL is required for parse_url operation');
    }

    try {
      // Create a temporary anchor to parse the URL
      const parser = new URL(url);

      const parsed = {
        href: parser.href,
        protocol: parser.protocol,
        hostname: parser.hostname,
        port: parser.port,
        pathname: parser.pathname,
        search: parser.search,
        search_params: this.parseSearchParams(parser.search),
        hash: parser.hash,
        origin: parser.origin,
        username: parser.username,
        password: parser.password
      };

      return {
        original: url,
        parsed,
        operation: 'parse_url'
      };
    } catch (error) {
      throw new Error(`URL parsing failed: ${(error as Error).message}`);
    }
  }

  private parseSearchParams(search: string): Record<string, string> {
    const params: Record<string, string> = {};
    if (search && search.startsWith('?')) {
      const searchParams = new URLSearchParams(search);
      for (const [key, value] of searchParams.entries()) {
        params[key] = value;
      }
    }
    return params;
  }

  private buildUrl(components: any): any {
    const {
      protocol,
      hostname,
      port,
      pathname,
      search,
      hash
    } = components;

    if (!protocol || !hostname) {
      throw new Error('Protocol and hostname are required for build_url operation');
    }

    try {
      let url = `${protocol}//${hostname}`;

      if (port) {
        url += `:${port}`;
      }

      if (pathname) {
        url += pathname.startsWith('/') ? pathname : `/${pathname}`;
      }

      if (search) {
        url += search.startsWith('?') ? search : `?${search}`;
      }

      if (hash) {
        url += hash.startsWith('#') ? hash : `#${hash}`;
      }

      return {
        components,
        built_url: url,
        operation: 'build_url'
      };
    } catch (error) {
      throw new Error(`URL building failed: ${(error as Error).message}`);
    }
  }
}