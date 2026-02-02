/**
 * Migrate existing embed_user_{uid} conversations to new structure
 * Old: data/{projectId}/embed_user_{uid}/
 * New: data/{projectId}/{uid}/embed_user_{uid}/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('Migration');

/**
 * Migrate existing embed_user_{uid} conversations to new structure
 */
export async function migrateEmbedConversations(): Promise<void> {
  const dataDir = path.join(process.cwd(), 'data');

  try {
    logger.info('Starting embed conversation migration...');

    // Check if data directory exists
    const dataDirExists = await fs.access(dataDir).then(() => true).catch(() => false);
    if (!dataDirExists) {
      logger.info('Data directory does not exist, skipping migration');
      return;
    }

    // Read all entries in data directory
    const dataDirEntries = await fs.readdir(dataDir, { withFileTypes: true });
    const projects = dataDirEntries.filter(d =>
      d.isDirectory() &&
      !d.name.endsWith('.db') && // Skip database files
      d.name !== 'backend' && // Skip backend logs
      d.name !== 'logs' // Skip log directories
    );

    if (projects.length === 0) {
      logger.info('No projects found, skipping migration');
      return;
    }

    logger.info(`Found ${projects.length} projects`);

    let totalMigrated = 0;

    for (const project of projects) {
      const projectId = project.name;
      const projectDir = path.join(dataDir, projectId);

      // Read all conversation directories in project
      const convDirs = await fs.readdir(projectDir, { withFileTypes: true }).catch(() => []);
      const embedConvDirs = convDirs.filter(d =>
        d.isDirectory() && d.name.startsWith('embed_user_')
      );

      if (embedConvDirs.length === 0) {
        logger.info(`No embed conversations found in project ${projectId}`);
        continue;
      }

      logger.info(`Found ${embedConvDirs.length} embed conversations in project ${projectId}`);

      for (const convDir of embedConvDirs) {
        const convId = convDir.name;
        const uid = convId.replace('embed_user_', '');

        const oldPath = path.join(projectDir, convId);
        const newPath = path.join(projectDir, uid, convId);

        try {
          // Check if old path exists
          const oldPathExists = await fs.access(oldPath).then(() => true).catch(() => false);
          if (!oldPathExists) {
            logger.info(`Old path does not exist: ${oldPath}, skipping`);
            continue;
          }

          // Check if new path already exists
          const newPathExists = await fs.access(newPath).then(() => true).catch(() => false);
          if (newPathExists) {
            logger.info(`New path already exists: ${newPath}, skipping`);
            // Remove old path to clean up
            await fs.rm(oldPath, { recursive: true, force: true });
            totalMigrated++;
            continue;
          }

          // Create new directory structure
          await fs.mkdir(path.dirname(newPath), { recursive: true });

          // Move conversation directory
          await fs.rename(oldPath, newPath);

          logger.info(`Migrated: ${projectId}/${convId} → ${projectId}/${uid}/${convId}`);
          totalMigrated++;
        } catch (error: any) {
          logger.error(`Error migrating ${projectId}/${convId}: ${error.message}`);
        }
      }
    }

    logger.info(`Completed successfully. Migrated ${totalMigrated} conversations`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      logger.error({ error }, 'Migration error');
      throw error;
    }
  }
}

// Run if executed directly (e.g., `bun run migrate-embed-conversations.ts`)
if (import.meta.main) {
  migrateEmbedConversations()
    .then(() => {
      logger.info('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Script failed');
      process.exit(1);
    });
}
