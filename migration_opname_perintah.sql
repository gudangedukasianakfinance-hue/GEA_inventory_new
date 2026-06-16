-- Perintah Stok Opname (SO) — aman untuk Neon / init-db
BEGIN;

CREATE TABLE IF NOT EXISTS stok_opname_perintah (
  id SERIAL PRIMARY KEY,
  kode_so VARCHAR(50) NOT NULL UNIQUE,
  tanggal_perintah DATE NOT NULL,
  bulan INTEGER NOT NULL,
  tahun INTEGER NOT NULL,
  svp_nama VARCHAR(150) NOT NULL,
  lokasi VARCHAR(150),
  keterangan TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'menunggu',
  checker VARCHAR(150),
  kategori_targets TEXT,
  opname_id INTEGER REFERENCES stok_opname(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  target_sku INTEGER DEFAULT 0
);

ALTER TABLE stok_opname
  ADD COLUMN IF NOT EXISTS perintah_id INTEGER REFERENCES stok_opname_perintah(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stok_opname_perintah_periode
  ON stok_opname_perintah (tahun, bulan, tanggal_perintah DESC);

CREATE INDEX IF NOT EXISTS idx_stok_opname_perintah_status
  ON stok_opname_perintah (status);

CREATE INDEX IF NOT EXISTS idx_stok_opname_perintah_kode
  ON stok_opname_perintah (kode_so);

COMMIT;
