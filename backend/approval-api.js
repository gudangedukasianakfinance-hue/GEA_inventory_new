/* ============================================
   CV GEA Warehouse V3 - Approval API Handler
   Handles approval workflow using existing database
   Reuses stok_opname_perintah table
   ============================================ */

import pool from "../services/db.js";
import { authenticate } from "../services/auth.js";

// Helper to send JSON responses
function send(res, status, payload) {
  return res.status(status).json(payload);
}

// Parse route path from request
function getRoutePath(req) {
  if (req.query?.route) {
    return "/" + String(req.query.route).replace(/^\/+/, "");
  }
  const url = new URL(req.url, "http://localhost");
  return url.pathname.replace(/^\/api/, "") || "/";
}

// Normalize route path (remove leading slash for consistent comparison)
function normalizeRoute(routePath) {
  return routePath.replace(/^\/+/, "");
}

// Get current user from token (using auth service)
async function getCurrentUser(req) {
  const auth = authenticate(req);
  return auth.authorized ? auth.user : null;
}

// Check admin authorization (using auth service)
async function requireAdmin(req, res) {
  const auth = authenticate(req);
  if (!auth.authorized) {
    send(res, 401, { success: false, message: "Unauthorized - Silakan login" });
    return null;
  }
  if (auth.user.role !== "admin") {
    send(res, 403, { success: false, message: "Admin access required" });
    return null;
  }
  return auth.user;
}

// Map database status to UI status
function mapStatus(dbStatus) {
  const statusMap = {
    'menunggu': 'pending',
    'menunggu_approval': 'pending',
    'proses': 'in_progress',
    'selesai': 'approved',
    'ditolak': 'rejected',
    'recount': 'recount'
  };
  return statusMap[dbStatus] || dbStatus;
}

// Map database priority to UI priority
function mapPriority(priority) {
  const priorityMap = {
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'urgent': 'high'
  };
  return priorityMap[priority] || 'medium';
}

// Get approval type from status
function getApprovalType(so) {
  // Determine type based on table or context
  if (so.kode_so?.startsWith('SO-ADJ')) return 'adjustment';
  return 'opname';
}

// Transform database row to UI format
function transformApproval(so) {
  const initials = (so.svp_nama || 'U')
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return {
    id: so.id,
    type: getApprovalType(so),
    title: so.keterangan || `Stock Opname - ${so.kode_so}`,
    description: `Lokasi: ${so.lokasi || 'N/A'}`,
    submitter: {
      id: so.checker || 'system',
      name: so.svp_nama || 'System',
      initials: initials
    },
    submittedAt: so.completed_at || so.created_at,
    priority: mapPriority(so.priority || 'medium'),
    status: mapStatus(so.status),
    discrepancy: {
      sistem: so.total_selisih || 0,
      fisik: 0,
      selisih: so.total_selisih || 0
    },
    rawData: {
      kode_so: so.kode_so,
      status: so.status,
      opname_id: so.opname_id,
      lokasi: so.lokasi
    },
    history: [
      { action: 'submitted', user: so.svp_nama || 'System', time: formatTimeAgo(so.created_at) }
    ]
  };
}

