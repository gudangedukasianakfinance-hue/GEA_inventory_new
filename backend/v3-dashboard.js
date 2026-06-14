import pool from "../services/db.js";

// V3 Admin Dashboard - Data from Neon Database
export default async function handler(req, res) {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get filter params from query string
    const url = new URL(req.url, "http://localhost");
    const filterBulan = parseInt(url.searchParams.get('bulan')) || currentMonth;
    const filterTahun = parseInt(url.searchParams.get('tahun')) || currentYear;

    // Helper to build date range for period
    const startOfMonth = new Date(filterTahun, filterBulan - 1, 1);
    const endOfMonth = new Date(filterTahun, filterBulan, 0);

    // 1. Distribusi Periode (from outlet_stok_masuk)
    const distribusiPeriode = await pool.query(`
      SELECT 
        COUNT(*) AS distribusi_count,
        COALESCE(SUM(qty), 0) AS total_qty,
        COUNT(DISTINCT outlet_id) AS outlet_count
      FROM outlet_stok_masuk
      WHERE tanggal >= $1 AND tanggal <= $2
        AND sumber = 'warehouse_sale_auto'
    `, [startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]);

    // 2. Penjualan Periode
    const penjualanPeriode = await pool.query(`
      SELECT 
        COALESCE(SUM(qty), 0) AS total_qty,
        COUNT(DISTINCT nama_outlet) AS customer_count
      FROM penjualan 
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]);

    // 3. Profit Periode (simplified: based on harga_jual - harga_beli)
    const profitPeriode = await pool.query(`
      SELECT COALESCE(SUM((p.harga_jual - p.harga_beli) * j.qty), 0) AS total_profit
      FROM penjualan j
      JOIN produk p ON p.sku = j.sku
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]);

    // 4. Total Siswa Aktif (from outlet_siswa_level_bulanan)
    const totalSiswaAktif = await pool.query(`
      SELECT COALESCE(SUM(jumlah_siswa), 0) AS total_siswa
      FROM outlet_siswa_level_bulanan
      WHERE EXTRACT(MONTH FROM periode) = $1
        AND EXTRACT(YEAR FROM periode) = $2
    `, [filterBulan, filterTahun]);

    // 5. Produk Aktif (yang memiliki transaksi di periode ini)
    const produkAktif = await pool.query(`
      SELECT COUNT(DISTINCT sku) AS total
      FROM penjualan
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]);

    // 6. Outlet Aktif (outlet yang transaksi di periode ini)
    const outletAktif = await pool.query(`
      SELECT COUNT(DISTINCT nama_outlet) AS total
      FROM penjualan
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]);

    // 7. Total Produk
    const totalProduk = await pool.query(`SELECT COUNT(*) AS total FROM produk`);

    // 8. Total Outlet/Gerai
    const totalOutlet = await pool.query(`SELECT COUNT(*) AS total FROM outlet`);

    // 9. Stok Kritis
    const stokKritis = await pool.query(`
      WITH params AS (
        SELECT CURRENT_DATE AS end_date
      ),
      base_stock AS (
        SELECT sku, COALESCE(SUM(qty_awal), 0) AS stok_awal
        FROM stok_awal
        GROUP BY sku
      ),
      pembelian_total AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_beli
        FROM pembelian
        WHERE tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      penjualan_total AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_jual
        FROM penjualan
        WHERE tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      penyesuaian_total AS (
        SELECT sku, COALESCE(SUM(qty), 0) AS total_adjust
        FROM stok_penyesuaian
        WHERE tanggal <= (SELECT end_date FROM params)
        GROUP BY sku
      ),
      rolling_stok AS (
        SELECT 
          p.sku,
          p.nama_produk,
          COALESCE(bs.stok_awal, 0) + COALESCE(pb.total_beli, 0) - COALESCE(pj.total_jual, 0) + COALESCE(pa.total_adjust, 0) AS stok_akhir
        FROM produk p
        LEFT JOIN base_stock bs ON bs.sku = p.sku
        LEFT JOIN pembelian_total pb ON pb.sku = p.sku
        LEFT JOIN penjualan_total pj ON pj.sku = p.sku
        LEFT JOIN penyesuaian_total pa ON pa.sku = p.sku
      )
      SELECT COUNT(*) AS kritis_count
      FROM rolling_stok
      WHERE stok_akhir <= 0 OR stok_akhir < 10
    `);

    // 10. SO Berjalan
    const soBerjalan = await pool.query(`
      SELECT COUNT(*) AS total
      FROM stok_opname_perintah
      WHERE status IN ('menunggu', 'proses')
    `);

    // 11. SO Selesai Bulan Ini
    const soSelesai = await pool.query(`
      SELECT COUNT(*) AS total
      FROM stok_opname_perintah
      WHERE status = 'selesai'
        AND bulan = $1
        AND tahun = $2
    `, [filterBulan, filterTahun]);

    // 12. Total Users
    const totalUsers = await pool.query(`
      SELECT COUNT(*) AS total
      FROM users
      WHERE is_active = true
    `);

    // 13. STOK GUDANG AKTUAL (REAL)
    const stokGudang = await pool.query(`
      WITH params AS (
        SELECT CURRENT_DATE AS end_date
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
    `);

    const result = {
      filter: {
        bulan: filterBulan,
        tahun: filterTahun
      },
      periode: {
        distribusi: {
          count: Number(distribusiPeriode.rows[0]?.distribusi_count || 0),
          qty: Number(distribusiPeriode.rows[0]?.total_qty || 0),
          outlet_count: Number(distribusiPeriode.rows[0]?.outlet_count || 0)
        },
        penjualan: {
          qty: Number(penjualanPeriode.rows[0]?.total_qty || 0),
          customer_count: Number(penjualanPeriode.rows[0]?.customer_count || 0)
        },
        profit: Number(profitPeriode.rows[0]?.total_profit || 0),
        total_siswa: Number(totalSiswaAktif.rows[0]?.total_siswa || 0)
      },
      produk: {
        aktif: Number(produkAktif.rows[0]?.total || 0),
        total: Number(totalProduk.rows[0]?.total || 0)
      },
      outlet: {
        aktif: Number(outletAktif.rows[0]?.total || 0),
        total: Number(totalOutlet.rows[0]?.total || 0)
      },
      stok: {
        kritis: Number(stokKritis.rows[0]?.kritis_count || 0),
        gudang: {
          awal: Number(stokGudang.rows[0]?.stok_awal || 0),
          pembelian: Number(stokGudang.rows[0]?.pembelian || 0),
          penjualan: Number(stokGudang.rows[0]?.penjualan || 0),
          penyesuaian: Number(stokGudang.rows[0]?.penyesuaian || 0),
          akhir: Number(stokGudang.rows[0]?.stok_akhir || 0)
        }
      },
      opname: {
        berjalan: Number(soBerjalan.rows[0]?.total || 0),
        selesai_bulan_ini: Number(soSelesai.rows[0]?.total || 0)
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