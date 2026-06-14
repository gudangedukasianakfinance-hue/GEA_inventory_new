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

    // 2. Penjualan Periode - Qty and Nominal
    const penjualanPeriode = await pool.query(`
      SELECT 
        COALESCE(SUM(qty), 0) AS total_qty,
        COALESCE(SUM(j.qty * p.harga_jual), 0) AS nominal,
        COUNT(DISTINCT nama_outlet) AS customer_count
      FROM penjualan j
      JOIN produk p ON p.sku = j.sku
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
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

    // 9. Stok Kritis - simplified query
    let stokKritis = { rows: [{ kritis_count: 0 }] };
    let stokKritisList = { rows: [] };
    try {
      // Try to get kriti products using available tables
      stokKritis = await pool.query(`
        WITH produk_stok AS (
          SELECT 
            p.sku,
            p.nama_produk,
            COALESCE(
              (SELECT SUM(qty_awal) FROM stok_awal WHERE sku = p.sku GROUP BY sku),
              0
            ) + COALESCE(
              (SELECT SUM(qty) FROM pembelian WHERE sku = p.sku GROUP BY sku),
              0
            ) - COALESCE(
              (SELECT SUM(qty) FROM penjualan WHERE sku = p.sku GROUP BY sku),
              0
            ) + COALESCE(
              (SELECT SUM(qty) FROM stok_penyesuaian WHERE sku = p.sku GROUP BY sku),
              0
            ) AS stok_akhir
          FROM produk p
        )
        SELECT COUNT(*) AS kritis_count
        FROM produk_stok
        WHERE stok_akhir <= 0 OR stok_akhir < 10
      `);
      
      // Get list of kriti products
      stokKritisList = await pool.query(`
        WITH produk_stok AS (
          SELECT 
            p.sku,
            p.nama_produk,
            COALESCE(
              (SELECT SUM(qty_awal) FROM stok_awal WHERE sku = p.sku GROUP BY sku),
              0
            ) + COALESCE(
              (SELECT SUM(qty) FROM pembelian WHERE sku = p.sku GROUP BY sku),
              0
            ) - COALESCE(
              (SELECT SUM(qty) FROM penjualan WHERE sku = p.sku GROUP BY sku),
              0
            ) + COALESCE(
              (SELECT SUM(qty) FROM stok_penyesuaian WHERE sku = p.sku GROUP BY sku),
              0
            ) AS stok_akhir
          FROM produk p
        )
        SELECT sku, nama_produk, stok_akhir
        FROM produk_stok
        WHERE stok_akhir <= 0 OR stok_akhir < 10
        ORDER BY stok_akhir ASC
        LIMIT 20
      `);
    } catch (err) {
      console.error('Stok kritis query error:', err.message);
      // Fallback: try simpler query
      try {
        stokKritis = await pool.query(`
          SELECT COUNT(*) AS kritis_count
          FROM produk
          WHERE COALESCE(stok, 0) < 10
        `);
        stokKritisList = await pool.query(`
          SELECT sku, nama_produk, COALESCE(stok, 0) AS stok_akhir
          FROM produk
          WHERE COALESCE(stok, 0) < 10
          ORDER BY stok ASC
          LIMIT 20
        `);
      } catch (err2) {
        console.error('Fallback stok kritis error:', err2.message);
      }
    }

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
          nominal: Number(penjualanPeriode.rows[0]?.nominal || 0),
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
        kritis_list: stokKritisList.rows.map(r => ({
          sku: r.sku,
          nama_produk: r.nama_produk,
          stok: Number(r.stok_akhir || 0)
        })),
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