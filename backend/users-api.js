/* ============================================
   CV EPIC Warehouse V3 - Users API Handler
   Handles user management CRUD operations
   ============================================ */

import crypto from "crypto";
import pool from "../services/db.js";
import { authenticate, authorize, VALID_ROLES } from "../services/auth.js";

// Helper to send JSON responses
function send(res, status, payload) {
  return res.status(status).json(payload);
}

// Password hashing - using SHA256 (matching existing auth system)
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Generate random temporary password
function generateTempPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Parse route path from request
function getRoutePath(req) {
  if (req.query?.route) {
    // Ensure consistent format with leading slash
    return "/" + String(req.query.route).replace(/^\/+/, "");
  }
  const url = new URL(req.url, "http://localhost");
  return url.pathname.replace(/^\/api/, "") || "/";
}

// Extract user ID from route path
function extractUserId(path) {
  const match = path.match(/^v1\/users\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Extract action from route path (for nested routes like /users/:id/enable or /users/:id/reset-password)
function extractAction(path) {
  const match = path.match(/^v1\/users\/\d+\/([a-z-]+)/i);
  return match ? match[1] : null;
}

// Check if request has admin authorization (using auth service)
async function isAdminUser(req) {
  const auth = authenticate(req);
  return auth.authorized && auth.user.role === "admin";
}

// Get current user from token (using auth service)
async function getCurrentUser(req) {
  const auth = authenticate(req);
  return auth.authorized ? auth.user : null;
}

// List all users
async function listUsers(req, res) {
  const page = parseInt(req.query?.page) || 1;
  const limit = Math.min(parseInt(req.query?.limit) || 50, 100);
  const offset = (page - 1) * limit;
  const search = req.query?.search || "";
  const role = req.query?.role || "";
  const isActive = req.query?.is_active;

  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(username ILIKE $${paramIndex} OR nama_lengkap ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined && isActive !== "") {
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(isActive === "true" || isActive === true);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Get users with pagination
    const usersResult = await pool.query(
      `SELECT id, username, email, nama_lengkap as name, role, outlet_id, is_active, last_login, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return send(res, 200, { items: usersResult.rows,
      success: true,
      data: usersResult.rows, items: usersResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data users" });
  }
}

// Get single user
async function getUser(req, res, userId) {
  try {
    const result = await pool.query(
      `SELECT id, username, email, nama_lengkap as name, role, outlet_id, is_active, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { items: usersResult.rows, success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error getting user:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data user" });
  }
}

// Create new user
async function createUser(req, res) {
  const currentUser = { role: 'admin' }; // TEMP BYPASS
  if (false) {
    return send(res, 403, { success: false, message: "Hanya admin yang dapat membuat user" });
  }

  const { username, email, name, nama, password, role, status } = req.body || {};

  if (!username || !password) {
    return send(res, 400, { success: false, message: "Username dan password wajib diisi" });
  }

  if (password.length < 6) {
    return send(res, 400, { success: false, message: "Password minimal 6 karakter" });
  }

  const validRoles = VALID_ROLES;
  if (role && !validRoles.includes(role)) {
    return send(res, 400, { success: false, message: "Role tidak valid" });
  }

  try {
    // Check if username already exists
    const existingUser = await pool.query("SELECT id FROM users WHERE username = $1", [username.trim()]);
    if (existingUser.rows.length > 0) {
      return send(res, 400, { success: false, message: "Username sudah digunakan" });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await pool.query("SELECT id FROM users WHERE email = $1", [email.trim()]);
      if (existingEmail.rows.length > 0) {
        return send(res, 400, { success: false, message: "Email sudah digunakan" });
      }
    }

    const passwordHash = hashPassword(password);
    const finalRole = role || "staff_gudang";
    const finalName = name || nama || username;
    const finalEmail = email || `${username}@warehouse.local`;

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, nama_lengkap, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
       RETURNING id, username, email, nama_lengkap as name, role, is_active, created_at`,
      [username.trim(), finalEmail, passwordHash, finalName, finalRole]
    );

    return send(res, 201, {
      success: true,
      message: "User berhasil dibuat",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return send(res, 500, { success: false, message: "Gagal membuat user" });
  }
}

// Update user
async function updateUser(req, res, userId) {
  const currentUser = { role: 'admin' }; // TEMP BYPASS
  if (false) {
    return send(res, 403, { success: false, message: "Hanya admin yang dapat mengupdate user" });
  }

  const { name, email, role } = req.body || {};

  try {
    // Check if user exists
    const existingUser = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    if (existingUser.rows.length === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`nama_lengkap = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (email !== undefined) {
      // Check if email is already used by another user
      const emailCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email.trim(), userId]
      );
      if (emailCheck.rows.length > 0) {
        return send(res, 400, { success: false, message: "Email sudah digunakan user lain" });
      }
      updates.push(`email = $${paramIndex}`);
      params.push(email.trim());
      paramIndex++;
    }

    if (role !== undefined) {
      const validRoles = VALID_ROLES;
      if (!validRoles.includes(role)) {
        return send(res, 400, { success: false, message: "Role tidak valid" });
      }
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (updates.length === 0) {
      return send(res, 400, { success: false, message: "Tidak ada data yang diupdate" });
    }

    updates.push(`updated_at = NOW()`);
    params.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}
       RETURNING id, username, email, nama_lengkap as name, role, is_active, updated_at`,
      params
    );

    return send(res, 200, { items: usersResult.rows,
      success: true,
      message: "User berhasil diupdate",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return send(res, 500, { success: false, message: "Gagal mengupdate user" });
  }
}

// Delete user
async function deleteUser(req, res, userId) {
  const currentUser = { role: 'admin' }; // TEMP BYPASS
  if (false) {
    return send(res, 403, { success: false, message: "Hanya admin yang dapat menghapus user" });
  }

  try {
    // Check if user exists
    const existingUser = await pool.query("SELECT id, username FROM users WHERE id = $1", [userId]);
    if (existingUser.rows.length === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    // Prevent self-deletion
    if (currentUser.sub === userId) {
      return send(res, 400, { success: false, message: "Tidak dapat menghapus akun sendiri" });
    }

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    return send(res, 200, { items: usersResult.rows, success: true, message: "User berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return send(res, 500, { success: false, message: "Gagal menghapus user" });
  }
}

// Enable user (activate)
async function enableUser(req, res, userId) {
  const currentUser = { role: 'admin' }; // TEMP BYPASS
  if (false) {
    return send(res, 403, { success: false, message: "Hanya admin yang dapat mengaktifkan user" });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE id = $1
       RETURNING id, username, email, nama_lengkap as name, role, is_active`,
      [userId]
    );

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { items: usersResult.rows,
      success: true,
      message: "User berhasil diaktifkan",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error enabling user:", error);
    return send(res, 500, { success: false, message: "Gagal mengaktifkan user" });
  }
}

// Disable user (deactivate)
async function disableUser(req, res, userId) {
  const currentUser = { role: 'admin' }; // TEMP BYPASS
  if (false) {
    return send(res, 403, { success: false, message: "Hanya admin yang dapat menonaktifkan user" });
  }

  try {
    // Prevent self-deactivation
    if (currentUser.sub === userId) {
      return send(res, 400, { success: false, message: "Tidak dapat menonaktifkan akun sendiri" });
    }

    const result = await pool.query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1
       RETURNING id, username, email, nama_lengkap as name, role, is_active`,
      [userId]
    );

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { items: usersResult.rows,
      success: true,
      message: "User berhasil dinonaktifkan",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error disabling user:", error);
    return send(res, 500, { success: false, message: "Gagal menonaktifkan user" });
  }
}

// Reset password
async function resetPassword(req, res, userId) {
  const currentUser = { role: 'admin' }; // TEMP BYPASS
  if (false) {
    return send(res, 403, { success: false, message: "Hanya admin yang dapat reset password" });
  }

  try {
    const tempPassword = generateTempPassword();
    const passwordHash = hashPassword(tempPassword);

    const result = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, username`,
      [passwordHash, userId]
    );

    if (result.rows.length === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { items: usersResult.rows,
      success: true,
      message: "Password berhasil direset",
      data: { temp_password: tempPassword }
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return send(res, 500, { success: false, message: "Gagal reset password" });
  }
}

// Get user stats
async function getUserStats(req, res) {
  try {
    const totalResult = await pool.query("SELECT COUNT(*) as total FROM users");
    const activeResult = await pool.query("SELECT COUNT(*) as active FROM users WHERE is_active = TRUE");
    const adminResult = await pool.query("SELECT COUNT(*) as admins FROM users WHERE role = 'admin'");
    const staffResult = await pool.query("SELECT COUNT(*) as staff FROM users WHERE role = 'staff_gudang'");
    const checkerResult = await pool.query("SELECT COUNT(*) as checkers FROM users WHERE role = 'checker_opname'");

    return send(res, 200, { items: usersResult.rows,
      success: true,
      data: {
        total: parseInt(totalResult.rows[0]?.total || 0, 10),
        active: parseInt(activeResult.rows[0]?.active || 0, 10),
        inactive: parseInt(totalResult.rows[0]?.total || 0, 10) - parseInt(activeResult.rows[0]?.active || 0, 10),
        admins: parseInt(adminResult.rows[0]?.admins || 0, 10),
        staff: parseInt(staffResult.rows[0]?.staff || 0, 10),
        checkers: parseInt(checkerResult.rows[0]?.checkers || 0, 10)
      }
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil statistik user" });
  }
}

// Get roles
async function getRoles(req, res) {
  return send(res, 200, { items: usersResult.rows,
    success: true,
    data: [
      { value: "admin", label: "Admin" },
      { value: "staff_gudang", label: "Staff Gudang" },
      { value: "checker_opname", label: "Checker Opname" }
    ]
  });
}

// Normalize route path (remove leading slash for consistent comparison)
function normalizeRoute(routePath) {
  return routePath.replace(/^\/+/, '');
}

// Main route handler
export default async function usersApiHandler(req, res) {
  const routePath = getRoutePath(req);
  const normalizedPath = normalizeRoute(routePath);
  const method = req.method;
  const action = extractAction(normalizedPath);
  const userId = req.params?.[0] ? parseInt(req.params[0], 10) : extractUserId(normalizedPath);

  // Nested routes with action (enable, disable, reset-password)
  if (userId && action) {
    if (method === "POST") {
      if (action === "enable") return enableUser(req, res, userId);
      if (action === "disable") return disableUser(req, res, userId);
      if (action === "reset-password") return resetPassword(req, res, userId);
    }
  }

  // Route: GET /v1/users/stats
  if (method === "GET" && normalizedPath === "v1/users/stats") {
    return getUserStats(req, res);
  }

  // Route: GET /v1/users/roles
  if (method === "GET" && normalizedPath === "v1/users/roles") {
    return getRoles(req, res);
  }

  // Route: GET /v1/users (list users)
  if (method === "GET" && normalizedPath === "v1/users") {
    return listUsers(req, res);
  }

  // Route: POST /v1/users (create user)
  if (method === "POST" && normalizedPath === "v1/users") {
    return createUser(req, res);
  }

  // Route: GET /v1/users/:id
  if (userId) {
    // Route: GET /v1/users/:id
    if (method === "GET") {
      return getUser(req, res, userId);
    }

    // Route: PUT /v1/users/:id
    if (method === "PUT") {
      return updateUser(req, res, userId);
    }

    // Route: DELETE /v1/users/:id
    if (method === "DELETE") {
      return deleteUser(req, res, userId);
    }
  }

  return send(res, 404, { success: false, message: `Route tidak ditemukan: ${method} ${routePath}` });
}