// Netlify Function - Outlet Transaksi Summary API

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

export default async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  // Get query params
  const url = new URL(event.path, 'https://localhost');
  const params = Object.fromEntries(url.searchParams);
  
  if (event.queryStringParameters) {
    Object.assign(params, event.queryStringParameters);
  }

  const type = params.type || 'transaksi';
  const bulan = parseInt(params.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(params.tahun) || new Date().getFullYear();

  const startOfMonth = new Date(tahun, bulan - 1, 1);
  const endOfMonth = new Date(tahun, bulan, 0);
  const startDate = startOfMonth.toISOString().split('T')[0];
  const endDate = endOfMonth.toISOString().split('T')[0];

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new Response(JSON.stringify({ error: "Database URL not configured" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    let result;

    if (type === 'transaksi') {
      result = await pool.query(`
        SELECT 
          o.id AS outlet_id,
          o.nama_outlet,
          COUNT(DISTINCT j.id) AS total_transaksi,
          COALESCE(SUM(j.qty), 0) AS total_qty,
          COALESCE(SUM(j.qty * p.harga_jual), 0) AS total_nominal
        FROM outlet o
        INNER JOIN penjualan j ON j.nama_outlet = o.nama_outlet
          AND j.tanggal >= $1 AND j.tanggal <= $2
        LEFT JOIN produk p ON p.sku = j.sku
        GROUP BY o.id, o.nama_outlet
        ORDER BY total_nominal DESC
      `, [startDate, endDate]);
    } else {
      result = await pool.query(`
        SELECT 
          o.id AS outlet_id,
          o.nama_outlet,
          0 AS total_transaksi,
          0 AS total_qty,
          0 AS total_nominal
        FROM outlet o
        WHERE o.id NOT IN (
          SELECT DISTINCT o2.id
          FROM outlet o2
          INNER JOIN penjualan j ON j.nama_outlet = o2.nama_outlet
          WHERE j.tanggal >= $1 AND j.tanggal <= $2
        )
        ORDER BY o.nama_outlet ASC
      `, [startDate, endDate]);
    }

    return new Response(JSON.stringify({
      type: type,
      periode: { bulan, tahun },
      start_date: startDate,
      end_date: endDate,
      total_count: result.rows.length,
      data: result.rows.map((r, index) => ({
        no: index + 1,
        outlet_id: r.outlet_id,
        nama_outlet: r.nama_outlet,
        total_transaksi: Number(r.total_transaksi || 0),
        total_qty: Number(r.total_qty || 0),
        total_nominal: Number(r.total_nominal || 0)
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (error) {
    console.error("Outlet transaksi summary error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } finally {
    await pool.end();
  }
}
