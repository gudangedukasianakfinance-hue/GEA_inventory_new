/* ============================================
   CV EPIC Warehouse V3 - Settings API Handler
   Handles profile, settings, and system configuration
   Reuses existing users table and auth system
   ============================================ */

import crypto from "crypto";
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

// Check authentication (using auth service)
async function requireAuth(req, res) {
  const auth = authenticate(req);
  if (!auth.authorized) {
    send(res, 401, { success: false, message: "Unauthorized - Silakan login" });
    return null;
  }
  return auth.user;
}

// Get current user's profile
async function getProfile(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const result = await pool.query(`
      SELECT id, username, email, nama_lengkap, role, outlet_id, is_active, 
             created_at, last_login, failed_login_count
      FROM users
      WHERE id = $1
    `, [user.sub]);

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "User not found" });
    }

    const profile = result.rows[0];
    return send(res, 200, {
      success: true,
      data: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        nama_lengkap: profile.nama_lengkap,
        role: profile.role,
        outlet_id: profile.outlet_id,
        is_active: profile.is_active,
        created_at: profile.created_at,
        last_login: profile.last_login,
        failed_login_count: profile.failed_login_count
      }
    });
  } catch (error) {
    console.error("Error getting profile:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data profil" });
  }
}

// Update current user's profile
async function updateProfile(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { nama_lengkap, email } = req.body || {};

  if (!nama_lengkap && !email) {
    return send(res, 400, { success: false, message: "Tidak ada data yang diperbarui" });
  }

  try {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (nama_lengkap) {
      updates.push(`nama_lengkap = $${paramIndex++}`);
      params.push(nama_lengkap);
    }

    if (email) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }

    params.push(user.sub);

    const result = await pool.query(`
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, nama_lengkap, role
    `, params);

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "User not found" });
    }

    return send(res, 200, {
      success: true,
      message: "Profil berhasil diperbarui",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return send(res, 500, { success: false, message: "Gagal memperbarui profil" });
  }
}

// Change password
async function changePassword(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { old_password, new_password } = req.body || {};

  if (!old_password || !new_password) {
    return send(res, 400, { success: false, message: "Password lama dan baru wajib diisi" });
  }

  if (new_password.length < 8) {
    return send(res, 400, { success: false, message: "Password minimal 8 karakter" });
  }

  try {
    // Get current password hash
    const userResult = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [user.sub]
    );

    if (userResult.rows.length === 0) {
      return send(res, 404, { success: false, message: "User not found" });
    }

    const storedHash = userResult.rows[0].password_hash;

    // Verify old password
    let isValid = false;
    if (storedHash.startsWith("pbkdf2:sha256")) {
      // PBKDF2 verification
      const parts = storedHash.split("$");
      if (parts.length === 3) {
        const methodParts = parts[0].split(":");
        const iterations = Number(methodParts[2] || 260000);
        const salt = parts[1];
        const expected = parts[2];
        const derived = crypto.pbkdf2Sync(old_password, salt, iterations, 32, "sha256").toString("hex");
        isValid = derived === expected;
      }
    } else if (/^[a-f0-9]{64}$/i.test(storedHash)) {
      // SHA256 verification
      const hash = crypto.createHash("sha256").update(old_password).digest("hex");
      isValid = hash === storedHash;
    }

    if (!isValid) {
      return send(res, 400, { success: false, message: "Password lama tidak sesuai" });
    }

    // Hash new password (using SHA256 for consistency)
    const newHash = crypto.createHash("sha256").update(new_password).digest("hex");

    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [newHash, user.sub]
    );

    return send(res, 200, {
      success: true,
      message: "Password berhasil diubah"
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return send(res, 500, { success: false, message: "Gagal mengubah password" });
  }
}

// Get system settings (placeholder)
async function getSystemSettings(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  // Return placeholder system settings
  return send(res, 200, {
    success: true,
    data: {
      company_name: "CV EPIC Warehouse",
      version: "3.0.0",
      database_status: "connected",
      last_backup: null,
      environment: process.env.NODE_ENV || "production",
      features: {
        user_management: true,
        opname_approval: true,
        forecast: true,
        multi_outlet: true
      }
    }
  });
}

// Get database status
async function getDatabaseStatus(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    // Get table counts
    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM outlet) as outlets_count,
        (SELECT COUNT(*) FROM produk) as produk_count,
        (SELECT COUNT(*) FROM penjualan) as penjualan_count,
        (SELECT COUNT(*) FROM stok_opname_perintah) as opname_count
    `);

    return send(res, 200, {
      success: true,
      data: {
        status: "connected",
        host: "Neon PostgreSQL",
        table_counts: counts.rows[0],
        connection_time: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error getting database status:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil status database" });
  }
}

// Get audit logs
async function getAuditLogs(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const limit = parseInt(req.query?.limit) || 50;
  const offset = parseInt(req.query?.offset) || 0;

  try {
    const result = await pool.query(`
      SELECT id, action, module, user_id, details, ip_address, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return send(res, 200, {
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error getting audit logs:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil audit log" });
  }
}

// Main route handler
export default async function settingsApiHandler(req, res) {
  const routePath = getRoutePath(req);
  const normalizedPath = normalizeRoute(routePath);
  const method = req.method;

  // Route: GET /v1/auth/me (get current user profile)
  if (method === "GET" && normalizedPath === "v1/auth/me") {
    return getProfile(req, res);
  }

  // Route: PUT /v1/users/profile (update current user profile)
  if (method === "PUT" && normalizedPath === "v1/users/profile") {
    return updateProfile(req, res);
  }

  // Route: POST /v1/auth/change-password
  if (method === "POST" && normalizedPath === "v1/auth/change-password") {
    return changePassword(req, res);
  }

  // Route: GET /v1/settings/system (system settings)
  if (method === "GET" && normalizedPath === "v1/settings/system") {
    return getSystemSettings(req, res);
  }

  // Route: GET /v1/settings/database (database status)
  if (method === "GET" && normalizedPath === "v1/settings/database") {
    return getDatabaseStatus(req, res);
  }

  // Route: GET /v1/audit/logs (audit logs)
  if (method === "GET" && normalizedPath === "v1/audit/logs") {
    return getAuditLogs(req, res);
  }

  return send(res, 404, { success: false, message: `Route tidak ditemukan: ${method} ${routePath}` });
}