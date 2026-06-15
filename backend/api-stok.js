/* ============================================
   CV EPIC Warehouse - Stok Module API
   Sprint 4.1 - Modul Persediaan
   ============================================ */

import pool from "../services/db.js";

// Helper to send JSON responses
function send(res, status, payload) {
  return res.status(status).json(payload);
}

// ============================================
// KATEGORI MAPPING (based on nama_produk)
// ============================================
const KATEGORI_CONDITION = `
  CASE
    WHEN UPPER(nama_produk) LIKE '%MODUL%' THEN 'modul'
    WHEN UPPER(nama_produk) LIKE '%POSTER%' OR UPPER(nama_produk) LIKE '%FLASHCARD%' OR UPPER(nama_produk) LIKE '%FLASH CARD%' THEN 'poster'
    WHEN UPPER(nama_produk) LIKE '%PANDUAN%' THEN 'panduan'
    WHEN UPPER(nama_produk) LIKE '%TAS%' THEN 'tas'
    WHEN UPPER(nama_produk) LIKE '%BIRU%' OR UPPER(nama_produk) LIKE '%KUNING%' OR UPPER(nama_produk) LIKE '%MERAH%' OR UPPER(nama_produk) LIKE '%MY%' THEN 'seragam'
    ELSE 'lain_lain'
  END AS kategori
`;