// Format time ago string
function formatTimeAgo(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

// List all approvals
async function listApprovals(req, res) {
  const statusFilter = req.query?.status;
  const typeFilter = req.query?.type;
  const search = req.query?.search;

  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Filter by status
    if (statusFilter) {
      if (statusFilter === 'pending') {
        whereConditions.push(`status IN ('menunggu', 'menunggu_approval')`);
      } else if (statusFilter === 'approved') {
        whereConditions.push(`status = 'selesai'`);
      } else if (statusFilter === 'rejected') {
        whereConditions.push(`status = 'ditolak'`);
      } else if (statusFilter === 'recount') {
        whereConditions.push(`status = 'recount'`);
      }
    }

    // Search filter
    if (search) {
      whereConditions.push(`(kode_so ILIKE $${paramIndex} OR svp_nama ILIKE $${paramIndex} OR lokasi ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Get approvals from stok_opname_perintah
    const result = await pool.query(`
      SELECT id, kode_so, tanggal_perintah, bulan, tahun, svp_nama, lokasi,
             keterangan, status, checker, kategori_targets, opname_id,
             created_at, updated_at, started_at, completed_at
      FROM stok_opname_perintah
      ${whereClause}
      ORDER BY 
        CASE WHEN status = 'menunggu_approval' THEN 0 
             WHEN status = 'menunggu' THEN 1 
             WHEN status = 'proses' THEN 2 
             ELSE 3 END,
        created_at DESC
    `, params);

    // Transform to UI format
    const approvals = result.rows.map(transformApproval);

    // Count by status
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('menunggu', 'menunggu_approval')) as pending,
        COUNT(*) FILTER (WHERE status = 'selesai') as approved,
        COUNT(*) FILTER (WHERE status = 'ditolak') as rejected,
        COUNT(*) FILTER (WHERE status = 'recount') as recount,
        COUNT(*) FILTER (WHERE status = 'menunggu_approval' AND lokasi ILIKE '%urgent%') as urgent,
        COUNT(*) as total
      FROM stok_opname_perintah
    `);

    const counts = countResult.rows[0];

    return send(res, 200, {
      success: true,
      data: approvals,
      stats: {
        total: parseInt(counts.total || 0, 10),
        pending: parseInt(counts.pending || 0, 10),
        approved: parseInt(counts.approved || 0, 10),
        rejected: parseInt(counts.rejected || 0, 10),
        recount: parseInt(counts.recount || 0, 10),
        urgent: parseInt(counts.urgent || 0, 10)
      }
    });
  } catch (error) {
    console.error("Error listing approvals:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data approvals" });
  }
}

// Get single approval
async function getApproval(req, res, approvalId) {
  try {
    const result = await pool.query(`
      SELECT id, kode_so, tanggal_perintah, bulan, tahun, svp_nama, lokasi,
             keterangan, status, checker, kategori_targets, opname_id,
             created_at, updated_at, started_at, completed_at
      FROM stok_opname_perintah
      WHERE id = $1
    `, [approvalId]);

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "Approval tidak ditemukan" });
    }

    const approval = transformApproval(result.rows[0]);

    // Get opname details if available
    let opnameDetails = null;
    if (result.rows[0].opname_id) {
      const opnameResult = await pool.query(`
        SELECT id, total_item, total_selisih, total_item_selisih, total_selisih_net,
               checker, lokasi, disesuaikan_at
        FROM stok_opname
        WHERE id = $1
      `, [result.rows[0].opname_id]);

      if (opnameResult.rows.length > 0) {
        opnameDetails = opnameResult.rows[0];
      }
    }

    return send(res, 200, {
      success: true,
      data: {
        ...approval,
        opnameDetails
      }
    });
  } catch (error) {
    console.error("Error getting approval:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data approval" });
  }
}

// Approve approval
async function approveApproval(req, res, approvalId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    // Check if approval exists and is in correct status
    const checkResult = await pool.query(`
      SELECT id, status, opname_id FROM stok_opname_perintah WHERE id = $1
    `, [approvalId]);

    if (checkResult.rows.length === 0) {
      return send(res, 404, { success: false, message: "Approval tidak ditemukan" });
    }

    const so = checkResult.rows[0];
    if (!['menunggu_approval', 'menunggu'].includes(so.status)) {
      return send(res, 400, { success: false, message: "Status tidak memungkinkan approval" });
    }

    // Update status to approved
    await pool.query(`
      UPDATE stok_opname_perintah 
      SET status = 'selesai', updated_at = NOW()
      WHERE id = $1
    `, [approvalId]);

    // Finalize stok_opname if exists
    if (so.opname_id) {
      await pool.query(`
        UPDATE stok_opname 
        SET disesuaikan_at = NOW()
        WHERE id = $1
      `, [so.opname_id]);
    }

    return send(res, 200, {
      success: true,
      message: "Approval berhasil disetujui"
    });
  } catch (error) {
    console.error("Error approving approval:", error);
    return send(res, 500, { success: false, message: "Gagal menyetujui approval" });
  }
}

