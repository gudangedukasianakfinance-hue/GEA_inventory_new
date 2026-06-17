import pool from "../services/db.js";
import { kategoriLabel } from "./opname-kategori-utils.js";

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
          return res.status(404).json({ error: "Perintah SO tidak ditemukan" });
        }

        const row = result.rows[0];
        const progress = await calculateProgress(row.opname_id, row.target_sku);
        
        return res.status(200).json({
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

      console.log("[SO LIST]", { bulan, tahun, count: items.length });
      return res.status(200).json({ success: true, items });
    }

    // Monitoring endpoint - aggregated data by user and status
    if (req.query.action === 'monitoring') {
      const { bulan, tahun } = req.query;
      
      if (!bulan || !tahun) {
        return res.status(400).json({ error: "bulan & tahun wajib" });
      }

      // Query status summary
      const statusResult = await pool.query(`
        SELECT 
          status,
          COUNT(*)::int as count
        FROM stok_opname_perintah 
        WHERE bulan = $1 AND tahun = $2 
        GROUP BY status
      `, [Number(bulan), Number(tahun)]);

      // Query user summary (claimed/proses/selesai)
      const userResult = await pool.query(`
        SELECT 
          COALESCE(checker, '(belum diambil)') as checker,
          COUNT(*) FILTER (WHERE status = 'claimed')::int as claimed,
          COUNT(*) FILTER (WHERE status = 'proses')::int as proses,
          COUNT(*) FILTER (WHERE status = 'selesai')::int as selesai,
          COUNT(*)::int as total
        FROM stok_opname_perintah 
        WHERE bulan = $1 AND tahun = $2 AND checker IS NOT NULL
        GROUP BY checker
        ORDER BY checker
      `, [Number(bulan), Number(tahun)]);

      const statusSummary = {
        menunggu: 0,
        claimed: 0,
        proses: 0,
        selesai: 0
      };
      
      statusResult.rows.forEach(row => {
        if (row.status in statusSummary) {
          statusSummary[row.status] = row.count;
        }
      });

      return res.status(200).json({
        success: true,
        status_summary: statusSummary,
        user_summary: userResult.rows
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = String(body.action || "create").toLowerCase();

      if (action === "start") {
        const perintahId = Number(body.perintah_id);
        if (!perintahId) {
          return res.status(400).json({ error: "perintah_id wajib" });
        }

        const result = await pool.query(
          `UPDATE stok_opname_perintah SET status = 'proses', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1 AND status IN ('menunggu', 'proses') RETURNING *`,
          [perintahId]
        );

        if (!result.rows.length) {
          return res.status(404).json({ error: "Perintah SO tidak ditemukan atau sudah selesai" });
        }

        return res.status(200).json(result.rows[0]);
      }

      if (action === "mulai") {
        // Untuk checker: ubah status dari 'claimed' ke 'proses'
        const perintahId = Number(body.perintah_id);
        if (!perintahId) {
          return res.status(400).json({ error: "perintah_id wajib" });
        }

        const auth = await import('../services/auth.js');
        const currentUser = auth.getCurrentUser(req);
        if (!currentUser || !currentUser.authorized) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await pool.query(
          `UPDATE stok_opname_perintah 
           SET status = 'proses', started_at = NOW(), updated_at = NOW() 
           WHERE id = $1 AND status = 'claimed' 
           RETURNING *`,
          [perintahId]
        );

        if (!result.rows.length) {
          return res.status(404).json({ error: "Perintah tidak ditemukan atau tidak dapat dimulai" });
        }

        return res.status(200).json({ 
          success: true, 
          message: `SO berhasil dimulai`, 
          perintah: result.rows[0] 
        });
      }

      if (action === "claim") {
        const perintahId = Number(body.perintah_id);
        if (!perintahId) {
          return res.status(400).json({ error: "perintah_id wajib" });
        }

        const auth = await import('../services/auth.js');
        const currentUser = auth.getCurrentUser(req);
        if (!currentUser || !currentUser.authorized) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await pool.query(
          `UPDATE stok_opname_perintah 
           SET checker_user_id = $1, checker = $2, claimed_at = NOW(), status = 'claimed', updated_at = NOW() 
           WHERE id = $3 AND status = 'menunggu' 
           RETURNING *`,
          [currentUser.user.sub, currentUser.user.username]
        );

        if (!result.rows.length) {
          return res.status(404).json({ error: "Perintah tidak ditemukan atau sudah di-claim" });
        }

        return res.status(200).json({ 
          success: true, 
          message: `Task berhasil di-claim`, 
          perintah: result.rows[0] 
        });
      }

      if (action === "update") {
        const perintahId = Number(body.perintah_id);
        if (!perintahId) {
          return res.status(400).json({ error: "perintah_id wajib" });
        }

        const kodeSo = normalizeKodeSo(body.kode_so);
        const kategoriId = body.kategori_id;
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
          `UPDATE stok_opname_perintah SET kode_so = $1, kategori_id = $2, kategori_nama = $3, tanggal_perintah = $4, bulan = $5, tahun = $6, svp_nama = $7, lokasi = $8, keterangan = $9, target_sku = $10, updated_at = NOW() WHERE id = $11 RETURNING *`,
          [kodeSo, kategoriId, kategoriLabel(kategoriId), tanggal, bulan, tahun, svpNama, lokasi, keterangan, targetSku, perintahId]
        );

        if (!updateResult.rows.length) {
          return res.status(400).json({ error: "Perintah tidak dapat diperbarui" });
        }

        return res.status(200).json({ message: `Perintah ${kodeSo} berhasil diperbarui`, perintah: updateResult.rows[0] });
      }

      if (action === "submit") {
        // Submit SO - ubah status ke 'selesai'
        const perintahId = Number(body.perintah_id);
        if (!perintahId) {
          return res.status(400).json({ error: "perintah_id wajib" });
        }

        const result = await pool.query(
          `UPDATE stok_opname_perintah 
           SET status = 'selesai', completed_at = NOW(), updated_at = NOW() 
           WHERE id = $1 AND status = 'proses' 
           RETURNING *`,
          [perintahId]
        );

        if (!result.rows.length) {
          return res.status(404).json({ error: "Perintah tidak ditemukan atau tidak dapat diselesaikan" });
        }

        return res.status(200).json({ 
          success: true, 
          message: `SO berhasil disubmit`, 
          perintah: result.rows[0] 
        });
      }

      // CREATE
      const kodeSo = normalizeKodeSo(body.kode_so);
      const kategoriId = body.kategori_id || 'modul';
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
        `INSERT INTO stok_opname_perintah (kode_so, kategori_id, kategori_nama, tanggal_perintah, bulan, tahun, svp_nama, lokasi, keterangan, target_sku, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'menunggu') RETURNING *`,
        [kodeSo, kategoriId, kategoriLabel(kategoriId), tanggal, bulan, tahun, svpNama, lokasi, keterangan, targetSku]
      );

      return res.status(201).json({ message: `Perintah ${kodeSo} berhasil dibuat`, perintah: insertResult.rows[0] });
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
      
      return res.status(200).json({ message: `Perintah ${perintah.kode_so} berhasil dihapus` });
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
