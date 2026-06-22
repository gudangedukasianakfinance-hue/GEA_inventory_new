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
    
    // Format 1: Direct array (as shown in your example)
    if (Array.isArray(rawData)) {
      rows = rawData;
    }
    // Format 2: { values: [[headers], [data], ...] }
    else if (rawData.values && Array.isArray(rawData.values)) {
      const headers = rawData.values[0].map(h => h.trim()) || [];
      const dataRows = rawData.values.slice(1) || [];
      
      rows = dataRows.map(row => {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = (row[index] || '').toString().trim() || null;
        });
        return record;
      });
    }
    
    stats.total = rows.length;
    console.log(`[Sync Shipments] Found ${stats.total} rows from Google Sheets`);
    console.log('[Sync Shipments] Sample row keys:', Object.keys(rows[0] || {}));

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
        // Helper to get value with flexible column name matching
        const getValue = (obj, ...keys) => {
          for (const key of keys) {
            // Try exact match first
            if (obj[key] !== undefined) return obj[key];
            // Try case-insensitive match
            const lowerKey = key.toLowerCase();
            for (const k of Object.keys(obj)) {
              if (k.toLowerCase() === lowerKey || k.toLowerCase().trim() === lowerKey) {
                return obj[k];
              }
            }
          }
          return null;
        };

        // Get values with flexible column matching
        const noResi = getValue(row, 'No Resi', 'no_resi', 'no resi') || null;
        const tanggal = getValue(row, 'Tanggal', 'tanggal');
        const poNumber = getValue(row, 'No Purchase Order', 'po_number', 'No PO');
        const outlet = getValue(row, 'Outlet', 'outlet');
        const paymentStatus = getValue(row, 'Status Pembayaran', 'payment_status');
        const preparationStatus = getValue(row, 'Status Penyiapan', 'preparation_status');
        const packingStatus = getValue(row, 'Status Packing', 'packing_status');
        const deliveryStatus = getValue(row, 'Status Delivery', 'delivery_status');
        const ekspedisi = getValue(row, 'Ekspedisi', 'ekspedisi');
        const estimasi = getValue(row, 'Estimasi Pengiriman', 'estimasi_pengiriman');
        const tanggalKirim = getValue(row, 'Tanggal Pengiriman', 'tanggal_pengiriman', 'Tanggal Pengiriman ');
        const tanggalSampai = getValue(row, 'Tanggal Sampai', 'tanggal_sampai');
        const alamat = getValue(row, 'Alamat pengiriman', 'alamat_pengiriman', 'Alamat');
        const timeReceiving = getValue(row, 'Time Receiving', 'time_receiving');
        const statusOTR = getValue(row, 'Status', 'status_otr');
        const keterangan = getValue(row, 'Keterangan', 'keterangan');
        
        if (!noResi) {
          stats.failed++;
          stats.errors.push({ data: row, error: 'Missing No Resi' });
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
          parseDate(tanggal),
          poNumber,
          outlet,
          paymentStatus,
          preparationStatus,
          packingStatus,
          deliveryStatus,
          ekspedisi,
          parseInt(estimasi) || null,
          parseDate(tanggalKirim),
          parseDate(tanggalSampai),
          alamat,
          noResi.toString(),
          parseInt(timeReceiving) || null,
          statusOTR,
          keterangan
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
