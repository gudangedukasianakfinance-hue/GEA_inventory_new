import pool from "../services/db.js";

// V3 Persediaan - Stok Gudang dengan Rolling Stock
export default async function handler(req, res) {
  try {
    const { bulan, tahun, kategori, sku } = req.query;
    const now = new Date();
    const targetBulan = Number(bulan || now.getMonth() + 1);
    const targetTahun = Number(tahun || now.getFullYear());

    // Calculate date range for rolling stock
    const startDate = new Date(targetTahun, targetBulan - 1, 1);
    const endDate = new Date(targetTahun, targetBulan, 0); // Last day of month

    // Check if database is available
    if (!pool) {
      console.warn('Database not configured - returning empty persediaan');
      return res.status(200).json({
        periode: {
          bulan: targetBulan,
          tahun: targetTahun,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        },
        ringkasan: { stok_awal: 0, total_pembelian: 0, total_penjualan: 0, total_penyesuaian: 0, stok_akhir: 0 },
        produk: [],
        kategori: [],
        stok_kritis: [],
        forecast: [],
        generated_at: new Date().toISOString(),
        _warning: 'Database not configured'
      });
    }

    // 1. Stok Gudang dengan Rolling Stock
    // STOK_AKHIR = STOK_AWAL + PEMBELIAN - PENJUALAN + PENYESUAIAN
    const stokGudang = await pool.query(`
      WITH params AS (
        SELECT 
          make_date($2::int, $1::int, 1) AS start_date,
          (make_date($2::int, $1::int, 1) + interval '1 month')::date AS end_date,
          make_date($2::int, $1::int, 1) - interval '1 day' AS before_date
      ),
      base_stock AS (
        SELECT sku, COALESCE(SUM(qty_awal), 0) AS stok_awal
        FROM stok_awal
        GROUP BY sku
      ),
      pembelian_upto AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_beli
        FROM pembelian
        WHERE tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      penjualan_upto AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_jual
        FROM penjualan
        WHERE tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      penyesuaian_upto AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_adjust
        FROM stok_penyesuaian
        WHERE tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      pembelian_bulan AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS beli_bulan_ini
        FROM pembelian
        WHERE tanggal >= (SELECT start_date FROM params)
          AND tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      penjualan_bulan AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS jual_bulan_ini
        FROM penjualan
        WHERE tanggal >= (SELECT start_date FROM params)
          AND tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      kategori_calc AS (
        SELECT 
          sku,
          CASE
            WHEN UPPER(nama_produk) LIKE 'MODUL%' THEN 'modul'
            WHEN UPPER(nama_produk) LIKE 'TAS%' THEN 'tas'
            WHEN UPPER(nama_produk) LIKE 'BIRU%' 
              OR UPPER(nama_produk) LIKE 'KUNING%'
              OR UPPER(nama_produk) LIKE 'MERAH%' THEN 'seragam'
            ELSE 'lain_lain'
          END AS kategori
        FROM produk
      )
      SELECT 
        p.sku,
        p.nama_produk,
        COALESCE(bs.stok_awal, 0) AS stok_awal,
        COALESCE(pb.total_beli, 0) AS total_pembelian,
        COALESCE(pj.total_jual, 0) AS total_penjualan,
        COALESCE(pa.total_adjust, 0) AS total_penyesuaian,
        COALESCE(pb_bulan.beli_bulan_ini, 0) AS pembelian_bulan_ini,
        COALESCE(pj_bulan.jual_bulan_ini, 0) AS penjualan_bulan_ini,
        COALESCE(bs.stok_awal, 0) + COALESCE(pb.total_beli, 0) - COALESCE(pj.total_jual, 0) + COALESCE(pa.total_adjust, 0) AS stok_akhir,
        k.kategori,
        p.harga_beli,
        p.harga_jual
      FROM produk p
      LEFT JOIN base_stock bs ON bs.sku = p.sku
      LEFT JOIN pembelian_upto pb ON pb.sku = p.sku
      LEFT JOIN penjualan_upto pj ON pj.sku = p.sku
      LEFT JOIN penyesuaian_upto pa ON pa.sku = p.sku
      LEFT JOIN pembelian_bulan pb_bulan ON pb_bulan.sku = p.sku
      LEFT JOIN penjualan_bulan pj_bulan ON pj_bulan.sku = p.sku
      LEFT JOIN kategori_calc k ON k.sku = p.sku
      WHERE ($3::text = '' OR k.kategori = $3)
        AND ($4::text = '' OR p.sku = $4)
      ORDER BY p.nama_produk
    `, [targetBulan, targetTahun, kategori || '', sku || '']);

    // 2. Ringkasan Stok Gudang
    const ringkasanStok = await pool.query(`
      WITH params AS (
        SELECT 
          (make_date($2::int, $1::int, 1) + interval '1 month')::date AS end_date
      ),
      base_stock AS (
        SELECT COALESCE(SUM(qty_awal), 0) AS total FROM stok_awal
      ),
      pembelian_total AS (
        SELECT COALESCE(SUM(qty), 0) AS total FROM pembelian WHERE tanggal <= (SELECT end_date FROM params)
      ),
      penjualan_total AS (
        SELECT COALESCE(SUM(qty), 0) AS total FROM penjualan WHERE tanggal <= (SELECT end_date FROM params)
      ),
      penyesuaian_total AS (
        SELECT COALESCE(SUM(qty), 0) AS total FROM stok_penyesuaian WHERE tanggal <= (SELECT end_date FROM params)
      )
      SELECT 
        bs.total AS stok_awal_total,
        pt.total AS pembelian_total,
        pj.total AS penjualan_total,
        pen.total AS penyesuaian_total,
        bs.total + pt.total - pj.total + pen.total AS stok_akhir_total
      FROM base_stock bs, pembelian_total pt, penjualan_total pj, penyesuaian_total pen
    `, [targetBulan, targetTahun]);

    // 3. Stok per Kategori
    const stokPerKategori = await pool.query(`
      WITH params AS (
        SELECT (make_date($2::int, $1::int, 1) + interval '1 month')::date AS end_date
      ),
      base_stock AS (
        SELECT 
          CASE
            WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'modul'
            WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'tas'
            WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
              OR UPPER(p.nama_produk) LIKE 'KUNING%'
              OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'seragam'
            ELSE 'lain_lain'
          END AS kategori,
          COALESCE(SUM(sa.qty_awal), 0) AS stok_awal
        FROM produk p
        LEFT JOIN stok_awal sa ON sa.sku = p.sku
        GROUP BY kategori
      ),
      pembelian AS (
        SELECT 
          CASE
            WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'modul'
            WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'tas'
            WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
              OR UPPER(p.nama_produk) LIKE 'KUNING%'
              OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'seragam'
            ELSE 'lain_lain'
          END AS kategori,
          COALESCE(SUM(pb.qty), 0) AS total_beli
        FROM produk p
        LEFT JOIN pembelian pb ON pb.sku = p.sku AND pb.tanggal <= (SELECT end_date FROM params)
        GROUP BY kategori
      ),
      penjualan AS (
        SELECT 
          CASE
            WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'modul'
            WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'tas'
            WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
              OR UPPER(p.nama_produk) LIKE 'KUNING%'
              OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'seragam'
            ELSE 'lain_lain'
          END AS kategori,
          COALESCE(SUM(j.qty), 0) AS total_jual
        FROM produk p
        LEFT JOIN penjualan j ON j.sku = p.sku AND j.tanggal <= (SELECT end_date FROM params)
        GROUP BY kategori
      )
      SELECT 
        bs.kategori,
        COALESCE(bs.stok_awal, 0) AS stok_awal,
        COALESCE(pb.total_beli, 0) AS total_pembelian,
        COALESCE(pj.total_jual, 0) AS total_penjualan,
        COALESCE(bs.stok_awal, 0) + COALESCE(pb.total_beli, 0) - COALESCE(pj.total_jual, 0) AS stok_akhir
      FROM base_stock bs
      LEFT JOIN pembelian pb ON pb.kategori = bs.kategori
      LEFT JOIN penjualan pj ON pj.kategori = bs.kategori
    `, [targetBulan, targetTahun]);

    // 4. Stok Kritis (stok <= 0 atau < 10)
    const stokKritis = await pool.query(`
      WITH params AS (
        SELECT (make_date($2::int, $1::int, 1) + interval '1 month')::date AS end_date
      ),
      base_stock AS (
        SELECT sku, COALESCE(SUM(qty_awal), 0) AS stok_awal
        FROM stok_awal GROUP BY sku
      ),
      pembelian_total AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_beli
        FROM pembelian WHERE tanggal <= (SELECT end_date FROM params) GROUP BY sku
      ),
      penjualan_total AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_jual
        FROM penjualan WHERE tanggal <= (SELECT end_date FROM params) GROUP BY sku
      ),
      penyesuaian_total AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_adjust
        FROM stok_penyesuaian WHERE tanggal <= (SELECT end_date FROM params) GROUP BY sku
      ),
      rolling AS (
        SELECT 
          p.sku,
          p.nama_produk,
          COALESCE(bs.stok_awal, 0) + COALESCE(pt.total_beli, 0) - COALESCE(pj.total_jual, 0) + COALESCE(pen.total_adjust, 0) AS stok_akhir
        FROM produk p
        LEFT JOIN base_stock bs ON bs.sku = p.sku
        LEFT JOIN pembelian_total pt ON pt.sku = p.sku
        LEFT JOIN penjualan_total pj ON pj.sku = p.sku
        LEFT JOIN penyesuaian_total pen ON pen.sku = p.sku
      )
      SELECT sku, nama_produk, stok_akhir
      FROM rolling
      WHERE stok_akhir <= 0 OR stok_akhir < 10
      ORDER BY stok_akhir ASC
    `, [targetBulan, targetTahun]);

    // 5. Forecast Sederhana (berdasarkan 3 bulan terakhir)
    const forecastData = await pool.query(`
      WITH params AS (
        SELECT 
          CURRENT_DATE AS today,
          make_date($2::int, $1::int, 1) AS current_month_start,
          make_date($2::int, $1::int, 1) - interval '1 month' AS prev_month_start,
          make_date($2::int, $1::int, 1) - interval '2 months' AS two_months_ago_start
      ),
      monthly_sales AS (
        SELECT 
          p.sku,
          p.nama_produk,
          SUM(CASE WHEN j.tanggal >= (SELECT current_month_start FROM params) AND j.tanggal < (SELECT current_month_start FROM params) + interval '1 month' THEN j.qty ELSE 0 END) AS bulan_ini,
          SUM(CASE WHEN j.tanggal >= (SELECT prev_month_start FROM params) AND j.tanggal < (SELECT current_month_start FROM params) THEN j.qty ELSE 0 END) AS bulan_lalu,
          SUM(CASE WHEN j.tanggal >= (SELECT two_months_ago_start FROM params) AND j.tanggal < (SELECT prev_month_start FROM params) THEN j.qty ELSE 0 END) AS dua_bulan_lalu
        FROM produk p
        LEFT JOIN penjualan j ON j.sku = p.sku
        GROUP BY p.sku, p.nama_produk
      ),
      ema_calc AS (
        SELECT 
          sku,
          nama_produk,
          bulan_ini,
          bulan_lalu,
          dua_bulan_lalu,
          ROUND((0.5 * bulan_ini + 0.3 * bulan_lalu + 0.2 * dua_bulan_lalu)::numeric, 0) AS forecast
        FROM monthly_sales
      )
      SELECT 
        sku,
        nama_produk,
        bulan_ini,
        bulan_lalu,
        dua_bulan_lalu,
        forecast,
        CASE WHEN forecast > bulan_ini THEN 'Naik' WHEN forecast < bulan_ini THEN 'Turun' ELSE 'Stabil' END AS trend
      FROM ema_calc
      WHERE bulan_ini > 0 OR bulan_lalu > 0 OR dua_bulan_lalu > 0
      ORDER BY forecast DESC
      LIMIT 20
    `, [targetBulan, targetTahun]);

    const result = {
      periode: {
        bulan: targetBulan,
        tahun: targetTahun,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      },
      ringkasan: {
        stok_awal: Number(ringkasanStok.rows[0]?.stok_awal_total || 0),
        total_pembelian: Number(ringkasanStok.rows[0]?.pembelian_total || 0),
        total_penjualan: Number(ringkasanStok.rows[0]?.penjualan_total || 0),
        total_penyesuaian: Number(ringkasanStok.rows[0]?.penyesuaian_total || 0),
        stok_akhir: Number(ringkasanStok.rows[0]?.stok_akhir_total || 0)
      },
      produk: stokGudang.rows.map(r => ({
        sku: r.sku,
        nama_produk: r.nama_produk,
        kategori: r.kategori,
        stok_awal: Number(r.stok_awal || 0),
        total_pembelian: Number(r.total_pembelian || 0),
        total_penjualan: Number(r.total_penjualan || 0),
        total_penyesuaian: Number(r.total_penyesuaian || 0),
        stok_akhir: Number(r.stok_akhir || 0),
        harga_beli: Number(r.harga_beli || 0),
        harga_jual: Number(r.harga_jual || 0)
      })),
      kategori: stokPerKategori.rows.map(r => ({
        kategori: r.kategori,
        label: r.kategori === 'modul' ? 'Modul'
             : r.kategori === 'tas' ? 'Tas'
             : r.kategori === 'seragam' ? 'Seragam'
             : 'Lain-Lain',
        stok_awal: Number(r.stok_awal || 0),
        total_pembelian: Number(r.total_pembelian || 0),
        total_penjualan: Number(r.total_penjualan || 0),
        stok_akhir: Number(r.stok_akhir || 0)
      })),
      stok_kritis: stokKritis.rows.map(r => ({
        sku: r.sku,
        nama_produk: r.nama_produk,
        stok_akhir: Number(r.stok_akhir || 0)
      })),
      forecast: forecastData.rows.map(r => ({
        sku: r.sku,
        nama_produk: r.nama_produk,
        bulan_ini: Number(r.bulan_ini || 0),
        bulan_lalu: Number(r.bulan_lalu || 0),
        dua_bulan_lalu: Number(r.dua_bulan_lalu || 0),
        forecast: Number(r.forecast || 0),
        trend: r.trend
      })),
      generated_at: new Date().toISOString()
    };

    res.status(200).json(result);
  } catch (err) {
    console.error("V3 PERSEDIAAN ERROR:", err);
    // Return empty but valid response instead of 500
    const now = new Date();
    const fallbackBulan = Number(req.query.bulan || now.getMonth() + 1);
    const fallbackTahun = Number(req.query.tahun || now.getFullYear());
    const startDate = new Date(fallbackTahun, fallbackBulan - 1, 1);
    const endDate = new Date(fallbackTahun, fallbackBulan, 0);
    
    res.status(200).json({
      periode: { bulan: fallbackBulan, tahun: fallbackTahun, start_date: startDate.toISOString().split('T')[0], end_date: endDate.toISOString().split('T')[0] },
      ringkasan: { stok_awal: 0, total_pembelian: 0, total_penjualan: 0, total_penyesuaian: 0, stok_akhir: 0 },
      produk: [],
      kategori: [],
      stok_kritis: [],
      forecast: [],
      generated_at: new Date().toISOString(),
      _error: err.message
    });
  }
}