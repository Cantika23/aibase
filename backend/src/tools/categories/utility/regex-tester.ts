import { TypedTool, ToolParameterSchema } from '../../types';

/**
 * Regex Tester Tool - Test and validate regular expressions
 */
export class RegexTesterTool extends TypedTool {
  name = 'regex_tester';
  description = 'Test and validate regular expressions against text';

  parameterSchema: Record<string, ToolParameterSchema> = {
    operation: {
      type: 'string',
      description: 'Operation to perform',
      enum: ['test', 'match', 'match_all', 'replace', 'extract_groups', 'validate_regex'],
      required: true
    },
    pattern: {
      type: 'string',
      description: 'Regular expression pattern',
      required: false
    },
    text: {
      type: 'string',
      description: 'Text to test against the pattern',
      required: false
    },
    flags: {
      type: 'string',
      description: 'Regex flags (g, i, m, s, u, y)',
      required: false
    },
    replacement: {
      type: 'string',
      description: 'Replacement text for replace operation',
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['test', 'match', 'match_all', 'replace', 'extract_groups', 'validate_regex']
      },
      pattern: {
        type: 'string',
        description: 'Regular expression pattern'
      },
      text: {
        type: 'string',
        description: 'Text to test against the pattern'
      },
      flags: {
        type: 'string',
        description: 'Regex flags (g, i, m, s, u, y)'
      },
      replacement: {
        type: 'string',
        description: 'Replacement text for replace operation'
      }
    },
    required: ['operation']
  };

  protected async executeTyped(args: any): Promise<any> {
    const { operation, pattern, text, flags = '', replacement } = args;

    switch (operation) {
      case 'test':
        return this.test(pattern, text, flags);

      case 'match':
        return this.match(pattern, text, flags);

      case 'match_all':
        return this.matchAll(pattern, text, flags);

      case 'replace':
        return this.replace(pattern, text, flags, replacement);

      case 'extract_groups':
        return this.extractGroups(pattern, text, flags);

      case 'validate_regex':
        return this.validateRegex(pattern);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private test(pattern: string, text: string, flags: string): any {
    if (!pattern) {
      throw new Error('Pattern is required for test operation');
    }
    if (!text) {
      throw new Error('Text is required for test operation');
    }

    try {
      const regex = new RegExp(pattern, flags);
      const matches = regex.test(text);

      return {
        pattern,
        text,
        flags,
        matches,
        operation: 'test'
      };
    } catch (error) {
      throw new Error(`Regex test failed: ${(error as Error).message}`);
    }
  }

  private match(pattern: string, text: string, flags: string): any {
    if (!pattern) {
      throw new Error('Pattern is required for match operation');
    }
    if (!text) {
      throw new Error('Text is required for match operation');
    }

    try {
      const regex = new RegExp(pattern, flags);
      const match = text.match(regex);

      return {
        pattern,
        text,
        flags,
        match,
        match_count: match ? match.length : 0,
        operation: 'match'
      };
    } catch (error) {
      throw new Error(`Regex match failed: ${(error as Error).message}`);
    }
  }

  private matchAll(pattern: string, text: string, flags: string): any {
    if (!pattern) {
      throw new Error('Pattern is required for match_all operation');
    }
    if (!text) {
      throw new Error('Text is required for match_all operation');
    }

    try {
      // Ensure global flag is present for matchAll
      const allFlags = flags.includes('g') ? flags : flags + 'g';
      const regex = new RegExp(pattern, allFlags);

      const matches = [...text.matchAll(regex)];

      return {
        pattern,
        text,
        flags: allFlags,
        matches,
        match_count: matches.length,
        operation: 'match_all',
        groups: matches.map(match => ({
          full_match: match[0],
          groups: match.slice(1),
          index: match.index,
          input: match.input
        }))
      };
    } catch (error) {
      throw new Error(`Regex matchAll failed: ${(error as Error).message}`);
    }
  }

  private replace(pattern: string, text: string, flags: string, replacement: string): any {
    if (!pattern) {
      throw new Error('Pattern is required for replace operation');
    }
    if (!text) {
      throw new Error('Text is required for replace operation');
    }
    if (!replacement) {
      throw new Error('Replacement is required for replace operation');
    }

    try {
      const regex = new RegExp(pattern, flags);
      const result = text.replace(regex, replacement);
      const matches = [...text.matchAll(new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'))];

      return {
        pattern,
        text,
        flags,
        replacement,
        result,
        replacements_made: matches.length,
        operation: 'replace'
      };
    } catch (error) {
      throw new Error(`Regex replace failed: ${(error as Error).message}`);
    }
  }

  private extractGroups(pattern: string, text: string, flags: string): any {
    if (!pattern) {
      throw new Error('Pattern is required for extract_groups operation');
    }
    if (!text) {
      throw new Error('Text is required for extract_groups operation');
    }

    try {
      const regex = new RegExp(pattern, flags);
      const matches = [...text.matchAll(regex)];

      const groups = matches.map(match => ({
        full_match: match[0],
        capture_groups: match.slice(1).map((group, index) => ({
          group_number: index + 1,
          value: group,
          start: match.index + match[0].indexOf(group),
          end: match.index + match[0].indexOf(group) + group.length
        })),
        index: match.index,
        input: match.input
      }));

      return {
        pattern,
        text,
        flags,
        groups,
        match_count: matches.length,
        operation: 'extract_groups'
      };
    } catch (error) {
      throw new Error(`Regex group extraction failed: ${(error as Error).message}`);
    }
  }

  private validateRegex(pattern: string): any {
    if (!pattern) {
      throw new Error('Pattern is required for validate_regex operation');
    }

    try {
      new RegExp(pattern);
      return {
        pattern,
        valid: true,
        message: 'Valid regular expression',
        operation: 'validate_regex'
      };
    } catch (error) {
      return {
        pattern,
        valid: false,
        error: (error as Error).message,
        message: 'Invalid regular expression',
        operation: 'validate_regex'
      };
    }
  }
}