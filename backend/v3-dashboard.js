import pool from "../services/db.js";

// V3 Admin Dashboard - Data from Neon Database
export default async function handler(req, res) {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get filter parameters from query
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filterBulan = parseInt(url.searchParams.get('bulan')) || currentMonth;
    const filterTahun = parseInt(url.searchParams.get('tahun')) || currentYear;

    // Helper function for date range
    const getMonthDateRange = (bulan, tahun) => {
      const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
      const endDate = new Date(tahun, bulan, 0).toISOString().split('T')[0];
      return { startDate, endDate };
    };

    const { startDate, endDate } = getMonthDateRange(filterBulan, filterTahun);

    // Check if database is available
    if (!pool) {
      console.warn('Database not configured - returning empty dashboard');
      return res.status(200).json({
        today: { penjualan: 0, customer_count: 0, pembelian: 0 },
        produk: { aktif: 0, total: 0 },
        outlet: { aktif: 0, total: 0 },
        stok: { kritis: 0, gudang: { awal: 0, pembelian: 0, penjualan: 0, penyesuaian: 0, akhir: 0 } },
        distribusi: { periode: { count: 0, qty: 0, outlet_count: 0 } },
        opname: { menunggu: 0, proses: 0, selesai: 0, berjalan: 0 },
        users: { total: 0 },
        profit: 0,
        siswa_aktif: 0,
        filter: { bulan: filterBulan, tahun: filterTahun },
        generated_at: new Date().toISOString(),
        _warning: 'Database not configured'
      });
    }

    // 1. Penjualan Periode (based on filter)
    const penjualanPeriode = await pool.query(`
      SELECT 
        COALESCE(SUM(qty), 0) AS total_qty,
        COUNT(DISTINCT nama_outlet) AS customer_count
      FROM penjualan 
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startDate, endDate]);

    // 2. Pembelian Periode
    const pembelianPeriode = await pool.query(`
      SELECT COALESCE(SUM(qty), 0) AS total_qty
      FROM pembelian 
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startDate, endDate]);

    // 3. Produk Aktif (yang memiliki transaksi di periode ini)
    const produkAktif = await pool.query(`
      SELECT COUNT(DISTINCT sku) AS total
      FROM penjualan
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startDate, endDate]);

    // 4. Outlet Aktif (outlet yang transaksi di periode ini)
    const outletAktif = await pool.query(`
      SELECT COUNT(DISTINCT nama_outlet) AS total
      FROM penjualan
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startDate, endDate]);

    // 5. Total Produk
    const totalProduk = await pool.query(`SELECT COUNT(*) AS total FROM produk`);

    // 6. Total Outlet/Gerai
    const totalOutlet = await pool.query(`SELECT COUNT(*) AS total FROM outlet`);

    // 7. Stok Kritis - Produk dengan stok akhir <= min_stok atau stok = 0
    const stokKritis = await pool.query(`
      WITH params AS (
        SELECT $2 AS end_date
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
          p.harga_beli,
          p.harga_jual,
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
    `, [startDate, endDate]);

    // 8. SO Progress - Real counts from stok_opname_perintah
    const soMenunggu = await pool.query(`
      SELECT COUNT(*) AS total
      FROM stok_opname_perintah
      WHERE status = 'menunggu'
    `);

    const soProses = await pool.query(`
      SELECT COUNT(*) AS total
      FROM stok_opname_perintah
      WHERE status = 'proses'
    `);

    const soSelesai = await pool.query(`
      SELECT COUNT(*) AS total
      FROM stok_opname_perintah
      WHERE status = 'selesai'
    `);

    // 9. Total Users
    const totalUsers = await pool.query(`
      SELECT COUNT(*) AS total
      FROM users
      WHERE is_active = true
    `);

    // 10. STOK GUDANG AKTUAL (REAL) - up to end of period
    const stokGudang = await pool.query(`
      WITH params AS (
        SELECT $1 AS end_date
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
    `, [endDate]);

    // 11. DISTRIBUSI PERIODE (REAL) - From outlet_stok_masuk table
    const distribusiPeriode = await pool.query(`
      SELECT 
        COUNT(*) AS distribusi_count,
        COALESCE(SUM(qty), 0) AS total_qty,
        COUNT(DISTINCT outlet_id) AS outlet_count
      FROM outlet_stok_masuk
      WHERE tanggal >= $1 AND tanggal <= $2
        AND sumber = 'warehouse_transfer'
    `, [startDate, endDate]);

    // 12. PROFIT - Calculate from penjualan (harga_jual - harga_beli) * qty
    const profitData = await pool.query(`
      SELECT 
        COALESCE(SUM(p.qty * (pr.harga_jual - pr.harga_beli)), 0) AS total_profit
      FROM penjualan p
      JOIN produk pr ON pr.sku = p.sku
      WHERE p.tanggal >= $1 AND p.tanggal <= $2
    `, [startDate, endDate]);

    // 13. Total Siswa Aktif - Sum from outlet_siswa_level_bulanan
    const siswaAktif = await pool.query(`
      SELECT COALESCE(SUM(jumlah_siswa), 0) AS total_siswa
      FROM outlet_siswa_level_bulanan
      WHERE periode >= $1 AND periode <= $2
    `, [startDate, endDate]);

    const result = {
      today: {
        penjualan: Number(penjualanPeriode.rows[0]?.total_qty || 0),
        customer_count: Number(penjualanPeriode.rows[0]?.customer_count || 0),
        pembelian: Number(pembelianPeriode.rows[0]?.total_qty || 0)
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
      distribusi: {
        periode: {
          count: Number(distribusiPeriode.rows[0]?.distribusi_count || 0),
          qty: Number(distribusiPeriode.rows[0]?.total_qty || 0),
          outlet_count: Number(distribusiPeriode.rows[0]?.outlet_count || 0)
        }
      },
      opname: {
        menunggu: Number(soMenunggu.rows[0]?.total || 0),
        proses: Number(soProses.rows[0]?.total || 0),
        selesai: Number(soSelesai.rows[0]?.total || 0),
        berjalan: Number(soMenunggu.rows[0]?.total || 0) + Number(soProses.rows[0]?.total || 0)
      },
      users: {
        total: Number(totalUsers.rows[0]?.total || 0)
      },
      profit: Number(profitData.rows[0]?.total_profit || 0),
      siswa_aktif: Number(siswaAktif.rows[0]?.total_siswa || 0),
      filter: {
        bulan: filterBulan,
        tahun: filterTahun
      },
      generated_at: new Date().toISOString()
    };

    res.status(200).json(result);
  } catch (err) {
    console.error("V3 DASHBOARD ERROR:", err);
    // Return empty but valid response instead of 500
    res.status(200).json({
      today: { penjualan: 0, customer_count: 0, pembelian: 0 },
      produk: { aktif: 0, total: 0 },
      outlet: { aktif: 0, total: 0 },
      stok: { kritis: 0, gudang: { awal: 0, pembelian: 0, penjualan: 0, penyesuaian: 0, akhir: 0 } },
      distribusi: { periode: { count: 0, qty: 0, outlet_count: 0 } },
      opname: { menunggu: 0, proses: 0, selesai: 0, berjalan: 0 },
      users: { total: 0 },
      profit: 0,
      siswa_aktif: 0,
      filter: { bulan: 1, tahun: 2024 },
      generated_at: new Date().toISOString(),
      _error: err.message
    });
  }
}