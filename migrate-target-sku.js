/**
 * Migration: Add target_sku column to stok_opname_perintah table
 * 
 * Usage: npm run migrate:target-sku
 * Or: node migrate-target-sku.js
 */

import pool from './services/db.js';

async function migrate() {
  console.log('Starting migration: Add target_sku column...');
  
  try {
    // Step 1: Add target_sku column if not exists
    console.log('Adding target_sku column...');
    await pool.query(`
      ALTER TABLE stok_opname_perintah 
      ADD COLUMN IF NOT EXISTS target_sku INTEGER DEFAULT 0
    `);
    console.log('✓ target_sku column added');

    // Step 2: Backfill existing rows with current product count
    console.log('Backfilling existing orders with product count...');
    const result = await pool.query(`
      UPDATE stok_opname_perintah
      SET target_sku = (
        SELECT COUNT(*) FROM produk
      )
      WHERE target_sku = 0 OR target_sku IS NULL
      RETURNING id, kode_so, target_sku
    `);
    console.log(`✓ Backfilled ${result.rowCount} orders`);
    
    if (result.rows.length > 0) {
      console.log('Updated orders:');
      result.rows.forEach(row => {
        console.log(`  - ${row.kode_so}: target_sku = ${row.target_sku}`);
      });
    }

    // Step 3: Verify
    const verify = await pool.query(`SELECT COUNT(*) as total FROM stok_opname_perintah WHERE target_sku > 0`);
    console.log(`✓ Total orders with target_sku: ${verify.rows[0].total}`);

    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
