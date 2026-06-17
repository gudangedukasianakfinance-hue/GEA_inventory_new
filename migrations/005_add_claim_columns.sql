-- Migration: Add claim columns for checker assignment
-- Safe to run repeatedly

ALTER TABLE stok_opname_perintah ADD COLUMN IF NOT EXISTS checker_user_id INTEGER;
ALTER TABLE stok_opname_perintah ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP DEFAULT NOW();

-- Add foreign key if users table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'users' AND table_schema = 'public'
  ) THEN
    ALTER TABLE stok_opname_perintah
      ADD CONSTRAINT fk_checker_user
      FOREIGN KEY (checker_user_id) 
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_stok_opname_perintah_checker_user_id ON stok_opname_perintah(checker_user_id);
CREATE INDEX IF NOT EXISTS idx_stok_opname_perintah_claimed_at ON stok_opname_perintah(claimed_at);
