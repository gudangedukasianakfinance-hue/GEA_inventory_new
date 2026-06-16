import pool from "../services/db.js";
import {
  buildKategoriProgress,
  buildPeriodKategoriIndicator,
  ensurePerintahKategoriColumn,
  getKategoriCountedByOpname,
  getKategoriTotalsForPeriod,
  normalizeKategoriTargets,
  serializeKategoriTargets
} from "./opname-kategori-utils.js";

function normalizeKodeSo(value) {
  return String(value || "").trim().toUpperCase();
}

async function calculateProgressFields(perintahRow) {
  const opnameId = perintahRow.opname_id;
  const storedTargetSku = Number(perintahRow.target_sku || 0);
  
  if (!opnameId) {
    return {
      target_sku: storedTargetSku,
      checked_sku: 0,
      progress_percent: 0
    };
  }
  
  try {
    // Get checked SKU count from opname detail
    const checkedCount = await pool.query(`
      SELECT COUNT(*)::int as checked 
      FROM stok_opname_detail 
      WHERE opname_id = $1 AND stok_fisik IS NOT NULL
    `, [opnameId]);
    
    // Use stored target_sku as snapshot (not live count)
    const total = storedTargetSku;
    const checked = Number(checkedCount.rows[0]?.checked || 0);
    const progress = total > 0 ? (checked / total) * 100 : 0;
    
    return {
      target_sku: total,
      checked_sku: checked,
      progress_percent: Math.round(progress * 100) / 100
    };
  } catch (error) {
    console.error('Error calculating progress:', error);
    return {
      target_sku: storedTargetSku,
      checked_sku: 0,
      progress_percent: 0
    };
  }
}

async function enrichPerintahRows(rows, bulan, tahun) {
  if (!rows.length) {
    return { rows: [], period_kategori: buildPeriodKategoriIndicator([]) };
  }

  const totalsByKategori = await getKategoriTotalsForPeriod(bulan, tahun);
  const countedMap = await getKategoriCountedByOpname(
    rows.map((row) => row.opname_id).filter(Boolean)
  );

  const enriched = await Promise.all(rows.map(async (row) => {
    const kategori_targets = normalizeKategoriTargets(row.kategori_targets);
    const kategori_progress = buildKategoriProgress(
      kategori_targets,
      totalsByKategori,
      countedMap[row.opname_id] || {},
      row.status
    );
    
    // Calculate progress fields
    const progress = await calculateProgressFields(row);

    return {
      ...row,
      ...progress,
      kategori_targets,
      kategori_progress,
      kategori_label: kategori_progress.map((item) => item.label).join(", ")
    };
  }));

  return {
    rows: enriched,
    period_kategori: buildPeriodKategoriIndicator(enriched)
  };
}

