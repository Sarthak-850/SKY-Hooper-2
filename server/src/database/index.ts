/**
 * Database Connection & Query Engine
 * 
 * Supports both:
 * 1. Production PostgreSQL via standard 'pg' Pool (when DATABASE_URL is set)
 * 2. Embedded PostgreSQL via '@electric-sql/pglite' (when running locally or in tests)
 * 
 * Both use authentic PostgreSQL SQL syntax, indexes, and constraints.
 */

import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.ts';

export interface DbQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<DbQueryResult<T>>;
}

class DatabaseManager {
  private pgPool: pg.Pool | null = null;
  private pglite: PGlite | null = null;
  private isPgLite: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    if (config.databaseUrl) {
      console.log('📡 Connecting to PostgreSQL server via DATABASE_URL...');
      this.pgPool = new pg.Pool({
        connectionString: config.databaseUrl,
        ssl: config.isProduction ? { rejectUnauthorized: false } : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      try {
        const res = await this.pgPool.query('SELECT NOW() AS current_time');
        console.log('✅ Connected to PostgreSQL database at:', res.rows[0].current_time);
        this.isPgLite = false;
        return;
      } catch (err) {
        console.warn('⚠️ Could not connect to DATABASE_URL, falling back to embedded PGlite:', (err as Error).message);
        if (this.pgPool) {
          await this.pgPool.end().catch(() => {});
          this.pgPool = null;
        }
      }
    }

    // Fallback to embedded PGlite
    const pglitePath = config.pgliteDir;
    if (!fs.existsSync(pglitePath)) {
      fs.mkdirSync(pglitePath, { recursive: true });
    }
    console.log(`📦 Using embedded PostgreSQL engine (PGlite) at: ${pglitePath}`);
    this.pglite = new PGlite(pglitePath);
    await this.pglite.waitReady;
    this.isPgLite = true;
    console.log('✅ Embedded PostgreSQL engine initialized.');
  }

  public async waitReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<DbQueryResult<T>> {
    await this.waitReady();

    if (this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    }

    if (this.pglite) {
      const res = await this.pglite.query(sql, params);
      return {
        rows: (res.rows || []) as T[],
        rowCount: res.affectedRows ?? (res.rows ? res.rows.length : 0),
      };
    }

    throw new Error('Database engine not initialized');
  }

  public async transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
    await this.waitReady();

    if (this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const wrapped: DbClient = {
          query: async <R>(sql: string, params?: any[]) => {
            const r = await client.query(sql, params);
            return { rows: r.rows as R[], rowCount: r.rowCount ?? r.rows.length };
          },
        };
        const result = await callback(wrapped);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (this.pglite) {
      return await this.pglite.transaction(async (tx) => {
        const wrapped: DbClient = {
          query: async <R>(sql: string, params?: any[]) => {
            const r = await tx.query(sql, params);
            return { rows: (r.rows || []) as R[], rowCount: r.affectedRows ?? (r.rows ? r.rows.length : 0) };
          },
        };
        return await callback(wrapped);
      });
    }

    throw new Error('Database engine not initialized');
  }

  public async exec(sql: string): Promise<void> {
    await this.waitReady();

    if (this.pgPool) {
      await this.pgPool.query(sql);
      return;
    }

    if (this.pglite) {
      await this.pglite.exec(sql);
      return;
    }

    throw new Error('Database engine not initialized');
  }

  public async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    if (this.pglite) {
      await this.pglite.close();
      this.pglite = null;
    }
  }

  public isUsingPgLite(): boolean {
    return this.isPgLite;
  }
}

export const db = new DatabaseManager();
