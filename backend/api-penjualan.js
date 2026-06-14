/* ============================================
   CV EPIC Warehouse - Penjualan CRUD API
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