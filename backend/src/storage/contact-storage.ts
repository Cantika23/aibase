/**
 * Contact storage service using SQLite
 * Stores end-users (contacts) in data/app/databases/contacts.db
 * Separate from System Users (users.db)
 */

import { Database } from "bun:sqlite";
import * as path from 'path';
import * as fs from 'fs/promises';
import { PATHS } from '../config/paths';
import { createLogger } from '../utils/logger';

const logger = createLogger('ContactStorage');

export type ContactChannel = 'whatsapp' | 'web' | 'embed';

export interface Contact {
  id: string; // Phone number or Session ID
  name: string; // PushName or 'Anonymous'
  channel: ContactChannel;
  last_active: number;
  metadata: Record<string, any>; // JSON storage for channel specifics
  created_at: number;
  updated_at: number;
}

export interface CreateContactData {
  id: string;
  name: string;
  channel: ContactChannel;
  metadata?: Record<string, any>;
}

export interface UpdateContactData {
  name?: string;
  last_active?: number;
  metadata?: Record<string, any>;
}

export class ContactStorage {
  private static instance: ContactStorage;
  private db: Database | null = null;
  private memoryCache: Map<string, Contact> = new Map(); // Simple cache for frequent lookups

  private constructor() {
    // Lazy init
  }

  private get dbPath(): string {
    return path.join(path.dirname(PATHS.USERS_DB), 'contacts.db');
  }

  private getDatabase(): Database {
    if (!this.db) {
      throw new Error('ContactStorage not initialized. Call initialize() first.');
    }
    return this.db;
  }

  static getInstance(): ContactStorage {
    if (!ContactStorage.instance) {
      ContactStorage.instance = new ContactStorage();
    }
    return ContactStorage.instance;
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    const dataDir = path.dirname(this.dbPath);
    await fs.mkdir(dataDir, { recursive: true });

    this.db = new Database(this.dbPath);

    // Create contacts table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        channel TEXT NOT NULL,
        last_active INTEGER NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Index for faster channel filtering
    this.db.run('CREATE INDEX IF NOT EXISTS idx_contacts_channel ON contacts(channel)');
    // Index for sorting by activity
    this.db.run('CREATE INDEX IF NOT EXISTS idx_contacts_last_active ON contacts(last_active DESC)');

    logger.info(`Database initialized at ${this.dbPath}`);
  }

  /**
   * Upsert a contact (Create or Update if exists)
   */
  async upsert(data: CreateContactData): Promise<Contact> {
    const now = Date.now();
    const db = this.getDatabase();

    const existing = this.getById(data.id);

    if (existing) {
        // Update
        const updates: string[] = ['updated_at = ?', 'last_active = ?'];
        const values: any[] = [now, now];

        if (data.name && data.name !== existing.name) {
            updates.push('name = ?');
            values.push(data.name);
        }

        // Merge metadata if provided
        if (data.metadata) {
            const mergedMeta = { ...existing.metadata, ...data.metadata };
            updates.push('metadata = ?');
            values.push(JSON.stringify(mergedMeta));
        }

        values.push(data.id);

        db.run(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, values);
        
        // Invalidate cache
        this.memoryCache.delete(data.id);
        
        return this.getById(data.id)!;

    } else {
        // Create
        const metadataStr = JSON.stringify(data.metadata || {});
        
        db.run(`
            INSERT INTO contacts (id, name, channel, last_active, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [data.id, data.name, data.channel, now, metadataStr, now, now]);

        const newContact = this.getById(data.id)!;
        return newContact;
    }
  }

  /**
   * Get contact by ID (Unique)
   */
  getById(id: string): Contact | null {
    if (this.memoryCache.has(id)) {
        return this.memoryCache.get(id)!;
    }

    const db = this.getDatabase();
    const stmt = db.prepare('SELECT * FROM contacts WHERE id = ?');
    const result = stmt.get(id) as any;

    if (!result) return null;

    const contact: Contact = {
        ...result,
        metadata: JSON.parse(result.metadata || '{}')
    };

    // Cache it
    this.memoryCache.set(id, contact);
    return contact;
  }

  /**
   * List contacts with pagination and filtering
   */
  list(channel?: ContactChannel, limit = 50, offset = 0): { contacts: Contact[], total: number } {
    const db = this.getDatabase();
    
    let query = 'SELECT * FROM contacts';
    let countQuery = 'SELECT COUNT(*) as count FROM contacts';
    const params: any[] = [];

    if (channel) {
        query += ' WHERE channel = ?';
        countQuery += ' WHERE channel = ?';
        params.push(channel);
    }

    query += ' ORDER BY last_active DESC LIMIT ? OFFSET ?';
    
    const countResult = db.prepare(countQuery).get(...params) as { count: number };
    const rows = db.prepare(query).all(...params, limit, offset) as any[];

    const contacts = rows.map(row => ({
        ...row,
        metadata: JSON.parse(row.metadata || '{}')
    }));

    return {
        contacts,
        total: countResult.count
    };
  }

  /**
   * Delete contact by ID
   */
  delete(id: string): void {
    const db = this.getDatabase();
    db.run('DELETE FROM contacts WHERE id = ?', [id]);
    this.memoryCache.delete(id);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