export default async function handler(req, res) {
  try {
    await ensurePerintahKategoriColumn();

    if (req.method === "GET") {
      const { id, kode_so, bulan, tahun } = req.query;

      if (id || kode_so) {
        const result = await pool.query(
          `
          SELECT
            p.*,
            h.total_item,
            h.total_selisih,
            h.total_item_selisih,
            h.total_selisih_net
          FROM stok_opname_perintah p
          LEFT JOIN stok_opname h ON h.id = p.opname_id
          WHERE ${id ? "p.id = $1" : "UPPER(p.kode_so) = $1"}
          LIMIT 1
          `,
          [id ? Number(id) : normalizeKodeSo(kode_so)]
        );

        if (!result.rows.length) {
          return res.status(404).json({ error: "Perintah SO tidak ditemukan" });
        }

        const row = result.rows[0];
        const { rows: enrichedRows } = await enrichPerintahRows([row], row.bulan, row.tahun);
        return res.status(200).json(enrichedRows[0]);
      }

      if (!bulan || !tahun) {
        return res.status(400).json({ error: "bulan & tahun wajib" });
      }

      const listResult = await pool.query(
        `
        SELECT
          p.id,
          p.kode_so,
          p.tanggal_perintah,
          p.bulan,
          p.tahun,
          p.svp_nama,
          p.pic_checker,
          p.kategori_id,
          p.kategori_nama,
          p.lokasi,
          p.keterangan,
          p.status,
          p.checker,
          p.opname_id,
          p.created_at,
          p.started_at,
          p.completed_at,
          h.total_item,
          h.total_selisih,
          h.total_item_selisih,
          h.total_selisih_net
        FROM stok_opname_perintah p
        LEFT JOIN stok_opname h ON h.id = p.opname_id
        WHERE p.bulan = $1 AND p.tahun = $2
        ORDER BY p.created_at DESC, p.kode_so ASC
        `,
        [Number(bulan), Number(tahun)]
      );

      const { rows, period_kategori } = await enrichPerintahRows(
        listResult.rows,
        Number(bulan),
        Number(tahun)
      );

      return res.status(200).json({
        items: rows,
        period_kategori
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
          `
          UPDATE stok_opname_perintah
          SET
            status = 'proses',
            checker = COALESCE(NULLIF($2, ''), checker),
            started_at = COALESCE(started_at, NOW()),
            updated_at = NOW()
          WHERE id = $1 AND status IN ('menunggu', 'proses')
          RETURNING *
          `,
          [perintahId, body.checker || null]
        );

        if (!result.rows.length) {
          return res.status(404).json({ error: "Perintah SO tidak ditemukan atau sudah selesai" });
        }

        return res.status(200).json(result.rows[0]);
      }

      if (action === "update") {
        const perintahId = Number(body.perintah_id);
        const kodeSo = normalizeKodeSo(body.kode_so);
        const svpNama = String(body.svp_nama || "").trim();
        const lokasi = String(body.lokasi || "").trim() || null;
        const keterangan = String(body.keterangan || "").trim() || null;
        const tanggal = body.tanggal_perintah || body.tanggal;
        const kategoriTargets = serializeKategoriTargets(body.kategori_targets);

        if (!perintahId) {
          return res.status(400).json({ error: "perintah_id wajib" });
        }
        if (!kodeSo || !svpNama || !tanggal) {
          return res.status(400).json({ error: "kode_so, svp_nama, dan tanggal wajib diisi" });
        }
        if (!normalizeKategoriTargets(kategoriTargets).length) {
          return res.status(400).json({ error: "Pilih minimal satu kategori SO" });
        }

        const dateObj = new Date(tanggal);
        if (Number.isNaN(dateObj.getTime())) {
          return res.status(400).json({ error: "Format tanggal tidak valid" });
        }

        const bulan = Number(body.bulan) || dateObj.getMonth() + 1;
        const tahun = Number(body.tahun) || dateObj.getFullYear();

        const existing = await pool.query(
          `SELECT id, status, kode_so FROM stok_opname_perintah WHERE id = $1`,
          [perintahId]
        );

        if (!existing.rows.length) {
          return res.status(404).json({ error: "Perintah SO tidak ditemukan" });
        }

        const duplicate = await pool.query(
          `SELECT id FROM stok_opname_perintah WHERE UPPER(kode_so) = $1 AND id <> $2`,
          [kodeSo, perintahId]
        );

        if (duplicate.rows.length) {
          return res.status(409).json({ error: "Kode SO sudah digunakan perintah lain" });
        }

        const updateResult = await pool.query(
          `
          UPDATE stok_opname_perintah
          SET
            kode_so = $1,
            tanggal_perintah = $2,
            bulan = $3,
            tahun = $4,
            svp_nama = $5,
            lokasi = $6,
            keterangan = $7,
            kategori_targets = $8,
            updated_at = NOW()
          WHERE id = $9 AND status IN ('menunggu', 'proses', 'selesai')
          RETURNING *
          `,
          [kodeSo, tanggal, bulan, tahun, svpNama, lokasi, keterangan, kategoriTargets, perintahId]
        );

        if (!updateResult.rows.length) {
          return res.status(400).json({ error: "Perintah tidak dapat diperbarui" });
        }

        return res.status(200).json({
          message: `Perintah ${kodeSo} berhasil diperbarui`,
          perintah: updateResult.rows[0]
        });
      }

      const kodeSo = normalizeKodeSo(body.kode_so);
      const svpNama = String(body.svp_nama || "").trim();
      const picChecker = String(body.pic_checker || "").trim() || null;
      const lokasi = String(body.lokasi || "").trim() || null;
      const keterangan = String(body.keterangan || "").trim() || null;
      const tanggal = body.tanggal_perintah || body.tanggal;
      const kategoriId = String(body.kategori_id || "modul").trim();
      const kategoriNama = String(body.kategori_nama || "Modul").trim();

      if (!kodeSo || !svpNama || !tanggal) {
        return res.status(400).json({ error: "kode_so, svp_nama, dan tanggal wajib diisi" });
      }

      const dateObj = new Date(tanggal);
      if (Number.isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: "Format tanggal tidak valid" });
      }

      const bulan = Number(body.bulan) || dateObj.getMonth() + 1;
      const tahun = Number(body.tahun) || dateObj.getFullYear();

      // Get product count filtered by kategori as snapshot for target_sku
      const produkCountResult = await pool.query(
        `SELECT COUNT(*)::int as total FROM produk WHERE kategori = $1`,
        [kategoriId]
      );
      const targetSku = Number(produkCountResult.rows[0]?.total || 0);

      const insertResult = await pool.query(
        `
        INSERT INTO stok_opname_perintah (
          kode_so, tanggal_perintah, bulan, tahun,
          svp_nama, pic_checker, lokasi, keterangan, 
          kategori_id, kategori_nama, kategori_targets, 
          status, target_sku
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'menunggu', $12)
        RETURNING *
        `,
        [kodeSo, tanggal, bulan, tahun, svpNama, picChecker, lokasi, keterangan, 
         kategoriId, kategoriNama, kategoriId, targetSku]
      );

      return res.status(201).json({
        message: `Perintah ${kodeSo} berhasil dibuat`,
        perintah: insertResult.rows[0]
      });
    }
    
    // DELETE - Delete perintah (Admin only)
    if (req.method === "DELETE") {
      // Check authorization
      const auth = await import('../services/auth.js');
      const authResult = auth.authenticate(req);
      if (!authResult.authorized) {
        return res.status(401).json({ error: "Unauthorized - Silakan login" });
      }
      if (authResult.user.role !== 'admin') {
        return res.status(403).json({ error: "Hanya admin yang dapat menghapus perintah SO" });
      }
      
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/').filter(Boolean);
      // URL: /api/opname-perintah/:id -> pathParts = ['api', 'opname-perintah', ':id']
      const idIndex = pathParts.findIndex(p => p === 'opname-perintah');
      const id = pathParts[idIndex + 1];
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: "ID tidak valid" });
      }
      
      // Check if perintah exists and is in 'menunggu' status
      const checkResult = await pool.query(
        `SELECT id, kode_so, status FROM stok_opname_perintah WHERE id = $1`,
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "Perintah tidak ditemukan" });
      }
      
      const perintah = checkResult.rows[0];
      
      if (perintah.status !== 'menunggu') {
        return res.status(400).json({ 
          error: `Tidak dapat menghapus perintah dengan status "${perintah.status}". Hanya perintah dengan status "menunggu" yang dapat dihapus.` 
        });
      }
      
      // Delete the perintah (cascade will handle related records if FK is set)
      await pool.query(`DELETE FROM stok_opname_perintah WHERE id = $1`, [id]);
      
      return res.status(200).json({
        message: `Perintah ${perintah.kode_so} berhasil dihapus`
      });
    }

    return res.status(405).json({ error: "Method tidak diizinkan" });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Kode SO sudah digunakan. Gunakan kode lain." });
    }
    console.error("OPNAME PERINTAH ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
