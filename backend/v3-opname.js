import pool from "../services/db.js";

// V3 Stock Opname - Simplified Workflow
// 1 SO = 1 kategori
// Status flow: menunggu -> proses -> selesai (tanpa approval)
// Tidak ada kategori_targets, commands, atau dependency tabel stok

// GET Handler - Ambil daftar perintah SO
export async function handleGet(req, res) {
  try {
    const { status, bulan, tahun } = req.query;
    
    let query = `
      SELECT 
        sop.id,
        sop.kode_so,
        sop.tanggal_perintah,
        sop.bulan,
        sop.tahun,
        sop.svp_nama,
        sop.lokasi,
        sop.keterangan,
        sop.status,
        sop.checker,
        sop.kategori,
        sop.opname_id,
        sop.created_at,
        sop.started_at,
        sop.completed_at
      FROM stok_opname_perintah sop
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND sop.status = $${params.length}`;
    }
    if (bulan) {
      params.push(Number(bulan));
      query += ` AND sop.bulan = $${params.length}`;
    }
    if (tahun) {
      params.push(Number(tahun));
      query += ` AND sop.tahun = $${params.length}`;
    }
    
    query += ` ORDER BY sop.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    res.status(200).json({ 
      success: true,
      items: result.rows,
      total: result.rows.length 
    });
  } catch (err) {
    console.error("V3 SO GET ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}

// POST Handler - Admin buat perintah SO baru
export async function handlePost(req, res) {
  try {
    const { kode_so, bulan, tahun, svp_nama, lokasi, keterangan, kategori } = req.body;
    
    // Validate required fields
    if (!kode_so || !bulan || !tahun || !svp_nama || !kategori) {
      return res.status(400).json({ 
        success: false,
        error: "kode_so, bulan, tahun, svp_nama, kategori wajib diisi" 
      });
    }
    
    // Check if kode_so already exists
    const existing = await pool.query(
      `SELECT id FROM stok_opname_perintah WHERE kode_so = $1`,
      [kode_so]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: "Kode SO sudah ada" });
    }
    
    const result = await pool.query(`
      INSERT INTO stok_opname_perintah (
        kode_so, tanggal_perintah, bulan, tahun, svp_nama, lokasi, keterangan, status, kategori
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, 'menunggu', $7)
      RETURNING *
    `, [kode_so, Number(bulan), Number(tahun), svp_nama, lokasi || null, keterangan || null, kategori]);
    
    res.status(201).json({ 
      success: true, 
      item: result.rows[0],
      message: "Perintah SO berhasil dibuat"
    });
  } catch (err) {
    console.error("V3 SO POST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}

// PUT Handler - Update status SO
export async function handlePut(req, res) {
  try {
    const { id, action, checker, lokasi } = req.body;
    
    if (!id || !action) {
      return res.status(400).json({ success: false, error: "id dan action wajib diisi" });
    }
    
    // Get current SO
    const current = await pool.query(
      `SELECT * FROM stok_opname_perintah WHERE id = $1`,
      [id]
    );
    
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Perintah SO tidak ditemukan" });
    }
    
    const so = current.rows[0];
    
    switch (action) {
      case 'start':
        // User memulai SO
        if (so.status !== 'menunggu') {
          return res.status(400).json({ success: false, error: "SO tidak bisa dimulai dari status ini" });
        }
        await pool.query(`
          UPDATE stok_opname_perintah 
          SET status = 'proses', started_at = NOW(), checker = $2
          WHERE id = $1
        `, [id, checker || null]);
        
        // Create stok_opname header
        const opnameResult = await pool.query(`
          INSERT INTO stok_opname (tanggal, keterangan, perintah_id, checker, lokasi)
          VALUES (CURRENT_DATE, $2, $1, $3, $4)
          RETURNING id
        `, [id, `SO dari perintah ${so.kode_so}`, checker || null, lokasi || so.lokasi]);
        
        // Update perintah dengan opname_id
        await pool.query(`
          UPDATE stok_opname_perintah SET opname_id = $2 WHERE id = $1
        `, [id, opnameResult.rows[0].id]);
        
        res.status(200).json({ 
          success: true, 
          opname_id: opnameResult.rows[0].id,
          message: "SO dimulai, siap untuk input qty fisik" 
        });
        break;
        
      case 'submit':
        // User submit SO (setelah input qty fisik)
        // Direct to 'selesai' (no approval)
        if (so.status !== 'proses') {
          return res.status(400).json({ success: false, error: "SO tidak bisa disubmit dari status ini" });
        }
        await pool.query(`
          UPDATE stok_opname_perintah 
          SET status = 'selesai', completed_at = NOW()
          WHERE id = $1
        `, [id]);
        
        // Update opname timestamp if exists
        if (so.opname_id) {
          await pool.query(`
            UPDATE stok_opname 
            SET tanggal_selesai = NOW(), updated_at = NOW()
            WHERE id = $1
          `, [so.opname_id]);
        }
        
        res.status(200).json({ success: true, message: "SO submitted dan selesai", status: 'selesai' });
        break;
        
      default:
        res.status(400).json({ success: false, error: `Action '${action}' tidak valid` });
    }
  } catch (err) {
    console.error("V3 SO PUT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}

// Export handlers
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
    } else if (req.method === 'POST') {
      await handlePost(req, res);
    } else if (req.method === 'PUT') {
      await handlePut(req, res);
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error("V3 SO Handler Error:", err);
    res.status(500).json({ error: err.message });
  }
}