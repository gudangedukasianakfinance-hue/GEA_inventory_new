-- Migration: Add pic_checker and kategori fields to stok_opname_perintah
-- Date: 2026-06-16

-- Add pic_checker column
ALTER TABLE stok_opname_perintah 
ADD COLUMN IF NOT EXISTS pic_checker VARCHAR(255);

-- Add kategori_id column  
ALTER TABLE stok_opname_perintah 
ADD COLUMN IF NOT EXISTS kategori_id VARCHAR(50);

-- Add kategori_nama column
ALTER TABLE stok_opname_perintah 
ADD COLUMN IF NOT EXISTS kategori_nama VARCHAR(255);

-- Add unique constraint for opname detail (for ON CONFLICT support)
ALTER TABLE stok_opname_detail 
ADD CONSTRAINT stok_opname_detail_opname_sku_unique 
UNIQUE (opname_id, sku);

-- Add index on kategori for faster filtering
CREATE INDEX IF NOT EXISTS idx_produk_kategori ON produk(kategori);

COMMENT ON COLUMN stok_opname_perintah.pic_checker IS 'Nama PIC Checker Gudang';
COMMENT ON COLUMN stok_opname_perintah.kategori_id IS 'ID Kategori untuk filter SO';
COMMENT ON COLUMN stok_opname_perintah.kategori_nama IS 'Nama Kategori untuk display';
