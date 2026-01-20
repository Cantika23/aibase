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
 * Check if a file is a .docx file
 */
export function isDocxFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.docx');
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

  // For non-docx files, just read as text
  return await fs.readFile(filePath, 'utf-8');
}
