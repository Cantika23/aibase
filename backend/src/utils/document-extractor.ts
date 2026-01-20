/**
 * Document text extraction utilities
 * Handles extracting text from various document formats
 */

import * as fs from 'fs/promises';
import mammoth from 'mammoth';

/**
 * Extract text from a .docx file
 * @param filePath - Path to the .docx file
 * @returns Extracted text content
 */
export async function extractTextFromDocx(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error: any) {
    throw new Error(`Failed to extract text from .docx file: ${error.message}`);
  }
}

/**
 * Extract text from a .pdf file
 * NOTE: PDF reading is not currently supported in Bun runtime.
 * PDF libraries like pdf-parse and pdfjs-dist require Node.js or browser APIs
 * that are not available in Bun. Users should convert PDFs to .txt or .docx format.
 *
 * @param filePath - Path to the .pdf file
 * @returns Error message indicating PDF is not supported
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  throw new Error(
    'PDF files are not currently supported. Please convert the PDF to a .txt or .docx file, ' +
    'or copy-paste the text content directly. This is a known limitation due to PDF processing libraries ' +
    'requiring Node.js/browser APIs that are incompatible with the Bun runtime.'
  );
}

/**
 * Check if a file is a .docx file
 */
export function isDocxFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.docx');
}

/**
 * Check if a file is a .pdf file
 */
export function isPdfFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf');
}

/**
 * Extract text from a file based on its extension
 * @param filePath - Path to the file
 * @param fileName - Name of the file (used to detect type)
 * @returns Extracted text content
 */
export async function extractTextFromFile(filePath: string, fileName: string): Promise<string> {
  if (isDocxFile(fileName)) {
    return await extractTextFromDocx(filePath);
  }

  if (isPdfFile(fileName)) {
    return await extractTextFromPdf(filePath);
  }

  // For other files, just read as text
  return await fs.readFile(filePath, 'utf-8');
}
