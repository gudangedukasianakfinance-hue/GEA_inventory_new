import pool from "../services/db.js";

// V3 Opname Detail - Input Qty Fisik oleh User
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // GET - Ambil daftar produk untuk opname berdasarkan perintah
    if (req.method === 'GET') {
      const { perintah_id, opname_id, kategori } = req.query;
      
      if (!perintah_id && !opname_id) {
        return res.status(400).json({ error: "perintah_id atau opname_id wajib" });
      }
      
      // Get perintah SO
      const perintah = await pool.query(
        `SELECT * FROM stok_opname_perintah WHERE id = $1`,
        [perintah_id]
      );
      
      if (perintah.rows.length === 0) {
        return res.status(404).json({ error: "Perintah SO tidak ditemukan" });
      }
      
      const p = perintah.rows[0];
      const kategoriTargets = p.kategori_targets ? JSON.parse(p.kategori_targets) : ['modul', 'seragam', 'poster', 'lain-lain'];
      
      // Get produk berdasarkan kategori_targets
      // STOK SISTEM dihitung dari rolling stock
      const produkList = await pool.query(`
        WITH params AS (
          SELECT (make_date($2::int, $1::int, 1) + interval '1 month')::date AS end_date
        ),
        base_stock AS (
          SELECT sku, COALESCE(SUM(qty_awal), 0) AS stok_awal FROM stok_awal GROUP BY sku
        ),
        pembelian_total AS (
          SELECT sku, COALESCE(SUM(qty), 0) AS total_beli FROM pembelian 
          WHERE tanggal <= (SELECT end_date FROM params) GROUP BY sku
        ),
        penjualan_total AS (
          SELECT sku, COALESCE(SUM(qty), 0) AS total_jual FROM penjualan 
          WHERE tanggal <= (SELECT end_date FROM params) GROUP BY sku
        ),
        penyesuaian_total AS (
          SELECT sku, COALESCE(SUM(qty), 0) AS total_adjust FROM stok_penyesuaian 
          WHERE tanggal <= (SELECT end_date FROM params) GROUP BY sku
        ),
        rolling_stok AS (
          SELECT 
            p.sku,
            p.nama_produk,
            CASE
              WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'modul'
              WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'tas'
              WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
                OR UPPER(p.nama_produk) LIKE 'KUNING%'
                OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'seragam'
              ELSE 'lain_lain'
            END AS kategori,
            COALESCE(bs.stok_awal, 0) + COALESCE(pt.total_beli, 0) - COALESCE(pj.total_jual, 0) + COALESCE(pen.total_adjust, 0) AS stok_sistem
          FROM produk p
          LEFT JOIN base_stock bs ON bs.sku = p.sku
          LEFT JOIN pembelian_total pt ON pt.sku = p.sku
          LEFT JOIN penjualan_total pj ON pj.sku = p.sku
          LEFT JOIN penyesuaian_total pen ON pen.sku = p.sku
        )
        SELECT 
          rs.sku,
          rs.nama_produk,
          rs.kategori,
          rs.stok_sistem,
          COALESCE(sod.stok_fisik, 0) AS stok_fisik,
          COALESCE(sod.selisih, 0) AS selisih,
          sod.id AS detail_id,
          sod.input_at
        FROM rolling_stok rs
        LEFT JOIN stok_opname_detail sod ON sod.sku = rs.sku AND sod.opname_id = $3
        WHERE rs.kategori = ANY($4::text[])
        ORDER BY rs.nama_produk
      `, [p.bulan, p.tahun, p.opname_id || 0, kategoriTargets]);
      
      res.status(200).json({
        perintah: {
          id: p.id,
          kode_so: p.kode_so,
          status: p.status,
          lokasi: p.lokasi
        },
        produk: produkList.rows.map(r => ({
          sku: r.sku,
          nama_produk: r.nama_produk,
          kategori: r.kategori,
          stok_sistem: Number(r.stok_sistem || 0),
          stok_fisik: Number(r.stok_fisik || 0),
          selisih: Number(r.selisih || 0),
          detail_id: r.detail_id,
          input_at: r.input_at
        })),
        total: produkList.rows.length
      });
    }
    
    // POST - Input qty fisik untuk satu produk
    else if (req.method === 'POST') {
      const { opname_id, sku, stok_fisik, checker } = req.body;
      
      if (!opname_id || !sku || stok_fisik === undefined) {
        return res.status(400).json({ error: "opname_id, sku, dan stok_fisik wajib diisi" });
      }
      
      // Get stok_sistem dari rolling stock
      const stokSistemResult = await pool.query(`
        WITH params AS (
          SELECT CURRENT_DATE AS end_date
        ),
        base_stock AS (
          SELECT COALESCE(SUM(qty_awal), 0) AS stok FROM stok_awal WHERE sku = $1 GROUP BY sku
        ),
        pembelian AS (
          SELECT COALESCE(SUM(qty), 0) AS total FROM pembelian WHERE sku = $1 AND tanggal <= (SELECT end_date FROM params)
        ),
        penjualan AS (
          SELECT COALESCE(SUM(qty), 0) AS total FROM penjualan WHERE sku = $1 AND tanggal <= (SELECT end_date FROM params)
        ),
        penyesuaian AS (
          SELECT COALESCE(SUM(qty), 0) AS total FROM stok_penyesuaian WHERE sku = $1 AND tanggal <= (SELECT end_date FROM params)
        )
        SELECT 
          COALESCE(bs.stok, 0) + COALESCE(p.total, 0) - COALESCE(j.total, 0) + COALESCE(pen.total, 0) AS stok_sistem
        FROM base_stock bs, pembelian p, penjualan j, penyesuaian pen
      `, [sku]);
      
      const stokSistem = Number(stokSistemResult.rows[0]?.stok_sistem || 0);
      const selisih = Number(stok_fisik) - stokSistem;
      
      // Use upsert approach - try update first, then insert if not exists
      // This avoids ON CONFLICT which requires unique constraint
      let result;
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Try to update existing record
        const updateResult = await client.query(`
          UPDATE stok_opname_detail 
          SET stok_fisik = $1, selisih = $2, input_at = NOW()
          WHERE opname_id = $3 AND sku = $4
          RETURNING *
        `, [Number(stok_fisik), selisih, opname_id, sku]);
        
        if (updateResult.rows.length > 0) {
          // Record exists and was updated
          result = updateResult;
        } else {
          // Record doesn't exist, insert new
          result = await client.query(`
            INSERT INTO stok_opname_detail (opname_id, sku, stok_sistem, stok_fisik, selisih, input_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
          `, [opname_id, sku, stokSistem, Number(stok_fisik), selisih]);
        }
        
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      
      res.status(200).json({
        success: true,
        detail: result.rows[0],
        message: `Qty fisik untuk ${sku} disimpan. Stok sistem: ${stokSistem}, Selisih: ${selisih}`
      });
    }
    
    else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error("V3 OPNAME DETAIL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}