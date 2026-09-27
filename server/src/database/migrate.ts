/**
 * Database Migration Runner
 * Applies .sql migrations sequentially and tracks applied versions.
 */

import fs from 'fs';
import path from 'path';
import { db } from './index.ts';

export async function runMigrations(): Promise<void> {
  console.log('🔄 Checking database migrations...');
  await db.waitReady();

  // Create migrations tracker table
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationsDir = path.resolve(import.meta.dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found at', migrationsDir);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const check = await db.query(
      'SELECT id FROM schema_migrations WHERE name = $1',
      [file]
    );

    if (check.rows.length === 0) {
      console.log(`⏳ Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Execute multi-statement migration script
      await db.exec(sql);

      // Record applied migration
      await db.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [file]
      );

      console.log(`✅ Applied migration: ${file}`);
    } else {
      // Already applied
    }
  }

  console.log('✨ All database migrations are up to date.');
}

// Standalone execution support
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => {
      console.log('Migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
