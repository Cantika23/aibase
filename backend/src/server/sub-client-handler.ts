/**
 * Sub-Client API Handler
 * Handles CRUD operations for sub-clients
 */

import { SubClientStorage } from "../storage/sub-client-storage";
import { ProjectStorage } from "../storage/project-storage";
import { authenticateRequest } from "./auth-handler";
import { createLogger } from "../utils/logger";

const logger = createLogger('SubClientHandler');
const subClientStorage = SubClientStorage.getInstance();
const projectStorage = ProjectStorage.getInstance();

// Initialize sub-client storage
subClientStorage.initialize().catch((error) => logger.error({ error }, "Failed to initialize sub-client storage"));

/**
 * Handle GET /api/sub-clients/lookup - Lookup sub-client by shortId+pathname or custom domain
 * Query params: shortPath (e.g., x7m2-marketing) or host
 */
export async function handleLookupSubClient(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const shortPath = url.searchParams.get('shortPath');
    const host = url.searchParams.get('host');

    let subClient = null;

    if (shortPath) {
      // Lookup by combined shortId-pathname (e.g., x7m2-marketing)
      subClient = subClientStorage.getByShortIdAndPathname(shortPath);
    } else if (host) {
      // Lookup by custom domain (e.g., marketing.company.com)
      subClient = subClientStorage.getByCustomDomain(host);
    } else {
      return Response.json(
        { success: false, error: "Either 'shortPath' or 'host' query parameter is required" },
        { status: 400 }
      );
    }

    if (!subClient) {
      return Response.json(
        { success: false, error: "Sub-client not found" },
        { status: 404 }
      );
    }

    // Get the project to check if sub-clients are enabled
    const project = projectStorage.getById(subClient.project_id);

    if (!project) {
      return Response.json(
        { success: false, error: "Associated project not found" },
        { status: 404 }
      );
    }

    if (!project.sub_clients_enabled) {
      return Response.json(
        { success: false, error: "Sub-clients feature is not enabled for this project" },
        { status: 400 }
      );
    }

    // Return sub-client info without exposing sensitive data
    return Response.json({
      success: true,
      data: {
        subClient: {
          id: subClient.id,
          project_id: subClient.project_id,
          name: subClient.name,
          description: subClient.description,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, "Error looking up sub-client");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to lookup sub-client" },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /api/projects/:projectId/sub-clients - Get all sub-clients for a project
 */
export async function handleGetSubClients(req: Request, projectId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Check if sub-clients feature is enabled for this project
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Get sub-clients with users
    const subClients = subClientStorage.getByProjectIdWithUsers(projectId);

    return Response.json({
      success: true,
      data: { subClients, enabled: project.sub_clients_enabled },
    });
  } catch (error) {
    logger.error({ error }, "Error getting sub-clients");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get sub-clients" },
      { status: 500 }
    );
  }
}

/**
 * Handle POST /api/projects/:projectId/sub-clients - Create a new sub-client
 */
export async function handleCreateSubClient(req: Request, projectId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Check if sub-clients feature is enabled
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    if (!project.sub_clients_enabled) {
      return Response.json(
        { success: false, error: "Sub-clients feature is not enabled for this project" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Response.json(
        { success: false, error: "Sub-client name is required" },
        { status: 400 }
      );
    }

    const subClient = await subClientStorage.create({
      project_id: projectId,
      name: name.trim(),
      description: description?.trim(),
    });

    // Ensure directories exist
    await subClientStorage.ensureDirectories(subClient.id, projectId, project.tenant_id ?? 'default');

    // Add the creator as an admin
    await subClientStorage.addUser(subClient.id, auth.user.id, 'admin');

    return Response.json({
      success: true,
      data: { subClient },
      message: "Sub-client created successfully",
    }, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Error creating sub-client");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create sub-client" },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /api/projects/:projectId/sub-clients/:subClientId - Get a specific sub-client
 */
export async function handleGetSubClient(req: Request, projectId: string, subClientId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const subClient = subClientStorage.getByIdWithUsers(subClientId);

    if (!subClient || subClient.project_id !== projectId) {
      return Response.json(
        { success: false, error: "Sub-client not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: { subClient },
    });
  } catch (error) {
    logger.error({ error }, "Error getting sub-client");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get sub-client" },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT /api/projects/:projectId/sub-clients/:subClientId - Update a sub-client
 */
export async function handleUpdateSubClient(req: Request, projectId: string, subClientId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const subClient = subClientStorage.getById(subClientId);

    if (!subClient || subClient.project_id !== projectId) {
      return Response.json(
        { success: false, error: "Sub-client not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the sub-client or project owner
    const userRole = subClientStorage.getUserRole(subClientId, auth.user.id);
    const isProjectOwner = subClient.project_id === projectId && projectStorage.getById(projectId)?.user_id === auth.user.id;
    
    if (userRole !== 'admin' && !isProjectOwner) {
      return Response.json(
        { success: false, error: "Only sub-client admins can update sub-client details" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description } = body;

    const updates: { name?: string; description?: string } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return Response.json(
          { success: false, error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description.trim();
    }

    const updated = await subClientStorage.update(subClientId, updates);

    if (!updated) {
      return Response.json(
        { success: false, error: "Failed to update sub-client" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: { subClient: updated },
      message: "Sub-client updated successfully",
    });
  } catch (error) {
    logger.error({ error }, "Error updating sub-client");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update sub-client" },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE /api/projects/:projectId/sub-clients/:subClientId - Delete a sub-client
 */
export async function handleDeleteSubClient(req: Request, projectId: string, subClientId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const subClient = subClientStorage.getById(subClientId);

    if (!subClient || subClient.project_id !== projectId) {
      return Response.json(
        { success: false, error: "Sub-client not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the sub-client or project owner
    const userRole = subClientStorage.getUserRole(subClientId, auth.user.id);
    const isProjectOwner = projectStorage.getById(projectId)?.user_id === auth.user.id;
    
    if (userRole !== 'admin' && !isProjectOwner) {
      return Response.json(
        { success: false, error: "Only sub-client admins can delete sub-clients" },
        { status: 403 }
      );
    }

    const deleted = await subClientStorage.delete(subClientId);

    if (!deleted) {
      return Response.json(
        { success: false, error: "Failed to delete sub-client" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: "Sub-client deleted successfully",
    });
  } catch (error) {
    logger.error({ error }, "Error deleting sub-client");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete sub-client" },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /api/projects/:projectId/sub-clients/:subClientId/users - Get sub-client users
 */
export async function handleGetSubClientUsers(req: Request, projectId: string, subClientId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const subClient = subClientStorage.getById(subClientId);

    if (!subClient || subClient.project_id !== projectId) {
      return Response.json(
        { success: false, error: "Sub-client not found" },
        { status: 404 }
      );
    }

    const users = subClientStorage.getUsers(subClientId);

    return Response.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    logger.error({ error }, "Error getting sub-client users");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get sub-client users" },
      { status: 500 }
    );
  }
}

/**
 * Handle POST /api/projects/:projectId/sub-clients/:subClientId/users - Add user to sub-client
 */
export async function handleAddSubClientUser(req: Request, projectId: string, subClientId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const subClient = subClientStorage.getById(subClientId);

    if (!subClient || subClient.project_id !== projectId) {
      return Response.json(
        { success: false, error: "Sub-client not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the sub-client or project owner
    const userRole = subClientStorage.getUserRole(subClientId, auth.user.id);
    const isProjectOwner = projectStorage.getById(projectId)?.user_id === auth.user.id;
    
    if (userRole !== 'admin' && !isProjectOwner) {
      return Response.json(
        { success: false, error: "Only sub-client admins can add users" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId, role = 'user' } = body;

    if (!userId || typeof userId !== "number") {
      return Response.json(
        { success: false, error: "Valid userId is required" },
        { status: 400 }
      );
    }

    if (role !== 'admin' && role !== 'user') {
      return Response.json(
        { success: false, error: "Role must be 'admin' or 'user'" },
        { status: 400 }
      );
    }

    const subClientUser = await subClientStorage.addUser(subClientId, userId, role);

    return Response.json({
      success: true,
      data: { user: subClientUser },
      message: "User added to sub-client successfully",
    }, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Error adding user to sub-client");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to add user to sub-client" },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE /api/projects/:projectId/sub-clients/:subClientId/users/:userId - Remove user from sub-client
 */
export async function handleRemoveSubClientUser(req: Request, projectId: string, subClientId: string, userId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const subClient = subClientStorage.getById(subClientId);

    if (!subClient || subClient.project_id !== projectId) {
      return Response.json(
        { success: false, error: "Sub-client not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the sub-client or project owner
    const userRole = subClientStorage.getUserRole(subClientId, auth.user.id);
    const isProjectOwner = projectStorage.getById(projectId)?.user_id === auth.user.id;
    
    if (userRole !== 'admin' && !isProjectOwner) {
      return Response.json(
        { success: false, error: "Only sub-client admins can remove users" },
        { status: 403 }
      );
    }

    const targetUserId = parseInt(userId, 10);
    if (isNaN(targetUserId)) {
      return Response.json(
        { success: false, error: "Invalid userId" },
        { status: 400 }
      );
    }

    // Prevent removing yourself if you're the last admin
    const users = subClientStorage.getUsers(subClientId);
    const admins = users.filter(u => u.role === 'admin');
    const targetUser = users.find(u => u.id === targetUserId);

    if (targetUser?.role === 'admin' && admins.length === 1) {
      return Response.json(
        { success: false, error: "Cannot remove the last admin from sub-client" },
        { status: 400 }
      );
    }

    const removed = await subClientStorage.removeUser(subClientId, targetUserId);

    if (!removed) {
      return Response.json(
        { success: false, error: "User not found in sub-client" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "User removed from sub-client successfully",
    });
  } catch (error) {
    logger.error({ error }, "Error removing user from sub-client");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to remove user from sub-client" },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT /api/projects/:projectId/sub-clients/:subClientId/users/:userId/role - Update user role
 */
export async function handleUpdateSubClientUserRole(req: Request, projectId: string, subClientId: string, userId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const subClient = subClientStorage.getById(subClientId);

    if (!subClient || subClient.project_id !== projectId) {
      return Response.json(
        { success: false, error: "Sub-client not found" },
        { status: 404 }
      );
    }

    // Check if user is admin of the sub-client or project owner
    const userRole = subClientStorage.getUserRole(subClientId, auth.user.id);
    const isProjectOwner = projectStorage.getById(projectId)?.user_id === auth.user.id;
    
    if (userRole !== 'admin' && !isProjectOwner) {
      return Response.json(
        { success: false, error: "Only sub-client admins can update user roles" },
        { status: 403 }
      );
    }

    const targetUserId = parseInt(userId, 10);
    if (isNaN(targetUserId)) {
      return Response.json(
        { success: false, error: "Invalid userId" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { role } = body;

    if (!role || (role !== 'admin' && role !== 'user')) {
      return Response.json(
        { success: false, error: "Role must be 'admin' or 'user'" },
        { status: 400 }
      );
    }

    // Prevent demoting yourself if you're the last admin
    if (targetUserId === auth.user.id && role === 'user') {
      const users = subClientStorage.getUsers(subClientId);
      const admins = users.filter(u => u.role === 'admin');
      
      if (admins.length === 1) {
        return Response.json(
          { success: false, error: "Cannot demote yourself - you are the last admin" },
          { status: 400 }
        );
      }
    }

    const updated = await subClientStorage.updateUserRole(subClientId, targetUserId, role);

    if (!updated) {
      return Response.json(
        { success: false, error: "User not found in sub-client" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "User role updated successfully",
    });
  } catch (error) {
    logger.error({ error }, "Error updating user role");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update user role" },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /api/projects/:projectId/users - Get all users in the project's tenant
 * This returns users that can potentially be added to sub-clients within the project
 */
export async function handleGetProjectUsers(req: Request, projectId: string): Promise<Response> {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has access to the project
    const hasAccess = projectStorage.userHasAccess(projectId, auth.user.id, auth.user.tenant_id);
    if (!hasAccess) {
      return Response.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Get project to find tenant
    const project = projectStorage.getById(projectId);
    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Get all users in the project's tenant
    const { UserStorage } = await import("../storage/user-storage");
    const userStorage = UserStorage.getInstance();
    const users = userStorage.getByTenantId(project.tenant_id ?? 0);

    return Response.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    logger.error({ error }, "Error getting project users");
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get project users" },
      { status: 500 }
    );
  }
}
