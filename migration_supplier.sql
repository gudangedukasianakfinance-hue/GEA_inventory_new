-- ============================================
-- Migration: Supplier Master Table & Pembelian Enhancement
-- Date: 2026-06-14
-- Purpose: Add supplier master table and enhance pembelian with supplier reference
-- ============================================
-- JANGAN JALANKAN OTOMATIS - EKSEKUSI MANUAL OLEH ADMIN DATABASE
-- ============================================

-- Create Supplier Master Table
CREATE TABLE IF NOT EXISTS supplier (
    id SERIAL PRIMARY KEY,
    kode_supplier VARCHAR(20) UNIQUE,
    nama_supplier VARCHAR(255) NOT NULL,
    alamat TEXT,
    telepon VARCHAR(50),
    pic VARCHAR(100),
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add supplier_id to existing pembelian table (preserve data)
ALTER TABLE pembelian
ADD COLUMN IF NOT EXISTS supplier_id INTEGER;

-- Create index for faster queries on supplier_id
CREATE INDEX IF NOT EXISTS idx_pembelian_supplier ON pembelian (supplier_id);

-- Create index for supplier lookup
CREATE INDEX IF NOT EXISTS idx_supplier_kode ON supplier (kode_supplier);
CREATE INDEX IF NOT EXISTS idx_supplier_nama ON supplier (nama_supplier);

-- ============================================
-- Sample data for testing (optional - comment out if not needed)
-- ============================================
-- INSERT INTO supplier (kode_supplier, nama_supplier, alamat, telepon, pic) VALUES
-- ('SUP001', 'PT Maju Bersama', 'Jl. Industri Raya No. 10, Jakarta', '021-5551234', 'Budi Santoso'),
-- ('SUP002', 'CV Sukses Abadi', 'Jl. Dagang Utama No. 25, Bandung', '022-6662345', 'Ani Wijaya'),
-- ('SUP003', 'Toko Sumber Rejeki', 'Jl. Pasar Baru No. 8, Surabaya', '031-7773456', 'Dewi Kusuma')
-- ON CONFLICT (kode_supplier) DO NOTHING;