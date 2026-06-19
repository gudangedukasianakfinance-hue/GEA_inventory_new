-- Migration: Fix target_sku for lain_lain category
-- Date: 2026-06-19
-- Fix: Set correct target_sku for existing perintah with kategori "lain_lain"

UPDATE stok_opname_perintah
SET target_sku = 28,
    kategori_nama = 'Lain-Lain'
WHERE kategori_id = 'lain_lain'
  AND target_sku = 0;
