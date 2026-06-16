import pool from "../services/db.js";
import {
  buildKategoriProgress,
  buildPeriodKategoriIndicator,
  ensurePerintahKategoriColumn,
  getKategoriCountedByOpname,
  getKategoriTotalsForPeriod,
  normalizeKategoriTargets
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
    const checkedCount = await pool.query(`
      SELECT COUNT(*)::int as checked 
      FROM stok_opname_detail 
      WHERE opname_id = $1 AND stok_fisik IS NOT NULL
    `, [opnameId]);
    
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

      // GET list - using only columns that exist in production schema
      // REMOVED: pic_checker, kategori_id, kategori_nama (do not exist in production)
      // Use: checker as pic_checker, kategori_targets as kategori_id/kategori_nama
      const listResult = await pool.query(
        `
        SELECT
          p.id,
          p.kode_so,
          p.tanggal_perintah,
          p.bulan,
          p.tahun,
          p.svp_nama,
          p.checker AS pic_checker,
          p.kategori_targets AS kategori_id,
          p.kategori_targets AS kategori_nama,
          p.lokasi,
          p.keterangan,
          p.status,
          p.checker,
          p.opname_id,
          p.target_sku,
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
        const kategoriTargets = body.kategori_targets || ['modul', 'seragam', 'poster', 'lain_lain'];

        if (!perintahId) {
          return res.status(400).json({ error: "perintah_id wajib" });
        }
        if (!kodeSo || !svpNama || !tanggal) {
          return res.status(400).json({ error: "kode_so, svp_nama, dan tanggal wajib diisi" });
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

        // UPDATE - only using columns that exist in production schema
        // REMOVED: pic_checker, kategori_id, kategori_nama (do not exist)
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
            checker = COALESCE(NULLIF($9, ''), checker),
            updated_at = NOW()
          WHERE id = $10 AND status IN ('menunggu', 'proses', 'selesai')
          RETURNING *
          `,
          [kodeSo, tanggal, bulan, tahun, svpNama, lokasi, keterangan, 
           JSON.stringify(Array.isArray(kategoriTargets) ? kategoriTargets : ['modul', 'seragam', 'poster', 'lain_lain']),
           body.checker || body.pic_checker || null,
           perintahId]
        );

        if (!updateResult.rows.length) {
          return res.status(400).json({ error: "Perintah tidak dapat diperbarui" });
        }

        return res.status(200).json({
          message: `Perintah ${kodeSo} berhasil diperbarui`,
          perintah: updateResult.rows[0]
        });
      }

      // CREATE new perintah - only using columns that exist in production schema
      // REMOVED: pic_checker, kategori_id, kategori_nama (do not exist)
      const kodeSo = normalizeKodeSo(body.kode_so);
      const svpNama = String(body.svp_nama || "").trim();
      const lokasi = String(body.lokasi || "").trim() || null;
      const keterangan = String(body.keterangan || "").trim() || null;
      const tanggal = body.tanggal_perintah || body.tanggal;
      const kategoriTargets = body.kategori_targets || ['modul', 'seragam', 'poster', 'lain_lain'];

      if (!kodeSo || !svpNama || !tanggal) {
        return res.status(400).json({ error: "kode_so, svp_nama, dan tanggal wajib diisi" });
      }

      const dateObj = new Date(tanggal);
      if (Number.isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: "Format tanggal tidak valid" });
      }

      const bulan = Number(body.bulan) || dateObj.getMonth() + 1;
      const tahun = Number(body.tahun) || dateObj.getFullYear();

      // Get total product count for target_sku
      const produkCountResult = await pool.query(`SELECT COUNT(*)::int as total FROM produk`);
      const targetSku = Number(produkCountResult.rows[0]?.total || 0);

      // INSERT - only using columns that exist in production schema
      // REMOVED: pic_checker, kategori_id, kategori_nama (do not exist)
      const insertResult = await pool.query(
        `
        INSERT INTO stok_opname_perintah (
          kode_so, tanggal_perintah, bulan, tahun,
          svp_nama, checker, lokasi, keterangan, 
          kategori_targets, status, target_sku
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'menunggu', $10)
        ON CONFLICT (kode_so) DO UPDATE SET
          tanggal_perintah = EXCLUDED.tanggal_perintah,
          bulan = EXCLUDED.bulan,
          tahun = EXCLUDED.tahun,
          svp_nama = EXCLUDED.svp_nama,
          checker = COALESCE(EXCLUDED.checker, stok_opname_perintah.checker),
          lokasi = EXCLUDED.lokasi,
          keterangan = EXCLUDED.keterangan,
          updated_at = NOW()
        RETURNING *
        `,
        [kodeSo, tanggal, bulan, tahun, svpNama, body.checker || body.pic_checker || null, lokasi, keterangan, 
         JSON.stringify(Array.isArray(kategoriTargets) ? kategoriTargets : ['modul', 'seragam', 'poster', 'lain_lain']), 
         targetSku]
      );

      return res.status(201).json({
        message: `Perintah ${kodeSo} berhasil dibuat`,
        perintah: insertResult.rows[0]
      });
    }
    
    // DELETE - Delete perintah (Admin only)
    if (req.method === "DELETE") {
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
      const idIndex = pathParts.findIndex(p => p === 'opname-perintah');
      const id = pathParts[idIndex + 1];
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: "ID tidak valid" });
      }
      
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
