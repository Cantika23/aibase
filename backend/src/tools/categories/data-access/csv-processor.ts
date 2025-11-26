import { TypedTool, ToolParameterSchema } from '../../types';

/**
 * CSV Processor Tool - Process and transform CSV data
 */
export class CsvProcessorTool extends TypedTool {
  name = 'csv_processor';
  description = 'Parse and process CSV data';

  parameterSchema: Record<string, ToolParameterSchema> = {
    operation: {
      type: 'string',
      description: 'Operation to perform on the CSV data',
      enum: ['parse', 'validate', 'to_json', 'from_json', 'query', 'statistics'],
      required: true
    },
    data: {
      type: 'string',
      description: 'CSV string or data to process',
      required: false
    },
    delimiter: {
      type: 'string',
      description: 'CSV delimiter (default: comma)',
      enum: [',', ';', '\t', '|'],
      required: false
    },
    has_headers: {
      type: 'boolean',
      description: 'Whether the CSV has headers (default: true)',
      required: false
    },
    row_filter: {
      type: 'object',
      description: 'Filter criteria for query operation',
      required: false
    },
    column_filter: {
      type: 'array',
      description: 'List of columns to extract',
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform on the CSV data',
        enum: ['parse', 'validate', 'to_json', 'from_json', 'query', 'statistics']
      },
      data: {
        type: 'string',
        description: 'CSV string or data to process'
      },
      delimiter: {
        type: 'string',
        description: 'CSV delimiter (default: comma)',
        enum: [',', ';', '\t', '|']
      },
      has_headers: {
        type: 'boolean',
        description: 'Whether the CSV has headers (default: true)'
      },
      row_filter: {
        type: 'object',
        description: 'Filter criteria for query operation'
      },
      column_filter: {
        type: 'array',
        description: 'List of columns to extract',
        items: {
          type: 'string'
        }
      }
    },
    required: ['operation']
  };

  protected async executeTyped(args: {
    operation: string;
    data?: string;
    delimiter?: string;
    has_headers?: boolean;
    row_filter?: Record<string, any>;
    column_filter?: string[];
  }): Promise<any> {
    const {
      operation,
      data,
      delimiter = ',',
      has_headers = true,
      row_filter,
      column_filter
    } = args;

    switch (operation) {
      case 'parse':
        return this.parseCSV(data, delimiter, has_headers);

      case 'validate':
        return this.validateCSV(data, delimiter, has_headers);

      case 'to_json':
        return this.csvToJSON(data, delimiter, has_headers);

      case 'from_json':
        return this.jsonToCSV(data, delimiter);

      case 'query':
        return this.queryCSV(data, delimiter, has_headers, row_filter, column_filter);

      case 'statistics':
        return this.getCSVStatistics(data, delimiter, has_headers);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private parseCSV(data?: string, delimiter: string = ',', hasHeaders: boolean = true): any {
    if (!data) {
      throw new Error('Data is required for parse operation');
    }

    try {
      const lines = this.splitCSVLines(data);
      if (lines.length === 0) {
        throw new Error('Empty CSV data');
      }

      const headers = this.parseCSVLine(lines[0], delimiter);
      const rows = lines.slice(1).map(line => this.parseCSVLine(line, delimiter));

      // Validate row length
      const expectedColumns = headers.length;
      const invalidRows = rows.filter(row => row.length !== expectedColumns);

      if (invalidRows.length > 0) {
        console.warn(`Found ${invalidRows.length} rows with incorrect column count`);
      }

      const result = {
        headers,
        rows: rows.map((row, index) => ({
          index: index + 1,
          values: row
        })),
        total_rows: rows.length,
        total_columns: headers.length,
        delimiter,
        has_headers
      };

      return result;
    } catch (error) {
      throw new Error(`CSV parsing failed: ${(error as Error).message}`);
    }
  }

  private validateCSV(data?: string, delimiter: string = ',', hasHeaders: boolean = true): any {
    if (!data) {
      throw new Error('Data is required for validate operation');
    }

    try {
      const result = this.parseCSV(data, delimiter, hasHeaders);
      const allRowsLengths = [result.headers.length, ...result.rows.map(r => r.values.length)];
      const uniqueLengths = [...new Set(allRowsLengths)];

      return {
        valid: uniqueLengths.length === 1,
        total_rows: result.total_rows,
        total_columns: result.total_columns,
        has_consistent_columns: uniqueLengths.length === 1,
        column_counts: uniqueLengths,
        warnings: uniqueLengths.length > 1 ? ['Inconsistent column counts detected'] : []
      };
    } catch (error) {
      return {
        valid: false,
        error: (error as Error).message
      };
    }
  }

  private csvToJSON(data?: string, delimiter: string = ',', hasHeaders: boolean = true): any {
    if (!data) {
      throw new Error('Data is required for to_json operation');
    }

    const parsed = this.parseCSV(data, delimiter, hasHeaders);
    const jsonArray = parsed.rows.map(row => {
      const obj: any = {};
      parsed.headers.forEach((header, index) => {
        obj[header] = row.values[index] || '';
      });
      return obj;
    });

    return {
      json: jsonArray,
      count: jsonArray.length,
      headers: parsed.headers
    };
  }

  private jsonToCSV(data?: string, delimiter: string = ','): any {
    if (!data) {
      throw new Error('Data is required for from_json operation');
    }

    try {
      const jsonArray = JSON.parse(data);
      if (!Array.isArray(jsonArray)) {
        throw new Error('Data must be a JSON array');
      }

      if (jsonArray.length === 0) {
        return { csv: '', count: 0 };
      }

      const headers = Object.keys(jsonArray[0]);
      const csvLines = [headers.join(delimiter)];

      jsonArray.forEach(obj => {
        const values = headers.map(header => {
          const value = obj[header];
          // Escape values that contain the delimiter
          if (typeof value === 'string' && value.includes(delimiter)) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        });
        csvLines.push(values.join(delimiter));
      });

      return {
        csv: csvLines.join('\n'),
        count: jsonArray.length,
        headers
      };
    } catch (error) {
      throw new Error(`JSON to CSV conversion failed: ${(error as Error).message}`);
    }
  }

  private queryCSV(data?: string, delimiter: string = ',', hasHeaders: boolean = true, rowFilter?: Record<string, any>, columnFilter?: string[]): any {
    if (!data) {
      throw new Error('Data is required for query operation');
    }

    const parsed = this.parseCSV(data, delimiter, hasHeaders);
    let filteredRows = parsed.rows;

    // Apply row filter
    if (rowFilter) {
      filteredRows = filteredRows.filter(row => {
        return Object.entries(rowFilter).every(([column, expectedValue]) => {
          const columnIndex = parsed.headers.indexOf(column);
          if (columnIndex === -1) return true;
          const actualValue = row.values[columnIndex];
          return String(actualValue) === String(expectedValue);
        });
      });
    }

    // Apply column filter
    let filteredHeaders = parsed.headers;
    if (columnFilter && columnFilter.length > 0) {
      const validColumns = columnFilter.filter(col => parsed.headers.includes(col));
      filteredHeaders = validColumns;

      filteredRows = filteredRows.map(row => {
        const filteredValues = validColumns.map(header => {
          const index = parsed.headers.indexOf(header);
          return row.values[index];
        });
        return {
          ...row,
          values: filteredValues
        };
      });
    }

    return {
      headers: filteredHeaders,
      rows: filteredRows,
      total_rows: filteredRows.length,
      filtered_from: parsed.rows.length,
      columns: filteredHeaders.length
    };
  }

  private getCSVStatistics(data?: string, delimiter: string = ',', hasHeaders: boolean = true): any {
    if (!data) {
      throw new Error('Data is required for statistics operation');
    }

    const parsed = this.parseCSV(data, delimiter, hasHeaders);
    const stats: any = {
      total_rows: parsed.total_rows,
      total_columns: parsed.total_columns,
      headers: parsed.headers
    };

    // Column statistics
    stats.column_stats = parsed.headers.map((header, index) => {
      const columnValues = parsed.rows
        .map(row => row.values[index])
        .filter(value => value !== null && value !== undefined && value !== '');

      const numericValues = columnValues
        .map(value => parseFloat(value))
        .filter(value => !isNaN(value));

      return {
        column: header,
        non_empty_count: columnValues.length,
        empty_count: parsed.rows.length - columnValues.length,
        unique_values: [...new Set(columnValues)].length,
        numeric_count: numericValues.length,
        min_numeric: numericValues.length > 0 ? Math.min(...numericValues) : null,
        max_numeric: numericValues.length > 0 ? Math.max(...numericValues) : null,
        avg_numeric: numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : null
      };
    });

    return stats;
  }

  private splitCSVLines(data: string): string[] {
    // Handle quoted fields that might contain newlines
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < data.length; i++) {
      const char = data[i];

      if (char === '"') {
        // Check if it's an escaped quote
        if (i + 1 < data.length && data[i + 1] === '"') {
          currentLine += '""';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
          currentLine += char;
        }
      } else if (char === '\n' && !inQuotes) {
        lines.push(currentLine.trim());
        currentLine = '';
      } else {
        currentLine += char;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    return lines;
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          currentField += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }

    fields.push(currentField);
    return fields;
  }
}