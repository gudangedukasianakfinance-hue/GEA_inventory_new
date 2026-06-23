import pool from "../services/db.js";

// Outlet Transaksi Summary API - Dashboard Widget
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const type = url.searchParams.get('type') || 'transaksi'; // 'transaksi' atau 'non-transaksi'
    const bulan = parseInt(url.searchParams.get('bulan')) || new Date().getMonth() + 1;
    const tahun = parseInt(url.searchParams.get('tahun')) || new Date().getFullYear();

    // Date range for period
    const startOfMonth = new Date(tahun, bulan - 1, 1);
    const endOfMonth = new Date(tahun, bulan, 0);
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];

    let result;

    if (type === 'transaksi') {
      // Outlet YANG MELAKUKAN TRANSAKSI di periode ini
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
      // Outlet YANG TIDAK MELAKUKAN TRANSAKSI di periode ini
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

    res.status(200).json({
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
    });

  } catch (err) {
    console.error("OUTLET TRANSAKSI SUMMARY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}
