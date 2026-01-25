/**
 * Fix template literals in extension context exports
 * Converts: export const context = () => `...`
 * To: export const context = () => '...' + '...'
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const extensionsDir = path.join(process.cwd(), 'src/tools/extensions/defaults');

async function fixExtension(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  // Check if file has the problematic pattern
  if (!content.includes('export const context = () => `')) {
    return { fixed: false, reason: 'No context export with template literal' };
  }

  console.log(`\nProcessing: ${path.basename(filePath)}`);

  // Extract the template literal content
  const startMarker = 'export const context = () => `';
  const startIdx = content.indexOf(startMarker);

  if (startIdx === -1) {
    return { fixed: false, reason: 'Pattern not found' };
  }

  // Find the end of the template literal (matching backtick)
  let searchStart = startIdx + startMarker.length;
  let endIdx = -1;
  let depth = 1;
  let i = searchStart;

  while (i < content.length && depth > 0) {
    if (content[i] === '`') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    } else if (content[i] === '\\' && i + 1 < content.length && content[i + 1] === '`') {
      // Escaped backtick, skip next char
      i++;
    }
    i++;
  }

  if (endIdx === -1) {
    return { fixed: false, reason: 'Could not find closing backtick' };
  }

  // Extract the template content
  const templateContent = content.substring(searchStart, endIdx);

  // Convert to string concatenation
  // Replace newlines with \n and escape quotes
  const lines = templateContent.split('\n');
  const convertedLines = lines.map((line, idx) => {
    let trimmed = line.replace(/\t/g, '  '); // Normalize tabs
    if (idx === lines.length - 1 && trimmed === '') {
      return ''; // Skip trailing empty line
    }

    // Handle escaped backticks (\`\`\`) before other escaping
    // The template has \` which means literal backtick, so we need to output `
    const hasEscapedBackticks = trimmed.includes('\\`\\`\\`');

    // First, replace escaped backticks with a marker
    if (hasEscapedBackticks) {
      trimmed = trimmed.replace(/\\`\\`\\`/g, '<<<TRIPLE_BACKTICK>>>');
    }

    // Now escape single quotes and other backslashes
    let escaped = trimmed
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/'/g, "\\'");    // Escape single quotes

    // Restore triple backticks (as literal backticks, not escaped)
    if (hasEscapedBackticks) {
      escaped = escaped.replace(/<<<TRIPLE_BACKTICK>>>/g, '`' + '`' + '`');
    }

    return `'${escaped}'`;
  }).filter(l => l !== '');

  const converted = convertedLines.join(' +\n  ');

  // Rebuild the content
  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx + 1);

  const newContent = before + 'export const context = () =>\n  ' + converted + after;

  // Write back
  await fs.writeFile(filePath, newContent, 'utf-8');
  console.log(`  ✓ Fixed: ${convertedLines.length} lines converted`);

  return { fixed: true, lines: convertedLines.length };
}

async function main() {
  console.log('Fixing extension context exports...\n');

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
        console.log(`  - Skipped: ${result.reason}`);
      }
    } catch (error) {
      errors.push({ dir, error: error.message });
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.forEach(e => console.log(`  - ${e.dir}: ${e.error}`));
  }
}

main().catch(console.error);
