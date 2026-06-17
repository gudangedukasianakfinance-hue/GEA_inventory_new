import pool from "../services/db.js";
import { kategoriLabel } from "./opname-kategori-utils.js";

const VALID_KATEGORI = [
  "modul",
  "poster",
  "seragam",
  "lain-lain"
];

function normalizeKodeSo(value) {
  return String(value || "").trim().toUpperCase();
}

async function calculateProgress(opnameId, targetSku) {
  if (!opnameId) {
    return { target_sku: targetSku, checked_sku: 0, progress_percent: 0 };
  }
  
  try {
    const result = await pool.query(`
      SELECT COUNT(DISTINCT sku)::int AS checked
      FROM stok_opname_detail
      WHERE opname_id = $1
    `, [opnameId]);
    
    const checked = Number(result.rows[0]?.checked || 0);
    const progress = targetSku > 0 ? Math.round((checked / targetSku) * 100) : 0;
    
    return { target_sku: targetSku, checked_sku: checked, progress_percent: progress };
  } catch (error) {
    console.error('Error calculating progress:', error);
    return { target_sku: targetSku, checked_sku: 0, progress_percent: 0 };
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { id, kode_so, bulan, tahun } = req.query;

      if (id || kode_so) {
        const result = await pool.query(
          `SELECT * FROM stok_opname_perintah WHERE ${id ? "id = $1" : "UPPER(kode_so) = $1"} LIMIT 1`,
          [id ? Number(id) : normalizeKodeSo(kode_so)]
        );

        if (!result.rows.length) {
          return res.status(404).json({ success: false, error: "Perintah SO tidak ditemukan" });
        }

        const row = result.rows[0];
        const progress = await calculateProgress(row.opname_id, row.target_sku);
        
        return res.status(200).json({
          success: true,
          item: {
            id: row.id,
            kode_so: row.kode_so,
            kategori_id: row.kategori_id,
            kategori_nama: kategoriLabel(row.kategori_id),
            target_sku: progress.target_sku,
            checked_sku: progress.checked_sku,
            progress_percent: progress.progress_percent,
            status: row.status,
            checker: row.checker,
            svp_nama: row.svp_nama,
            lokasi: row.lokasi,
            keterangan: row.keterangan,
            tanggal_perintah: row.tanggal_perintah,
            bulan: row.bulan,
            tahun: row.tahun,
            opname_id: row.opname_id,
            created_at: row.created_at,
            started_at: row.started_at,
            completed_at: row.completed_at
          }
        });
      }

      if (!bulan || !tahun) {
        return res.status(400).json({ error: "bulan & tahun wajib" });
      }

      const listResult = await pool.query(
        `SELECT * FROM stok_opname_perintah WHERE bulan = $1 AND tahun = $2 ORDER BY created_at DESC, kode_so ASC`,
        [Number(bulan), Number(tahun)]
      );

      const items = await Promise.all(listResult.rows.map(async (row) => {
        const progress = await calculateProgress(row.opname_id, row.target_sku);
        return {
          id: row.id,
          kode_so: row.kode_so,
          kategori_id: row.kategori_id,
          kategori_nama: kategoriLabel(row.kategori_id),
          target_sku: progress.target_sku,
          checked_sku: progress.checked_sku,
          progress_percent: progress.progress_percent,
          status: row.status,
          checker: row.checker,
          svp_nama: row.svp_nama,
          lokasi: row.lokasi,
          keterangan: row.keterangan,
          tanggal_perintah: row.tanggal_perintah,
          bulan: row.bulan,
          tahun: row.tahun,
          opname_id: row.opname_id,
          created_at: row.created_at,
          started_at: row.started_at,
          completed_at: row.completed_at
        };
      }));

      return res.status(200).json({ success: true, items });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = String(body.action || "create").toLowerCase();

      

      if (action === "update") {
        const perintahId = Number(body.perintah_id);
        if (!perintahId) {
          return res.status(400).json({ error: "perintah_id wajib" });
        }

        const kodeSo = normalizeKodeSo(body.kode_so);
        const kategoriId = body.kategori_id;
        
        if (!VALID_KATEGORI.includes(kategoriId)) {
          return res.status(400).json({ error: "kategori tidak valid" });
        }
        const svpNama = String(body.svp_nama || "").trim();
        const lokasi = String(body.lokasi || "").trim() || null;
        const keterangan = String(body.keterangan || "").trim() || null;
        const tanggal = body.tanggal_perintah || body.tanggal;

        if (!kodeSo || !svpNama || !tanggal || !kategoriId) {
          return res.status(400).json({ error: "kode_so, kategori_id, svp_nama, dan tanggal wajib diisi" });
        }

        const dateObj = new Date(tanggal);
        if (Number.isNaN(dateObj.getTime())) {
          return res.status(400).json({ error: "Format tanggal tidak valid" });
        }

        const bulan = Number(body.bulan) || dateObj.getMonth() + 1;
        const tahun = Number(body.tahun) || dateObj.getFullYear();

        const countResult = await pool.query(`SELECT COUNT(*)::int as total FROM produk WHERE kategori = $1`, [kategoriId]);
        const targetSku = countResult.rows[0].total;

        const updateResult = await pool.query(
          `UPDATE stok_opname_perintah SET kode_so = $1, kategori_id = $2, kategori_nama = $3, tanggal_perintah = $4, bulan = $5, tahun = $6, svp_nama = $7, lokasi = $8, keterangan = $9, target_sku = $10, checker = COALESCE(NULLIF($11, ''), checker), updated_at = NOW() WHERE id = $12 RETURNING *`,
          [kodeSo, kategoriId, kategoriLabel(kategoriId), tanggal, bulan, tahun, svpNama, lokasi, keterangan, targetSku, body.checker, perintahId]
        );

        if (!updateResult.rows.length) {
          return res.status(400).json({ error: "Perintah tidak dapat diperbarui" });
        }

        return res.status(200).json({
          success: true,
          item: updateResult.rows[0]
        });
      }

      // CREATE
      const kodeSo = normalizeKodeSo(body.kode_so);
      const kategoriId = body.kategori_id || 'modul';
      
      if (!VALID_KATEGORI.includes(kategoriId)) {
        return res.status(400).json({ error: "kategori tidak valid" });
      }
      const svpNama = String(body.svp_nama || "").trim();
      const lokasi = String(body.lokasi || "").trim() || null;
      const keterangan = String(body.keterangan || "").trim() || null;
      const tanggal = body.tanggal_perintah || body.tanggal;

      if (!kodeSo || !svpNama || !tanggal) {
        return res.status(400).json({ error: "kode_so, svp_nama, dan tanggal wajib diisi" });
      }

      const dateObj = new Date(tanggal);
      if (Number.isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: "Format tanggal tidak valid" });
      }

      const bulan = Number(body.bulan) || dateObj.getMonth() + 1;
      const tahun = Number(body.tahun) || dateObj.getFullYear();

      const countResult = await pool.query(`SELECT COUNT(*)::int as total FROM produk WHERE kategori = $1`, [kategoriId]);
      const targetSku = countResult.rows[0].total;

      const insertResult = await pool.query(
        `INSERT INTO stok_opname_perintah (kode_so, kategori_id, kategori_nama, tanggal_perintah, bulan, tahun, svp_nama, checker, lokasi, keterangan, target_sku, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'menunggu') RETURNING *`,
        [kodeSo, kategoriId, kategoriLabel(kategoriId), tanggal, bulan, tahun, svpNama, body.checker, lokasi, keterangan, targetSku]
      );

      return res.status(201).json({
        success: true,
        item: insertResult.rows[0]
      });
    }
    
    // CLAIM TASK - Checker klaim task SO
    if (req.method === "POST" && action === "claim") {
      const auth = await import('../services/auth.js');
      const authResult = auth.authenticate(req);
      if (!authResult.authorized) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (authResult.user.role !== 'checker_opname') {
        return res.status(403).json({ error: "Hanya checker yang dapat klaim task" });
      }
      
      const perintahId = Number(body.perintah_id);
      if (!perintahId) {
        return res.status(400).json({ error: "perintah_id wajib" });
      }
      
      // Check if task still available (status = menunggu)
      const checkResult = await pool.query(
        `SELECT id, kode_so, status, checker_user_id FROM stok_opname_perintah WHERE id = $1`,
        [perintahId]
      );
      
      if (!checkResult.rows.length) {
        return res.status(404).json({ error: "Perintah SO tidak ditemukan" });
      }
      
      const perintah = checkResult.rows[0];
      
      if (perintah.status !== 'menunggu') {
        return res.status(400).json({ error: `Task sudah diambil atau tidak tersedia (status: ${perintah.status})` });
      }
      
      if (perintah.checker_user_id) {
        return res.status(400).json({ error: "Task sudah diklaim checker lain" });
      }
      
      // Claim task
      const userId = authResult.user.id;
      const result = await pool.query(
        `UPDATE stok_opname_perintah 
         SET status = 'claimed', 
             checker_user_id = $1, 
             claimed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2 AND status = 'menunggu'
         RETURNING *`,
        [userId, perintahId]
      );
      
      if (!result.rows.length) {
        return res.status(400).json({ error: "Gagal mengklaim task" });
      }
      
      return res.status(200).json({
        success: true,
        message: "Task berhasil diklaim. Silakan mulai SO untuk mulai dikerjakan.",
        item: result.rows[0]
      });
    }
    
    // MULAI SO - Checker mulai mengerjakan task (claimed → proses)
    if (req.method === "POST" && action === "mulai") {
      const auth = await import('../services/auth.js');
      const authResult = auth.authenticate(req);
      if (!authResult.authorized) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (authResult.user.role !== 'checker_opname') {
        return res.status(403).json({ error: "Hanya checker yang dapat memulai SO" });
      }
      
      const perintahId = Number(body.perintah_id);
      if (!perintahId) {
        return res.status(400).json({ error: "perintah_id wajib" });
      }
      
      const userId = authResult.user.id;
      
      // Check if task is claimed by this checker
      const checkResult = await pool.query(
        `SELECT id, kode_so, status, checker_user_id FROM stok_opname_perintah WHERE id = $1`,
        [perintahId]
      );
      
      if (!checkResult.rows.length) {
        return res.status(404).json({ error: "Perintah SO tidak ditemukan" });
      }
      
      const perintah = checkResult.rows[0];
      
      if (perintah.status !== 'claimed') {
        return res.status(400).json({ error: `Task tidak bisa dimulai (status: ${perintah.status})` });
      }
      
      if (perintah.checker_user_id !== userId) {
        return res.status(403).json({ error: "Task ini diklaim oleh checker lain" });
      }
      
      // Create opname record and update status to 'proses'
      const opnameResult = await pool.query(
        `INSERT INTO stok_opname (tanggal, keterangan, perintah_id, checker, lokasi)
         VALUES (CURRENT_DATE, $1, $2, $3, $4)
         RETURNING id`,
        [`SO dari perintah ${perintah.kode_so}`, perintahId, authResult.user.nama, null]
      );
      
      const result = await pool.query(
        `UPDATE stok_opname_perintah 
         SET status = 'proses', 
             started_at = NOW(),
             updated_at = NOW(),
             opname_id = $1
         WHERE id = $2
         RETURNING *`,
        [opnameResult.rows[0].id, perintahId]
      );
      
      return res.status(200).json({
        success: true,
        message: "SO dimulai, siap untuk input qty fisik",
        item: result.rows[0],
        opname_id: opnameResult.rows[0].id
      });
    }
    
    if (req.method === "DELETE") {
      const auth = await import('../services/auth.js');
      const authResult = auth.authenticate(req);
      if (!authResult.authorized) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (authResult.user.role !== 'admin') {
        return res.status(403).json({ error: "Hanya admin yang dapat menghapus" });
      }
      
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const idIndex = pathParts.findIndex(p => p === 'opname-perintah');
      const id = pathParts[idIndex + 1];
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: "ID tidak valid" });
      }
      
      const checkResult = await pool.query(`SELECT id, kode_so, status FROM stok_opname_perintah WHERE id = $1`, [id]);
      
      if (!checkResult.rows.length) {
        return res.status(404).json({ error: "Perintah tidak ditemukan" });
      }
      
      const perintah = checkResult.rows[0];
      
      if (perintah.status !== 'menunggu') {
        return res.status(400).json({ error: `Tidak dapat menghapus perintah dengan status "${perintah.status}"` });
      }
      
      await pool.query(`DELETE FROM stok_opname_perintah WHERE id = $1`, [id]);
      
      return res.status(200).json({
        success: true
      });
    }

    return res.status(405).json({ error: "Method tidak diizinkan" });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Kode SO sudah digunakan" });
    }
    console.error("OPNAME PERINTAH ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
