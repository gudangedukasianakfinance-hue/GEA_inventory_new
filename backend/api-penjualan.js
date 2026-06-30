/* ============================================
   PT. GEA Warehouse - Penjualan CRUD API
   Sprint 1 Backend - Sales/Transaction API
   ============================================ */

import pool from "../services/db.js";

// Helper to send JSON responses
function send(res, status, payload) {
  return res.status(status).json(payload);
}

// Parse route path from request
function getRoutePath(req) {
  if (req.query?.route) {
    return "/" + String(req.query.route).replace(/^\/+/, "");
  }
  const url = new URL(req.url, "http://localhost");
  return url.pathname.replace(/^\/api/, "") || "/";
}

// Extract penjualan ID from route path
function extractPenjualanId(path) {
  const match = path.match(/^v1\/penjualan\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Normalize route path
function normalizeRoute(routePath) {
  return routePath.replace(/^\/+/, '');
}

// ============================================
// GET /v1/penjualan - List all penjualan
// ============================================
async function listPenjualan(req, res) {
  try {
    const page = parseInt(req.query?.page) || 1;
    const limit = Math.min(parseInt(req.query?.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const tanggalAwal = req.query?.tanggal_awal;
    const tanggalAkhir = req.query?.tanggal_akhir;
    const outlet = req.query?.outlet;
    const sku = req.query?.sku;
    const search = req.query?.search;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Date range filter
    if (tanggalAwal) {
      whereConditions.push(`p.tanggal >= $${paramIndex}`);
      params.push(tanggalAwal);
      paramIndex++;
    }

    if (tanggalAkhir) {
      whereConditions.push(`p.tanggal <= $${paramIndex}`);
      params.push(tanggalAkhir);
      paramIndex++;
    }

    // Outlet filter
    if (outlet) {
      whereConditions.push(`p.nama_outlet ILIKE $${paramIndex}`);
      params.push(`%${outlet}%`);
      paramIndex++;
    }

    // SKU filter
    if (sku) {
      whereConditions.push(`p.sku = $${paramIndex}`);
      params.push(sku);
      paramIndex++;
    }

    // Search filter (tanggal, outlet, or sku)
    if (search) {
      whereConditions.push(`(
        CAST(p.tanggal AS TEXT) ILIKE $${paramIndex} OR 
        p.nama_outlet ILIKE $${paramIndex} OR 
        p.sku ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}` 
      : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM penjualan p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Get summary totals (qty and nominal) for all filtered data
    const summaryResult = await pool.query(
      `SELECT 
        COUNT(*) as total_transaksi,
        COALESCE(SUM(p.qty), 0) as total_qty,
        COALESCE(SUM(p.qty * pr.harga_jual), 0) as total_nominal
       FROM penjualan p
       LEFT JOIN produk pr ON pr.sku = p.sku
       ${whereClause}`,
      params
    );
    const summary = summaryResult.rows[0] || {};

    // Get penjualan with product info and calculated nominal
    const dataResult = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.nama_outlet,
        p.sku,
        p.qty,
        pr.nama_produk,
        pr.harga_jual,
        (p.qty * pr.harga_jual) as nominal,
        p.created_at
       FROM penjualan p
       LEFT JOIN produk pr ON pr.sku = p.sku
       ${whereClause}
       ORDER BY p.tanggal DESC, p.id DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return send(res, 200, {
      success: true,
      data: dataResult.rows,
      summary: {
        total_transaksi: parseInt(summary.total_transaksi || 0, 10),
        total_qty: parseInt(summary.total_qty || 0, 10),
        total_nominal: parseFloat(summary.total_nominal || 0)
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error listing penjualan:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data penjualan" });
  }
}

// ============================================
// GET /v1/penjualan/:id - Get single penjualan
// ============================================
async function getPenjualan(req, res, penjualanId) {
  try {
    const result = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.nama_outlet,
        p.sku,
        p.qty,
        pr.nama_produk,
        pr.harga_jual,
        (p.qty * pr.harga_jual) as nominal,
        p.created_at
       FROM penjualan p
       LEFT JOIN produk pr ON pr.sku = p.sku
       WHERE p.id = $1`,
      [penjualanId]
    );

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "Penjualan tidak ditemukan" });
    }

    return send(res, 200, { success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error getting penjualan:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data penjualan" });
  }
}

// ============================================
// POST /v1/penjualan - Create new penjualan
// ============================================
async function createPenjualan(req, res) {
  const { tanggal, nama_outlet, sku, qty } = req.body || {};

  // Validation
  if (!tanggal) {
    return send(res, 400, { success: false, message: "Tanggal wajib diisi" });
  }

  if (!nama_outlet) {
    return send(res, 400, { success: false, message: "Nama outlet wajib diisi" });
  }

  if (!sku) {
    return send(res, 400, { success: false, message: "SKU produk wajib diisi" });
  }

  if (!qty || qty <= 0) {
    return send(res, 400, { success: false, message: "Qty harus lebih dari 0" });
  }

  try {
    // Check if SKU exists
    const produkCheck = await pool.query("SELECT sku FROM produk WHERE sku = $1", [sku]);
    if (produkCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "SKU tidak ditemukan di master produk" });
    }

    // Check if outlet exists in master outlet table
    const outletCheck = await pool.query("SELECT nama_outlet FROM outlet WHERE nama_outlet = $1", [nama_outlet]);
    if (outletCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Nama outlet tidak ditemukan di master outlet. Gunakan nama outlet yang valid." });
    }

    // Insert new penjualan
    const result = await pool.query(
      `INSERT INTO penjualan (tanggal, nama_outlet, sku, qty, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, tanggal, nama_outlet, sku, qty, created_at`,
      [tanggal, nama_outlet, sku, qty]
    );

    // Get full data with product info
    const fullResult = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.nama_outlet,
        p.sku,
        p.qty,
        pr.nama_produk,
        pr.harga_jual,
        (p.qty * pr.harga_jual) as nominal,
        p.created_at
       FROM penjualan p
       LEFT JOIN produk pr ON pr.sku = p.sku
       WHERE p.id = $1`,
      [result.rows[0].id]
    );

    return send(res, 201, {
      success: true,
      message: "Penjualan berhasil ditambahkan",
      data: fullResult.rows[0]
    });
  } catch (error) {
    console.error("Error creating penjualan:", error);
    return send(res, 500, { success: false, message: "Gagal membuat penjualan" });
  }
}

// ============================================
// PUT /v1/penjualan/:id - Update penjualan
// ============================================
async function updatePenjualan(req, res, penjualanId) {
  const { tanggal, nama_outlet, sku, qty } = req.body || {};

  // Validation for qty if provided
  if (qty !== undefined && qty !== null && qty <= 0) {
    return send(res, 400, { success: false, message: "Qty harus lebih dari 0" });
  }

  // Validation for sku if provided
  if (sku !== undefined && sku !== null && sku !== "") {
    const produkCheck = await pool.query("SELECT sku FROM produk WHERE sku = $1", [sku]);
    if (produkCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "SKU tidak ditemukan di master produk" });
    }
  }

  // Validation for nama_outlet if provided
  if (nama_outlet !== undefined && nama_outlet !== null && nama_outlet !== "") {
    const outletCheck = await pool.query("SELECT nama_outlet FROM outlet WHERE nama_outlet = $1", [nama_outlet]);
    if (outletCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Nama outlet tidak ditemukan di master outlet. Gunakan nama outlet yang valid." });
    }
  }

  try {
    // Check if penjualan exists
    const existingCheck = await pool.query("SELECT id FROM penjualan WHERE id = $1", [penjualanId]);
    if (existingCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Penjualan tidak ditemukan" });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (tanggal !== undefined) {
      updates.push(`tanggal = $${paramIndex}`);
      params.push(tanggal);
      paramIndex++;
    }

    if (nama_outlet !== undefined) {
      updates.push(`nama_outlet = $${paramIndex}`);
      params.push(nama_outlet);
      paramIndex++;
    }

    if (sku !== undefined && sku !== "") {
      updates.push(`sku = $${paramIndex}`);
      params.push(sku);
      paramIndex++;
    }

    if (qty !== undefined && qty !== null) {
      updates.push(`qty = $${paramIndex}`);
      params.push(qty);
      paramIndex++;
    }

    if (updates.length === 0) {
      return send(res, 400, { success: false, message: "Tidak ada data yang diupdate" });
    }

    // Execute update
    params.push(penjualanId);
    await pool.query(
      `UPDATE penjualan SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    // Get updated data with product info
    const result = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.nama_outlet,
        p.sku,
        p.qty,
        pr.nama_produk,
        pr.harga_jual,
        (p.qty * pr.harga_jual) as nominal,
        p.created_at
       FROM penjualan p
       LEFT JOIN produk pr ON pr.sku = p.sku
       WHERE p.id = $1`,
      [penjualanId]
    );

    return send(res, 200, {
      success: true,
      message: "Penjualan berhasil diupdate",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating penjualan:", error);
    return send(res, 500, { success: false, message: "Gagal mengupdate penjualan" });
  }
}

// ============================================
// DELETE /v1/penjualan/:id - Delete penjualan
// ============================================
async function deletePenjualan(req, res, penjualanId) {
  try {
    // Check if penjualan exists
    const existingCheck = await pool.query("SELECT id FROM penjualan WHERE id = $1", [penjualanId]);
    if (existingCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Penjualan tidak ditemukan" });
    }

    // Hard delete (no deleted_at column exists)
    await pool.query("DELETE FROM penjualan WHERE id = $1", [penjualanId]);

    return send(res, 200, { success: true, message: "Penjualan berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting penjualan:", error);
    return send(res, 500, { success: false, message: "Gagal menghapus penjualan" });
  }
}

// ============================================
// POST /v1/penjualan/import - Import penjualan from CSV/Excel
// ============================================
async function importPenjualan(req, res) {
  try {
    // Parse body - expects { data: [[tanggal, nama_outlet, sku, qty], ...] }
    const { data } = req.body || {};

    if (!data || !Array.isArray(data) || data.length === 0) {
      return send(res, 400, { 
        success: false, 
        message: "Data tidak ditemukan. Pastikan file Excel/CSV sudah benar." 
      });
    }

    // Load master data for validation
    const [produkResult, outletResult] = await Promise.all([
      pool.query("SELECT sku FROM produk"),
      pool.query("SELECT nama_outlet FROM outlet")
    ]);

    const validSkuSet = new Set(produkResult.rows.map(r => r.sku));
    const validOutletSet = new Set(outletResult.rows.map(r => r.nama_outlet));

    // Validate all rows first
    const errors = [];
    const validRows = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row (1 = header, data starts at 2)

      // Expected: [tanggal, nama_outlet, sku, qty]
      const tanggal = row[0] ? String(row[0]).trim() : "";
      const nama_outlet = row[1] ? String(row[1]).trim() : "";
      const sku = row[2] ? String(row[2]).trim() : "";
      const qty = row[3] !== undefined ? parseInt(row[3]) : 0;

      // Validation
      if (!tanggal) {
        errors.push({ row: rowNum, message: `Tanggal wajib diisi` });
        continue;
      }

      if (!nama_outlet) {
        errors.push({ row: rowNum, message: `Nama outlet wajib diisi` });
        continue;
      }

      if (!sku) {
        errors.push({ row: rowNum, message: `SKU wajib diisi` });
        continue;
      }

      if (qty <= 0) {
        errors.push({ row: rowNum, message: `Qty harus lebih dari 0` });
        continue;
      }

      // Check SKU exists
      if (!validSkuSet.has(sku)) {
        errors.push({ row: rowNum, message: `SKU "${sku}" tidak ditemukan di master produk` });
        continue;
      }

      // Check outlet exists
      if (!validOutletSet.has(nama_outlet)) {
        errors.push({ row: rowNum, message: `Outlet "${nama_outlet}" tidak ditemukan di master outlet` });
        continue;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(tanggal)) {
        errors.push({ row: rowNum, message: `Format tanggal salah. Gunakan format: YYYY-MM-DD` });
        continue;
      }

      validRows.push({ tanggal, nama_outlet, sku, qty });
    }

    // If any errors, return them without importing
    if (errors.length > 0) {
      return send(res, 400, {
        success: false,
        message: "Terdapat error pada data. Silakan perbaiki dan upload ulang.",
        errors: errors.slice(0, 50), // Limit to 50 errors
        summary: {
          total_rows: data.length,
          valid_rows: validRows.length,
          error_rows: errors.length
        }
      });
    }

    // All valid - perform bulk insert
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let importedCount = 0;
      for (const row of validRows) {
        await client.query(
          `INSERT INTO penjualan (tanggal, nama_outlet, sku, qty, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [row.tanggal, row.nama_outlet, row.sku, row.qty]
        );
        importedCount++;
      }

      await client.query('COMMIT');

      return send(res, 201, {
        success: true,
        message: `Berhasil import ${importedCount} data penjualan`,
        summary: {
          total_rows: data.length,
          valid_rows: validRows.length,
          imported: importedCount
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error importing penjualan:", error);
    return send(res, 500, { success: false, message: "Gagal import data penjualan" });
  }
}

// ============================================
// Main Route Handler
// ============================================
export default async function apiPenjualanHandler(req, res) {
  const routePath = getRoutePath(req);
  const normalizedPath = normalizeRoute(routePath);
  const method = req.method;
  const penjualanId = req.params?.[0] ? parseInt(req.params[0], 10) : extractPenjualanId(normalizedPath);

  // Route: GET /v1/penjualan
  if (method === "GET" && normalizedPath === "v1/penjualan") {
    return listPenjualan(req, res);
  }

  // Route: POST /v1/penjualan
  if (method === "POST" && normalizedPath === "v1/penjualan") {
    return createPenjualan(req, res);
  }

  // Route: POST /v1/penjualan/import
  if (method === "POST" && normalizedPath === "v1/penjualan/import") {
    return importPenjualan(req, res);
  }

  // Route: GET /v1/penjualan/:id
  if (method === "GET" && penjualanId) {
    return getPenjualan(req, res, penjualanId);
  }

  // Route: PUT /v1/penjualan/:id
  if (method === "PUT" && penjualanId) {
    return updatePenjualan(req, res, penjualanId);
  }

  // Route: DELETE /v1/penjualan/:id
  if (method === "DELETE" && penjualanId) {
    return deletePenjualan(req, res, penjualanId);
  }

  return send(res, 404, { success: false, message: `Route tidak ditemukan: ${method} ${routePath}` });
}