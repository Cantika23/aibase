/**
 * PDF Document Extension
 * Extract text content from PDF files with multiple methods
 * Combines functionality from extract-pdf and pdf-reader
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { extractTextFromPdf, isPdfFile } from '../../../../utils/document-extractor';
import { getConversationFilesDir } from '../../../../config/paths';

/**
 * PDF Document extension
 * Provides multiple methods to read and extract text from PDF files
 */
const pdfDocumentExtension = {
  /**
   * Extract text from PDF file using pdf-parse library
   * Best for most PDFs with good text extraction accuracy
   *
   * @param filePath - Full path to the PDF file
   * @param fileId - File ID in conversation storage (alternative to filePath)
   * @returns Extracted text content
   */
  extract: async (options: {
    filePath?: string;
    fileId?: string;
  }) => {
    if (!options || typeof options !== "object") {
      throw new Error("extractPDF requires an options object");
    }

    if (!options.filePath && !options.fileId) {
      throw new Error("extractPDF requires either 'filePath' or 'fileId' parameter");
    }

    let filePath = options.filePath!;

    // If fileId is provided, resolve to actual file path
    if (options.fileId) {
      // Access conversation files from storage
      const convId = (globalThis as any).convId || '';
      const projectId = (globalThis as any).projectId || '';
      const tenantId = (globalThis as any).tenantId || 'default';
      const convFilesDir = getConversationFilesDir(projectId, convId, tenantId);
      filePath = path.join(convFilesDir, options.fileId);

      // Try to find file by ID if not directly accessible
      try {
        await fs.access(filePath);
      } catch {
        // If direct access fails, search for the file
        const entries = await fs.readdir(convFilesDir, { withFileTypes: true });
        const fileEntry = entries.find(e => e.name.startsWith(options.fileId!));
        if (fileEntry) {
          filePath = path.join(convFilesDir, fileEntry.name);
        }
      }
    }

    // Validate file is PDF
    if (!isPdfFile(filePath)) {
      throw new Error("File is not a PDF document");
    }

    try {
      const text = await extractTextFromPdf(filePath);
      return { text };
    } catch (error: any) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  },

  /**
   * Read PDF file using unpdf library
   * Alternative extraction method that handles some PDFs better
   *
   * Usage:
   * const pdf = await read({ filePath: 'document.pdf' });
   *
   * @param filePath - Full path to the PDF file
   * @param buffer - PDF file as Buffer (alternative to filePath)
   * @param password - Password for encrypted PDFs (optional)
   * @param maxPages - Maximum pages to extract (optional)
   * @returns Extracted text with page count
   */
  read: async (options: {
    filePath?: string;
    fileId?: string;
    buffer?: Buffer;
    password?: string;
    maxPages?: number;
  }) => {
    if (!options || typeof options !== "object") {
      throw new Error(
        "read requires an options object. Usage: await read({ filePath: 'document.pdf' })"
      );
    }

    if (!options.filePath && !options.buffer && !options.fileId) {
      throw new Error(
        "read requires either 'filePath', 'fileId', or 'buffer' parameter"
      );
    }

    try {
      let dataBuffer: Buffer;

      if (options.buffer) {
        dataBuffer = options.buffer;
      } else {
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

        // Validate file is PDF
        if (!isPdfFile(filePath)) {
          throw new Error("File is not a PDF document");
        }

        dataBuffer = await fs.readFile(filePath);
      }

      // Use unpdf to extract text from PDF
      const { extractText, getDocumentProxy } = await import("unpdf");

      // Convert Buffer to Uint8Array
      const uint8Array = new Uint8Array(dataBuffer);

      // Load PDF
      const pdf = await getDocumentProxy(uint8Array);

      // Extract text (merge all pages)
      const { text, totalPages } = await extractText(pdf, { mergePages: true });

      // Clean up whitespace
      const cleanedText = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      return {
        text: cleanedText,
        totalPages: totalPages,
      };
    } catch (error: any) {
      throw new Error(`PDF reading failed: ${error.message}`);
    }
  },

  /**
   * Convenience method - alias for extract()
   */
  extractPDF: async (options: { filePath?: string; fileId?: string }) => {
    return pdfDocumentExtension.extract(options);
  },

  /**
   * Convenience method - alias for read()
   */
  pdfReader: async (options: {
    filePath?: string;
    fileId?: string;
    buffer?: Buffer;
    password?: string;
    maxPages?: number;
  }) => {
    return pdfDocumentExtension.read(options);
  },
};

export default pdfDocumentExtension;
