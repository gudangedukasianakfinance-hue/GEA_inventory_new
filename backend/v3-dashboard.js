import pool from "../services/db.js";

// V3 Admin Dashboard - Data from Neon Database
export default async function handler(req, res) {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get filter params (default to current month/year)
    const targetBulan = parseInt(req.query.bulan) || currentMonth;
    const targetTahun = parseInt(req.query.tahun) || currentYear;

    // 1. Total Produk
    const totalProduk = await pool.query(`SELECT COUNT(*) AS total FROM produk`);

    // 2. Total Outlet/Gerai
    const totalOutlet = await pool.query(`SELECT COUNT(*) AS total FROM outlet`);

    // 3. STOK GUDANG AKTUAL (REAL) - based on filter period
    const stokGudang = await pool.query(`
      WITH params AS (
        SELECT make_date($2::int, $1::int, 1) AS start_date,
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
        bs.total AS stok_awal,
        pt.total AS pembelian,
        pj.total AS penjualan,
        pen.total AS penyesuaian,
        bs.total + pt.total - pj.total + pen.total AS stok_akhir
      FROM base_stock bs, pembelian_total pt, penjualan_total pj, penyesuaian_total pen
    `, [targetBulan, targetTahun]);

    // 4. Stok Outlet (active outlets with transactions in period)
    const stokOutlet = await pool.query(`
      SELECT COUNT(DISTINCT nama_outlet) AS total
      FROM penjualan
      WHERE EXTRACT(MONTH FROM tanggal) = $1
        AND EXTRACT(YEAR FROM tanggal) = $2
    `, [targetBulan, targetTahun]);

    // 5. Distribusi Periode (from outlet_stok_masuk table)
    const distribusiPeriode = await pool.query(`
      SELECT 
        COUNT(*) AS distribusi_count,
        COALESCE(SUM(qty), 0) AS total_qty
      FROM outlet_stok_masuk
      WHERE EXTRACT(MONTH FROM tanggal) = $1
        AND EXTRACT(YEAR FROM tanggal) = $2
        AND sumber = 'warehouse_transfer'
    `, [targetBulan, targetTahun]);

    // 6. Penjualan Periode (from penjualan table)
    const penjualanPeriode = await pool.query(`
      SELECT 
        COALESCE(SUM(qty), 0) AS total_qty,
        COUNT(DISTINCT nama_outlet) AS customer_count,
        COALESCE(SUM(qty * harga_satuan), 0) AS total_nilai
      FROM penjualan
      WHERE EXTRACT(MONTH FROM tanggal) = $1
        AND EXTRACT(YEAR FROM tanggal) = $2
    `, [targetBulan, targetTahun]);

    // 7. Pembelian Periode (for profit calculation)
    const pembelianPeriode = await pool.query(`
      SELECT COALESCE(SUM(qty * harga_satuan), 0) AS total_nilai
      FROM pembelian
      WHERE EXTRACT(MONTH FROM tanggal) = $1
        AND EXTRACT(YEAR FROM tanggal) = $2
    `, [targetBulan, targetTahun]);

    // 8. Profit (Penjualan - Pembelian)
    const penjualanNilai = Number(penjualanPeriode.rows[0]?.total_nilai || 0);
    const pembelianNilai = Number(pembelianPeriode.rows[0]?.total_nilai || 0);
    const profit = penjualanNilai - pembelianNilai;

    // 9. Stok Kritis - Produk dengan stok akhir <= 0 atau < 10
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
      rolling_stok AS (
        SELECT 
          p.sku,
          p.nama_produk,
          COALESCE(bs.stok_awal, 0) + COALESCE(pt.total_beli, 0) - COALESCE(pj.total_jual, 0) + COALESCE(pa.total_adjust, 0) AS stok_akhir
        FROM produk p
        LEFT JOIN base_stock bs ON bs.sku = p.sku
        LEFT JOIN pembelian_total pt ON pt.sku = p.sku
        LEFT JOIN penjualan_total pj ON pj.sku = p.sku
        LEFT JOIN penyesuaian_total pa ON pa.sku = p.sku
      )
      SELECT COUNT(*) AS kritis_count
      FROM rolling_stok
      WHERE stok_akhir <= 0 OR stok_akhir < 10
    `, [targetBulan, targetTahun]);

    // 10. SO Berjalan
    const soBerjalan = await pool.query(`
      SELECT COUNT(*) AS total
      FROM stok_opname_perintah
      WHERE status IN ('menunggu', 'proses')
    `);

    // 11. Total Users Active
    const totalUsers = await pool.query(`
      SELECT COUNT(*) AS total
      FROM users
      WHERE is_active = true
    `);

    // 12. Forecast (based on 3-month average)
    const forecastData = await pool.query(`
      WITH params AS (
        SELECT 
          make_date($2::int, $1::int, 1) AS current_month_start,
          make_date($2::int, $1::int, 1) - interval '1 month' AS prev_month_start,
          make_date($2::int, $1::int, 1) - interval '2 months' AS two_months_ago_start
      ),
      monthly_sales AS (
        SELECT 
          COALESCE(SUM(CASE WHEN j.tanggal >= (SELECT current_month_start FROM params) AND j.tanggal < (SELECT current_month_start FROM params) + interval '1 month' THEN j.qty ELSE 0 END), 0) AS bulan_ini,
          COALESCE(SUM(CASE WHEN j.tanggal >= (SELECT prev_month_start FROM params) AND j.tanggal < (SELECT current_month_start FROM params) THEN j.qty ELSE 0 END), 0) AS bulan_lalu,
          COALESCE(SUM(CASE WHEN j.tanggal >= (SELECT two_months_ago_start FROM params) AND j.tanggal < (SELECT prev_month_start FROM params) THEN j.qty ELSE 0 END), 0) AS dua_bulan_lalu
        FROM penjualan j
      )
      SELECT ROUND((0.5 * bulan_ini + 0.3 * bulan_lalu + 0.2 * dua_bulan_lalu)::numeric, 0) AS forecast
      FROM monthly_sales
    `, [targetBulan, targetTahun]);

    const result = {
      periode: {
        bulan: targetBulan,
        tahun: targetTahun,
        label: `${getNamaBulan(targetBulan)} ${targetTahun}`
      },
      produk: {
        total: Number(totalProduk.rows[0]?.total || 0)
      },
      outlet: {
        total: Number(totalOutlet.rows[0]?.total || 0),
        aktif: Number(stokOutlet.rows[0]?.total || 0)
      },
      stok: {
        gudang: {
          awal: Number(stokGudang.rows[0]?.stok_awal || 0),
          pembelian: Number(stokGudang.rows[0]?.pembelian || 0),
          penjualan: Number(stokGudang.rows[0]?.penjualan || 0),
          penyesuaian: Number(stokGudang.rows[0]?.penyesuaian || 0),
          akhir: Number(stokGudang.rows[0]?.stok_akhir || 0)
        },
        kritis: Number(stokKritis.rows[0]?.kritis_count || 0)
      },
      distribusi: {
        periode: {
          count: Number(distribusiPeriode.rows[0]?.distribusi_count || 0),
          qty: Number(distribusiPeriode.rows[0]?.total_qty || 0)
        }
      },
      periode_data: {
        penjualan: Number(penjualanPeriode.rows[0]?.total_qty || 0),
        customer_count: Number(penjualanPeriode.rows[0]?.customer_count || 0),
        nilai_penjualan: penjualanNilai
      },
      profit: profit,
      forecast: Number(forecastData.rows[0]?.forecast || 0),
      opname: {
        berjalan: Number(soBerjalan.rows[0]?.total || 0)
      },
      users: {
        total: Number(totalUsers.rows[0]?.total || 0)
      },
      generated_at: new Date().toISOString()
    };

    res.status(200).json(result);
  } catch (err) {
    console.error("V3 DASHBOARD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}

// Helper function to get month name in Indonesian
function getNamaBulan(bulan) {
  const namaBulan = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return namaBulan[bulan] || '';
}