/* ============================================
   CV EPIC Warehouse - Supplier Master API
   CRUD operations for supplier master data
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

// Extract supplier ID from route path
function extractSupplierId(path) {
  const match = path.match(/^v1\/supplier\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Normalize route path
function normalizeRoute(routePath) {
  return routePath.replace(/^\/+/, '');
}

// ============================================
// GET /v1/supplier - List all suppliers
// ============================================
async function listSuppliers(req, res) {
  try {
    const { status, search } = req.query;
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Status filter
    if (status !== undefined) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status === 'true' || status === '1');
      paramIndex++;
    }

    // Search filter
    if (search) {
      whereConditions.push(`(
        nama_supplier ILIKE $${paramIndex} OR 
        kode_supplier ILIKE $${paramIndex} OR
        COALESCE(pic, '') ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}` 
      : "";

    const result = await pool.query(
      `SELECT id, kode_supplier, nama_supplier, alamat, telepon, pic, status, created_at
       FROM supplier
       ${whereClause}
       ORDER BY nama_supplier ASC`
    );

    return send(res, 200, {
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error listing suppliers:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data supplier" });
  }
}

// ============================================
// GET /v1/supplier/:id - Get single supplier
// ============================================
async function getSupplier(req, res, supplierId) {
  try {
    const result = await pool.query(
      `SELECT id, kode_supplier, nama_supplier, alamat, telepon, pic, status, created_at
       FROM supplier
       WHERE id = $1`,
      [supplierId]
    );

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "Supplier tidak ditemukan" });
    }

    return send(res, 200, { success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error getting supplier:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data supplier" });
  }
}

// ============================================
// POST /v1/supplier - Create new supplier
// ============================================
async function createSupplier(req, res) {
  const { kode_supplier, nama_supplier, alamat, telepon, pic, status } = req.body || {};

  // Validation
  if (!nama_supplier) {
    return send(res, 400, { success: false, message: "Nama supplier wajib diisi" });
  }

  try {
    // Check for duplicate kode_supplier if provided
    if (kode_supplier) {
      const kodeCheck = await pool.query(
        "SELECT id FROM supplier WHERE kode_supplier = $1",
        [kode_supplier]
      );
      if (kodeCheck.rows.length > 0) {
        return send(res, 400, { success: false, message: "Kode supplier sudah digunakan" });
      }
    }

    // Auto-generate kode_supplier if not provided
    let finalKode = kode_supplier;
    if (!finalKode) {
      const maxKode = await pool.query(
        "SELECT MAX(CAST(SUBSTRING(kode_supplier FROM 4) AS INTEGER)) as max_num FROM supplier WHERE kode_supplier LIKE 'SUP%'"
      );
      const nextNum = (parseInt(maxKode.rows[0]?.max_num || 0, 10) || 0) + 1;
      finalKode = `SUP${String(nextNum).padStart(3, '0')}`;
    }

    // Insert new supplier
    const result = await pool.query(
      `INSERT INTO supplier (kode_supplier, nama_supplier, alamat, telepon, pic, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [finalKode, nama_supplier, alamat || null, telepon || null, pic || null, status !== false]
    );

    return send(res, 201, {
      success: true,
      message: "Supplier berhasil ditambahkan",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating supplier:", error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return send(res, 400, { success: false, message: "Kode atau nama supplier sudah ada" });
    }
    
    return send(res, 500, { success: false, message: "Gagal membuat supplier" });
  }
}

// ============================================
// PUT /v1/supplier/:id - Update supplier
// ============================================
async function updateSupplier(req, res, supplierId) {
  const { kode_supplier, nama_supplier, alamat, telepon, pic, status } = req.body || {};

  // Validation
  if (!nama_supplier) {
    return send(res, 400, { success: false, message: "Nama supplier wajib diisi" });
  }

  try {
    // Check if exists
    const existingCheck = await pool.query("SELECT id FROM supplier WHERE id = $1", [supplierId]);
    if (existingCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Supplier tidak ditemukan" });
    }

    // Check for duplicate kode_supplier if changing
    if (kode_supplier) {
      const kodeCheck = await pool.query(
        "SELECT id FROM supplier WHERE kode_supplier = $1 AND id != $2",
        [kode_supplier, supplierId]
      );
      if (kodeCheck.rows.length > 0) {
        return send(res, 400, { success: false, message: "Kode supplier sudah digunakan" });
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (kode_supplier !== undefined) {
      updates.push(`kode_supplier = $${paramIndex}`);
      params.push(kode_supplier);
      paramIndex++;
    }

    updates.push(`nama_supplier = $${paramIndex}`);
    params.push(nama_supplier);
    paramIndex++;

    if (alamat !== undefined) {
      updates.push(`alamat = $${paramIndex}`);
      params.push(alamat);
      paramIndex++;
    }

    if (telepon !== undefined) {
      updates.push(`telepon = $${paramIndex}`);
      params.push(telepon);
      paramIndex++;
    }

    if (pic !== undefined) {
      updates.push(`pic = $${paramIndex}`);
      params.push(pic);
      paramIndex++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(Boolean(status));
      paramIndex++;
    }

    params.push(supplierId);
    
    await pool.query(
      `UPDATE supplier SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    // Get updated data
    const result = await pool.query(
      "SELECT * FROM supplier WHERE id = $1",
      [supplierId]
    );

    return send(res, 200, {
      success: true,
      message: "Supplier berhasil diupdate",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating supplier:", error);
    
    if (error.code === '23505') {
      return send(res, 400, { success: false, message: "Kode atau nama supplier sudah ada" });
    }
    
    return send(res, 500, { success: false, message: "Gagal mengupdate supplier" });
  }
}

// ============================================
// DELETE /v1/supplier/:id - Delete supplier
// ============================================
async function deleteSupplier(req, res, supplierId) {
  try {
    // Check if exists
    const existingCheck = await pool.query("SELECT id, kode_supplier FROM supplier WHERE id = $1", [supplierId]);
    if (existingCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Supplier tidak ditemukan" });
    }

    // Don't allow deleting SUP001 (default supplier)
    if (existingCheck.rows[0].kode_supplier === 'SUP001') {
      return send(res, 400, { success: false, message: "Tidak dapat menghapus supplier default" });
    }

    // Check if supplier has purchases
    const purchasesCheck = await pool.query(
      "SELECT COUNT(*) FROM pembelian WHERE supplier_id = $1",
      [supplierId]
    );
    
    if (parseInt(purchasesCheck.rows[0]?.count || 0, 10) > 0) {
      return send(res, 400, { 
        success: false, 
        message: "Tidak dapat menghapus supplier yang memiliki data pembelian. Nonaktifkan saja." 
      });
    }

    // Delete supplier
    await pool.query("DELETE FROM supplier WHERE id = $1", [supplierId]);

    return send(res, 200, { success: true, message: "Supplier berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return send(res, 500, { success: false, message: "Gagal menghapus supplier" });
  }
}

// ============================================
// Main Route Handler
// ============================================
export default async function apiSupplierHandler(req, res) {
  const routePath = getRoutePath(req);
  const normalizedPath = normalizeRoute(routePath);
  const method = req.method;
  const supplierId = req.params?.[0] ? parseInt(req.params[0], 10) : extractSupplierId(normalizedPath);

  // Route: GET /v1/supplier (list)
  if (method === "GET" && normalizedPath === "v1/supplier") {
    return listSuppliers(req, res);
  }

  // Route: GET /v1/supplier/:id
  if (method === "GET" && supplierId) {
    return getSupplier(req, res, supplierId);
  }

  // Route: POST /v1/supplier
  if (method === "POST" && normalizedPath === "v1/supplier") {
    return createSupplier(req, res);
  }

  // Route: PUT /v1/supplier/:id
  if (method === "PUT" && supplierId) {
    return updateSupplier(req, res, supplierId);
  }

  // Route: DELETE /v1/supplier/:id
  if (method === "DELETE" && supplierId) {
    return deleteSupplier(req, res, supplierId);
  }

  return send(res, 404, { success: false, message: `Route tidak ditemukan: ${method} ${routePath}` });
}