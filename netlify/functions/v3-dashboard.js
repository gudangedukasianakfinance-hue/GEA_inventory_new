// Netlify Function - V3 Dashboard API
import { Pool } from "pg";

// Helper to read body from various formats
async function parseBody(event) {
  const body = event.body;
  if (!body) return {};
  
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  
  if (body && typeof body === 'object' && typeof body.getReader === 'function') {
    try {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }
      result += decoder.decode();
      return JSON.parse(result);
    } catch { return {}; }
  }
  
  if (typeof body === 'object') return body;
  return {};
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

export default async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  // Get query params from path
  const url = new URL(event.path, 'https://localhost');
  const params = Object.fromEntries(url.searchParams);
  
  // Override with queryStringParameters if available
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

    // 1. Distribusi Periode
    const distribusiPeriode = await pool.query(`
      SELECT 
        COUNT(DISTINCT j.sku) AS distribusi_count,
        COALESCE(SUM(j.qty), 0) AS total_qty,
        COUNT(DISTINCT j.nama_outlet) AS outlet_count
      FROM penjualan j
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // 2. Penjualan Periode
    const penjualanPeriode = await pool.query(`
      SELECT 
        COALESCE(SUM(qty), 0) AS total_qty,
        COALESCE(SUM(j.qty * p.harga_jual), 0) AS nominal,
        COUNT(DISTINCT nama_outlet) AS customer_count
      FROM penjualan j
      JOIN produk p ON p.sku = j.sku
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // 3. Profit Periode
    const profitPeriode = await pool.query(`
      SELECT COALESCE(SUM((p.harga_jual - p.harga_beli) * j.qty), 0) AS total_profit
      FROM penjualan j
      JOIN produk p ON p.sku = j.sku
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // 4. Total Siswa Aktif
    const totalSiswaAktif = await pool.query(`
      SELECT COALESCE(SUM(jumlah_siswa), 0) AS total_siswa
      FROM outlet_siswa_level_bulanan
      WHERE EXTRACT(MONTH FROM periode) = $1
        AND EXTRACT(YEAR FROM periode) = $2
    `, [filterBulan, filterTahun]);

    // 5. Stok Gudang
    const stokGudang = await pool.query(`
      SELECT COALESCE(SUM(stok), 0) AS total_stok
      FROM produk
    `);

    // 6. Top Outlet
    const topOutlet = await pool.query(`
      SELECT o.nama_outlet, SUM(j.qty * p.harga_jual) AS total_nominal, SUM(j.qty) AS total_qty
      FROM penjualan j
      JOIN produk p ON p.sku = j.sku
      JOIN outlet o ON o.nama_outlet = j.nama_outlet
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
      GROUP BY o.id, o.nama_outlet
      ORDER BY total_nominal DESC
      LIMIT 5
    `, [startDate, endDate]);

    // 7. Stok Kritis
    const stokKritis = await pool.query(`
      SELECT p.sku, p.nama_produk, COALESCE(s.stok, 0) AS stok
      FROM produk p
      LEFT JOIN (
        SELECT sku, SUM(CASE WHEN jenis = 'masuk' THEN qty ELSE -qty END) AS stok
        FROM stok
        GROUP BY sku
      ) s ON s.sku = p.sku
      WHERE COALESCE(s.stok, 0) <= 10
      ORDER BY stok ASC
      LIMIT 10
    `);

    // 8. Aktivitas Terbaru (recent transactions)
    const aktivitasTerbaru = await pool.query(`
      SELECT 
        'penjualan' AS jenis,
        j.tanggal,
        j.nama_outlet AS outlet,
        j.qty,
        p.harga_jual * j.qty AS nominal
      FROM penjualan j
      JOIN produk p ON p.sku = j.sku
      ORDER BY j.tanggal DESC
      LIMIT 10
    `);

    const result = {
      kpi: {
        distribusi: {
          label: "Produk Terjual",
          value: Number(distribusiPeriode.rows[0]?.distribusi_count || 0),
          total_qty: Number(distribusiPeriode.rows[0]?.total_qty || 0),
          outlet_count: Number(distribusiPeriode.rows[0]?.outlet_count || 0)
        },
        penjualan: {
          label: "Penjualan",
          value: Number(penjualanPeriode.rows[0]?.nominal || 0),
          total_qty: Number(penjualanPeriode.rows[0]?.total_qty || 0),
          customer_count: Number(penjualanPeriode.rows[0]?.customer_count || 0)
        },
        profit: {
          label: "Profit",
          value: Number(profitPeriode.rows[0]?.total_profit || 0)
        },
        siswaAktif: {
          label: "Siswa Aktif",
          value: Number(totalSiswaAktif.rows[0]?.total_siswa || 0)
        },
        stokGudang: {
          label: "Stok Gudang",
          value: Number(stokGudang.rows[0]?.total_stok || 0)
        }
      },
      topOutlet: topOutlet.rows.map(r => ({
        nama_outlet: r.nama_outlet,
        total_nominal: Number(r.total_nominal || 0),
        total_qty: Number(r.total_qty || 0)
      })),
      stok: {
        kritis_list: stokKritis.rows.map(r => ({
          sku: r.sku,
          nama_produk: r.nama_produk,
          stok: Number(r.stok || 0)
        }))
      },
      aktivitasTerbaru: aktivitasTerbaru.rows.map(r => ({
        jenis: r.jenis,
        tanggal: r.tanggal,
        outlet: r.outlet,
        qty: Number(r.qty || 0),
        nominal: Number(r.nominal || 0)
      })),
      filter: { bulan: filterBulan, tahun: filterTahun }
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
