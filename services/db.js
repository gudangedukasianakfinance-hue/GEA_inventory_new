import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ DATABASE_URL belum di-set. API database akan gagal sampai env tersedia.");
  console.warn("   Untuk Vercel: Tambahkan DATABASE_URL di Settings → Environment Variables");
}

// Helper to check if database is configured
export function isDatabaseConfigured() {
  return Boolean(connectionString);
}

// Health check function
export async function checkDatabaseHealth() {
  if (!connectionString) {
    return { healthy: false, error: "DATABASE_URL not set" };
  }
  try {
    const testPool = new Pool({ connectionString, max: 1 });
    const result = await testPool.query("SELECT 1 as health");
    await testPool.end();
    return { healthy: true, latency: result.rows[0] };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

const globalPool = globalThis.__epicWarehousePool;

const pool = globalPool || new Pool({
  connectionString,
  ssl: connectionString
    ? { rejectUnauthorized: false }
    : false,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000
});

if (!globalPool) {
  globalThis.__epicWarehousePool = pool;
}

// Helper function to run queries
export async function query(text, params) {
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  return await pool.query(text, params);
}

export default pool;
