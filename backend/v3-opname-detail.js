import pool from "../services/db.js";

// V3 Stock Opname Detail - No dependency on stok table
// GET: Ambil daftar produk untuk opname
// POST: Simpan hasil scan qty fisik

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // GET - Ambil produk list untuk opname
    if (req.method === 'GET') {
      // Support both naming conventions from frontend
      const opnameId = req.query.opname_id || req.query.perintah_id;
      const kategoriId = req.query.kategori_id || req.query.kategori;
      
      console.log("[SO DETAIL GET]", { opnameId, kategoriId });
      
      if (!opnameId) {
        return res.status(400).json({ success: false, error: "opname_id atau perintah_id wajib" });
      }
      
      if (!kategoriId) {
        return res.status(400).json({ success: false, error: "kategori_id atau kategori wajib" });
      }
      
      // Query: JOIN produk dengan stok_opname_detail
      // Tidak ada dependency terhadap tabel stok
      const produkList = await pool.query(`
        SELECT
          p.sku,
          p.nama_produk,
          p.kategori,
          COALESCE(sod.stok_sistem, 0)::int AS stok_sistem,
          sod.id AS detail_id,
          sod.stok_fisik,
          sod.selisih,
          sod.input_at
        FROM produk p
        LEFT JOIN stok_opname_detail sod
          ON sod.sku = p.sku
          AND sod.opname_id = $1
        WHERE p.kategori = $2
        ORDER BY p.nama_produk
      `, [Number(opnameId), kategoriId]);
      
      res.status(200).json({
        success: true,
        items: produkList.rows.map(r => ({
          sku: r.sku,
          nama_produk: r.nama_produk,
          kategori: r.kategori,
          stok_sistem: Number(r.stok_sistem || 0),
          detail_id: r.detail_id,
          stok_fisik: r.stok_fisik,
          selisih: r.selisih,
          input_at: r.input_at
        })),
        total: produkList.rows.length
      });
    }
    
    // POST - Simpan hasil scan
    else if (req.method === 'POST') {
      const { opname_id, sku, stok_fisik, stok_sistem } = req.body;
      
      if (!opname_id || !sku || stok_fisik === undefined) {
        return res.status(400).json({ success: false, error: "opname_id, sku, dan stok_fisik wajib diisi" });
      }
      
      // stok_sistem dari frontend (stok_opname_detail) atau default 0
      // Tidak query dari tabel stok
      const stokSistemVal = Number(stok_sistem || 0);
      const selisih = Number(stok_fisik) - stokSistemVal;
      
      let result;
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Check existing detail
        const existingDetail = await client.query(`
          SELECT id, stok_sistem FROM stok_opname_detail 
          WHERE opname_id = $1 AND sku = $2
        `, [Number(opname_id), sku]);
        
        // Use existing stok_sistem if available, otherwise use passed value or 0
        const existingStokSistem = Number(existingDetail.rows[0]?.stok_sistem || 0);
        const finalStokSistem = existingStokSistem || stokSistemVal;
        const finalSelisih = Number(stok_fisik) - finalStokSistem;
        
        const updateResult = await client.query(`
          UPDATE stok_opname_detail 
          SET stok_fisik = $1, selisih = $2, input_at = NOW()
          WHERE opname_id = $3 AND sku = $4 
          RETURNING *
        `, [Number(stok_fisik), finalSelisih, Number(opname_id), sku]);
        
        if (updateResult.rows.length > 0) {
          result = updateResult;
        } else {
          result = await client.query(`
            INSERT INTO stok_opname_detail (opname_id, sku, stok_sistem, stok_fisik, selisih, input_at)
            VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *
          `, [Number(opname_id), sku, finalStokSistem, Number(stok_fisik), finalSelisih]);
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
        item: result.rows[0],
        message: `Qty fisik untuk ${sku} disimpan`
      });
    }
    
    else {
      res.status(405).json({ success: false, error: "Method not allowed" });
    }
  } catch (err) {
    console.error("V3 OPNAME DETAIL ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
