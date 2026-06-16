/**
 * Run migrations for SO module
 * Usage: node run-migrations.js
 */

import pool from './services/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  try {
    // Get all SQL files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${files.length} migration file(s)`);
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`\nRunning migration: ${file}`);
      await pool.query(sql);
      console.log(`✓ Completed: ${file}`);
    }
    
    console.log('\n✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations();