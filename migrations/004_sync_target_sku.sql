-- Migration: Sync target_sku based on kategori_id
-- Date: 2026-06-16

-- Sync old target_sku values based on kategori distribution:
-- modul = 25, poster = 14, seragam = 32, lain_lain = 28

UPDATE stok_opname_perintah
SET target_sku = CASE
    WHEN kategori_id = 'modul' THEN 25
    WHEN kategori_id = 'poster' THEN 14
    WHEN kategori_id = 'seragam' THEN 32
    WHEN kategori_id = 'lain_lain' OR kategori_id = 'lain-lain' THEN 28
    ELSE target_sku
END
WHERE target_sku = 0 OR target_sku IS NULL;
