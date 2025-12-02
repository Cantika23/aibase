import { ProjectStorage } from "../storage/project-storage";

const projectStorage = ProjectStorage.getInstance();

/**
 * Handle GET /api/projects - Get all projects
 */
export async function handleGetProjects(req: Request): Promise<Response> {
  try {
    const projects = await projectStorage.getAll();

    return Response.json({
      success: true,
      data: { projects },
    });
  } catch (error) {
    console.error("Error getting projects:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get projects",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /api/projects/:id - Get a specific project
 */
export async function handleGetProject(req: Request, projectId: string): Promise<Response> {
  try {
    const project = await projectStorage.get(projectId);

    if (!project) {
      return Response.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: { project },
    });
  } catch (error) {
    console.error("Error getting project:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle POST /api/projects - Create a new project
 */
export async function handleCreateProject(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { name, description } = body as any;

    if (!name || typeof name !== "string") {
      return Response.json(
        {
          success: false,
          error: "Project name is required and must be a string",
        },
        { status: 400 }
      );
    }

    if (name.trim().length === 0) {
      return Response.json(
        {
          success: false,
          error: "Project name cannot be empty",
        },
        { status: 400 }
      );
    }

    if (description !== undefined && typeof description !== "string") {
      return Response.json(
        {
          success: false,
          error: "Description must be a string",
        },
        { status: 400 }
      );
    }

    const project = await projectStorage.create(name.trim(), description?.trim());

    return Response.json(
      {
        success: true,
        data: { project },
        message: "Project created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating project:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create project",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT /api/projects/:id - Update a project
 */
export async function handleUpdateProject(req: Request, projectId: string): Promise<Response> {
  try {
    const body = await req.json();
    const { name, description } = body as any;

    const updates: { name?: string; description?: string } = {};

    if (name !== undefined) {
      if (typeof name !== "string") {
        return Response.json(
          {
            success: false,
            error: "Name must be a string",
          },
          { status: 400 }
        );
      }
      if (name.trim().length === 0) {
        return Response.json(
          {
            success: false,
            error: "Name cannot be empty",
          },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return Response.json(
          {
            success: false,
            error: "Description must be a string",
          },
          { status: 400 }
        );
      }
      updates.description = description.trim();
    }

    const project = await projectStorage.update(projectId, updates);

    if (!project) {
      return Response.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: { project },
      message: "Project updated successfully",
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update project",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE /api/projects/:id - Delete a project
 */
export async function handleDeleteProject(req: Request, projectId: string): Promise<Response> {
  try {
    const deleted = await projectStorage.delete(projectId);

    if (!deleted) {
      return Response.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete project",
      },
      { status: 500 }
    );
  }
}
