/**
 * Extension UI Handler
 * Handles bundling and serving of co-located extension UI components
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createLogger } from '../utils/logger';

const logger = createLogger('ExtensionUI');

const extensionsDir = path.join(process.cwd(), 'backend/src/tools/extensions/defaults');
const cacheDir = path.join(process.cwd(), 'data/cache/extension-ui');

/**
 * GET /api/extensions/:id/ui
 * Get transpiled & bundled extension UI component
 */
export async function handleGetExtensionUI(req: Request, extensionId: string): Promise<Response> {
  try {
    const uiPath = path.join(extensionsDir, extensionId, 'ui.tsx');

    // Check if ui.tsx exists
    try {
      await fs.access(uiPath);
    } catch {
      logger.info({ extensionId }, 'Extension UI not found');
      return Response.json(
        { success: false, error: 'Extension UI not found' },
        { status: 404 }
      );
    }

    // Check cache
    const cached = await getFromCache(extensionId);
    if (cached) {
      logger.info({ extensionId, cache: 'HIT' }, 'Returning cached extension UI');
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'X-Extension-Cache': 'HIT',
          'Cache-Control': 'public, max-age=3600' // Cache 1 jam di browser
        }
      });
    }

    // Read UI code
    const uiCode = await fs.readFile(uiPath, 'utf-8');

    // Bundle dengan esbuild
    logger.info({ extensionId }, 'Bundling extension UI with esbuild');

    const result = await esbuild.build({
      entryPoints: [uiPath],
      bundle: true,                      // Bundle dependencies
      platform: 'browser',
      target: 'es2020',
      format: 'esm',
      minify: false,                     // POC: no minification for debugging
      sourcemap: true,                   // Source maps for debugging
      external: ['react', 'react-dom'],  // Exclude shared React deps
      write: false,
      outdir: 'out',
    });

    if (result.errors.length > 0) {
      logger.error({ extensionId, errors: result.errors }, 'esbuild errors');
      return Response.json(
        {
          success: false,
          error: 'Failed to bundle extension UI',
          errors: result.errors.map(e => e.text)
        },
        { status: 500 }
      );
    }

    const bundledCode = result.outputFiles[0].text;

    // Save to cache
    await saveToCache(extensionId, bundledCode);

    logger.info({
      extensionId,
      cache: 'MISS',
      size: bundledCode.length
    }, 'Extension UI bundled successfully');

    return new Response(bundledCode, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'X-Extension-Cache': 'MISS',
        'Cache-Control': 'public, max-age=3600' // Cache 1 jam di browser
      }
    });
  } catch (error) {
    logger.error({ extensionId, error }, 'Error bundling extension UI');
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bundle extension UI'
      },
      { status: 500 }
    );
  }
}

/**
 * Check cache with mtime-based invalidation
 */
async function getFromCache(extensionId: string): Promise<string | null> {
  const cachePath = path.join(cacheDir, `${extensionId}.js`);
  const uiPath = path.join(extensionsDir, extensionId, 'ui.tsx');

  try {
    // Check cache exists
    await fs.access(cachePath);

    // Compare mtimes
    const [cacheStat, uiStat] = await Promise.all([
      fs.stat(cachePath),
      fs.stat(uiPath)
    ]);

    // Cache is valid if newer than source
    if (cacheStat.mtimeMs >= uiStat.mtimeMs) {
      return await fs.readFile(cachePath, 'utf-8');
    }

    logger.info({ extensionId }, 'Cache expired (source modified)');
    return null;
  } catch (error) {
    // Cache doesn't exist or error reading
    return null;
  }
}

/**
 * Save to cache
 */
async function saveToCache(extensionId: string, code: string): Promise<void> {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    const cachePath = path.join(cacheDir, `${extensionId}.js`);
    await fs.writeFile(cachePath, code, 'utf-8');
    logger.info({ extensionId, size: code.length }, 'Cached bundled UI');
  } catch (error) {
    logger.error({ extensionId, error }, 'Failed to cache bundled UI');
    // Non-fatal, continue without caching
  }
}