// Reject approval
async function rejectApproval(req, res, approvalId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { reason } = req.body || {};

  try {
    // Check if approval exists
    const checkResult = await pool.query(`
      SELECT id, status FROM stok_opname_perintah WHERE id = $1
    `, [approvalId]);

    if (checkResult.rows.length === 0) {
      return send(res, 404, { success: false, message: "Approval tidak ditemukan" });
    }

    // Update status to rejected
    await pool.query(`
      UPDATE stok_opname_perintah 
      SET status = 'ditolak', updated_at = NOW()
      WHERE id = $1
    `, [approvalId]);

    return send(res, 200, {
      success: true,
      message: "Approval berhasil ditolak"
    });
  } catch (error) {
    console.error("Error rejecting approval:", error);
    return send(res, 500, { success: false, message: "Gagal menolak approval" });
  }
}

// Request recount
async function requestRecount(req, res, approvalId) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    // Check if approval exists
    const checkResult = await pool.query(`
      SELECT id, status FROM stok_opname_perintah WHERE id = $1
    `, [approvalId]);

    if (checkResult.rows.length === 0) {
      return send(res, 404, { success: false, message: "Approval tidak ditemukan" });
    }

    // Update status to recount
    await pool.query(`
      UPDATE stok_opname_perintah 
      SET status = 'recount', updated_at = NOW()
      WHERE id = $1
    `, [approvalId]);

    return send(res, 200, {
      success: true,
      message: "Recount berhasil diminta"
    });
  } catch (error) {
    console.error("Error requesting recount:", error);
    return send(res, 500, { success: false, message: "Gagal meminta recount" });
  }
}

// Get approval stats
async function getApprovalStats(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('menunggu', 'menunggu_approval')) as pending,
        COUNT(*) FILTER (WHERE status = 'selesai') as approved,
        COUNT(*) FILTER (WHERE status = 'ditolak') as rejected,
        COUNT(*) FILTER (WHERE status = 'recount') as recount,
        COUNT(*) FILTER (WHERE status = 'menunggu_approval') as menunggu_approval,
        COUNT(*) FILTER (WHERE status = 'menunggu') as menunggu,
        COUNT(*) as total
      FROM stok_opname_perintah
    `);

    const stats = result.rows[0];

    return send(res, 200, {
      success: true,
      data: {
        total: parseInt(stats.total || 0, 10),
        pending: parseInt(stats.pending || 0, 10),
        approved: parseInt(stats.approved || 0, 10),
        rejected: parseInt(stats.rejected || 0, 10),
        recount: parseInt(stats.recount || 0, 10),
        menunggu_approval: parseInt(stats.menunggu_approval || 0, 10),
        menunggu: parseInt(stats.menunggu || 0, 10)
      }
    });
  } catch (error) {
    console.error("Error getting approval stats:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil statistik" });
  }
}

// Main route handler
export default async function approvalApiHandler(req, res) {
  const routePath = getRoutePath(req);
  const normalizedPath = normalizeRoute(routePath);
  const method = req.method;

  // Extract ID from path
  const idMatch = normalizedPath.match(/^v1\/approvals\/(\d+)/);
  const approvalId = idMatch ? parseInt(idMatch[1], 10) : null;

  // Route: GET /v1/approvals/stats
  if (method === "GET" && normalizedPath === "v1/approvals/stats") {
    return getApprovalStats(req, res);
  }

  // Route: GET /v1/approvals (list)
  if (method === "GET" && normalizedPath === "v1/approvals") {
    return listApprovals(req, res);
  }

  // Route: GET /v1/approvals/:id
  if (method === "GET" && approvalId) {
    return getApproval(req, res, approvalId);
  }

  // Route: POST /v1/approvals/:id/approve
  if (method === "POST" && normalizedPath === `v1/approvals/${approvalId}/approve`) {
    return approveApproval(req, res, approvalId);
  }

  // Route: POST /v1/approvals/:id/reject
  if (method === "POST" && normalizedPath === `v1/approvals/${approvalId}/reject`) {
    return rejectApproval(req, res, approvalId);
  }

  // Route: POST /v1/approvals/:id/recount
  if (method === "POST" && normalizedPath === `v1/approvals/${approvalId}/recount`) {
    return requestRecount(req, res, approvalId);
  }

  return send(res, 404, { success: false, message: `Route tidak ditemukan: ${method} ${routePath}` });
}