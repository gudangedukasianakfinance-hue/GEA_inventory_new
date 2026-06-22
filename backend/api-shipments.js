/***********************************************
 * CV EPIC Warehouse - Shipments API
 * 
 * GET /api/shipments - Get shipments from database
 * 
 * Requires DATABASE_URL in environment variables
 ***********************************************/

import { query, isDatabaseConfigured } from "../services/db.js";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check if database is configured
  if (!isDatabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: "Database not configured. Set DATABASE_URL environment variable."
    });
  }

  try {
    // Get shipments data
    const shipmentsResult = await query(`
      SELECT 
        id,
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
      FROM shipments 
      ORDER BY tanggal DESC
    `);

    // Get KPIs
    const totalPOResult = await query(`SELECT COUNT(*) as count FROM shipments`);
    const totalOutletResult = await query(`SELECT COUNT(DISTINCT outlet) as count FROM shipments`);
    const otrResult = await query(`
      SELECT ROUND(
        100.0 * SUM(CASE WHEN status_otr = 'On Time' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2
      ) as percentage FROM shipments
    `);
    const avgTimeResult = await query(`
      SELECT ROUND(AVG(NULLIF(time_receiving, 0)), 2) as avg_time FROM shipments
    `);

    // Get shipments by status
    const statusResult = await query(`
      SELECT delivery_status, COUNT(*) as count 
      FROM shipments 
      GROUP BY delivery_status
    `);

    const kpi = {
      total_po: parseInt(totalPOResult.rows[0]?.count || 0),
      total_outlet: parseInt(totalOutletResult.rows[0]?.count || 0),
      otr_percentage: parseFloat(otrResult.rows[0]?.percentage || 0),
      avg_receiving_time: parseFloat(avgTimeResult.rows[0]?.avg_time || 0),
      status_counts: {}
    };

    // Add status counts to KPI
    statusResult.rows.forEach(row => {
      kpi.status_counts[row.delivery_status] = parseInt(row.count);
    });

    return res.status(200).json({
      success: true,
      data: shipmentsResult.rows,
      kpi: kpi
    });

  } catch (error) {
    console.error("Shipments API Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
