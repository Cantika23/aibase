/**
 * Remove 'export' keyword from context declarations
 * Converts: export const context = ...
 * To: const context = ...
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const extensionsDir = path.join(process.cwd(), 'src/tools/extensions/defaults');

async function fixExtension(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  // Check if file has the problematic pattern
  if (!content.includes('export const context')) {
    return { fixed: false };
  }

  console.log(`  Fixing: ${path.basename(path.dirname(filePath))}`);

  // Remove 'export' keyword from context declaration
  const fixed = content.replace(
    /export const context = /g,
    'const context = '
  );

  await fs.writeFile(filePath, fixed, 'utf-8');
  return { fixed: true };
}

async function main() {
  console.log('Removing export keyword from context declarations...\n');

  const entries = await fs.readdir(extensionsDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  let fixed = 0;
  let skipped = 0;
  const errors = [];

  for (const dir of dirs) {
    const indexPath = path.join(extensionsDir, dir, 'index.ts');
    try {
      await fs.access(indexPath);
      const result = await fixExtension(indexPath);
      if (result.fixed) {
        fixed++;
      } else {
        skipped++;
      }
    } catch (error) {
      errors.push({ dir, error: error.message });
      console.error(`  ✗ Error in ${dir}: ${error.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
  }
}

main().catch(console.error);
