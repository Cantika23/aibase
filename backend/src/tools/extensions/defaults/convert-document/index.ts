/**
 * Convert Document Extension
 * Convert Markdown to PDF or Word documents using Pandoc
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

/**
 * Convert document extension
 */
export default {
  /**
   * Convert Markdown to PDF or Word
   *
   * Usage:
   * await convertDocument({
   *   content: '# My Report\n\nThis is a report.',
   *   format: 'pdf',
   *   saveTo: 'report.pdf'
   * });
   */
  convertDocument: async (args: {
    content: string;
    format: "pdf" | "docx";
    saveTo: string;
    cwd?: string;
  }) {
    const { content, format, saveTo } = args;

    // Validate format
    if (!["pdf", "docx"].includes(format)) {
      throw new Error(
        `Invalid format "${format}". Must be 'pdf' or 'docx'`
      );
    }

    // Ensure saveTo has correct extension
    const filename = saveTo.endsWith(`.${format}`)
      ? saveTo
      : `${saveTo}.${format}`;

    const cwd = args.cwd || process.cwd();
    const outputPath = path.join(cwd, filename);

    try {
      // Create temporary markdown file
      const tempInput = path.join(cwd, `.temp_${Date.now()}.md`);
      await fs.writeFile(tempInput, content, "utf-8");

      // Build pandoc command
      const pandocArgs = [
        tempInput,
        "-o", outputPath,
        ...(format === "pdf" ? [
          "--pdf-engine=xelatex",
          "-V", "geometry:margin=1in",
        ] : []),
      ];

      // Spawn pandoc process
      return new Promise((resolve, reject) => {
        const pandoc = spawn("pandoc", pandocArgs);

        let stderr = "";

        pandoc.on("error", (error) => {
          reject(
            new Error(
              `Failed to spawn pandoc: ${error.message}. Ensure pandoc is installed.`
            )
          );
        });

        pandoc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        pandoc.on("close", async (code) => {
          // Clean up temp file
          try {
            await fs.unlink(tempInput);
          } catch {
            // Ignore cleanup errors
          }

          if (code !== 0) {
            reject(
              new Error(
                `Pandoc conversion failed (exit code ${code}): ${stderr}`
              )
            );
            return;
          }

          resolve({
            status: "success",
            message: `Document converted to ${format.toUpperCase()}`,
            path: filename,
          });
        });
      });
    } catch (error: any) {
      throw new Error(`Document conversion failed: ${error.message}`);
    }
  },
};
