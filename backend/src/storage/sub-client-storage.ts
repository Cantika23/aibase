/**
 * Sub-client storage service using SQLite
 * Stores sub-clients in data/app/databases/projects.db (same as projects)
 */

import { Database } from "bun:sqlite";
import * as path from 'path';
import * as fs from 'fs/promises';
import { PATHS, getSubClientDir, getSubClientConversationsDir, getSubClientWhatsAppDir, getSubClientFilesDir } from '../config/paths';
import { createLogger } from '../utils/logger';

const logger = createLogger('SubClientStorage');

export type SubClientUserRole = 'admin' | 'user';

export interface SubClient {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  whatsapp_client_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface SubClientUser {
  id: number;
  sub_client_id: string;
  user_id: number;
  role: SubClientUserRole;
  created_at: number;
}

export interface SubClientWithUsers extends SubClient {
  users: {
    id: number;
    username: string;
    email: string;
    role: SubClientUserRole;
  }[];
}

export interface CreateSubClientData {
  project_id: string;
  name: string;
  description?: string;
  whatsapp_client_id?: string;
}

export interface UpdateSubClientData {
  name?: string;
  description?: string;
  whatsapp_client_id?: string | null;
}

export class SubClientStorage {
  private static instance: SubClientStorage;
  private db!: Database;
  private dbPath: string;

  private constructor() {
    this.dbPath = PATHS.PROJECTS_DB;
  }

  static getInstance(): SubClientStorage {
    if (!SubClientStorage.instance) {
      SubClientStorage.instance = new SubClientStorage();
    }
    return SubClientStorage.instance;
  }

  /**
   * Initialize the database connection
   * Note: Tables are created by ProjectStorage
   */
  async initialize(): Promise<void> {
    // Ensure data directory exists
    await fs.mkdir(PATHS.APP_DATABASES, { recursive: true });

    // Open database
    this.db = new Database(this.dbPath);

    logger.info(`SubClientStorage initialized at ${this.dbPath}`);
  }

  /**
   * Generate unique sub-client ID
   */
  private generateId(): string {
    const timestamp = Date.now();
    return `scl_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new sub-client
   */
  async create(data: CreateSubClientData): Promise<SubClient> {
    const now = Date.now();
    const id = this.generateId();

    const stmt = this.db.prepare(`
      INSERT INTO sub_clients (id, project_id, name, description, whatsapp_client_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.project_id,
      data.name,
      data.description ?? null,
      data.whatsapp_client_id ?? null,
      now,
      now
    );

    // Create sub-client directories
    const tenantId = 'default'; // Will be updated when we have the project info
    await fs.mkdir(getSubClientDir(id, id, tenantId), { recursive: true });

    const subClient = this.getById(id);
    if (!subClient) {
      throw new Error('Failed to create sub-client');
    }

    logger.info(`Created sub-client: ${subClient.name} (${subClient.id}) for project ${data.project_id}`);
    return subClient;
  }

