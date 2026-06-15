import pool from "../services/db.js";

// V3 Stock Opname - Workflow sesuai model bisnis V3
// Admin: Buat Perintah SO -> User: Input Qty Fisik -> Admin: Approval/Finalisasi

// 1. GET - Ambil daftar perintah SO
// 2. POST - Admin buat perintah SO baru
// 3. PUT - Update status SO (User: mulai/submit, Admin: approval/finalisasi)

// Get current user from token
async function getCurrentUser(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    return JSON.parse(Buffer.from(parts[0], "base64url").toString());
  } catch {
    return null;
  }
}

// Check admin authorization - matches approval-api.js behavior
async function requireAdmin(req, res) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  if (user.role !== "admin") {
    res.status(403).json({ success: false, message: "Admin access required" });
    return null;
  }
  return user;
}

// GET Handler
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
        sop.kategori_targets,
        sop.opname_id,
        sop.created_at,
        sop.started_at,
        sop.completed_at,
        (SELECT COUNT(*) FROM stok_opname so WHERE so.perintah_id = sop.id) AS detail_count
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
    
    // Parse kategori_targets
    const commands = result.rows.map(row => ({
      ...row,
      kategori_targets: row.kategori_targets ? JSON.parse(row.kategori_targets) : ['modul', 'seragam', 'poster', 'lain-lain']
    }));
    
    res.status(200).json({ commands, total: result.rows.length });
  } catch (err) {
    console.error("V3 SO GET ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}

// POST Handler - Admin buat perintah SO baru
export async function handlePost(req, res) {
  try {
    const { kode_so, bulan, tahun, svp_nama, lokasi, keterangan, kategori_targets } = req.body;
    
    // Validate required fields
    if (!kode_so || !bulan || !tahun || !svp_nama) {
      return res.status(400).json({ error: "kode_so, bulan, tahun, svp_nama wajib diisi" });
    }
    
    // Check if kode_so already exists
    const existing = await pool.query(
      `SELECT id FROM stok_opname_perintah WHERE kode_so = $1`,
      [kode_so]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Kode SO sudah ada" });
    }
    
    // Parse kategori_targets
    const targets = Array.isArray(kategori_targets) ? kategori_targets : ['modul', 'seragam', 'poster', 'lain-lain'];
    
    const result = await pool.query(`
      INSERT INTO stok_opname_perintah (
        kode_so, tanggal_perintah, bulan, tahun, svp_nama, lokasi, keterangan, status, kategori_targets
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, 'menunggu', $7)
      RETURNING *
    `, [kode_so, Number(bulan), Number(tahun), svp_nama, lokasi || null, keterangan || null, JSON.stringify(targets)]);
    
    res.status(201).json({ 
      success: true, 
      command: result.rows[0],
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
      return res.status(400).json({ error: "id dan action wajib diisi" });
    }
    
    // Get current SO
    const current = await pool.query(
      `SELECT * FROM stok_opname_perintah WHERE id = $1`,
      [id]
    );
    
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Perintah SO tidak ditemukan" });
    }
    
    const so = current.rows[0];
    
    switch (action) {
      case 'start':
        // User memulai SO
        if (so.status !== 'menunggu') {
          return res.status(400).json({ error: "SO tidak bisa dimulai dari status ini" });
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
        if (so.status !== 'proses') {
          return res.status(400).json({ error: "SO tidak bisa disubmit dari status ini" });
        }
        await pool.query(`
          UPDATE stok_opname_perintah 
          SET status = 'menunggu_approval', completed_at = NOW()
          WHERE id = $1
        `, [id]);
        res.status(200).json({ success: true, message: "SO submitted, menunggu approval admin" });
        break;
        
      case 'approve':
        // Admin approve SO - require admin authorization
        const adminApprove = await requireAdmin(req, res);
        if (!adminApprove) return;
        
        if (so.status !== 'menunggu_approval') {
          return res.status(400).json({ error: "SO tidak bisa diapprove dari status ini" });
        }
        await pool.query(`
          UPDATE stok_opname_perintah 
          SET status = 'selesai'
          WHERE id = $1
        `, [id]);
        
        // Update stok_opname with finalization
        if (so.opname_id) {
          await pool.query(`
            UPDATE stok_opname 
            SET disesuaikan_at = NOW()
            WHERE id = $1
          `, [so.opname_id]);
        }
        
        res.status(200).json({ success: true, message: "SO approved dan difinalisasi" });
        break;
        
      case 'reject':
        // Admin reject SO - require admin authorization
        const adminReject = await requireAdmin(req, res);
        if (!adminReject) return;
        
        await pool.query(`
          UPDATE stok_opname_perintah 
          SET status = 'ditolak'
          WHERE id = $1
        `, [id]);
        res.status(200).json({ success: true, message: "SO ditolak" });
        break;
        
      default:
        res.status(400).json({ error: `Action '${action}' tidak valid` });
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