// ============================================
// TAB 1: STOK REALTIME (Stok Periode)
// GET /v1/stok/realtime
// ============================================
async function getStokRealtime(req, res) {
  try {
    const page = parseInt(req.query?.page) || 1;
    const limit = Math.min(parseInt(req.query?.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const search = req.query?.search || "";
    const kategori = req.query?.kategori || "";
    const tahun = parseInt(req.query?.tahun) || new Date().getFullYear();
    const bulan = parseInt(req.query?.bulan) || (new Date().getMonth() + 1);

    // Calculate date range for the selected period
    const startDate = new Date(tahun, bulan - 1, 1);
    const endDate = new Date(tahun, bulan, 0); // Last day of the month
    const beforeDate = new Date(tahun, bulan - 1, 0); // Last day of previous month

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const beforeDateStr = beforeDate.toISOString().split('T')[0];

    // Build search condition
    // Use $1 for search, inline dates for clarity
    const searchParam = search ? `%${search}%` : '%';
    const searchCondition = `AND (p.sku ILIKE $1 OR p.nama_produk ILIKE $1)`;
    
    // Build kategori condition
    let kategoriCondition = "";
    if (kategori && kategori !== "semua") {
      const kategoriMap = {
        'modul': `AND UPPER(p.nama_produk) LIKE '%MODUL%'`,
        'poster': `AND (UPPER(p.nama_produk) LIKE '%POSTER%' OR UPPER(p.nama_produk) LIKE '%FLASHCARD%' OR UPPER(p.nama_produk) LIKE '%FLASH CARD%')`,
        'panduan': `AND UPPER(p.nama_produk) LIKE '%PANDUAN%'`,
        'tas': `AND UPPER(p.nama_produk) LIKE '%TAS%'`,
        'seragam': `AND (UPPER(p.nama_produk) LIKE '%BIRU%' OR UPPER(p.nama_produk) LIKE '%KUNING%' OR UPPER(p.nama_produk) LIKE '%MERAH%' OR UPPER(p.nama_produk) LIKE '%MY%')`,
        'lain_lain': `AND (UPPER(p.nama_produk) NOT LIKE '%MODUL%' AND UPPER(p.nama_produk) NOT LIKE '%POSTER%' AND UPPER(p.nama_produk) NOT LIKE '%FLASHCARD%' AND UPPER(p.nama_produk) NOT LIKE '%FLASH CARD%' AND UPPER(p.nama_produk) NOT LIKE '%PANDUAN%' AND UPPER(p.nama_produk) NOT LIKE '%TAS%' AND UPPER(p.nama_produk) NOT LIKE '%BIRU%' AND UPPER(p.nama_produk) NOT LIKE '%KUNING%' AND UPPER(p.nama_produk) NOT LIKE '%MERAH%' AND UPPER(p.nama_produk) NOT LIKE '%MY%')`
      };
      if (kategoriMap[kategori]) {
        kategoriCondition = kategoriMap[kategori];
      }
    }
    
    // Count query - only uses search param
    const countResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM produk p
      WHERE 1=1 ${kategoriCondition} ${searchCondition}
    `, [searchParam]);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Main query - Stok Realtime with rolling calculation per period
    // Stok Awal = Stok Akhir previous month (not total from beginning)
    // Stok Akhir = Stok Awal + Pembelian this month - Penjualan this month + Penyesuaian this month
    // Params: $1=startDateStr, $2=endDateStr, $3=beforeDateStr, $4=searchParam, $5=limit, $6=offset
    // Determine if January (bulan = 1) - special handling for stok_awal
    const isJanuary = parseInt(bulan) === 1;
    
    const dataResult = await pool.query(`
      WITH params AS (
        SELECT 
          $1::date AS start_date,
          $2::date AS end_date,
          $3::date AS before_date
      ),
      -- Stok Awal calculation:
      -- For January: Use ONLY stok_awal table (initial recorded stock)
      -- For other months: Use cumulative transactions from all tables before this month
      stok_terakhir_sebelumnya AS (
        SELECT 
          sku,
          COALESCE(SUM(stok), 0) AS stok_sblm
        FROM (
          ${isJanuary 
            ? `-- January: Only use stok_awal table
               SELECT sku, COALESCE(SUM(qty_awal), 0) AS stok FROM stok_awal GROUP BY sku`
            : `-- Other months: Cumulative of all transactions before this month
               SELECT sku, COALESCE(SUM(qty_awal), 0) AS stok FROM stok_awal WHERE created_at::date <= (SELECT before_date FROM params) GROUP BY sku
               UNION ALL
               SELECT sku, COALESCE(SUM(qty), 0) AS stok FROM pembelian WHERE tanggal <= (SELECT before_date FROM params) GROUP BY sku
               UNION ALL
               SELECT sku, COALESCE(SUM(-qty), 0) AS stok FROM penjualan WHERE tanggal <= (SELECT before_date FROM params) GROUP BY sku
               UNION ALL
               SELECT sku, COALESCE(SUM(qty), 0) AS stok FROM stok_penyesuaian WHERE tanggal <= (SELECT before_date FROM params) GROUP BY sku`
          }
        ) combined
        GROUP BY sku
      ),
      -- Pembelian this month
      pembelian_bulan AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS total_beli
        FROM pembelian
        WHERE tanggal >= (SELECT start_date FROM params) AND tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      -- Penjualan this month
      penjualan_bulan AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS total_jual
        FROM penjualan
        WHERE tanggal >= (SELECT start_date FROM params) AND tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      -- Penyesuaian this month
      penyesuaian_bulan AS (
        SELECT 
          sku, 
          COALESCE(SUM(qty), 0) AS total_adjust
        FROM stok_penyesuaian
        WHERE tanggal >= (SELECT start_date FROM params) AND tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      )
      SELECT 
        p.sku,
        p.nama_produk,
        ${KATEGORI_CONDITION},
        COALESCE(ss.stok_sblm, 0) AS stok_awal,
        COALESCE(pb.total_beli, 0) AS pembelian,
        COALESCE(pj.total_jual, 0) AS penjualan,
        COALESCE(py.total_adjust, 0) AS penyesuaian,
        (
          COALESCE(ss.stok_sblm, 0) 
          + COALESCE(pb.total_beli, 0) 
          - COALESCE(pj.total_jual, 0) 
          + COALESCE(py.total_adjust, 0)
        ) AS stok_akhir
      FROM produk p
      LEFT JOIN stok_terakhir_sebelumnya ss ON ss.sku = p.sku
      LEFT JOIN pembelian_bulan pb ON pb.sku = p.sku
      LEFT JOIN penjualan_bulan pj ON pj.sku = p.sku
      LEFT JOIN penyesuaian_bulan py ON py.sku = p.sku
      WHERE 1=1 ${kategoriCondition} AND (p.sku ILIKE $4 OR p.nama_produk ILIKE $4)
      ORDER BY p.nama_produk
      LIMIT $5 OFFSET $6
    `, [startDateStr, endDateStr, beforeDateStr, searchParam, limit, offset]);

    // Calculate summary stats - same January logic
    const summaryResult = await pool.query(`
      WITH params AS (
        SELECT 
          $1::date AS start_date,
          $2::date AS end_date,
          $3::date AS before_date
      ),
      produk_stats AS (
        SELECT 
          p.sku,
          COALESCE(
            ${isJanuary
              ? `(SELECT COALESCE(SUM(qty_awal), 0) FROM stok_awal WHERE sku = p.sku)`
              : `(SELECT COALESCE(SUM(qty_awal), 0) FROM stok_awal WHERE sku = p.sku AND created_at::date <= (SELECT before_date FROM params)) +
                 (SELECT COALESCE(SUM(qty), 0) FROM pembelian WHERE sku = p.sku AND tanggal <= (SELECT before_date FROM params)) -
                 (SELECT COALESCE(SUM(qty), 0) FROM penjualan WHERE sku = p.sku AND tanggal <= (SELECT before_date FROM params)) +
                 (SELECT COALESCE(SUM(qty), 0) FROM stok_penyesuaian WHERE sku = p.sku AND tanggal <= (SELECT before_date FROM params))`
            },
            0
          ) AS stok_awal,
          COALESCE((SELECT SUM(qty) FROM pembelian WHERE sku = p.sku AND tanggal >= (SELECT start_date FROM params) AND tanggal <= (SELECT end_date FROM params)), 0) AS pembelian,
          COALESCE((SELECT SUM(qty) FROM penjualan WHERE sku = p.sku AND tanggal >= (SELECT start_date FROM params) AND tanggal <= (SELECT end_date FROM params)), 0) AS penjualan,
          COALESCE((SELECT SUM(qty) FROM stok_penyesuaian WHERE sku = p.sku AND tanggal >= (SELECT start_date FROM params) AND tanggal <= (SELECT end_date FROM params)), 0) AS penyesuaian
        FROM produk p
        WHERE 1=1 ${kategoriCondition}
      ),
      computed AS (
        SELECT 
          stok_awal + pembelian - penjualan + penyesuaian AS stok_akhir
        FROM produk_stats
      )
      SELECT 
        COUNT(*) AS total_sku,
        COALESCE(SUM(stok_akhir), 0) AS total_stok_akhir,
        COALESCE(SUM(CASE WHEN stok_akhir < 0 THEN 1 ELSE 0 END), 0) AS produk_minus,
        COALESCE(SUM(CASE WHEN stok_akhir = 0 THEN 1 ELSE 0 END), 0) AS produk_kosong
      FROM computed
    `, [startDateStr, endDateStr, beforeDateStr]);

    const summary = summaryResult.rows[0] || {
      total_sku: 0,
      total_stok_akhir: 0,
      produk_minus: 0,
      produk_kosong: 0
    };

    return send(res, 200, {
      success: true,
      data: dataResult.rows,
      summary: {
        total_sku: parseInt(summary.total_sku || 0, 10),
        total_stok_akhir: parseInt(summary.total_stok_akhir || 0, 10),
        produk_minus: parseInt(summary.produk_minus || 0, 10),
        produk_kosong: parseInt(summary.produk_kosong || 0, 10)
      },
      periode: {
        bulan,
        tahun,
        start_date: startDateStr,
        end_date: endDateStr
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      },
      filters: {
        search: search || null,
        kategori: kategori || null
      }
    });
  } catch (error) {
    console.error("Error getting stok realtime:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data stok realtime: " + error.message });
  }
}

// ============================================
// TAB 2: KARTU STOK
// GET /v1/stok/kartu
// ============================================
async function getKartuStok(req, res) {
  try {
    const page = parseInt(req.query?.page) || 1;
    // Higher limit for single product view, but still capped to prevent browser freeze
    const limit = Math.min(parseInt(req.query?.limit) || 200, 500);
    const offset = (page - 1) * limit;
    const tahun = parseInt(req.query?.tahun) || new Date().getFullYear();
    const bulan = parseInt(req.query?.bulan) || (new Date().getMonth() + 1);
    const produk = req.query?.produk || "";
    const search = req.query?.search || "";

    // Calculate date range for the selected period
    const startDate = new Date(tahun, bulan - 1, 1);
    const endDate = new Date(tahun, bulan, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Check if single product selected - use higher limit for better UX
    const isSingleProduct = produk && produk.trim() !== "";

    // Get all transactions for this period with partner info
    // Running balance calculated per SKU
    const dataResult = await pool.query(`
      WITH params AS (
        SELECT 
          $1::date AS start_date,
          $2::date AS end_date,
          $3::text AS produk_filter
      ),
      -- Get all transactions with partner info
      all_transactions AS (
        -- Stok Awal
        SELECT 
          sa.created_at::date as tanggal,
          sa.sku,
          p.nama_produk,
          'Stok Awal' as aktivitas,
          '' as partner,
          sa.qty_awal as masuk,
          0 as keluar,
          1 as sort_order
        FROM stok_awal sa
        JOIN produk p ON p.sku = sa.sku
        WHERE sa.created_at::date >= (SELECT start_date FROM params) 
          AND sa.created_at::date <= (SELECT end_date FROM params)
          AND ((SELECT produk_filter FROM params) IS NULL OR (SELECT produk_filter FROM params) = '' OR sa.sku = (SELECT produk_filter FROM params))
        
        UNION ALL
        
        -- Pembelian (no supplier info in schema)
        SELECT 
          pb.tanggal,
          pb.sku,
          pr.nama_produk,
          'Pembelian' as aktivitas,
          '-' as partner,
          pb.qty as masuk,
          0 as keluar,
          2 as sort_order
        FROM pembelian pb
        JOIN produk pr ON pr.sku = pb.sku
        WHERE pb.tanggal >= (SELECT start_date FROM params) 
          AND pb.tanggal <= (SELECT end_date FROM params)
          AND ((SELECT produk_filter FROM params) IS NULL OR (SELECT produk_filter FROM params) = '' OR pb.sku = (SELECT produk_filter FROM params))
        
        UNION ALL
        
        -- Penjualan with outlet name
        SELECT 
          jj.tanggal,
          jj.sku,
          pr.nama_produk,
          'Penjualan' as aktivitas,
          COALESCE(jj.nama_outlet, '-') as partner,
          0 as masuk,
          jj.qty as keluar,
          3 as sort_order
        FROM penjualan jj
        JOIN produk pr ON pr.sku = jj.sku
        WHERE jj.tanggal >= (SELECT start_date FROM params) 
          AND jj.tanggal <= (SELECT end_date FROM params)
          AND ((SELECT produk_filter FROM params) IS NULL OR (SELECT produk_filter FROM params) = '' OR jj.sku = (SELECT produk_filter FROM params))
        
        UNION ALL
        
        -- Penyesuaian
        SELECT 
          sp.tanggal,
          sp.sku,
          pr.nama_produk,
          COALESCE(sp.keterangan, 'Penyesuaian') as aktivitas,
          '-' as partner,
          CASE WHEN sp.qty > 0 THEN sp.qty ELSE 0 END as masuk,
          CASE WHEN sp.qty < 0 THEN ABS(sp.qty) ELSE 0 END as keluar,
          4 as sort_order
        FROM stok_penyesuaian sp
        JOIN produk pr ON pr.sku = sp.sku
        WHERE sp.tanggal >= (SELECT start_date FROM params) 
          AND sp.tanggal <= (SELECT end_date FROM params)
          AND ((SELECT produk_filter FROM params) IS NULL OR (SELECT produk_filter FROM params) = '' OR sp.sku = (SELECT produk_filter FROM params))
      ),
      -- Calculate running balance per SKU
      with_balance AS (
        SELECT 
          at.*,
          COALESCE(
            (SELECT SUM(a2.masuk - a2.keluar) 
             FROM all_transactions a2 
             WHERE a2.sku = at.sku 
               AND (
                 a2.tanggal < at.tanggal 
                 OR (a2.tanggal = at.tanggal AND a2.sort_order < at.sort_order)
               )
            ),
            0
          ) + 
          (SELECT COALESCE(SUM(stok), 0) FROM (
            SELECT sku, COALESCE(SUM(qty_awal), 0) AS stok FROM stok_awal WHERE created_at::date < (SELECT start_date FROM params) GROUP BY sku
            UNION ALL
            SELECT sku, COALESCE(SUM(qty), 0) AS stok FROM pembelian WHERE tanggal < (SELECT start_date FROM params) GROUP BY sku
            UNION ALL
            SELECT sku, COALESCE(SUM(-qty), 0) AS stok FROM penjualan WHERE tanggal < (SELECT start_date FROM params) GROUP BY sku
            UNION ALL
            SELECT sku, COALESCE(SUM(qty), 0) AS stok FROM stok_penyesuaian WHERE tanggal < (SELECT start_date FROM params) GROUP BY sku
          ) before_stok WHERE sku = at.sku GROUP BY sku)
          AS saldo_before,
          (COALESCE(
            (SELECT SUM(a2.masuk - a2.keluar) 
             FROM all_transactions a2 
             WHERE a2.sku = at.sku 
               AND (
                 a2.tanggal < at.tanggal 
                 OR (a2.tanggal = at.tanggal AND a2.sort_order <= at.sort_order)
               )
            ),
            0
          ) + 
          (SELECT COALESCE(SUM(stok), 0) FROM (
            SELECT sku, COALESCE(SUM(qty_awal), 0) AS stok FROM stok_awal WHERE created_at::date < (SELECT start_date FROM params) GROUP BY sku
            UNION ALL
            SELECT sku, COALESCE(SUM(qty), 0) AS stok FROM pembelian WHERE tanggal < (SELECT start_date FROM params) GROUP BY sku
            UNION ALL
            SELECT sku, COALESCE(SUM(-qty), 0) AS stok FROM penjualan WHERE tanggal < (SELECT start_date FROM params) GROUP BY sku
            UNION ALL
            SELECT sku, COALESCE(SUM(qty), 0) AS stok FROM stok_penyesuaian WHERE tanggal < (SELECT start_date FROM params) GROUP BY sku
          ) before_stok WHERE sku = at.sku GROUP BY sku)) AS saldo
        FROM all_transactions at
      )
      SELECT 
        tanggal,
        sku,
        nama_produk,
        aktivitas,
        partner,
        masuk,
        keluar,
        saldo
      FROM with_balance
      WHERE ($4::text IS NULL OR $4::text = '' OR LOWER(nama_produk) LIKE LOWER($4) OR LOWER(sku) LIKE LOWER($4))
      ORDER BY sku, tanggal ASC, sort_order
      LIMIT $5 OFFSET $6
    `, [startDateStr, endDateStr, produk || null, search ? `%${search}%` : null, limit, offset]);

    // Get total count
    const countResult = await pool.query(`
      WITH params AS (
        SELECT 
          $1::date AS start_date,
          $2::date AS end_date,
          $3::text AS produk_filter
      ),
      all_transactions AS (
        SELECT sa.sku FROM stok_awal sa WHERE sa.created_at::date >= (SELECT start_date FROM params) AND sa.created_at::date <= (SELECT end_date FROM params) AND ((SELECT produk_filter FROM params) IS NULL OR (SELECT produk_filter FROM params) = '' OR sa.sku = (SELECT produk_filter FROM params))
        UNION
        SELECT pb.sku FROM pembelian pb WHERE pb.tanggal >= (SELECT start_date FROM params) AND pb.tanggal <= (SELECT end_date FROM params) AND ((SELECT produk_filter FROM params) IS NULL OR (SELECT produk_filter FROM params) = '' OR pb.sku = (SELECT produk_filter FROM params))
        UNION
        SELECT jj.sku FROM penjualan jj WHERE jj.tanggal >= (SELECT start_date FROM params) AND jj.tanggal <= (SELECT end_date FROM params) AND ((SELECT produk_filter FROM params) IS NULL OR (SELECT produk_filter FROM params) = '' OR jj.sku = (SELECT produk_filter FROM params))
        UNION
        SELECT sp.sku FROM stok_penyesuaian sp WHERE sp.tanggal >= (SELECT start_date FROM params) AND sp.tanggal <= (SELECT end_date FROM params) AND ((SELECT produk_filter FROM params) IS NULL OR (SELECT produk_filter FROM params) = '' OR sp.sku = (SELECT produk_filter FROM params))
      )
      SELECT COUNT(*) as total FROM all_transactions
    `, [startDateStr, endDateStr, produk || null]);
    
    const total = parseInt(countResult.rows[0]?.total || 0, 10);
    
    // Calculate summary stats for single product view
    let transactionSummary = null;
    if (isSingleProduct && dataResult.rows.length > 0) {
      const totalMasuk = dataResult.rows.reduce((sum, item) => sum + (parseInt(item.masuk) || 0), 0);
      const totalKeluar = dataResult.rows.reduce((sum, item) => sum + (parseInt(item.keluar) || 0), 0);
      const lastSaldo = dataResult.rows.length > 0 ? dataResult.rows[dataResult.rows.length - 1].saldo : 0;
      transactionSummary = {
        total_masuk: totalMasuk,
        total_keluar: totalKeluar,
        saldo_akhir: lastSaldo
      };
    }

    return send(res, 200, {
      success: true,
      data: dataResult.rows,
      periode: {
        bulan,
        tahun,
        start_date: startDateStr,
        end_date: endDateStr
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      },
      filters: {
        tahun,
        bulan,
        produk: produk || null,
        search: search || null
      },
      transaction_summary: transactionSummary
    });
  } catch (error) {
    console.error("Error getting kartu stok:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data kartu stok: " + error.message });
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