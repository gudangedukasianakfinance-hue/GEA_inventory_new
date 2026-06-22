/***********************************************
 * CV EPIC Warehouse - Sync Shipments from Google Sheets
 * 
 * POST /api/sync-shipments
 * 
 * Fetches data from Google Sheets and upserts to Neon PostgreSQL
 * Uses no_resi as unique key for upsert
 * 
 * Called by:
 * - Vercel Cron (every 15 minutes)
 * - Manual trigger from dashboard
 ***********************************************/

import { query, isDatabaseConfigured } from "../services/db.js";

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxb3nDU0ul_XHAkkLWo8Gc5LbUDxNn5k3L34qOZIze2TVJxE4mZuMkq-mGdI36iZlLG/exec';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!isDatabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: "Database not configured. Set DATABASE_URL environment variable."
    });
  }

  console.log('[Sync Shipments] Starting sync...');
  const startTime = Date.now();

  let stats = {
    total: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: []
  };

  try {
    // Step 1: Fetch data from Google Sheets
    console.log('[Sync Shipments] Fetching from Google Sheets...');
    const response = await fetch(GOOGLE_SHEETS_URL);
    
    if (!response.ok) {
      throw new Error(`Google Sheets API returned ${response.status}`);
    }
    
    const rawData = await response.json();
    
    // Transform Google Sheets data to array format
    let rows = [];
    if (rawData.values && Array.isArray(rawData.values)) {
      const headers = rawData.values[0] || [];
      const dataRows = rawData.values.slice(1) || [];
      
      rows = dataRows.map(row => {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = row[index] || null;
        });
        return record;
      });
    } else if (Array.isArray(rawData)) {
      rows = rawData;
    }
    
    stats.total = rows.length;
    console.log(`[Sync Shipments] Found ${stats.total} rows from Google Sheets`);

    if (stats.total === 0) {
      return res.status(200).json({
        success: true,
        message: "No data to sync",
        stats: stats,
        duration: Date.now() - startTime
      });
    }

    // Step 2: Upsert each row to database
    console.log('[Sync Shipments] Starting upsert to database...');
    
    for (const row of rows) {
      try {
        // Map Google Sheets columns to database columns
        // Adjust column names based on your Google Sheets headers
        const noResi = row['No Resi'] || row['no_resi'] || row['No. Resi'] || null;
        
        if (!noResi) {
          stats.failed++;
          stats.errors.push({ row: row, error: 'Missing no_resi' });
          continue;
        }

        const result = await query(`
          INSERT INTO shipments (
            tanggal,
            po_number,
            outlet,
            payment_status,
            preparation_status,
            packing_status,
            delivery_status,
            ekspedisi,
            estimasi_pengiriman,
            tanggal_pengiriman,
            tanggal_sampai,
            alamat_pengiriman,
            no_resi,
            time_receiving,
            status_otr,
            keterangan,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16, NOW()
          )
          ON CONFLICT (no_resi) DO UPDATE SET
            tanggal = EXCLUDED.tanggal,
            po_number = EXCLUDED.po_number,
            outlet = EXCLUDED.outlet,
            payment_status = EXCLUDED.payment_status,
            preparation_status = EXCLUDED.preparation_status,
            packing_status = EXCLUDED.packing_status,
            delivery_status = EXCLUDED.delivery_status,
            ekspedisi = EXCLUDED.ekspedisi,
            estimasi_pengiriman = EXCLUDED.estimasi_pengiriman,
            tanggal_pengiriman = EXCLUDED.tanggal_pengiriman,
            tanggal_sampai = EXCLUDED.tanggal_sampai,
            alamat_pengiriman = EXCLUDED.alamat_pengiriman,
            time_receiving = EXCLUDED.time_receiving,
            status_otr = EXCLUDED.status_otr,
            keterangan = EXCLUDED.keterangan,
            updated_at = NOW()
        `, [
          parseDate(row['Tanggal'] || row['tanggal']),
          row['No Purchase Order'] || row['po_number'] || row['No PO'],
          row['Outlet'] || row['outlet'],
          row['Status Pembayaran'] || row['payment_status'] || 'Pending',
          row['Status Penyiapan'] || row['preparation_status'] || 'Pending',
          row['Status Packing'] || row['packing_status'] || 'Pending',
          row['Status Delivery'] || row['delivery_status'] || 'Menunggu',
          row['Ekspedisi'] || row['ekspedisi'],
          parseInt(row['Estimasi Pengiriman'] || row['estimasi_pengiriman']) || null,
          parseDate(row['Tanggal Pengiriman'] || row['tanggal_pengiriman']),
          parseDate(row['Tanggal Sampai'] || row['tanggal_sampai']),
          row['Alamat pengiriman'] || row['alamat_pengiriman'] || row['Alamat'],
          noResi,
          parseInt(row['Time Receiving'] || row['time_receiving']) || null,
          row['Status'] || row['status_otr'] || 'Unknown',
          row['Keterangan'] || row['keterangan']
        ]);

        if (result.rowCount === 1) {
          stats.inserted++;
        } else if (result.rowCount === 2) {
          stats.updated++;
        }
      } catch (err) {
        stats.failed++;
        stats.errors.push({ data: row, error: err.message });
        console.error('[Sync Shipments] Error upserting row:', err.message);
      }
    }

    console.log('[Sync Shipments] Sync complete:', stats);

    return res.status(200).json({
      success: true,
      message: `Sync complete: ${stats.inserted} inserted, ${stats.updated} updated, ${stats.failed} failed`,
      stats: stats,
      duration: Date.now() - startTime
    });

  } catch (error) {
    console.error('[Sync Shipments] Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stats: stats,
      duration: Date.now() - startTime
    });
  }
}

// Helper function to parse date
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  // Try to parse various date formats
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}
