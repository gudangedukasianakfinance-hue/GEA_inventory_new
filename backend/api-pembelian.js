/* ============================================
   PT. GEA Warehouse - Pembelian CRUD API
   Sprint 2 - Purchase/Transaction API
   Pattern: Follow Penjualan API structure
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

// Extract pembelian ID from route path
function extractPembelianId(path) {
  const match = path.match(/^v1\/pembelian\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Normalize route path
function normalizeRoute(routePath) {
  return routePath.replace(/^\/+/, '');
}

// ============================================
// GET /v1/pembelian - List all pembelian with server-side pagination
// ============================================
async function listPembelian(req, res) {
  try {
    const page = parseInt(req.query?.page) || 1;
    const limit = Math.min(parseInt(req.query?.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const tanggalAwal = req.query?.tanggal_awal;
    const tanggalAkhir = req.query?.tanggal_akhir;
    const supplier = req.query?.supplier;
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

    // Supplier filter - check both supplier name and supplier_id
    if (supplier) {
      whereConditions.push(`(
        s.nama_supplier ILIKE $${paramIndex} OR 
        s.kode_supplier ILIKE $${paramIndex} OR
        CAST(p.supplier_id AS TEXT) = $${paramIndex}
      )`);
      params.push(`%${supplier}%`);
      paramIndex++;
    }

    // SKU filter
    if (sku) {
      whereConditions.push(`p.sku = $${paramIndex}`);
      params.push(sku);
      paramIndex++;
    }

    // Search filter (tanggal, supplier, or sku)
    if (search) {
      whereConditions.push(`(
        CAST(p.tanggal AS TEXT) ILIKE $${paramIndex} OR 
        COALESCE(s.nama_supplier, '') ILIKE $${paramIndex} OR 
        p.sku ILIKE $${paramIndex} OR
        COALESCE(pr.nama_produk, '') ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}` 
      : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM pembelian p
       LEFT JOIN supplier s ON s.id = p.supplier_id
       LEFT JOIN produk pr ON pr.sku = p.sku
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Get summary data (for stats cards) - same filters but without pagination
    const summaryResult = await pool.query(
      `SELECT 
        COUNT(*) as total_transaksi,
        COALESCE(SUM(p.qty), 0) as total_qty,
        COALESCE(SUM(p.qty * COALESCE(pr.harga_beli, 0)), 0) as total_nominal
       FROM pembelian p
       LEFT JOIN supplier s ON s.id = p.supplier_id
       LEFT JOIN produk pr ON pr.sku = p.sku
       ${whereClause}`,
      params
    );

    // Get pembelian with product and supplier info and calculated nominal
    const dataResult = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.supplier_id,
        COALESCE(s.kode_supplier, '') as kode_supplier,
        COALESCE(s.nama_supplier, 'Tanpa Supplier') as nama_supplier,
        p.sku,
        p.qty,
        pr.nama_produk,
        pr.harga_beli,
        (p.qty * COALESCE(pr.harga_beli, 0)) as nominal,
        p.created_at
       FROM pembelian p
       LEFT JOIN supplier s ON s.id = p.supplier_id
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
        total_transaksi: parseInt(summaryResult.rows[0]?.total_transaksi || 0, 10),
        total_qty: parseInt(summaryResult.rows[0]?.total_qty || 0, 10),
        total_nominal: parseFloat(summaryResult.rows[0]?.total_nominal || 0)
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error listing pembelian:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data pembelian" });
  }
}

// ============================================
// GET /v1/pembelian/:id - Get single pembelian
// ============================================
async function getPembelian(req, res, pembelianId) {
  try {
    const result = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.supplier_id,
        COALESCE(s.kode_supplier, '') as kode_supplier,
        COALESCE(s.nama_supplier, 'Tanpa Supplier') as nama_supplier,
        p.sku,
        p.qty,
        pr.nama_produk,
        pr.harga_beli,
        (p.qty * COALESCE(pr.harga_beli, 0)) as nominal,
        p.created_at
       FROM pembelian p
       LEFT JOIN supplier s ON s.id = p.supplier_id
       LEFT JOIN produk pr ON pr.sku = p.sku
       WHERE p.id = $1`,
      [pembelianId]
    );

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "Pembelian tidak ditemukan" });
    }

    return send(res, 200, { success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error getting pembelian:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data pembelian" });
  }
}

// ============================================
// POST /v1/pembelian - Create new pembelian
// ============================================
async function createPembelian(req, res) {
  const { tanggal, supplier_id, sku, qty } = req.body || {};

  // Validation
  if (!tanggal) {
    return send(res, 400, { success: false, message: "Tanggal wajib diisi" });
  }

  if (!sku) {
    return send(res, 400, { success: false, message: "SKU produk wajib diisi" });
  }

  if (!qty || qty <= 0) {
    return send(res, 400, { success: false, message: "Qty harus lebih dari 0" });
  }

  try {
    // Check if SKU exists
    const produkCheck = await pool.query("SELECT sku, nama_produk, harga_beli FROM produk WHERE sku = $1", [sku]);
    if (produkCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "SKU tidak ditemukan di master produk" });
    }

    // If supplier_id provided, validate it exists
    if (supplier_id) {
      const supplierCheck = await pool.query("SELECT id, nama_supplier FROM supplier WHERE id = $1", [supplier_id]);
      if (supplierCheck.rows.length === 0) {
        return send(res, 404, { success: false, message: "Supplier tidak ditemukan" });
      }
    }

    // Insert new pembelian
    const result = await pool.query(
      `INSERT INTO pembelian (tanggal, supplier_id, sku, qty, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, tanggal, supplier_id, sku, qty, created_at`,
      [tanggal, supplier_id || null, sku, qty]
    );

    // Get full data with product and supplier info
    const fullResult = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.supplier_id,
        COALESCE(s.kode_supplier, '') as kode_supplier,
        COALESCE(s.nama_supplier, 'Tanpa Supplier') as nama_supplier,
        p.sku,
        p.qty,
        pr.nama_produk,
        pr.harga_beli,
        (p.qty * COALESCE(pr.harga_beli, 0)) as nominal,
        p.created_at
       FROM pembelian p
       LEFT JOIN supplier s ON s.id = p.supplier_id
       LEFT JOIN produk pr ON pr.sku = p.sku
       WHERE p.id = $1`,
      [result.rows[0].id]
    );

    return send(res, 201, {
      success: true,
      message: "Pembelian berhasil ditambahkan",
      data: fullResult.rows[0]
    });
  } catch (error) {
    console.error("Error creating pembelian:", error);
    return send(res, 500, { success: false, message: "Gagal membuat pembelian" });
  }
}

// ============================================
// PUT /v1/pembelian/:id - Update pembelian
// ============================================
async function updatePembelian(req, res, pembelianId) {
  const { tanggal, supplier_id, sku, qty } = req.body || {};

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

  // Validation for supplier_id if provided
  if (supplier_id !== undefined && supplier_id !== null) {
    if (supplier_id > 0) {
      const supplierCheck = await pool.query("SELECT id FROM supplier WHERE id = $1", [supplier_id]);
      if (supplierCheck.rows.length === 0) {
        return send(res, 404, { success: false, message: "Supplier tidak ditemukan" });
      }
    }
  }

  try {
    // Check if pembelian exists
    const existingCheck = await pool.query("SELECT id FROM pembelian WHERE id = $1", [pembelianId]);
    if (existingCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Pembelian tidak ditemukan" });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (tanggal !== undefined) {
      updates.push(`tanggal = $${paramIndex}`);
      params.push(tanggal);
      paramIndex++;
    }

    if (supplier_id !== undefined) {
      updates.push(`supplier_id = $${paramIndex}`);
      params.push(supplier_id > 0 ? supplier_id : null);
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
    params.push(pembelianId);
    await pool.query(
      `UPDATE pembelian SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    // Get updated data with product and supplier info
    const result = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.supplier_id,
        COALESCE(s.kode_supplier, '') as kode_supplier,
        COALESCE(s.nama_supplier, 'Tanpa Supplier') as nama_supplier,
        p.sku,
        p.qty,
        pr.nama_produk,
        pr.harga_beli,
        (p.qty * COALESCE(pr.harga_beli, 0)) as nominal,
        p.created_at
       FROM pembelian p
       LEFT JOIN supplier s ON s.id = p.supplier_id
       LEFT JOIN produk pr ON pr.sku = p.sku
       WHERE p.id = $1`,
      [pembelianId]
    );

    return send(res, 200, {
      success: true,
      message: "Pembelian berhasil diupdate",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating pembelian:", error);
    return send(res, 500, { success: false, message: "Gagal mengupdate pembelian" });
  }
}

// ============================================
// DELETE /v1/pembelian/:id - Delete pembelian
// ============================================
async function deletePembelian(req, res, pembelianId) {
  try {
    // Check if pembelian exists
    const existingCheck = await pool.query("SELECT id FROM pembelian WHERE id = $1", [pembelianId]);
    if (existingCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Pembelian tidak ditemukan" });
    }

    // Hard delete
    await pool.query("DELETE FROM pembelian WHERE id = $1", [pembelianId]);

    return send(res, 200, { success: true, message: "Pembelian berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting pembelian:", error);
    return send(res, 500, { success: false, message: "Gagal menghapus pembelian" });
  }
}

// ============================================
// GET /v1/supplier - List all suppliers
// ============================================
async function listSupplier(req, res) {
  try {
    const status = req.query?.status;
    const search = req.query?.search;
    const page = parseInt(req.query?.page) || 1;
    const limit = Math.min(parseInt(req.query?.limit) || 100, 500);
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (status !== undefined && status !== '') {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status === 'true' || status === '1');
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        nama_supplier ILIKE $${paramIndex} OR 
        kode_supplier ILIKE $${paramIndex} OR
        COALESCE(alamat, '') ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}` 
      : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM supplier ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Get suppliers
    const dataResult = await pool.query(
      `SELECT 
        id, kode_supplier, nama_supplier, alamat, telepon, pic, status, created_at
       FROM supplier
       ${whereClause}
       ORDER BY nama_supplier ASC
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
    console.error("Error listing supplier:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data supplier" });
  }
}

// ============================================
// POST /v1/pembelian/import - Import pembelian from CSV/Excel
// ============================================
async function importPembelian(req, res) {
  try {
    // Parse body - expects { data: [[tanggal, supplier_name, sku, qty], ...] }
    const { data } = req.body || {};

    if (!data || !Array.isArray(data) || data.length === 0) {
      return send(res, 400, { 
        success: false, 
        message: "Data tidak ditemukan. Pastikan file Excel/CSV sudah benar." 
      });
    }

    // Load master data for validation
    const [produkResult, supplierResult] = await Promise.all([
      pool.query("SELECT sku FROM produk"),
      pool.query("SELECT id, nama_supplier FROM supplier")
    ]);

    const validSkuSet = new Set(produkResult.rows.map(r => r.sku));
    const validSupplierMap = new Map(supplierResult.rows.map(r => [r.nama_supplier.toLowerCase(), r.id]));

    // Validate all rows first
    const errors = [];
    const validRows = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row (1 = header, data starts at 2)

      // Expected: [tanggal, supplier_name, sku, qty]
      const tanggal = row[0] ? String(row[0]).trim() : "";
      const supplier_name = row[1] ? String(row[1]).trim() : "";
      const sku = row[2] ? String(row[2]).trim() : "";
      const qty = row[3] !== undefined ? parseInt(row[3]) : 0;

      // Validation
      if (!tanggal) {
        errors.push({ row: rowNum, message: `Tanggal wajib diisi` });
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

      // Check supplier exists (optional - if provided)
      let supplierId = null;
      if (supplier_name) {
        supplierId = validSupplierMap.get(supplier_name.toLowerCase());
        if (!supplierId) {
          errors.push({ row: rowNum, message: `Supplier "${supplier_name}" tidak ditemukan di master supplier` });
          continue;
        }
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(tanggal)) {
        errors.push({ row: rowNum, message: `Format tanggal salah. Gunakan format: YYYY-MM-DD` });
        continue;
      }

      validRows.push({ tanggal, supplier_id: supplierId, sku, qty });
    }

    // If any errors, return them without importing
    if (errors.length > 0) {
      return send(res, 400, {
        success: false,
        message: "Terdapat error pada data. Silakan perbaiki dan upload ulang.",
        errors: errors.slice(0, 50),
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
          `INSERT INTO pembelian (tanggal, supplier_id, sku, qty, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [row.tanggal, row.supplier_id, row.sku, row.qty]
        );
        importedCount++;
      }

      await client.query('COMMIT');

      return send(res, 201, {
        success: true,
        message: `Berhasil import ${importedCount} data pembelian`,
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
    console.error("Error importing pembelian:", error);
    return send(res, 500, { success: false, message: "Gagal import data pembelian" });
  }
}

// ============================================
// Main Route Handler
// ============================================
export default async function apiPembelianHandler(req, res) {
  const routePath = getRoutePath(req);
  const normalizedPath = normalizeRoute(routePath);
  const method = req.method;
  const pembelianId = req.params?.[0] ? parseInt(req.params[0], 10) : extractPembelianId(normalizedPath);

  // Route: GET /v1/supplier - List suppliers (for dropdown)
  if (method === "GET" && normalizedPath === "v1/supplier") {
    return listSupplier(req, res);
  }

  // Route: GET /v1/pembelian - List all pembelian
  if (method === "GET" && normalizedPath === "v1/pembelian") {
    return listPembelian(req, res);
  }

  // Route: POST /v1/pembelian
  if (method === "POST" && normalizedPath === "v1/pembelian") {
    return createPembelian(req, res);
  }

  // Route: POST /v1/pembelian/import
  if (method === "POST" && normalizedPath === "v1/pembelian/import") {
    return importPembelian(req, res);
  }

  // Route: GET /v1/pembelian/:id
  if (method === "GET" && pembelianId) {
    return getPembelian(req, res, pembelianId);
  }

  // Route: PUT /v1/pembelian/:id
  if (method === "PUT" && pembelianId) {
    return updatePembelian(req, res, pembelianId);
  }

  // Route: DELETE /v1/pembelian/:id
  if (method === "DELETE" && pembelianId) {
    return deletePembelian(req, res, pembelianId);
  }

  return send(res, 404, { success: false, message: `Route tidak ditemukan: ${method} ${routePath}` });
}