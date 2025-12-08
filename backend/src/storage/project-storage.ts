/**
 * Project storage service using SQLite
 * Stores projects in /data/projects.db
 */

import { Database } from "bun:sqlite";
import * as path from 'path';
import * as fs from 'fs/promises';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  user_id: number; // Owner of the project
  tenant_id: number | null; // Tenant the project belongs to
  is_shared: boolean; // Whether project is shared within tenant
  is_default: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  user_id: number;
  tenant_id?: number | null;
  is_shared?: boolean;
  is_default?: boolean;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  is_shared?: boolean;
}

export class ProjectStorage {
  private static instance: ProjectStorage;
  private db: Database;
  private dbPath: string;
  private baseDir: string;

  private constructor() {
    this.baseDir = path.join(process.cwd(), 'data');
    this.dbPath = path.join(this.baseDir, 'projects.db');
  }

  static getInstance(): ProjectStorage {
    if (!ProjectStorage.instance) {
      ProjectStorage.instance = new ProjectStorage();
    }
    return ProjectStorage.instance;
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    // Ensure data directory exists
    await fs.mkdir(this.baseDir, { recursive: true });

    // Open database
    this.db = new Database(this.dbPath);

    // Create projects table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        user_id INTEGER NOT NULL,
        tenant_id INTEGER,
        is_shared INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for faster lookups
    this.db.run('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects(tenant_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_projects_is_shared ON projects(is_shared)');

    console.log('[ProjectStorage] Database initialized at', this.dbPath);
  }

  /**
   * Generate unique project ID
   */
  private generateId(): string {
    const timestamp = Date.now();
    return `proj_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new project
   */
  async create(data: CreateProjectData): Promise<Project> {
    const now = Date.now();
    const id = this.generateId();
    const is_shared = data.is_shared ?? false;
    const is_default = data.is_default ?? false;

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, user_id, tenant_id, is_shared, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.description ?? null,
      data.user_id,
      data.tenant_id ?? null,
      is_shared ? 1 : 0,
      is_default ? 1 : 0,
      now,
      now
    );

    // Create project directory
    const projectDir = this.getProjectDir(id);
    await fs.mkdir(projectDir, { recursive: true });

    const project = this.getById(id);
    if (!project) {
      throw new Error('Failed to create project');
    }

    console.log('[ProjectStorage] Created project:', project.name);
    return project;
  }

  /**
   * Get project by ID
   */
  getById(id: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      ...row,
      is_shared: row.is_shared === 1,
      is_default: row.is_default === 1,
    };
  }

  /**
   * Get all projects for a specific user
   * Returns user's own projects + shared projects in their tenant
   */
  getByUserId(userId: number, tenantId: number | null): Project[] {
    let stmt;
    let rows;

    if (tenantId !== null) {
      // Get user's own projects + shared projects in the same tenant
      stmt = this.db.prepare(`
        SELECT * FROM projects
        WHERE (user_id = ? OR (tenant_id = ? AND is_shared = 1))
        ORDER BY is_default DESC, created_at DESC
      `);
      rows = stmt.all(userId, tenantId) as any[];
    } else {
      // No tenant - only get user's own projects
      stmt = this.db.prepare(`
        SELECT * FROM projects
        WHERE user_id = ?
        ORDER BY is_default DESC, created_at DESC
      `);
      rows = stmt.all(userId) as any[];
    }

    return rows.map(row => ({
      ...row,
      is_shared: row.is_shared === 1,
      is_default: row.is_default === 1,
    }));
  }

  /**
   * Get all projects (admin only)
   */
  getAll(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      ...row,
      is_shared: row.is_shared === 1,
      is_default: row.is_default === 1,
    }));
  }

  /**
   * Check if user has access to a project
   */
  userHasAccess(projectId: string, userId: number, tenantId: number | null): boolean {
    const project = this.getById(projectId);
    if (!project) return false;

    // User owns the project
    if (project.user_id === userId) return true;

    // Project is shared in user's tenant
    if (project.is_shared && project.tenant_id === tenantId && tenantId !== null) {
      return true;
    }

    return false;
  }

  /**
   * Update a project
   */
  async update(id: string, userId: number, updates: UpdateProjectData): Promise<Project | null> {
    const project = this.getById(id);
    if (!project) return null;

    // Only owner can update
    if (project.user_id !== userId) {
      throw new Error('Only the project owner can update the project');
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.is_shared !== undefined) {
      fields.push('is_shared = ?');
      values.push(updates.is_shared ? 1 : 0);
    }

    if (fields.length === 0) {
      return project;
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE projects SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
    return this.getById(id);
  }

  /**
   * Delete a project
   */
  async delete(id: string, userId: number): Promise<boolean> {
    const project = this.getById(id);
    if (!project) return false;

    // Only owner can delete
    if (project.user_id !== userId) {
      throw new Error('Only the project owner can delete the project');
    }

    // Don't allow deleting the default project
    if (project.is_default) {
      throw new Error('Cannot delete the default project');
    }

    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes > 0) {
      // Delete project directory
      const projectDir = this.getProjectDir(id);
      try {
        await fs.rm(projectDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to delete project directory ${projectDir}:`, error);
      }
    }

    return result.changes > 0;
  }

  /**
   * Get user's default project
   */
  getDefaultByUserId(userId: number): Project | null {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      WHERE user_id = ? AND is_default = 1
      LIMIT 1
    `);
    const row = stmt.get(userId) as any;

    if (!row) return null;

    return {
      ...row,
      is_shared: row.is_shared === 1,
      is_default: row.is_default === 1,
    };
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

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
