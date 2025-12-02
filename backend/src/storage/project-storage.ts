/**
 * Project storage service for managing projects
 * Stores projects in /data/projects.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

export interface ProjectsData {
  projects: Project[];
}

export class ProjectStorage {
  private static instance: ProjectStorage;
  private baseDir: string;
  private projectsFilePath: string;
  private cache: ProjectsData | null = null;

  private constructor() {
    // Use absolute path from project root
    this.baseDir = path.join(process.cwd(), 'data');
    this.projectsFilePath = path.join(this.baseDir, 'projects.json');
  }

  static getInstance(): ProjectStorage {
    if (!ProjectStorage.instance) {
      ProjectStorage.instance = new ProjectStorage();
    }
    return ProjectStorage.instance;
  }

  /**
   * Ensure base data directory exists
   */
  private async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  /**
   * Initialize projects.json with default A1 project if it doesn't exist
   */
  private async initializeProjectsFile(): Promise<void> {
    await this.ensureBaseDir();

    try {
      await fs.access(this.projectsFilePath);
      // File exists, do nothing
    } catch (error) {
      // File doesn't exist, create with default A1 project
      const defaultData: ProjectsData = {
        projects: [
          {
            id: 'A1',
            name: 'Default Project',
            description: 'Your first project',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isDefault: true,
          },
        ],
      };

      await fs.writeFile(this.projectsFilePath, JSON.stringify(defaultData, null, 2), 'utf-8');
      this.cache = defaultData;
    }
  }

  /**
   * Read projects from disk
   */
  private async readProjects(): Promise<ProjectsData> {
    await this.initializeProjectsFile();

    const content = await fs.readFile(this.projectsFilePath, 'utf-8');
    const data = JSON.parse(content) as ProjectsData;
    this.cache = data;
    return data;
  }

  /**
   * Write projects to disk
   */
  private async writeProjects(data: ProjectsData): Promise<void> {
    await this.ensureBaseDir();
    await fs.writeFile(this.projectsFilePath, JSON.stringify(data, null, 2), 'utf-8');
    this.cache = data;
  }

  /**
   * Get all projects
   */
  async getAll(): Promise<Project[]> {
    const data = await this.readProjects();
    return data.projects;
  }

  /**
   * Get a specific project by ID
   */
  async get(id: string): Promise<Project | null> {
    const data = await this.readProjects();
    return data.projects.find((p) => p.id === id) || null;
  }

  /**
   * Check if a project exists
   */
  async exists(id: string): Promise<boolean> {
    const project = await this.get(id);
    return project !== null;
  }

  /**
   * Get the default project
   */
  async getDefault(): Promise<Project | null> {
    const data = await this.readProjects();
    return data.projects.find((p) => p.isDefault) || data.projects[0] || null;
  }

  /**
   * Create a new project
   */
  async create(name: string, description?: string): Promise<Project> {
    const data = await this.readProjects();

    // Generate unique ID
    const timestamp = Date.now();
    const id = `proj_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const newProject: Project = {
      id,
      name,
      description,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    data.projects.push(newProject);
    await this.writeProjects(data);

    // Create project directory
    const projectDir = path.join(this.baseDir, id);
    await fs.mkdir(projectDir, { recursive: true });

    return newProject;
  }

  /**
   * Update a project
   */
  async update(id: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project | null> {
    const data = await this.readProjects();
    const projectIndex = data.projects.findIndex((p) => p.id === id);

    if (projectIndex === -1) {
      return null;
    }

    const project = data.projects[projectIndex];
    data.projects[projectIndex] = {
      ...project,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.writeProjects(data);
    return data.projects[projectIndex];
  }

  /**
   * Delete a project
   */
  async delete(id: string): Promise<boolean> {
    const data = await this.readProjects();
    const projectIndex = data.projects.findIndex((p) => p.id === id);

    if (projectIndex === -1) {
      return false;
    }

    // Don't allow deleting the last project
    if (data.projects.length === 1) {
      throw new Error('Cannot delete the last project');
    }

    // Don't allow deleting the default project if it's the only one with data
    const project = data.projects[projectIndex];
    if (project.isDefault && data.projects.length <= 2) {
      throw new Error('Cannot delete the default project when only one other project exists');
    }

    data.projects.splice(projectIndex, 1);
    await this.writeProjects(data);

    // Delete project directory
    const projectDir = path.join(this.baseDir, id);
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
      console.warn(`Failed to delete project directory ${projectDir}:`, error);
    }

    return true;
  }

  /**
   * Get project directory path
   */
  getProjectDir(projectId: string): string {
    return path.join(this.baseDir, projectId);
  }

  /**
   * Ensure project directory exists
   */
  async ensureProjectDir(projectId: string): Promise<void> {
    const projectDir = this.getProjectDir(projectId);
    await fs.mkdir(projectDir, { recursive: true });
  }
}
