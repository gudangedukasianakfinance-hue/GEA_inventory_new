import pool from "../services/db.js";

export default async function handler(req, res) {
  try {
    const { bulan, tahun, detail, opname_id } = req.query;
    const includeDetails = String(detail).toLowerCase() === "true";
    
    // Get header info for single opname
    if (opname_id) {
      const opnameIdNum = Number(opname_id);
      
      const headerResult = await pool.query(
        "SELECT h.* FROM stok_opname h WHERE h.id = $1",
        [opnameIdNum]
      );
      
      if (!headerResult.rows.length) {
        return res.status(404).json({ error: "History SO tidak ditemukan" });
      }
      
      const h = headerResult.rows[0];
      
      const detailResult = await pool.query(
        "SELECT d.*, p.nama_produk FROM stok_opname_detail d LEFT JOIN produk p ON p.sku = d.sku WHERE d.opname_id = $1 ORDER BY d.input_at ASC NULLS LAST, d.id ASC",
        [opnameIdNum]
      );
      
      let perintah = null;
      try {
        const pr = await pool.query("SELECT * FROM stok_opname_perintah WHERE opname_id = $1 LIMIT 1", [opnameIdNum]);
        if (pr.rows.length > 0) perintah = pr.rows[0];
      } catch (e) {}
      
      const details = detailResult.rows
        .filter((row) => row.sku)
        .map((row) => ({
          sku: row.sku || '',
          nama_produk: row.nama_produk || '-',
          stok_sistem: Number(row.stok_sistem || 0),
          stok_fisik: Number(row.stok_fisik || 0),
          selisih: Number(row.selisih || 0),
          input_at: row.input_at || null
        }));

      return res.status(200).json({
        header: {
          opname_id: h.id,
          status: perintah?.status || h.status,
          perintah_id: perintah?.id || null,
          kode_so: perintah?.kode_so || null,
          kategori_id: perintah?.kategori_id || null,
          kategori_nama: perintah?.kategori_nama || null,
          tanggal_perintah: perintah?.tanggal_perintah || h.tanggal,
          tanggal_pelaksanaan: perintah?.completed_at || h.created_at || h.tanggal,
          svp_nama: perintah?.svp_nama || null,
          pic_pelaksana: h.checker || null,
          lokasi: h.lokasi || null,
          keterangan: h.keterangan || null,
          total_item: h.total_item || 0,
          total_selisih: h.total_selisih || 0,
          total_item_selisih: h.total_item_selisih || 0,
          total_selisih_net: h.total_selisih_net || 0,
          created_at: h.created_at || h.tanggal,
          disesuaikan_at: h.disesuaikan_at || null,
          stok_disesuaikan: Boolean(h.disesuaikan_at)
        },
        details
      });
    }

    if (!bulan || !tahun) {
      return res.status(400).json({ error: "bulan & tahun wajib" });
    }

    const bulanNum = Number(bulan);
    const tahunNum = Number(tahun);
    
    const historyResult = await pool.query(
      "SELECT h.*, p.id as perintah_id, p.kode_so, p.kategori_id, p.kategori_nama, p.svp_nama, p.status as perintah_status, p.tanggal_perintah, p.completed_at FROM stok_opname h LEFT JOIN stok_opname_perintah p ON p.opname_id = h.id WHERE (p.bulan = $1 AND p.tahun = $2) OR (p.id IS NULL AND EXTRACT(MONTH FROM h.tanggal) = $1 AND EXTRACT(YEAR FROM h.tanggal) = $2) ORDER BY COALESCE(p.completed_at, h.created_at, h.tanggal) DESC NULLS LAST, h.id DESC",
      [bulanNum, tahunNum]
    );

    const rows = historyResult.rows.map(h => ({
      opname_id: h.id,
      status: h.perintah_status || h.status,
      perintah_id: h.perintah_id || null,
      kode_so: h.kode_so || null,
      kategori_id: h.kategori_id || null,
      kategori_nama: h.kategori_nama || null,
      tanggal_perintah: h.tanggal_perintah || h.tanggal,
      tanggal_pelaksanaan: h.completed_at || h.created_at || h.tanggal,
      svp_nama: h.svp_nama || null,
      pic_pelaksana: h.checker || null,
      lokasi: h.lokasi || null,
      keterangan: h.keterangan || null,
      total_item: h.total_item || 0,
      total_selisih: h.total_selisih || 0,
      total_item_selisih: h.total_item_selisih || 0,
      total_selisih_net: h.total_selisih_net || 0,
      created_at: h.created_at || h.tanggal,
      disesuaikan_at: h.disesuaikan_at || null,
      stok_disesuaikan: Boolean(h.disesuaikan_at)
    }));

    if (includeDetails) {
      const opnameIds = rows.map(r => r.opname_id);
      let details = [];
      
      if (opnameIds.length > 0) {
        const dr = await pool.query(
          "SELECT d.opname_id, d.sku, p.nama_produk, d.stok_sistem, d.stok_fisik, d.selisih, d.input_at FROM stok_opname_detail d LEFT JOIN produk p ON p.sku = d.sku WHERE d.opname_id = ANY($1) ORDER BY d.opname_id DESC, d.input_at ASC NULLS LAST, d.id ASC",
          [opnameIds]
        );
        details = dr.rows;
      }

      return res.status(200).json({ summary: rows, details });
    }

    res.status(200).json(rows);
  } catch (err) {
    console.error("ERROR HISTORY:", err);
    res.status(500).json({ error: err.message });
  }
}
