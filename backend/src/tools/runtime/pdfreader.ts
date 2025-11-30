import { PdfReader } from "pdfreader";

/**
 * PDF reader options
 */
export interface PDFReaderOptions {
  /** PDF file path to read */
  filePath?: string;
  /** PDF buffer data (alternative to filePath) */
  buffer?: Buffer;
  /** Password for encrypted PDFs */
  password?: string;
  /** Maximum number of pages to read (0 = all pages) */
  maxPages?: number;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * PDF text item
 */
export interface PDFTextItem {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * PDF page
 */
export interface PDFPage {
  pageNumber: number;
  items: PDFTextItem[];
  text: string;
}

/**
 * PDF reader result
 */
export interface PDFReaderResult {
  /** Extracted text from the PDF */
  text: string;
  /** Pages with detailed text items */
  pages: PDFPage[];
  /** Total number of pages */
  totalPages: number;
}

/**
 * Create a PDF reader function that extracts text from PDF files
 *
 * Supports:
 * - Reading from file path or buffer
 * - Password-protected PDFs
 * - Page-by-page text extraction
 * - Positional text information
 *
 * @param cwd - Working directory for resolving relative file paths
 */
export function createPDFReaderFunction(cwd?: string) {
  return async (options: PDFReaderOptions): Promise<PDFReaderResult> => {
    if (!options || typeof options !== "object") {
      throw new Error(
        "pdfReader requires an options object. Usage: pdfReader({ filePath: 'document.pdf' })"
      );
    }

    if (!options.filePath && !options.buffer) {
      throw new Error(
        "pdfReader requires either 'filePath' or 'buffer' parameter. Usage: pdfReader({ filePath: 'document.pdf' })"
      );
    }

    const maxPages = options.maxPages || 0;
    const pages: PDFPage[] = [];
    let currentPage: PDFPage | null = null;
    let totalPages = 0;

    return new Promise((resolve, reject) => {
      const reader = new PdfReader({
        password: options.password,
        debug: options.debug,
      } as any);

      const processItem = (err: string | null, item: any) => {
        if (err) {
          reject(new Error(`PDF reading failed: ${err}`));
          return;
        }

        // End of file
        if (!item) {
          // Add the last page if it exists
          if (currentPage && currentPage.items.length > 0) {
            pages.push(currentPage);
          }

          // Combine all text from all pages
          const fullText = pages.map(p => p.text).join("\n\n");

          resolve({
            text: fullText,
            pages,
            totalPages,
          });
          return;
        }

        // New page
        if (item.page) {
          // Save previous page
          if (currentPage && currentPage.items.length > 0) {
            pages.push(currentPage);
          }

          totalPages++;

          // Check if we've reached max pages
          if (maxPages > 0 && totalPages > maxPages) {
            // Combine all text from all pages
            const fullText = pages.map(p => p.text).join("\n\n");

            resolve({
              text: fullText,
              pages,
              totalPages: pages.length,
            });
            return;
          }

          // Create new page
          currentPage = {
            pageNumber: item.page,
            items: [],
            text: "",
          };
        }

        // Text item
        if (item.text && currentPage) {
          const textItem: PDFTextItem = {
            text: item.text,
            x: item.x || 0,
            y: item.y || 0,
            w: item.w || 0,
            h: item.h || 0,
          };

          currentPage.items.push(textItem);
          currentPage.text += (currentPage.text ? " " : "") + item.text;
        }
      };

      // Parse from file or buffer
      if (options.filePath) {
        let filePath = options.filePath;

        // Resolve relative paths using cwd if provided
        if (cwd && !filePath.startsWith('/')) {
          filePath = `${cwd}/${filePath}`;
        }

        // Use parseFileItems for file-based reading
        reader.parseFileItems(filePath, processItem);
      } else if (options.buffer) {
        // Use parseBuffer for buffer-based reading
        reader.parseBuffer(options.buffer, processItem);
      }
    });
  };
}

/**
 * Helper function to read PDF from file path
 */
export async function readPDF(
  filePath: string,
  options?: { password?: string; maxPages?: number; cwd?: string }
): Promise<PDFReaderResult> {
  return createPDFReaderFunction(options?.cwd)({
    filePath,
    password: options?.password,
    maxPages: options?.maxPages,
  });
}

/**
 * Helper function to read PDF from buffer
 */
export async function readPDFBuffer(
  buffer: Buffer,
  options?: { password?: string; maxPages?: number }
): Promise<PDFReaderResult> {
  return createPDFReaderFunction()({
    buffer,
    password: options?.password,
    maxPages: options?.maxPages,
  });
}
