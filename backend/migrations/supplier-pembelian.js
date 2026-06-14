/* ============================================
   CV EPIC Warehouse - Supplier & Pembelian Migration
   Auto-runs on API startup to create tables
   Safe to run multiple times (idempotent)
   ============================================ */

import pool from "../services/db.js";

/**
 * Run supplier and pembelian migration
 * Creates tables and seeds default data if not exists
 */
export async function runSupplierPembelianMigration() {
  console.log("🔄 Running supplier & pembelian migration...");
  
  try {
    // Step 1: Create supplier table
    await createSupplierTable();
    
    // Step 2: Seed default supplier
    await seedDefaultSupplier();
    
    // Step 3: Create pembelian table
    await createPembelianTable();
    
    console.log("✅ Supplier & Pembelian migration completed successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ Migration failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create supplier table with all fields
 */
async function createSupplierTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS supplier (
      id SERIAL PRIMARY KEY,
      kode_supplier VARCHAR(20) UNIQUE,
      nama_supplier VARCHAR(255) NOT NULL,
      alamat TEXT,
      telepon VARCHAR(50),
      pic VARCHAR(100),
      status BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await pool.query(createTableSQL);
  console.log("  ✓ Table 'supplier' created/verified");

  // Create index for faster name lookups
  const createIndexSQL = `
    CREATE INDEX IF NOT EXISTS idx_supplier_nama 
    ON supplier(nama_supplier);
  `;
  
  await pool.query(createIndexSQL);
  console.log("  ✓ Index 'idx_supplier_nama' created/verified");
}

/**
 * Seed default supplier if table is empty
 */
async function seedDefaultSupplier() {
  // Check if any supplier exists
  const checkResult = await pool.query("SELECT COUNT(*) FROM supplier");
  const count = parseInt(checkResult.rows[0]?.count || 0, 10);
  
  if (count > 0) {
    console.log("  ✓ Supplier table already has data, skipping seed");
    return;
  }

  // Insert default supplier using INSERT...WHERE NOT EXISTS pattern
  const insertSQL = `
    INSERT INTO supplier (kode_supplier, nama_supplier, status)
    SELECT 'SUP001', 'SUPPLIER UMUM', TRUE
    WHERE NOT EXISTS (SELECT 1 FROM supplier);
  `;
  
  await pool.query(insertSQL);
  console.log("  ✓ Default supplier 'SUPPLIER UMUM' seeded");
}

/**
 * Create pembelian table with supplier reference
 */
async function createPembelianTable() {
  // First ensure supplier table exists
  await createSupplierTable();
  
  // Create pembelian table with supplier_id reference
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS pembelian (
      id SERIAL PRIMARY KEY,
      tanggal DATE NOT NULL,
      supplier_id INTEGER REFERENCES supplier(id),
      sku VARCHAR(50) NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await pool.query(createTableSQL);
  console.log("  ✓ Table 'pembelian' created/verified");

  // Create indexes
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_pembelian_tanggal ON pembelian(tanggal);",
    "CREATE INDEX IF NOT EXISTS idx_pembelian_supplier ON pembelian(supplier_id);",
    "CREATE INDEX IF NOT EXISTS idx_pembelian_sku ON pembelian(sku);"
  ];

  for (const indexSQL of indexes) {
    await pool.query(indexSQL);
  }
  console.log("  ✓ Pembelian indexes created/verified");
}

/**
 * Get supplier by ID
 */
export async function getSupplierById(id) {
  const result = await pool.query(
    "SELECT * FROM supplier WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get supplier by kode_supplier
 */
export async function getSupplierByKode(kode) {
  const result = await pool.query(
    "SELECT * FROM supplier WHERE kode_supplier = $1",
    [kode]
  );
  return result.rows[0] || null;
}

/**
 * Get or create supplier by name
 * Returns supplier ID
 */
export async function getOrCreateSupplier(namaSupplier) {
  if (!namaSupplier) {
    // Return default supplier (SUP001)
    const defaultSupplier = await getSupplierByKode('SUP001');
    return defaultSupplier?.id || null;
  }

  // Check if exists
  let supplier = await pool.query(
    "SELECT id FROM supplier WHERE nama_supplier = $1",
    [namaSupplier]
  );

  if (supplier.rows.length > 0) {
    return supplier.rows[0].id;
  }

  // Create new supplier
  // Generate kode_supplier
  const maxKode = await pool.query(
    "SELECT MAX(CAST(SUBSTRING(kode_supplier FROM 4) AS INTEGER)) as max_num FROM supplier WHERE kode_supplier LIKE 'SUP%'"
  );
  const nextNum = (parseInt(maxKode.rows[0]?.max_num || 0, 10) || 0) + 1;
  const kodeSupplier = `SUP${String(nextNum).padStart(3, '0')}`;

  const insertResult = await pool.query(
    `INSERT INTO supplier (kode_supplier, nama_supplier, status)
     VALUES ($1, $2, TRUE)
     RETURNING id`,
    [kodeSupplier, namaSupplier]
  );

  return insertResult.rows[0]?.id || null;
}

export default runSupplierPembelianMigration;