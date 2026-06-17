import pool from "../services/db.js";
import { kategoriLabel } from "./opname-kategori-utils.js";

// V3 Stock Opname - 1 SO = 1 Kategori
// Flow: Admin buat Perintah SO -> Checker input Qty Fisik -> Selesai

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      const { status, bulan, tahun } = req.query;
      let query = `
        SELECT sop.id, sop.kode_so, sop.tanggal_perintah, sop.bulan, sop.tahun,
          sop.svp_nama, sop.pic_checker, sop.kategori_id, sop.kategori_nama,
          sop.target_sku, sop.status, sop.lokasi, sop.keterangan, sop.opname_id,
          sop.created_at, sop.started_at, sop.completed_at
        FROM stok_opname_perintah sop WHERE 1=1
      `;
      const params = [];
      if (status) { params.push(status); query += ` AND sop.status = $${params.length}`; }
      if (bulan) { params.push(Number(bulan)); query += ` AND sop.bulan = $${params.length}`; }
      if (tahun) { params.push(Number(tahun)); query += ` AND sop.tahun = $${params.length}`; }
      query += ` ORDER BY sop.created_at DESC`;
      const result = await pool.query(query, params);
      const items = await Promise.all(result.rows.map(async (row) => {
        const progress = await calculateProgress(row.opname_id, row.target_sku);
        return {
          id: row.id, kode_so: row.kode_so, tanggal_perintah: row.tanggal_perintah,
          bulan: row.bulan, tahun: row.tahun, svp_nama: row.svp_nama,
          pic_checker: row.pic_checker, kategori_id: row.kategori_id,
          kategori_nama: row.kategori_nama || kategoriLabel(row.kategori_id),
          target_sku: progress.target_sku, checked_sku: progress.checked_sku,
          progress_percent: progress.progress_percent, status: row.status,
          lokasi: row.lokasi, keterangan: row.keterangan, opname_id: row.opname_id,
          created_at: row.created_at, started_at: row.started_at, completed_at: row.completed_at
        };
      }));
      res.status(200).json({ success: true, items });
    }
    else if (req.method === 'POST') {
      const { kode_so, bulan, tahun, svp_nama, pic_checker, kategori_id, lokasi, keterangan } = req.body;
      if (!kode_so || !bulan || !tahun || !svp_nama || !kategori_id) {
        return res.status(400).json({ error: "kode_so, bulan, tahun, svp_nama, kategori_id wajib diisi" });
      }
      const existing = await pool.query(`SELECT id FROM stok_opname_perintah WHERE kode_so = $1`, [normalizeKodeSo(kode_so)]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Kode SO sudah ada" });
      }
      const countResult = await pool.query(`SELECT COUNT(*)::int as total FROM produk WHERE kategori = $1`, [kategori_id]);
      const targetSku = countResult.rows[0].total;
      const kategoriNama = kategoriLabel(kategori_id);
      const result = await pool.query(`
        INSERT INTO stok_opname_perintah (kode_so, tanggal_perintah, bulan, tahun, svp_nama, pic_checker, kategori_id, kategori_nama, target_sku, lokasi, keterangan, status)
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'menunggu') RETURNING *
      `, [normalizeKodeSo(kode_so), Number(bulan), Number(tahun), svp_nama, pic_checker || null, kategori_id, kategoriNama, targetSku, lokasi || 'Gudang Utama', keterangan || null]);
      const item = result.rows[0];
      res.status(201).json({ success: true, item: { id: item.id, kode_so: item.kode_so, tanggal_perintah: item.tanggal_perintah, bulan: item.bulan, tahun: item.tahun, svp_nama: item.svp_nama, pic_checker: item.pic_checker, kategori_id: item.kategori_id, kategori_nama: item.kategori_nama, target_sku: item.target_sku, status: item.status, lokasi: item.lokasi, keterangan: item.keterangan, created_at: item.created_at }, message: "Perintah SO berhasil dibuat" });
    }
    else if (req.method === 'PUT') {
      const { id, action, checker, lokasi } = req.body;
      if (!id || !action) {
        return res.status(400).json({ error: "id dan action wajib diisi" });
      }
      const current = await pool.query(`SELECT * FROM stok_opname_perintah WHERE id = $1`, [id]);
      if (current.rows.length === 0) {
        return res.status(404).json({ error: "Perintah SO tidak ditemukan" });
      }
      const so = current.rows[0];
      switch (action) {
        case 'start':
          if (so.status !== 'menunggu') {
            return res.status(400).json({ error: "SO tidak bisa dimulai dari status ini" });
          }
          await pool.query(`UPDATE stok_opname_perintah SET status = 'proses', started_at = COALESCE(started_at, NOW()), checker = COALESCE($2, checker) WHERE id = $1`, [id, checker || null]);
          const opnameResult = await pool.query(`INSERT INTO stok_opname (tanggal, keterangan, perintah_id, checker, lokasi) VALUES (CURRENT_DATE, $2, $1, $3, $4) RETURNING id`, [id, `SO dari perintah ${so.kode_so}`, checker || null, lokasi || so.lokasi]);
          await pool.query(`UPDATE stok_opname_perintah SET opname_id = $2 WHERE id = $1`, [id, opnameResult.rows[0].id]);
          res.status(200).json({ success: true, item: { opname_id: opnameResult.rows[0].id }, message: "SO dimulai, siap untuk input qty fisik" });
          break;
        case 'submit':
          if (so.status !== 'proses') {
            return res.status(400).json({ error: "SO tidak bisa disubmit dari status ini" });
          }
          await pool.query(`UPDATE stok_opname_perintah SET status = 'selesai', completed_at = NOW() WHERE id = $1`, [id]);
          if (so.opname_id) {
            await pool.query(`UPDATE stok_opname SET tanggal_selesai = NOW(), updated_at = NOW() WHERE id = $1`, [so.opname_id]);
          }
          res.status(200).json({ success: true, item: { status: 'selesai' }, message: "SO submitted dan selesai" });
          break;
        default:
          res.status(400).json({ error: `Action '${action}' tidak valid` });
      }
    }
    else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error("V3 SO Handler Error:", err);
    res.status(500).json({ error: err.message });
  }
}
