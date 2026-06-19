import pool from "../services/db.js";
import { getStokOpnameColumns } from "./opname-db-utils.js";

async function hasPerintahTable() {
  const result = await pool.query(`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stok_opname_perintah'
    LIMIT 1
  `);
  return result.rows.length > 0;
}

export default async function handler(req, res) {
  try {
    const { bulan, tahun, detail, opname_id } = req.query;
    const includeDetails = String(detail).toLowerCase() === "true";
    
    let columns = new Set();
    try {
      columns = await getStokOpnameColumns();
    } catch (e) {
      console.error("getStokOpnameColumns error:", e);
    }
    
    let hasPerintah = false;
    try {
      hasPerintah = await hasPerintahTable();
    } catch (e) {
      console.error("hasPerintahTable error:", e);
    }

    const createdAtCol = columns.has("created_at") ? "h.created_at" : "h.tanggal";
    const itemSelisihCol = columns.has("total_item_selisih") ? "h.total_item_selisih" : "0 AS total_item_selisih";
    const selisihNetCol = columns.has("total_selisih_net") ? "h.total_selisih_net" : "0 AS total_selisih_net";
    const disesuaikanCol = columns.has("disesuaikan_at") ? "h.disesuaikan_at" : "null as disesuaikan_at";

    const perintahJoin = hasPerintah
      ? "LEFT JOIN stok_opname_perintah p ON p.opname_id = h.id"
      : "";
    const kodeSoSelect = hasPerintah ? "p.kode_so" : "null as kode_so";
    const perintahIdSelect = hasPerintah ? "p.id AS perintah_id" : "null as perintah_id";
    const svpSelect = hasPerintah ? "p.svp_nama" : "null as svp_nama";
    const kategoriIdSelect = hasPerintah ? "p.kategori_id" : "null as kategori_id";
    const kategoriNamaSelect = hasPerintah ? "p.kategori_nama" : "null as kategori_nama";
    const statusSelect = hasPerintah ? "p.status" : "h.status";
    const tanggalPerintahSelect = hasPerintah
      ? "p.tanggal_perintah"
      : "h.tanggal AS tanggal_perintah";
    const tanggalPelaksanaanSelect = hasPerintah
      ? `COALESCE(p.completed_at, ${createdAtCol}, h.tanggal)`
      : `COALESCE(${createdAtCol}, h.tanggal)`;

    if (opname_id) {
      const detailResult = await pool.query(
        `
        SELECT
          h.id AS opname_id,
          h.status,
          ${perintahIdSelect},
          ${kodeSoSelect},
          ${kategoriIdSelect},
          ${kategoriNamaSelect},
          ${tanggalPerintahSelect},
          ${tanggalPelaksanaanSelect} AS tanggal_pelaksanaan,
          ${svpSelect},
          h.checker AS pic_pelaksana,
          h.lokasi,
          h.keterangan,
          h.total_item,
          h.total_selisih,
          ${itemSelisihCol},
          ${selisihNetCol},
          ${disesuaikanCol},
          ${createdAtCol} AS created_at,
          d.sku,
          p2.nama_produk,
          d.stok_sistem,
          d.stok_fisik,
          d.selisih,
          d.input_at
        FROM stok_opname h
        ${perintahJoin}
        LEFT JOIN stok_opname_detail d ON d.opname_id = h.id
        LEFT JOIN produk p2 ON p2.sku = d.sku
        WHERE h.id = $1
        ORDER BY d.input_at ASC NULLS LAST, d.id ASC
        `,
        [Number(opname_id)]
      );

      if (!detailResult.rows.length) {
        return res.status(404).json({ error: "History SO tidak ditemukan" });
      }

      const header = detailResult.rows[0];
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
          opname_id: header.opname_id,
          status: header.status,
          perintah_id: header.perintah_id,
          kode_so: header.kode_so,
          kategori_id: header.kategori_id,
          kategori_nama: header.kategori_nama,
          tanggal_perintah: header.tanggal_perintah,
          tanggal_pelaksanaan: header.tanggal_pelaksanaan,
          svp_nama: header.svp_nama,
          pic_pelaksana: header.pic_pelaksana,
          lokasi: header.lokasi,
          keterangan: header.keterangan,
          total_item: header.total_item,
          total_selisih: header.total_selisih,
          total_item_selisih: header.total_item_selisih,
          total_selisih_net: header.total_selisih_net,
          created_at: header.created_at,
          disesuaikan_at: header.disesuaikan_at,
          stok_disesuaikan: Boolean(header.disesuaikan_at)
        },
        details
      });
    }

    if (!bulan || !tahun) {
      return res.status(400).json({ error: "bulan & tahun wajib" });
    }

    const periodFilter = hasPerintah
      ? `(
          (p.id IS NOT NULL AND p.bulan = $1 AND p.tahun = $2)
          OR (p.id IS NULL AND EXTRACT(MONTH FROM h.tanggal) = $1 AND EXTRACT(YEAR FROM h.tanggal) = $2)
        )`
      : `EXTRACT(MONTH FROM h.tanggal) = $1 AND EXTRACT(YEAR FROM h.tanggal) = $2`;

    const summaryResult = await pool.query(
      `
      SELECT
        h.id AS opname_id,
        ${statusSelect} AS status,
        ${perintahIdSelect},
        ${kodeSoSelect},
        ${kategoriIdSelect} AS kategori_id,
        ${kategoriNamaSelect} AS kategori_nama,
        ${tanggalPerintahSelect},
        ${tanggalPelaksanaanSelect} AS tanggal_pelaksanaan,
        ${svpSelect},
        h.checker AS pic_pelaksana,
        h.lokasi,
        h.keterangan,
        h.total_item,
        h.total_selisih,
        ${itemSelisihCol},
        ${selisihNetCol},
        ${disesuaikanCol},
        ${createdAtCol} AS created_at
      FROM stok_opname h
      ${perintahJoin}
      WHERE ${periodFilter}
      ORDER BY tanggal_pelaksanaan DESC NULLS LAST, h.id DESC
      `,
      [Number(bulan), Number(tahun)]
    );

    if (includeDetails) {
      const detailsResult = await pool.query(
        `
        SELECT
          h.id AS opname_id,
          ${statusSelect} AS status,
          ${perintahIdSelect},
          ${kodeSoSelect},
          ${kategoriIdSelect} AS kategori_id,
          ${kategoriNamaSelect} AS kategori_nama,
          ${tanggalPerintahSelect},
          ${tanggalPelaksanaanSelect} AS tanggal_pelaksanaan,
          ${svpSelect},
          h.checker AS pic_pelaksana,
          h.lokasi,
          d.sku,
          p2.nama_produk,
          d.stok_sistem,
          d.stok_fisik,
          d.selisih,
          d.input_at
        FROM stok_opname h
        ${perintahJoin}
        JOIN stok_opname_detail d ON d.opname_id = h.id
        LEFT JOIN produk p2 ON p2.sku = d.sku
        WHERE ${periodFilter}
        ORDER BY tanggal_pelaksanaan DESC NULLS LAST, h.id DESC, d.input_at ASC NULLS LAST, d.id ASC
        `,
        [Number(bulan), Number(tahun)]
      );

      return res.status(200).json({
        summary: summaryResult.rows,
        details: detailsResult.rows
      });
    }

    res.status(200).json(summaryResult.rows);
  } catch (err) {
    console.error("ERROR HISTORY:", err);
    res.status(500).json({ error: err.message });
  }
}