  /**
   * Get sub-client by ID
   */
  getById(id: string): SubClient | null {
    const stmt = this.db.prepare('SELECT * FROM sub_clients WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      whatsapp_client_id: row.whatsapp_client_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Get sub-client with users
   */
  getByIdWithUsers(id: string): SubClientWithUsers | null {
    const subClient = this.getById(id);
    if (!subClient) return null;

    const users = this.getUsers(id);

    return {
      ...subClient,
      users,
    };
  }

  /**
   * Get all sub-clients for a project
   */
  getByProjectId(projectId: string): SubClient[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sub_clients 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(projectId) as any[];

    return rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      whatsapp_client_id: row.whatsapp_client_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Get all sub-clients for a project with users
   */
  getByProjectIdWithUsers(projectId: string): SubClientWithUsers[] {
    const subClients = this.getByProjectId(projectId);

    return subClients.map(sc => {
      const users = this.getUsers(sc.id);
      return { ...sc, users };
    });
  }

  /**
   * Get sub-clients where a user is assigned
   */
  getByUserId(userId: number): SubClient[] {
    const stmt = this.db.prepare(`
      SELECT sc.* FROM sub_clients sc
      INNER JOIN sub_client_users scu ON sc.id = scu.sub_client_id
      WHERE scu.user_id = ?
      ORDER BY sc.created_at DESC
    `);
    const rows = stmt.all(userId) as any[];

    return rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      whatsapp_client_id: row.whatsapp_client_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Update a sub-client
   */
  async update(id: string, updates: UpdateSubClientData): Promise<SubClient | null> {
    const subClient = this.getById(id);
    if (!subClient) return null;

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
    if (updates.whatsapp_client_id !== undefined) {
      fields.push('whatsapp_client_id = ?');
      values.push(updates.whatsapp_client_id);
    }

    if (fields.length === 0) {
      return subClient;
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE sub_clients SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
    return this.getById(id);
  }

  /**
   * Delete a sub-client
   */
  async delete(id: string): Promise<boolean> {
    const subClient = this.getById(id);
    if (!subClient) return false;

    const stmt = this.db.prepare('DELETE FROM sub_clients WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes > 0) {
      // Delete sub-client directories
      try {
        const tenantId = 'default'; // We need to get this from the project
        const subClientDir = getSubClientDir(subClient.project_id, id, tenantId);
        await fs.rm(subClientDir, { recursive: true, force: true });
        logger.info(`Deleted sub-client directory: ${subClientDir}`);
      } catch (error) {
        logger.warn({ error }, `Failed to delete sub-client directory for ${id}`);
      }
    }

    return result.changes > 0;
  }

  /**
   * Add a user to a sub-client
   */
  async addUser(subClientId: string, userId: number, role: SubClientUserRole = 'user'): Promise<SubClientUser> {
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO sub_client_users (sub_client_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(subClientId, userId, role, now);
      const user = this.getSubClientUser(result.lastInsertRowid as number);

      if (!user) {
        throw new Error('Failed to add user to sub-client');
      }

      logger.info(`Added user ${userId} to sub-client ${subClientId} with role ${role}`);
      return user;
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        throw new Error('User is already assigned to this sub-client');
      }
      throw error;
    }
  }

  /**
   * Get a sub-client user by ID
   */
  private getSubClientUser(id: number): SubClientUser | null {
    const stmt = this.db.prepare('SELECT * FROM sub_client_users WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      sub_client_id: row.sub_client_id,
      user_id: row.user_id,
      role: row.role,
      created_at: row.created_at,
    };
  }

  /**
   * Get all users for a sub-client
   */
  getUsers(subClientId: string): { id: number; username: string; email: string; role: SubClientUserRole }[] {
    const stmt = this.db.prepare(`
      SELECT u.id, u.username, u.email, scu.role
      FROM users u
      INNER JOIN sub_client_users scu ON u.id = scu.user_id
      WHERE scu.sub_client_id = ?
      ORDER BY u.username
    `);
    return stmt.all(subClientId) as any[];
  }

  /**
   * Update user role in sub-client
   */
  async updateUserRole(subClientId: string, userId: number, role: SubClientUserRole): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE sub_client_users 
      SET role = ? 
      WHERE sub_client_id = ? AND user_id = ?
    `);

    const result = stmt.run(role, subClientId, userId);
    return result.changes > 0;
  }

  /**
   * Remove a user from a sub-client
   */
  async removeUser(subClientId: string, userId: number): Promise<boolean> {
    const stmt = this.db.prepare(`
      DELETE FROM sub_client_users 
      WHERE sub_client_id = ? AND user_id = ?
    `);

    const result = stmt.run(subClientId, userId);
    return result.changes > 0;
  }

  /**
   * Check if a user is assigned to a sub-client
   */
  isUserAssigned(subClientId: string, userId: number): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sub_client_users
      WHERE sub_client_id = ? AND user_id = ?
    `);
    const result = stmt.get(subClientId, userId) as { count: number };
    return result.count > 0;
  }

  /**
   * Get user's role in a sub-client
   */
  getUserRole(subClientId: string, userId: number): SubClientUserRole | null {
    const stmt = this.db.prepare(`
      SELECT role FROM sub_client_users
      WHERE sub_client_id = ? AND user_id = ?
    `);
    const result = stmt.get(subClientId, userId) as { role: SubClientUserRole } | undefined;
    return result?.role ?? null;
  }

  /**
   * Get sub-client directories
   */
  getDirectories(subClientId: string, projectId: string, tenantId: number | string) {
    return {
      base: getSubClientDir(projectId, subClientId, tenantId),
      conversations: getSubClientConversationsDir(projectId, subClientId, tenantId),
      whatsapp: getSubClientWhatsAppDir(projectId, subClientId, tenantId),
      files: getSubClientFilesDir(projectId, subClientId, tenantId),
    };
  }

  /**
   * Ensure sub-client directories exist
   */
  async ensureDirectories(subClientId: string, projectId: string, tenantId: number | string): Promise<void> {
    const dirs = this.getDirectories(subClientId, projectId, tenantId);

    for (const dir of Object.values(dirs)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
