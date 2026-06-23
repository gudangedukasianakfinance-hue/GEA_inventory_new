// Netlify Function - V3 Dashboard API
import { Pool } from "pg";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

export default async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  const url = new URL(event.path, 'https://localhost');
  const params = Object.fromEntries(url.searchParams);
  if (event.queryStringParameters) {
    Object.assign(params, event.queryStringParameters);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const filterBulan = parseInt(params.bulan) || currentMonth;
  const filterTahun = parseInt(params.tahun) || currentYear;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new Response(JSON.stringify({ error: "Database URL not configured" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    const startOfMonth = new Date(filterTahun, filterBulan - 1, 1);
    const endOfMonth = new Date(filterTahun, filterBulan, 0);
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];

    // 1. Distribusi
    const distribusiPeriode = await pool.query(`
      SELECT COUNT(DISTINCT j.sku) AS distribusi_count,
        COALESCE(SUM(j.qty), 0) AS total_qty,
        COUNT(DISTINCT j.nama_outlet) AS outlet_count
      FROM penjualan j WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // 2. Penjualan
    const penjualanPeriode = await pool.query(`
      SELECT COALESCE(SUM(qty), 0) AS total_qty,
        COALESCE(SUM(j.qty * p.harga_jual), 0) AS nominal,
        COUNT(DISTINCT nama_outlet) AS customer_count
      FROM penjualan j JOIN produk p ON p.sku = j.sku
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // 3. Profit
    const profitPeriode = await pool.query(`
      SELECT COALESCE(SUM((p.harga_jual - p.harga_beli) * j.qty), 0) AS total_profit
      FROM penjualan j JOIN produk p ON p.sku = j.sku
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // 4. Siswa Aktif
    const totalSiswaAktif = await pool.query(`
      SELECT COALESCE(SUM(jumlah_siswa), 0) AS total_siswa
      FROM outlet_siswa_level_bulanan
      WHERE EXTRACT(MONTH FROM periode) = $1 AND EXTRACT(YEAR FROM periode) = $2
    `, [filterBulan, filterTahun]);

    // 5. Produk Aktif
    const produkAktif = await pool.query(`
      SELECT COUNT(DISTINCT sku) AS total FROM penjualan
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startDate, endDate]);

    // 6. Outlet Aktif
    const outletAktif = await pool.query(`
      SELECT COUNT(DISTINCT nama_outlet) AS total FROM penjualan
      WHERE tanggal >= $1 AND tanggal <= $2
    `, [startDate, endDate]);

    // 7. Total Produk
    const totalProduk = await pool.query(`SELECT COUNT(*) AS total FROM produk`);

    // 8. Total Outlet
    const totalOutlet = await pool.query(`SELECT COUNT(*) AS total FROM outlet`);

    // 9. Stok Kritis
    let stokKritis = { rows: [{ kritis_count: 0 }] };
    let stokKritisList = { rows: [] };
    try {
      stokKritis = await pool.query(`
        WITH produk_stok AS (
          SELECT p.sku, p.nama_produk,
            COALESCE((SELECT SUM(qty_awal) FROM stok_awal WHERE sku = p.sku GROUP BY sku), 0)
            + COALESCE((SELECT SUM(qty) FROM pembelian WHERE sku = p.sku GROUP BY sku), 0)
            - COALESCE((SELECT SUM(qty) FROM penjualan WHERE sku = p.sku GROUP BY sku), 0)
            + COALESCE((SELECT SUM(qty) FROM stok_penyesuaian WHERE sku = p.sku GROUP BY sku), 0) AS stok_akhir
          FROM produk p
        )
        SELECT COUNT(*) AS kritis_count FROM produk_stok
        WHERE stok_akhir <= 0 OR stok_akhir < 10
      `);

      stokKritisList = await pool.query(`
        WITH produk_stok AS (
          SELECT p.sku, p.nama_produk,
            COALESCE((SELECT SUM(qty_awal) FROM stok_awal WHERE sku = p.sku GROUP BY sku), 0)
            + COALESCE((SELECT SUM(qty) FROM pembelian WHERE sku = p.sku GROUP BY sku), 0)
            - COALESCE((SELECT SUM(qty) FROM penjualan WHERE sku = p.sku GROUP BY sku), 0)
            + COALESCE((SELECT SUM(qty) FROM stok_penyesuaian WHERE sku = p.sku GROUP BY sku), 0) AS stok_akhir
          FROM produk p
        )
        SELECT sku, nama_produk, stok_akhir FROM produk_stok
        WHERE stok_akhir <= 0 OR stok_akhir < 10 ORDER BY stok_akhir ASC LIMIT 20
      `);
    } catch (err) {
      console.error('Stok kritis error:', err.message);
    }

    // 10. SO Berjalan
    const soBerjalan = await pool.query(`
      SELECT COUNT(*) AS total FROM stok_opname_perintah WHERE status IN ('menunggu', 'proses')
    `);

    // 11. SO Selesai
    const soSelesai = await pool.query(`
      SELECT COUNT(*) AS total FROM stok_opname_perintah WHERE status = 'selesai' AND bulan = $1 AND tahun = $2
    `, [filterBulan, filterTahun]);

    // 12. Users
    const totalUsers = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE is_active = true`);

    // 13. Stok Gudang
    const stokGudang = await pool.query(`
      WITH params AS (SELECT CURRENT_DATE AS end_date),
      base_stock AS (SELECT COALESCE(SUM(qty_awal), 0) AS total FROM stok_awal),
      pembelian_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM pembelian WHERE tanggal <= (SELECT end_date FROM params)),
      penjualan_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM penjualan WHERE tanggal <= (SELECT end_date FROM params)),
      penyesuaian_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM stok_penyesuaian WHERE tanggal <= (SELECT end_date FROM params))
      SELECT bs.total AS stok_awal, pt.total AS pembelian, pj.total AS penjualan, pen.total AS penyesuaian,
        bs.total + pt.total - pj.total + pen.total AS stok_akhir
      FROM base_stock bs, pembelian_total pt, penjualan_total pj, penyesuaian_total pen
    `);

    const result = {
      filter: { bulan: filterBulan, tahun: filterTahun },
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
      users: { total: Number(totalUsers.rows[0]?.total || 0) },
      generated_at: new Date().toISOString()
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } finally {
    await pool.end();
  }
}
