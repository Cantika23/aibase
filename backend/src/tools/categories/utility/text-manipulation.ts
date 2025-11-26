import { TypedTool, ToolParameterSchema } from '../../types';

/**
 * Text Manipulation Tool - Various text processing operations
 */
export class TextManipulationTool extends TypedTool {
  name = 'text_manipulation';
  description = 'Manipulate and transform text strings with various operations';

  parameterSchema: Record<string, ToolParameterSchema> = {
    operation: {
      type: 'string',
      description: 'Operation to perform on the text',
      enum: [
        'uppercase', 'lowercase', 'title_case', 'sentence_case',
        'reverse', 'count_characters', 'count_words', 'count_lines',
        'trim', 'pad_left', 'pad_right', 'center',
        'extract_numbers', 'extract_emails', 'extract_urls',
        'remove_whitespace', 'normalize_whitespace', 'replace',
        'split', 'join', 'substring', 'length'
      ],
      required: true
    },
    text: {
      type: 'string',
      description: 'Text to process',
      required: false
    },
    pattern: {
      type: 'string',
      description: 'Pattern for replace operation',
      required: false
    },
    replacement: {
      type: 'string',
      description: 'Replacement text for replace operation',
      required: false
    },
    delimiter: {
      type: 'string',
      description: 'Delimiter for split operation',
      required: false
    },
    start_index: {
      type: 'number',
      description: 'Start index for substring operation',
      required: false
    },
    end_index: {
      type: 'number',
      description: 'End index for substring operation',
      required: false
    },
    fill_char: {
      type: 'string',
      description: 'Character to use for padding operations',
      required: false
    },
    width: {
      type: 'number',
      description: 'Width for padding operations',
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform on the text',
        enum: [
          'uppercase', 'lowercase', 'title_case', 'sentence_case',
          'reverse', 'count_characters', 'count_words', 'count_lines',
          'trim', 'pad_left', 'pad_right', 'center',
          'extract_numbers', 'extract_emails', 'extract_urls',
          'remove_whitespace', 'normalize_whitespace', 'replace',
          'split', 'join', 'substring', 'length'
        ]
      },
      text: {
        type: 'string',
        description: 'Text to process'
      },
      pattern: {
        type: 'string',
        description: 'Pattern for replace operation'
      },
      replacement: {
        type: 'string',
        description: 'Replacement text for replace operation'
      },
      delimiter: {
        type: 'string',
        description: 'Delimiter for split operation'
      },
      start_index: {
        type: 'number',
        description: 'Start index for substring operation'
      },
      end_index: {
        type: 'number',
        description: 'End index for substring operation'
      },
      fill_char: {
        type: 'string',
        description: 'Character to use for padding operations'
      },
      width: {
        type: 'number',
        description: 'Width for padding operations'
      }
    },
    required: ['operation']
  };

  protected async executeTyped(args: any): Promise<any> {
    const { operation, text, ...otherArgs } = args;

    if (!text && operation !== 'length' && operation !== 'count_characters' && operation !== 'count_words') {
      throw new Error('Text parameter is required for this operation');
    }

    switch (operation) {
      case 'uppercase':
        return this.uppercase(text);

      case 'lowercase':
        return this.lowercase(text);

      case 'title_case':
        return this.titleCase(text);

      case 'sentence_case':
        return this.sentenceCase(text);

      case 'reverse':
        return this.reverse(text);

      case 'count_characters':
        return this.countCharacters(text);

      case 'count_words':
        return this.countWords(text);

      case 'count_lines':
        return this.countLines(text);

      case 'trim':
        return this.trim(text);

      case 'pad_left':
        return this.padLeft(text, otherArgs.fill_char, otherArgs.width);

      case 'pad_right':
        return this.padRight(text, otherArgs.fill_char, otherArgs.width);

      case 'center':
        return this.center(text, otherArgs.fill_char, otherArgs.width);

      case 'extract_numbers':
        return this.extractNumbers(text);

      case 'extract_emails':
        return this.extractEmails(text);

      case 'extract_urls':
        return this.extractUrls(text);

      case 'remove_whitespace':
        return this.removeWhitespace(text);

      case 'normalize_whitespace':
        return this.normalizeWhitespace(text);

      case 'replace':
        return this.replace(text, otherArgs.pattern, otherArgs.replacement);

      case 'split':
        return this.split(text, otherArgs.delimiter);

      case 'join':
        return this.join(text, otherArgs.delimiter);

      case 'substring':
        return this.substring(text, otherArgs.start_index, otherArgs.end_index);

      case 'length':
        return this.getLength(text);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private uppercase(text: string): any {
    return {
      original: text,
      result: text.toUpperCase(),
      operation: 'uppercase'
    };
  }

  private lowercase(text: string): any {
    return {
      original: text,
      result: text.toLowerCase(),
      operation: 'lowercase'
    };
  }

  private titleCase(text: string): any {
    const result = text.replace(/\w\S*/g, (txt) =>
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
    return {
      original: text,
      result,
      operation: 'title_case'
    };
  }

  private sentenceCase(text: string): any {
    const result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    return {
      original: text,
      result,
      operation: 'sentence_case'
    };
  }

  private reverse(text: string): any {
    return {
      original: text,
      result: text.split('').reverse().join(''),
      operation: 'reverse'
    };
  }

  private countCharacters(text?: string): any {
    const length = text ? text.length : 0;
    return {
      count: length,
      text_length: length,
      operation: 'count_characters'
    };
  }

  private countWords(text: string): any {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return {
      count: words.length,
      words: words,
      operation: 'count_words'
    };
  }

  private countLines(text: string): any {
    const lines = text.split('\n');
    return {
      count: lines.length,
      lines: lines,
      operation: 'count_lines'
    };
  }

  private trim(text: string): any {
    return {
      original: text,
      result: text.trim(),
      operation: 'trim',
      chars_removed: text.length - text.trim().length
    };
  }

  private padLeft(text: string, fillChar: string = ' ', width: number = 10): any {
    const padded = text.padStart(width, fillChar);
    return {
      original: text,
      result: padded,
      operation: 'pad_left',
      width,
      fill_char: fillChar
    };
  }

  private padRight(text: string, fillChar: string = ' ', width: number = 10): any {
    const padded = text.padEnd(width, fillChar);
    return {
      original: text,
      result: padded,
      operation: 'pad_right',
      width,
      fill_char: fillChar
    };
  }

  private center(text: string, fillChar: string = ' ', width: number = 10): any {
    if (width <= text.length) {
      return {
        original: text,
        result: text,
        operation: 'center',
        width,
        fill_char: fillChar,
        note: 'Width is less than or equal to text length'
      };
    }

    const totalPadding = width - text.length;
    const leftPadding = Math.floor(totalPadding / 2);
    const rightPadding = totalPadding - leftPadding;
    const padded = fillChar.repeat(leftPadding) + text + fillChar.repeat(rightPadding);

    return {
      original: text,
      result: padded,
      operation: 'center',
      width,
      fill_char: fillChar,
      left_padding: leftPadding,
      right_padding: rightPadding
    };
  }

  private extractNumbers(text: string): any {
    const numbers = text.match(/-?\d+\.?\d*/g) || [];
    return {
      numbers: numbers.map(Number),
      count: numbers.length,
      operation: 'extract_numbers'
    };
  }

  private extractEmails(text: string): any {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    return {
      emails,
      count: emails.length,
      operation: 'extract_emails'
    };
  }

  private extractUrls(text: string): any {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const urls = text.match(urlRegex) || [];
    return {
      urls,
      count: urls.length,
      operation: 'extract_urls'
    };
  }

  private removeWhitespace(text: string): any {
    const result = text.replace(/\s/g, '');
    return {
      original: text,
      result,
      operation: 'remove_whitespace',
      whitespace_removed: text.length - result.length
    };
  }

  private normalizeWhitespace(text: string): any {
    const result = text.replace(/\s+/g, ' ').trim();
    return {
      original: text,
      result,
      operation: 'normalize_whitespace',
      whitespace_normalized: true
    };
  }

  private replace(text: string, pattern: string, replacement: string): any {
    if (!pattern) {
      throw new Error('Pattern is required for replace operation');
    }
    if (replacement === undefined) {
      throw new Error('Replacement is required for replace operation');
    }

    const regex = new RegExp(pattern, 'g');
    const result = text.replace(regex, replacement);
    const matches = text.match(regex) || [];

    return {
      original: text,
      result,
      pattern,
      replacement,
      matches_found: matches.length,
      operation: 'replace'
    };
  }

  private split(text: string, delimiter: string = ','): any {
    const result = text.split(delimiter);
    return {
      original: text,
      result,
      delimiter,
      count: result.length,
      operation: 'split'
    };
  }

  private join(text: string, delimiter: string = ' '): any {
    // Assume text is an array for join operation
    if (typeof text === 'string') {
      try {
        const array = JSON.parse(text);
        if (!Array.isArray(array)) {
          throw new Error('Text must be an array for join operation');
        }
        const result = array.join(delimiter);
        return {
          original: array,
          result,
          delimiter,
          operation: 'join'
        };
      } catch (error) {
        throw new Error('Text must be a valid JSON array for join operation');
      }
    }

    const result = text.join(delimiter);
    return {
      original: text,
      result,
      delimiter,
      operation: 'join'
    };
  }

  private substring(text: string, startIndex: number, endIndex?: number): any {
    const result = endIndex !== undefined ? text.substring(startIndex, endIndex) : text.substring(startIndex);
    return {
      original: text,
      result,
      start_index: startIndex,
      end_index: endIndex,
      operation: 'substring'
    };
  }

  private getLength(text?: string): any {
    const length = text ? text.length : 0;
    return {
      length,
      operation: 'length'
    };
  }
}