/* ============================================
   CV EPIC Warehouse - Pembelian CRUD API
   Sprint 3 - Purchase/Transaction API
   Uses supplier_id reference (new schema)
   ============================================ */

import pool from "../services/db.js";
import { getOrCreateSupplier } from "./migrations/supplier-pembelian.js";

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
// GET /v1/pembelian - List all pembelian
// ============================================
async function listPembelian(req, res) {
  try {
    const page = parseInt(req.query?.page) || 1;
    const limit = Math.min(parseInt(req.query?.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const tanggalAwal = req.query?.tanggal_awal;
    const tanggalAkhir = req.query?.tanggal_akhir;
    const supplierId = req.query?.supplier_id;
    const supplier = req.query?.supplier; // fallback for nama_supplier search
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

    // Supplier filter (by ID or by name)
    if (supplierId) {
      whereConditions.push(`p.supplier_id = $${paramIndex}`);
      params.push(parseInt(supplierId));
      paramIndex++;
    } else if (supplier) {
      whereConditions.push(`s.nama_supplier ILIKE $${paramIndex}`);
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
        s.nama_supplier ILIKE $${paramIndex} OR 
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
      `SELECT COUNT(*) as total FROM pembelian p
       LEFT JOIN supplier s ON s.id = p.supplier_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Get pembelian with supplier and product info - use LEFT JOIN to get nama_supplier, nama_produk, harga_beli
    const dataResult = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.supplier_id,
        s.nama_supplier,
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
        s.nama_supplier,
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
  const { tanggal, supplier_id, nama_supplier, sku, qty } = req.body || {};

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
    const produkCheck = await pool.query("SELECT sku FROM produk WHERE sku = $1", [sku]);
    if (produkCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "SKU tidak ditemukan di master produk" });
    }

    // Get or create supplier
    let finalSupplierId = supplier_id;
    if (!finalSupplierId && nama_supplier) {
      finalSupplierId = await getOrCreateSupplier(nama_supplier);
    }

    // Insert new pembelian
    const result = await pool.query(
      `INSERT INTO pembelian (tanggal, supplier_id, sku, qty, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, tanggal, supplier_id, sku, qty, created_at`,
      [tanggal, finalSupplierId, sku, qty]
    );

    // Get full data with supplier and product info
    const fullResult = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.supplier_id,
        s.nama_supplier,
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
  const { tanggal, supplier_id, nama_supplier, sku, qty } = req.body || {};

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
    // Check if exists
    const existingCheck = await pool.query("SELECT id FROM pembelian WHERE id = $1", [pembelianId]);
    if (existingCheck.rows.length === 0) {
      return send(res, 404, { success: false, message: "Pembelian tidak ditemukan" });
    }

    // Get or create supplier if nama_supplier is provided
    let finalSupplierId = supplier_id;
    if (!finalSupplierId && nama_supplier) {
      finalSupplierId = await getOrCreateSupplier(nama_supplier);
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

    if (finalSupplierId !== undefined) {
      updates.push(`supplier_id = $${paramIndex}`);
      params.push(finalSupplierId);
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

    // Get updated data with supplier and product info
    const result = await pool.query(
      `SELECT 
        p.id,
        p.tanggal,
        p.supplier_id,
        s.nama_supplier,
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
// POST /v1/pembelian/import - Import pembelian from CSV/Excel
// ============================================
async function importPembelian(req, res) {
  try {
    // Parse body - expects { data: [[tanggal, nama_supplier, sku, qty], ...] }
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
    const supplierNameToId = {};
    supplierResult.rows.forEach(s => {
      supplierNameToId[s.nama_supplier] = s.id;
    });

    // Validate all rows first
    const errors = [];
    const validRows = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row (1 = header, data starts at 2)

      // Expected: [tanggal, nama_supplier, sku, qty]
      const tanggal = row[0] ? String(row[0]).trim() : "";
      const nama_supplier = row[1] ? String(row[1]).trim() : "";
      const sku = row[2] ? String(row[2]).trim() : "";
      const qty = row[3] !== undefined ? parseInt(row[3]) : 0;

      // Validation
      if (!tanggal) {
        errors.push({ row: rowNum, message: `Tanggal wajib diisi` });
        continue;
      }

      if (!nama_supplier) {
        errors.push({ row: rowNum, message: `Nama supplier wajib diisi` });
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

      // Get or create supplier ID
      let supplierId = supplierNameToId[nama_supplier];
      if (!supplierId) {
        // Will be created during insert
        supplierId = await getOrCreateSupplier(nama_supplier);
        supplierNameToId[nama_supplier] = supplierId;
      }

      validRows.push({ tanggal, supplier_id: supplierId, nama_supplier, sku, qty });
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

      // First, ensure all suppliers exist
      const uniqueSuppliers = [...new Set(validRows.filter(r => r.supplier_id).map(r => r.nama_supplier))];
      for (const sup of uniqueSuppliers) {
        await client.query(
          "INSERT INTO supplier (nama_supplier) VALUES ($1) ON CONFLICT (nama_supplier) DO NOTHING",
          [sup]
        );
      }

      let importedCount = 0;
      for (const row of validRows) {
        // Get supplier_id again in case it was just created
        let supplierId = supplierNameToId[row.nama_supplier];
        if (!supplierId) {
          supplierId = await getOrCreateSupplier(row.nama_supplier);
        }

        await client.query(
          `INSERT INTO pembelian (tanggal, supplier_id, sku, qty, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [row.tanggal, supplierId, row.sku, row.qty]
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
// GET /v1/suppliers - List all suppliers
// ============================================
async function listSuppliers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, nama_supplier, created_at 
       FROM supplier 
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
// Main Route Handler
// ============================================
export default async function apiPembelianHandler(req, res) {
  const routePath = getRoutePath(req);
  const normalizedPath = normalizeRoute(routePath);
  const method = req.method;
  const pembelianId = req.params?.[0] ? parseInt(req.params[0], 10) : extractPembelianId(normalizedPath);

  // Route: GET /v1/pembelian
  if (method === "GET" && normalizedPath === "v1/pembelian") {
    return listPembelian(req, res);
  }

  // Route: GET /v1/suppliers
  if (method === "GET" && normalizedPath === "v1/suppliers") {
    return listSuppliers(req, res);
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