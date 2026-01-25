/**
 * PowerPoint Document Extension
 * Extract text content from PowerPoint presentations (.pptx, .ppt)
 * Enhanced version of extract-pptx with additional capabilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { extractTextFromPowerPoint, isPowerPointFile } from '../../../../utils/document-extractor';
import { getConversationFilesDir } from '../../../../config/paths';

/**
 * PowerPoint Document extension
 * Extract text and content from PowerPoint presentations
 */
const powerpointDocumentExtension = {
  /**
   * Extract text from PowerPoint presentation
   *
   * @param filePath - Full path to the PPTX file
   * @param fileId - File ID in conversation storage (alternative to filePath)
   * @returns Extracted text content from all slides
   */
  extract: async (options: {
    filePath?: string;
    fileId?: string;
  }) => {
    if (!options || typeof options !== "object") {
      throw new Error("extractPowerPoint requires an options object");
    }

    if (!options.filePath && !options.fileId) {
      throw new Error("extractPowerPoint requires either 'filePath' or 'fileId' parameter");
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

    // Validate file is PowerPoint
    if (!isPowerPointFile(filePath)) {
      throw new Error("File is not a PowerPoint presentation (.pptx, .ppt)");
    }

    try {
      const text = await extractTextFromPowerPoint(filePath);
      return { text };
    } catch (error: any) {
      throw new Error(`PowerPoint extraction failed: ${error.message}`);
    }
  },

  /**
   * Read PowerPoint presentation - alias for extract()
   */
  read: async (options: { filePath?: string; fileId?: string }) => {
    return powerpointDocumentExtension.extract(options);
  },

  /**
   * Convenience method - alias for extract()
   */
  extractPPTX: async (options: { filePath?: string; fileId?: string }) => {
    return powerpointDocumentExtension.extract(options);
  },

  /**
   * Convenience method - alias for read()
   */
  pptxReader: async (options: { filePath?: string; fileId?: string }) => {
    return powerpointDocumentExtension.read(options);
  },
};

export default powerpointDocumentExtension;
