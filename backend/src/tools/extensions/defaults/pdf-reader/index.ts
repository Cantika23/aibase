/**
 * PDF Reader Extension
 * Extract text from PDF files
 */

import * as fs from "fs/promises";
import * as path from "path";

/**
 * PDF reader extension
 */
const pdfReaderExtension = {
  /**
   * Extract text from PDF
   *
   * Usage:
   * const pdf = await pdfReader({ filePath: 'document.pdf' });
   */
  pdfReader: async (options: {
    filePath?: string;
    buffer?: Buffer;
    password?: string;
    maxPages?: number;
  }) {
    if (!options || typeof options !== "object") {
      throw new Error(
        "pdfReader requires an options object. Usage: await pdfReader({ filePath: 'document.pdf' })"
      );
    }

    if (!options.filePath && !options.buffer) {
      throw new Error(
        "pdfReader requires either 'filePath' or 'buffer' parameter"
      );
    }

    try {
      let dataBuffer: Buffer;

      if (options.filePath) {
        dataBuffer = await fs.readFile(options.filePath);
      } else {
        dataBuffer = options.buffer!;
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
   * Read PDF from file path
   */
  readPDF: async (filePath: string, options?: { password?: string; maxPages?: number }) => {
    return pdfReaderExtension.pdfReader({
      filePath,
      password: options?.password,
      maxPages: options?.maxPages,
    });
  },
};
