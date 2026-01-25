/**
 * Fix incorrect escaping in converted extension files
 * Converts: '\\`\\`\\`'  (which shows as \`\`\`)
 * To: '`' + '`' + '`' (which shows as ```)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const extensionsDir = path.join(process.cwd(), 'src/tools/extensions/defaults');

async function fixExtension(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  // Check if file has the problematic pattern (single quote + 2 backslashes + backtick repeated 3 times + single quote)
  if (!content.includes("'\\\\`\\\\`\\\\`")) {
    return { fixed: false };
  }

  console.log(`  Fixing: ${path.basename(path.dirname(filePath))}`);

  // Replace '\\\\`\\\\`\\\\`' with '`' + '`' + '`' to create triple backticks
  // The pattern is: single quote, 2 backslashes, backtick, 2 backslashes, backtick, 2 backslashes, backtick, single quote
  let fixed = content.replace(
    /'\\\\`\\\\`\\\\`'/g,
    '\'`\' + \'`\' + \'`\''
  );

  // Also fix opening backticks (e.g., '\\\\`\\\\`\\\\`typescript')
  fixed = fixed.replace(
    /'\\\\`\\\\`\\\\`([^']+)'/g,
    '\'`\' + \'`\' + \'`\' + \'$1\''
  );

  await fs.writeFile(filePath, fixed, 'utf-8');
  return { fixed: true };
}

async function main() {
  console.log('Fixing escaping in extension context exports...\n');

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
