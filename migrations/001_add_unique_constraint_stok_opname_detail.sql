-- Migration: Add unique constraint for ON CONFLICT
-- Fixes: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

BEGIN;

-- Add unique constraint on stok_opname_detail for (opname_id, sku)
-- This is required for the ON CONFLICT DO UPDATE clause in v3-opname-detail.js

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stok_opname_detail_opname_id_sku_key'
  ) THEN
    ALTER TABLE stok_opname_detail 
    ADD CONSTRAINT stok_opname_detail_opname_id_sku_key 
    UNIQUE (opname_id, sku);
    RAISE NOTICE 'Added unique constraint stok_opname_detail_opname_id_sku_key';
  ELSE
    RAISE NOTICE 'Constraint stok_opname_detail_opname_id_sku_key already exists';
  END IF;
END $$;

COMMIT;