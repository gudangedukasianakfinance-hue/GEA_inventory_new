import pool from "../services/db.js";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      const { opname_id, kategori_id } = req.query;
      
      if (!opname_id) {
        return res.status(400).json({ error: "opname_id wajib" });
      }
      
      const produkList = await pool.query(`
        SELECT
          p.sku,
          p.nama_produk,
          p.kategori,
          COALESCE(s.stok_akhir, 0)::int AS stok_sistem,
          sod.stok_fisik,
          sod.selisih,
          sod.input_at
        FROM produk p
        LEFT JOIN stok s ON s.sku = p.sku
        LEFT JOIN stok_opname_detail sod ON sod.sku = p.sku AND sod.opname_id = $1
        WHERE p.kategori = $2
        ORDER BY p.nama_produk
      `, [Number(opname_id), kategori_id || 'modul']);
      
      res.status(200).json({
        produk: produkList.rows.map(r => ({
          sku: r.sku,
          nama_produk: r.nama_produk,
          kategori: r.kategori,
          stok_sistem: Number(r.stok_sistem || 0),
          stok_fisik: r.stok_fisik,
          selisih: r.selisih,
          input_at: r.input_at
        })),
        total: produkList.rows.length
      });
    }
    
    else if (req.method === 'POST') {
      const { opname_id, sku, stok_fisik } = req.body;
      
      if (!opname_id || !sku || stok_fisik === undefined) {
        return res.status(400).json({ error: "opname_id, sku, dan stok_fisik wajib diisi" });
      }
      
      const stokSistem = await pool.query(`SELECT COALESCE(stok_akhir, 0)::int AS stok FROM stok WHERE sku = $1`, [sku]);
      const stokSistemVal = Number(stokSistem.rows[0]?.stok || 0);
      const selisih = Number(stok_fisik) - stokSistemVal;
      
      let result;
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        const updateResult = await client.query(`
          UPDATE stok_opname_detail SET stok_fisik = $1, selisih = $2, input_at = NOW()
          WHERE opname_id = $3 AND sku = $4 RETURNING *
        `, [Number(stok_fisik), selisih, Number(opname_id), sku]);
        
        if (updateResult.rows.length > 0) {
          result = updateResult;
        } else {
          result = await client.query(`
            INSERT INTO stok_opname_detail (opname_id, sku, stok_sistem, stok_fisik, selisih, input_at)
            VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *
          `, [Number(opname_id), sku, stokSistemVal, Number(stok_fisik), selisih]);
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
        message: `Qty fisik untuk ${sku} disimpan. Stok sistem: ${stokSistemVal}, Selisih: ${selisih}`
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
