/**
 * Data Tools Extension
 * Provides utilities for data processing, transformation, and analysis
 */

export default {
  /**
   * Group array of objects by key
   */
  groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    }, {} as Record<string, T[]>);
  },

  /**
   * Calculate sum of array values
   */
  sum(array: number[]): number {
    return array.reduce((a, b) => a + b, 0);
  },

  /**
   * Calculate average of array values
   */
  average(array: number[]): number {
    if (array.length === 0) return 0;
    return this.sum(array) / array.length;
  },

  /**
   * Calculate median of array values
   */
  median(array: number[]): number {
    if (array.length === 0) return 0;
    const sorted = [...array].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  },

  /**
   * Remove duplicate values from array
   */
  unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  },

  /**
   * Chunk array into smaller arrays
   */
  chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * Sort array of objects by key
   */
  sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  },

  /**
   * Flatten nested array
   */
  flatten<T>(array: any[]): T[] {
    return array.flat(Infinity) as T[];
  },

  /**
   * Convert CSV string to array of objects
   */
  parseCSV(csv: string): Record<string, string>[] {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1);

    return rows.map(row => {
      const values = row.split(',').map(v => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  },

  /**
   * Convert array of objects to CSV string
   */
  toCSV(data: Record<string, any>[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(obj =>
      headers.map(header => {
        const value = String(obj[header] || '');
        // Escape commas and quotes
        return value.includes(',') || value.includes('"')
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  },

  /**
   * Paginate array
   */
  paginate<T>(array: T[], page: number, pageSize: number): {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } {
    const total = array.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const data = array.slice(start, end);

    return { data, page, pageSize, total, totalPages };
  },

  /**
   * Pick specific keys from objects in array
   */
  pick<T>(array: T[], keys: (keyof T)[]): Partial<T>[] {
    return array.map(obj => {
      const picked: Partial<T> = {};
      keys.forEach(key => {
        if (key in obj) {
          picked[key] = obj[key];
        }
      });
      return picked;
    });
  },

  /**
   * Omit specific keys from objects in array
   */
  omit<T>(array: T[], keys: (keyof T)[]): Partial<T>[] {
    return array.map(obj => {
      const omitted: Partial<T> = { ...obj };
      keys.forEach(key => {
        delete omitted[key];
      });
      return omitted;
    });
  },
};
