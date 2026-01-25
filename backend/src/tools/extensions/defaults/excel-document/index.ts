/**
 * Excel Document Extension
 * Extract text content from Excel spreadsheets (.xlsx, .xls)
 * Enhanced version of extract-xlsx with additional capabilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { extractTextFromExcel, isExcelFile } from '../../../../utils/document-extractor';
import { getConversationFilesDir } from '../../../../config/paths';

/**
 * Excel Document extension
 * Extract text and data from Excel spreadsheets
 */
const excelDocumentExtension = {
  /**
   * Extract text from Excel spreadsheet
   *
   * @param filePath - Full path to the Excel file
   * @param fileId - File ID in conversation storage (alternative to filePath)
   * @returns Extracted text content from all sheets
   */
  extract: async (options: {
    filePath?: string;
    fileId?: string;
  }) => {
    if (!options || typeof options !== "object") {
      throw new Error("extractExcel requires an options object");
    }

    if (!options.filePath && !options.fileId) {
      throw new Error("extractExcel requires either 'filePath' or 'fileId' parameter");
    }

    let filePath = options.filePath!;

    // If fileId is provided, resolve to actual file path
    if (options.fileId) {
      const convId = (globalThis as any).convId || '';
      const projectId = (globalThis as any).projectId || '';
      const tenantId = (globalThis as any).tenantId || 'default';
      const convFilesDir = getConversationFilesDir(projectId, convId, tenantId);
      filePath = path.join(convFilesDir, options.fileId);

      try {
        await fs.access(filePath);
      } catch {
        const entries = await fs.readdir(convFilesDir, { withFileTypes: true });
        const fileEntry = entries.find(e => e.name.startsWith(options.fileId!));
        if (fileEntry) {
          filePath = path.join(convFilesDir, fileEntry.name);
        }
      }
    }

    // Validate file is Excel
    if (!isExcelFile(filePath)) {
      throw new Error("File is not an Excel spreadsheet (.xlsx, .xls)");
    }

    try {
      const text = await extractTextFromExcel(filePath);
      return { text };
    } catch (error: any) {
      throw new Error(`Excel extraction failed: ${error.message}`);
    }
  },

  /**
   * Read Excel spreadsheet - alias for extract()
   */
  read: async (options: { filePath?: string; fileId?: string }) => {
    return excelDocumentExtension.extract(options);
  },

  /**
   * Convenience method - alias for extract()
   */
  extractXLSX: async (options: { filePath?: string; fileId?: string }) => {
    return excelDocumentExtension.extract(options);
  },

  /**
   * Convenience method - alias for read()
   */
  xlsxReader: async (options: { filePath?: string; fileId?: string }) => {
    return excelDocumentExtension.read(options);
  },
};

export default excelDocumentExtension;
