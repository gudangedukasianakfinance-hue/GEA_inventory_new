-- Migration: Add all missing columns to stok_opname_perintah (Safe Version)
-- Date: 2026-06-16
-- This script is safe to run multiple times - uses IF NOT EXISTS / IF NOT EXISTS

BEGIN;

-- 1. Add pic_checker column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stok_opname_perintah' AND column_name = 'pic_checker') THEN
    ALTER TABLE stok_opname_perintah ADD COLUMN pic_checker VARCHAR(255);
  END IF;
END $$;

-- 2. Add kategori_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stok_opname_perintah' AND column_name = 'kategori_id') THEN
    ALTER TABLE stok_opname_perintah ADD COLUMN kategori_id VARCHAR(50) DEFAULT 'modul';
  END IF;
END $$;

-- 3. Add kategori_nama column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stok_opname_perintah' AND column_name = 'kategori_nama') THEN
    ALTER TABLE stok_opname_perintah ADD COLUMN kategori_nama VARCHAR(255) DEFAULT 'Modul';
  END IF;
END $$;

-- 4. Add target_sku column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stok_opname_perintah' AND column_name = 'target_sku') THEN
    ALTER TABLE stok_opname_perintah ADD COLUMN target_sku INTEGER DEFAULT 0;
  END IF;
END $$;

-- 5. Add unique constraint to stok_opname_detail if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stok_opname_detail_opname_sku_unique') THEN
    ALTER TABLE stok_opname_detail ADD CONSTRAINT stok_opname_detail_opname_sku_unique UNIQUE (opname_id, sku);
  END IF;
END $$;

-- 6. Add index on produk.kategori if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'produk' AND indexname = 'idx_produk_kategori') THEN
    CREATE INDEX idx_produk_kategori ON produk(kategori);
  END IF;
END $$;

COMMIT;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stok_opname_perintah' 
AND column_name IN ('pic_checker', 'kategori_id', 'kategori_nama', 'target_sku')
ORDER BY column_name;
