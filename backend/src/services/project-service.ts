/**
 * Project service for managing user projects
 */

import { ProjectStorage } from '../storage/project-storage';

const projectStorage = ProjectStorage.getInstance();

/**
 * Ensure user has a default project
 * Creates one if it doesn't exist
 */
export async function ensureUserDefaultProject(userId: number, tenantId: number | null): Promise<void> {
  // Check if user has a default project
  const defaultProject = projectStorage.getDefaultByUserId(userId);

  if (!defaultProject) {
    // Create default project for user
    await projectStorage.create({
      name: 'My Project',
      description: 'Your default project',
      user_id: userId,
      tenant_id: tenantId,
      is_shared: false,
      is_default: true,
    });

    console.log(`[ProjectService] Created default project for user ${userId}`);
  }
}
