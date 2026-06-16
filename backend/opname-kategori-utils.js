import pool from "../services/db.js";

export const OPNAME_KATEGORI_LIST = ["modul", "seragam", "poster", "lain_lain", "lain-lain"];

export const OPNAME_KATEGORI_LABEL = {
  modul: "Modul",
  seragam: "Seragam",
  poster: "Poster",
  lain_lain: "Lain-Lain",
  "lain-lain": "Lain-Lain"
};

export function sqlProdukKategoriExpr(alias = "p") {
  const col = `${alias}.nama_produk`;
  return `
    CASE
      WHEN LOWER(${col}) LIKE 'modul%' THEN 'modul'
      WHEN LOWER(${col}) LIKE 'poster%' OR LOWER(${col}) LIKE 'flash%' THEN 'poster'
      WHEN LOWER(${col}) LIKE '%merah%'
        OR LOWER(${col}) LIKE '%kuning%'
        OR LOWER(${col}) LIKE '%biru%'
        OR LOWER(${col}) LIKE '% my%' THEN 'seragam'
      ELSE 'lain-lain'
    END
  `;
}

export function normalizeKategoriTargets(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim().toLowerCase()).filter((item) => OPNAME_KATEGORI_LIST.includes(item)))];
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeKategoriTargets(parsed);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => OPNAME_KATEGORI_LIST.includes(item));
    }
  }

  return [];
}

export function serializeKategoriTargets(targets) {
  return JSON.stringify(normalizeKategoriTargets(targets));
}

export async function ensurePerintahKategoriColumn() {
  await pool.query(`
    ALTER TABLE stok_opname_perintah
      ADD COLUMN IF NOT EXISTS kategori_targets TEXT
  `);

  await pool.query(`
    UPDATE stok_opname_perintah
    SET kategori_targets = $1
    WHERE kategori_targets IS NULL OR TRIM(kategori_targets) = ''
  `, [serializeKategoriTargets(OPNAME_KATEGORI_LIST)]);
}

export async function getKategoriTotalsForPeriod(bulan, tahun) {
  const kategoriExpr = sqlProdukKategoriExpr("p");
  const result = await pool.query(
    `
    WITH params AS (
      SELECT
        make_date($2::int, $1::int, 1) AS start_date,
        (make_date($2::int, $1::int, 1) + interval '1 month')::date AS end_date
    ),
    base_stock AS (
      SELECT sku, COALESCE(SUM(qty_awal), 0) AS total_qty_awal
      FROM stok_awal
      GROUP BY sku
    ),
    pembelian_upto AS (
      SELECT sku, COALESCE(SUM(qty), 0) AS qty
      FROM pembelian
      WHERE tanggal < (SELECT end_date FROM params)
      GROUP BY sku
    ),
    penjualan_upto AS (
      SELECT sku, COALESCE(SUM(qty), 0) AS qty
      FROM penjualan
      WHERE tanggal < (SELECT end_date FROM params)
      GROUP BY sku
    ),
    penyesuaian_upto AS (
      SELECT sku, COALESCE(SUM(qty), 0) AS qty
      FROM stok_penyesuaian
      WHERE tanggal < (SELECT end_date FROM params)
      GROUP BY sku
    ),
    stok_produk AS (
      SELECT
        p.sku,
        ${kategoriExpr} AS kategori
      FROM produk p
      LEFT JOIN base_stock bs ON bs.sku = p.sku
      LEFT JOIN pembelian_upto pb ON pb.sku = p.sku
      LEFT JOIN penjualan_upto pj ON pj.sku = p.sku
      LEFT JOIN penyesuaian_upto adj ON adj.sku = p.sku
      WHERE (
        COALESCE(bs.total_qty_awal, 0)
        + COALESCE(pb.qty, 0)
        - COALESCE(pj.qty, 0)
        + COALESCE(adj.qty, 0)
      ) > 0
         OR EXISTS (SELECT 1 FROM stok_awal sa WHERE sa.sku = p.sku)
         OR EXISTS (SELECT 1 FROM pembelian pm WHERE pm.sku = p.sku)
    )
    SELECT kategori, COUNT(*)::int AS total_sku
    FROM stok_produk
    GROUP BY kategori
    `,
    [Number(bulan), Number(tahun)]
  );

  const totals = Object.fromEntries(OPNAME_KATEGORI_LIST.map((key) => [key, 0]));
  result.rows.forEach((row) => {
    totals[row.kategori] = Number(row.total_sku || 0);
  });
  return totals;
}

export async function getKategoriCountedByOpname(opnameIds) {
  const ids = [...new Set(opnameIds.map((id) => Number(id)).filter(Boolean))];
  if (!ids.length) return {};

  const result = await pool.query(
    `
    SELECT
      d.opname_id,
      p.kategori,
      COUNT(DISTINCT d.sku)::int AS counted_sku
    FROM stok_opname_detail d
    JOIN produk p ON p.sku = d.sku
    WHERE d.opname_id = ANY($1::int[])
    GROUP BY
      d.opname_id,
      p.kategori
    `,
    [ids]
  );

  const map = {};
  result.rows.forEach((row) => {
    const opnameId = Number(row.opname_id);
    if (!map[opnameId]) map[opnameId] = {};
    map[opnameId][row.kategori] = Number(row.counted_sku || 0);
  });
  return map;
}

export function buildKategoriProgress(targets, totalsByKategori, countedByKategori = {}, status = "menunggu") {
  const normalizedTargets = normalizeKategoriTargets(targets);
  const targetList = normalizedTargets.length ? normalizedTargets : [...OPNAME_KATEGORI_LIST];

  return targetList.map((kategori) => {
    const total = Number(totalsByKategori[kategori] || 0);
    const counted = Number(countedByKategori[kategori] || 0);
    const progress = total ? Math.round((counted / total) * 100) : 0;
    let kategoriStatus = "menunggu";

    if (status === "selesai") {
      kategoriStatus = total === 0 || counted >= total ? "selesai" : "proses";
    } else if (status === "proses") {
      kategoriStatus = counted > 0 ? (counted >= total && total > 0 ? "selesai" : "proses") : "menunggu";
    } else if (counted > 0) {
      kategoriStatus = counted >= total && total > 0 ? "selesai" : "proses";
    }

    return {
      kategori,
      label: OPNAME_KATEGORI_LABEL[kategori] || kategori,
      total_sku: total,
      counted_sku: counted,
      progress,
      selesai: kategoriStatus === "selesai",
      status: kategoriStatus
    };
  });
}

export function buildPeriodKategoriIndicator(perintahRows = []) {
  const indicator = Object.fromEntries(
    OPNAME_KATEGORI_LIST.map((kategori) => [kategori, { kategori, label: OPNAME_KATEGORI_LABEL[kategori], status: "belum", perintah_count: 0 }])
  );

  const statusRank = { menunggu: 1, proses: 2, selesai: 3, belum: 0 };

  perintahRows.forEach((row) => {
    const targets = normalizeKategoriTargets(row.kategori_targets);
    const progressList = row.kategori_progress || [];

    targets.forEach((kategori) => {
      const slot = indicator[kategori];
      if (!slot) return;

      slot.perintah_count += 1;
      const rowProgress = progressList.find((item) => item.kategori === kategori);
      const candidate = rowProgress?.status || row.status || "menunggu";
      if (statusRank[candidate] > statusRank[slot.status]) {
        slot.status = candidate;
      }
    });
  });

  return OPNAME_KATEGORI_LIST.map((kategori) => indicator[kategori]);
}
