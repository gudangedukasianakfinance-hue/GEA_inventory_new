/* ============================================
   CV EPIC Warehouse - Stok Module API
   Sprint 4 - Modul Persediaan
   ============================================ */

import pool from "../services/db.js";

// Helper to send JSON responses
function send(res, status, payload) {
  return res.status(status).json(payload);
}

// ============================================
// TAB 1: STOK REALTIME
// GET /v1/stok/realtime
// ============================================
async function getStokRealtime(req, res) {
  try {
    const page = parseInt(req.query?.page) || 1;
    const limit = Math.min(parseInt(req.query?.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const sku = req.query?.sku;

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM produk";
    let countParams = [];
    if (sku) {
      countQuery += " WHERE sku = $1";
      countParams = [sku];
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Main query using aggregate CTEs for performance
    const dataResult = await pool.query(`
      WITH base_stock AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty_awal), 0) AS stok_awal_total
        FROM stok_awal
        GROUP BY sku
      ),
      total_pembelian AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS total_pembelian
        FROM pembelian
        GROUP BY sku
      ),
      total_penjualan AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS total_penjualan
        FROM penjualan
        GROUP BY sku
      ),
      total_penyesuaian AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS total_penyesuaian
        FROM stok_penyesuaian
        GROUP BY sku
      )
      SELECT 
        p.sku,
        p.nama_produk,
        COALESCE(bs.stok_awal_total, 0) AS stok_awal,
        COALESCE(tp.total_pembelian, 0) AS pembelian,
        COALESCE(tj.total_penjualan, 0) AS penjualan,
        COALESCE(tpy.total_penyesuaian, 0) AS penyesuaian,
        (
          COALESCE(bs.stok_awal_total, 0) 
          + COALESCE(tp.total_pembelian, 0) 
          - COALESCE(tj.total_penjualan, 0) 
          + COALESCE(tpy.total_penyesuaian, 0)
        ) AS stok_akhir
      FROM produk p
      LEFT JOIN base_stock bs ON bs.sku = p.sku
      LEFT JOIN total_pembelian tp ON tp.sku = p.sku
      LEFT JOIN total_penjualan tj ON tj.sku = p.sku
      LEFT JOIN total_penyesuaian tpy ON tpy.sku = p.sku
      WHERE ($1::text IS NULL OR $1::text = '' OR p.sku = $1)
      ORDER BY p.sku
      LIMIT $2 OFFSET $3
    `, [sku || null, limit, offset]);

    return send(res, 200, {
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      },
      formula: {
        stok_akhir: "stok_awal + pembelian - penjualan + penyesuaian"
      }
    });
  } catch (error) {
    console.error("Error getting stok realtime:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data stok realtime" });
  }
}

// ============================================
// TAB 2: KARTU STOK
// GET /v1/stok/kartu
// ============================================
async function getKartuStok(req, res) {
  try {
    const page = parseInt(req.query?.page) || 1;
    const limit = Math.min(parseInt(req.query?.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const tanggalAwal = req.query?.tanggal_awal;
    const tanggalAkhir = req.query?.tanggal_akhir;
    const sku = req.query?.sku;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Date range filter
    if (tanggalAwal) {
      whereConditions.push(`tanggal >= $${paramIndex}`);
      params.push(tanggalAwal);
      paramIndex++;
    }

    if (tanggalAkhir) {
      whereConditions.push(`tanggal <= $${paramIndex}`);
      params.push(tanggalAkhir);
      paramIndex++;
    }

    // SKU filter
    if (sku) {
      whereConditions.push(`sku = $${paramIndex}`);
      params.push(sku);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}` 
      : "";

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM (
        SELECT 1 as tanggal, sku, 'Stok Awal' as referensi, 0 as masuk, 0 as keluar
        FROM stok_awal sa
        ${sku ? `WHERE sa.sku = '${sku}'` : ''}
        UNION ALL
        SELECT tanggal, sku, 'Pembelian' as referensi, qty as masuk, 0 as keluar
        FROM pembelian p
        ${whereClause ? 'WHERE ' + whereClause.split('WHERE ')[1] : ''}
        UNION ALL
        SELECT tanggal, sku, 'Penjualan' as referensi, 0 as masuk, qty as keluar
        FROM penjualan j
        ${whereClause ? 'WHERE ' + whereClause.split('WHERE ')[1] : ''}
        UNION ALL
        SELECT tanggal, sku, COALESCE(keterangan, 'Penyesuaian') as referensi, 
               CASE WHEN qty > 0 THEN qty ELSE 0 END as masuk,
               CASE WHEN qty < 0 THEN ABS(qty) ELSE 0 END as keluar
        FROM stok_penyesuaian sp
        ${whereClause ? 'WHERE ' + whereClause.split('WHERE ')[1] : ''}
      ) combined`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Build filter params for subqueries
    let subWhereClause = whereClause;
    let subParams = [...params];

    // Get all transactions for calculating running balance
    const dataResult = await pool.query(`
      WITH all_transactions AS (
        -- Stok Awal entries
        SELECT 
          sa.created_at::date as tanggal,
          sa.sku,
          'Stok Awal' as referensi,
          sa.qty_awal as masuk,
          0 as keluar,
          1 as sort_order
        FROM stok_awal sa
        WHERE ($3::text IS NULL OR $3::text = '' OR sa.sku = $3)
        
        UNION ALL
        
        -- Pembelian entries
        SELECT 
          p.tanggal,
          p.sku,
          'Pembelian' as referensi,
          p.qty as masuk,
          0 as keluar,
          2 as sort_order
        FROM pembelian p
        ${subWhereClause}
        
        UNION ALL
        
        -- Penjualan entries
        SELECT 
          j.tanggal,
          j.sku,
          'Penjualan' as referensi,
          0 as masuk,
          j.qty as keluar,
          3 as sort_order
        FROM penjualan j
        ${subWhereClause}
        
        UNION ALL
        
        -- Penyesuaian entries
        SELECT 
          sp.tanggal,
          sp.sku,
          COALESCE(sp.keterangan, 'Penyesuaian') as referensi,
          CASE WHEN sp.qty > 0 THEN sp.qty ELSE 0 END as masuk,
          CASE WHEN sp.qty < 0 THEN ABS(sp.qty) ELSE 0 END as keluar,
          4 as sort_order
        FROM stok_penyesuaian sp
        ${subWhereClause}
      ),
      aggregated AS (
        SELECT 
          tanggal,
          sku,
          MAX(referensi) as referensi,
          SUM(masuk) as masuk,
          SUM(keluar) as keluar
        FROM all_transactions
        GROUP BY tanggal, sku, sort_order
      ),
      ranked AS (
        SELECT 
          a.tanggal,
          a.sku,
          a.referensi,
          a.masuk,
          a.keluar,
          ROW_NUMBER() OVER (ORDER BY a.tanggal ASC, a.sku, a.referensi) as row_num
        FROM aggregated a
        WHERE ($3::text IS NULL OR $3::text = '' OR a.sku = $3)
        ${tanggalAwal ? `AND a.tanggal >= $1` : ''}
        ${tanggalAkhir ? `AND a.tanggal <= $2` : ''}
      ),
      with_balance AS (
        SELECT 
          r.tanggal,
          r.sku,
          r.referensi,
          r.masuk,
          r.keluar,
          r.row_num,
          COALESCE(
            (SELECT SUM(a2.masuk - a2.keluar) 
             FROM aggregated a2 
             WHERE a2.sku = r.sku AND a2.tanggal <= r.tanggal),
            0
          ) as saldo
        FROM ranked r
      )
      SELECT 
        tanggal,
        sku,
        referensi,
        masuk,
        keluar,
        saldo
      FROM with_balance
      ORDER BY tanggal ASC, sku, row_num
      LIMIT $4 OFFSET $5
    `, [tanggalAwal || null, tanggalAkhir || null, sku || null, limit, offset]);

    return send(res, 200, {
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      },
      filters: {
        tanggal_awal: tanggalAwal || null,
        tanggal_akhir: tanggalAkhir || null,
        sku: sku || null
      }
    });
  } catch (error) {
    console.error("Error getting kartu stok:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data kartu stok" });
  }
}

// ============================================
// TAB 3: MUTASI STOK
// GET /v1/stok/mutasi
// ============================================
async function getMutasiStok(req, res) {
  try {
    const page = parseInt(req.query?.page) || 1;
    const limit = Math.min(parseInt(req.query?.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const tanggalAwal = req.query?.tanggal_awal;
    const tanggalAkhir = req.query?.tanggal_akhir;
    const sku = req.query?.sku;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Date range filter for all subqueries
    if (tanggalAwal) {
      whereConditions.push(`tanggal >= $${paramIndex}`);
      params.push(tanggalAwal);
      paramIndex++;
    }

    if (tanggalAkhir) {
      whereConditions.push(`tanggal <= $${paramIndex}`);
      params.push(tanggalAkhir);
      paramIndex++;
    }

    if (sku) {
      whereConditions.push(`sku = $${paramIndex}`);
      params.push(sku);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}` 
      : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM produk ${sku ? 'WHERE sku = $1' : ''}`,
      sku ? [sku] : []
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Main aggregate query for mutasi
    const dataResult = await pool.query(`
      WITH stok_awalnya AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty_awal), 0) AS stok_awal_total
        FROM stok_awal
        GROUP BY sku
      ),
      pembelian_period AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS masuk
        FROM pembelian
        ${whereClause}
        GROUP BY sku
      ),
      penjualan_period AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS keluar
        FROM penjualan
        ${whereClause}
        GROUP BY sku
      ),
      penyesuaian_period AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS penyesuaian
        FROM stok_penyesuaian
        ${whereClause}
        GROUP BY sku
      ),
      before_stock AS (
        SELECT 
          sku,
          COALESCE(SUM(qty_awal), 0) AS stok_before
        FROM stok_awal
        GROUP BY sku
      ),
      before_pembelian AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS masuk_before
        FROM pembelian
        ${tanggalAwal ? `WHERE tanggal < $1` : ''}
        GROUP BY sku
      ),
      before_penjualan AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS keluar_before
        FROM penjualan
        ${tanggalAwal ? `WHERE tanggal < $1` : ''}
        GROUP BY sku
      ),
      before_penyesuaian AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS penyesuaian_before
        FROM stok_penyesuaian
        ${tanggalAwal ? `WHERE tanggal < $1` : ''}
        GROUP BY sku
      )
      SELECT 
        p.sku,
        p.nama_produk,
        COALESCE(sp.masuk, 0) AS masuk,
        COALESCE(jp.keluar, 0) AS keluar,
        COALESCE(pn.penyesuaian, 0) AS penyesuaian,
        (
          COALESCE(sa.stok_awal_total, 0)
          + COALESCE(bm.masuk_before, 0)
          - COALESCE(bj.keluar_before, 0)
          + COALESCE(bp.penyesuaian_before, 0)
          + COALESCE(sp.masuk, 0)
          - COALESCE(jp.keluar, 0)
          + COALESCE(pn.penyesuaian, 0)
        ) AS saldo
      FROM produk p
      LEFT JOIN stok_awalnya sa ON sa.sku = p.sku
      LEFT JOIN before_pembelian bm ON bm.sku = p.sku
      LEFT JOIN before_penjualan bj ON bj.sku = p.sku
      LEFT JOIN before_penyesuaian bp ON bp.sku = p.sku
      LEFT JOIN pembelian_period sp ON sp.sku = p.sku
      LEFT JOIN penjualan_period jp ON jp.sku = p.sku
      LEFT JOIN penyesuaian_period pn ON pn.sku = p.sku
      WHERE ($3::text IS NULL OR $3::text = '' OR p.sku = $3)
      ORDER BY p.sku
      LIMIT $4 OFFSET $5
    `, [tanggalAwal || null, tanggalAkhir || null, sku || null, limit, offset]);

    return send(res, 200, {
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      },
      filters: {
        tanggal_awal: tanggalAwal || null,
        tanggal_akhir: tanggalAkhir || null,
        sku: sku || null
      }
    });
  } catch (error) {
    console.error("Error getting mutasi stok:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data mutasi stok" });
  }
}

// Parse route path from request (supports both direct path and query.route)
function getRoutePath(req) {
  if (req.query?.route) {
    return "/" + String(req.query.route).replace(/^\/+/, "");
  }
  const url = new URL(req.url, "http://localhost");
  return url.pathname.replace(/^\/api/, "") || "/";
}

// ============================================
// Main Route Handler
// Note: This handler is called by api/index.js with req.query.route set
// The route path is already normalized by the main router
// ============================================
export default async function apiStokHandler(req, res) {
  // Route path comes from api/index.js via req.query.route
  // or we extract it from URL
  const routePath = getRoutePath(req);
  const method = req.method;

  // Route: GET /v1/stok/realtime
  if (method === "GET" && routePath === "/v1/stok/realtime") {
    return getStokRealtime(req, res);
  }

  // Route: GET /v1/stok/kartu
  if (method === "GET" && routePath === "/v1/stok/kartu") {
    return getKartuStok(req, res);
  }

  // Route: GET /v1/stok/mutasi
  if (method === "GET" && routePath === "/v1/stok/mutasi") {
    return getMutasiStok(req, res);
  }

  return send(res, 404, { success: false, message: `Route tidak ditemukan: ${method} ${routePath}` });
}