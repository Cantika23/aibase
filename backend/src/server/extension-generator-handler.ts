/**
 * Extension Generator Handler
 * API endpoint for AI-powered extension creation
 */

import { ExtensionStorage } from "../storage/extension-storage";
import { generateExtension } from "../services/extension-generator";

export async function handleExtensionGeneratorRequest(req: any, res: any) {
  try {
    const { projectId } = req.params;
    const { prompt, category } = req.body;

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Prompt is required and must be a string'
      });
    }

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({
        error: 'Project ID is required'
      });
    }

    console.log(`[ExtensionGenerator] Generating extension for project ${projectId}`);
    console.log(`[ExtensionGenerator] Prompt: ${prompt.substring(0, 100)}...`);

    // Generate extension using AI
    const extension = await generateExtension(prompt, {
      projectId,
      category: category || 'Uncategorized',
    });

    // Save extension to project
    const extensionStorage = new ExtensionStorage();

    // Check if extension already exists
    const existing = await extensionStorage.getById(projectId, extension.metadata.id);
    if (existing) {
      return res.status(409).json({
        error: `Extension with ID '${extension.metadata.id}' already exists`,
        existing: existing
      });
    }

    // Create extension
    const created = await extensionStorage.create(projectId, {
      id: extension.metadata.id,
      name: extension.metadata.name,
      description: extension.metadata.description,
      author: extension.metadata.author || 'AI Generated',
      version: extension.metadata.version || '1.0.0',
      category: extension.metadata.category,
      code: extension.code,
      enabled: true,
      isDefault: false,
    });

    console.log(`[ExtensionGenerator] Extension created: ${created.metadata.id}`);

    return res.status(201).json({
      success: true,
      extension: {
        metadata: created.metadata,
        // Don't return code in response (too large)
      }
    });

  } catch (error: any) {
    console.error('[ExtensionGenerator] Error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to generate extension',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Preview extension without saving
 */
export async function handleExtensionPreviewRequest(req: any, res: any) {
  try {
    const { prompt, category } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Prompt is required and must be a string'
      });
    }

    console.log(`[ExtensionGenerator] Generating preview for prompt: ${prompt.substring(0, 100)}...`);

    // Generate extension preview
    const extension = await generateExtension(prompt, {
      projectId: 'preview',
      category: category || 'Uncategorized',
    });

    return res.status(200).json({
      success: true,
      preview: {
        metadata: extension.metadata,
        code: extension.code,
      }
    });

  } catch (error: any) {
    console.error('[ExtensionGenerator] Preview error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to generate preview',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
