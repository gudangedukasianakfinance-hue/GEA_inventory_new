import pool from "../services/db.js";

// V3 Chart - Chart data untuk Dashboard V3
export default async function handler(req, res) {
  try {
    const { bulan, tahun, type } = req.query;
    const now = new Date();
    const targetBulan = Number(bulan || now.getMonth() + 1);
    const targetTahun = Number(tahun || now.getFullYear());

    // Default type: 'overview'
    const chartType = type || 'overview';

    let result;

    switch (chartType) {
      case 'penjualan':
        // Bar chart - Penjualan Harian per tanggal dalam bulan
        result = await pool.query(`
          SELECT 
            EXTRACT(DAY FROM tanggal)::int AS tanggal,
            COALESCE(SUM(qty), 0) AS value
          FROM penjualan
          WHERE EXTRACT(MONTH FROM tanggal) = $1
            AND EXTRACT(YEAR FROM tanggal) = $2
          GROUP BY EXTRACT(DAY FROM tanggal)
          ORDER BY tanggal
        `, [targetBulan, targetTahun]);
        break;

      case 'kategori':
        // Pie/Donut chart - Penjualan per kategori
        result = await pool.query(`
          SELECT 
            CASE
              WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'Modul'
              WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'Tas'
              WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
                OR UPPER(p.nama_produk) LIKE 'KUNING%'
                OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'Seragam'
              ELSE 'Lain-Lain'
            END AS label,
            COALESCE(SUM(j.qty), 0) AS value
          FROM produk p
          LEFT JOIN penjualan j ON j.sku = p.sku
            AND EXTRACT(MONTH FROM j.tanggal) = $1
            AND EXTRACT(YEAR FROM j.tanggal) = $2
          GROUP BY 
            CASE
              WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'Modul'
              WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'Tas'
              WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
                OR UPPER(p.nama_produk) LIKE 'KUNING%'
                OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'Seragam'
              ELSE 'Lain-Lain'
            END
          ORDER BY value DESC
        `, [targetBulan, targetTahun]);
        break;

      case 'level':
        // Bar chart - Penjualan per level modul
        result = await pool.query(`
          WITH produk_level AS (
            SELECT 
              sku,
              CASE
                WHEN nama_produk ILIKE 'Modul Membaca%' THEN 'Membaca'
                WHEN nama_produk ILIKE 'Modul Expro MD%' THEN 'Expro MD'
                WHEN nama_produk ILIKE 'Modul Expro PU%' THEN 'Expro PU'
                ELSE 'Lainnya'
              END AS modul_type,
              CASE
                WHEN nama_produk LIKE '%Level 1.%' THEN '1'
                WHEN nama_produk LIKE '%Level 2.%' THEN '2'
                WHEN nama_produk LIKE '%Level 3.%' THEN '3'
                WHEN nama_produk LIKE '%Level 4.%' THEN '4'
                ELSE '0'
              END AS level_num
            FROM produk
            WHERE nama_produk ILIKE 'Modul%'
          ),
          penjualan_level AS (
            SELECT 
              pl.modul_type,
              pl.level_num,
              COALESCE(SUM(j.qty), 0) AS value
            FROM produk_level pl
            LEFT JOIN penjualan j ON j.sku = pl.sku
              AND EXTRACT(MONTH FROM j.tanggal) = $1
              AND EXTRACT(YEAR FROM j.tanggal) = $2
            GROUP BY pl.sku, pl.modul_type, pl.level_num
          )
          SELECT 
            modul_type || ' Level ' || level_num AS label,
            SUM(value) AS value
          FROM penjualan_level
          WHERE modul_type != 'Lainnya'
          GROUP BY modul_type, level_num
          ORDER BY 
            CASE modul_type WHEN 'Membaca' THEN 1 WHEN 'Expro PU' THEN 2 WHEN 'Expro MD' THEN 3 ELSE 4 END,
            level_num
        `, [targetBulan, targetTahun]);
        break;

      case 'tren':
        // Line chart - Tren penjualan 12 bulan
        result = await pool.query(`
          SELECT 
            TO_CHAR(tanggal, 'Mon YYYY') AS label,
            EXTRACT(MONTH FROM tanggal) AS bulan,
            EXTRACT(YEAR FROM tanggal) AS tahun,
            COALESCE(SUM(qty), 0) AS value
          FROM penjualan
          WHERE tanggal >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY tanggal
          ORDER BY tanggal
        `);
        break;

      case 'tren_penjualan':
        // Line chart - Trend Penjualan Bulanan (SUM qty * harga_jual per bulan)
        result = await pool.query(`
          SELECT 
            m.bulan,
            COALESCE(SUM(j.qty * p.harga_jual), 0) AS value
          FROM (
            VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12)
          ) m(bulan)
          LEFT JOIN penjualan j ON EXTRACT(MONTH FROM j.tanggal) = m.bulan
            AND EXTRACT(YEAR FROM j.tanggal) = $1
          LEFT JOIN produk p ON p.sku = j.sku
          GROUP BY m.bulan
          ORDER BY m.bulan
        `, [targetTahun]);
        break;

      case 'stok':
        // Bar chart - Stok per kategori
        result = await pool.query(`
          WITH params AS (
            SELECT (make_date($2::int, $1::int, 1) + interval '1 month')::date AS end_date
          ),
          base_stock AS (
            SELECT 
              CASE
                WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'Modul'
                WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'Tas'
                WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
                  OR UPPER(p.nama_produk) LIKE 'KUNING%'
                  OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'Seragam'
                ELSE 'Lain-Lain'
              END AS kategori,
              COALESCE(SUM(sa.qty_awal), 0) AS stok_awal
            FROM produk p
            LEFT JOIN stok_awal sa ON sa.sku = p.sku
            GROUP BY kategori
          ),
          pembelian AS (
            SELECT 
              CASE
                WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'Modul'
                WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'Tas'
                WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
                  OR UPPER(p.nama_produk) LIKE 'KUNING%'
                  OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'Seragam'
                ELSE 'Lain-Lain'
              END AS kategori,
              COALESCE(SUM(pb.qty), 0) AS total_beli
            FROM produk p
            LEFT JOIN pembelian pb ON pb.sku = p.sku AND pb.tanggal <= (SELECT end_date FROM params)
            GROUP BY kategori
          ),
          penjualan AS (
            SELECT 
              CASE
                WHEN UPPER(p.nama_produk) LIKE 'MODUL%' THEN 'Modul'
                WHEN UPPER(p.nama_produk) LIKE 'TAS%' THEN 'Tas'
                WHEN UPPER(p.nama_produk) LIKE 'BIRU%' 
                  OR UPPER(p.nama_produk) LIKE 'KUNING%'
                  OR UPPER(p.nama_produk) LIKE 'MERAH%' THEN 'Seragam'
                ELSE 'Lain-Lain'
              END AS kategori,
              COALESCE(SUM(j.qty), 0) AS total_jual
            FROM produk p
            LEFT JOIN penjualan j ON j.sku = p.sku AND j.tanggal <= (SELECT end_date FROM params)
            GROUP BY kategori
          )
          SELECT 
            bs.kategori AS label,
            COALESCE(bs.stok_awal, 0) + COALESCE(pb.total_beli, 0) - COALESCE(pj.total_jual, 0) AS value
          FROM base_stock bs
          LEFT JOIN pembelian pb ON pb.kategori = bs.kategori
          LEFT JOIN penjualan pj ON pj.kategori = bs.kategori
          ORDER BY value DESC
        `, [targetBulan, targetTahun]);
        break;

      case 'modul_level':
        // Table - Modul Terjual Per Level
        // Show all expected levels regardless of sales
        result = await pool.query(`
          WITH params AS (
            SELECT $1::int AS bulan, $2::int AS tahun
          ),
          expected_levels AS (
            VALUES 
              ('Membaca', 1),
              ('Membaca', 2),
              ('Membaca', 3),
              ('Expro PU', 1),
              ('Expro PU', 2),
              ('Expro MD', 1),
              ('Expro MD', 2),
              ('Expro MD', 3),
              ('Expro MD', 4)
          ),
          produk_mapping AS (
            SELECT 
              sku,
              nama_produk,
              CASE
                WHEN nama_produk ILIKE '%Membaca Level 1.%' THEN 'Membaca'
                WHEN nama_produk ILIKE '%Membaca Level 2.%' THEN 'Membaca'
                WHEN nama_produk ILIKE '%Membaca Level 3.%' THEN 'Membaca'
                WHEN nama_produk ILIKE '%Ekspro PU%' THEN 'Ekspro PU'
                WHEN nama_produk ILIKE '%Ekspro MD%' THEN 'Ekspro MD'
                ELSE 'Lainnya'
              END AS jenis,
              CASE
                WHEN nama_produk ILIKE '%Level 1.%' THEN 1
                WHEN nama_produk ILIKE '%Level 2.%' THEN 2
                WHEN nama_produk ILIKE '%Level 3.%' THEN 3
                WHEN nama_produk ILIKE '%Level 4.%' THEN 4
                ELSE 0
              END AS level_num
            FROM produk
            WHERE nama_produk ILIKE 'Modul%' 
               OR nama_produk ILIKE '%Ekspro%'
          ),
          penjualan_level AS (
            SELECT 
              pm.jenis,
              pm.level_num,
              COALESCE(SUM(j.qty), 0) AS qty_terjual
            FROM produk_mapping pm
            LEFT JOIN penjualan j ON j.sku = pm.sku
              AND EXTRACT(MONTH FROM j.tanggal) = (SELECT bulan FROM params)
              AND EXTRACT(YEAR FROM j.tanggal) = (SELECT tahun FROM params)
            WHERE pm.jenis != 'Lainnya'
              AND pm.level_num > 0
            GROUP BY pm.jenis, pm.level_num
          )
          SELECT 
            el.column1 AS label,
            el.column2 AS level_num,
            COALESCE(pl.qty_terjual, 0) AS value,
            el.column1 || ' Level ' || el.column2 AS full_label
          FROM expected_levels el
          LEFT JOIN penjualan_level pl ON pl.jenis = el.column1 AND pl.level_num = el.column2
          ORDER BY 
            CASE el.column1 
              WHEN 'Membaca' THEN 1 
              WHEN 'Ekspro PU' THEN 2 
              WHEN 'Expro MD' THEN 3 
            END,
            el.column2
        `, [targetBulan, targetTahun]);
        break;

      case 'top_produk':
        // Top 10 produk berdasarkan penjualan
        result = await pool.query(`
          SELECT 
            p.sku AS label,
            p.nama_produk,
            COALESCE(SUM(j.qty), 0) AS value
          FROM produk p
          LEFT JOIN penjualan j ON j.sku = p.sku
            AND EXTRACT(MONTH FROM j.tanggal) = $1
            AND EXTRACT(YEAR FROM j.tanggal) = $2
          GROUP BY p.sku, p.nama_produk
          ORDER BY value DESC
          LIMIT 10
        `, [targetBulan, targetTahun]);
        break;

      case 'outlet':
        // Top 10 outlet - coba outlet_penjualan dulu, fallback ke penjualan
        const outletCheck = await pool.query(`
          SELECT EXISTS(
            SELECT 1 FROM outlet_penjualan LIMIT 1
          ) AS exists
        `);
        
        if (outletCheck.rows[0]?.exists) {
          result = await pool.query(`
            SELECT 
              o.nama_outlet AS label,
              COALESCE(SUM(op.qty), 0) AS value
            FROM outlet o
            LEFT JOIN outlet_penjualan op ON op.outlet_id = o.id
              AND EXTRACT(MONTH FROM op.tanggal) = $1
              AND EXTRACT(YEAR FROM op.tanggal) = $2
            GROUP BY o.id, o.nama_outlet
            ORDER BY value DESC
            LIMIT 10
          `, [targetBulan, targetTahun]);
        } else {
          result = await pool.query(`
            SELECT 
              nama_outlet AS label,
              COALESCE(SUM(qty), 0) AS value
            FROM penjualan
            WHERE EXTRACT(MONTH FROM tanggal) = $1
              AND EXTRACT(YEAR FROM tanggal) = $2
            GROUP BY nama_outlet
            ORDER BY value DESC
            LIMIT 10
          `, [targetBulan, targetTahun]);
        }
        break;

      default:
        // Overview - ringkasan chart
        result = await pool.query(`
          SELECT 
            'Penjualan' AS label,
            COALESCE(SUM(qty), 0) AS value
          FROM penjualan
          WHERE EXTRACT(MONTH FROM tanggal) = $1
            AND EXTRACT(YEAR FROM tanggal) = $2
          UNION ALL
          SELECT 
            'Pembelian' AS label,
            COALESCE(SUM(qty), 0) AS value
          FROM pembelian
          WHERE EXTRACT(MONTH FROM tanggal) = $1
            AND EXTRACT(YEAR FROM tanggal) = $2
        `, [targetBulan, targetTahun]);
    }

    res.status(200).json({
      type: chartType,
      periode: { bulan: targetBulan, tahun: targetTahun },
      data: result.rows.map(r => ({
        label: r.label || r.full_label || (r.bulan ? `Bulan ${r.bulan}` : ''),
        full_label: r.full_label || (r.label ? r.label + (r.level_num ? ' Level ' + r.level_num : '') : ''),
        bulan: r.bulan ? Number(r.bulan) : null,
        level_num: r.level_num ? Number(r.level_num) : null,
        nama_produk: r.nama_produk || r.label || '',
        value: Number(r.value || r.total_penjualan || 0)
      }))
    });

  } catch (err) {
    console.error("V3 CHART ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}