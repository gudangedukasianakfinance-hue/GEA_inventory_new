/* ============================================
   CV GEA Warehouse V3 - Users API Handler
   Handles user management CRUD operations
   ============================================ */

import crypto from "crypto";
import pool from "../services/db.js";
import { VALID_ROLES } from "../services/auth.js";

function send(res, status, payload) {
  return res.status(status).json(payload);
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateTempPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getRoutePath(req) {
  if (req.query?.route) {
    return "/" + String(req.query.route).replace(/^\/+ /, "");
  }
  const url = new URL(req.url, "http://localhost");
  return url.pathname.replace(/^\/api/, "") || "/";
}

function extractUserId(path) {
  const match = path.match(/^v1\/users\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function extractAction(path) {
  const match = path.match(/^v1\/users\/\d+\/([a-z-]+)/i);
  return match ? match[1] : null;
}

function normalizeRoute(routePath) {
  return routePath.replace(/^\/+/, '');
}

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

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    const usersResult = await pool.query(
      `SELECT id, username, email, nama_lengkap, role, outlet_id, is_active, last_login, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Map untuk frontend - nama_lengkap jadi nama, is_active jadi status
    const users = usersResult.rows.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      nama: u.nama_lengkap,
      name: u.nama_lengkap,
      role: u.role,
      outlet_id: u.outlet_id,
      status: u.is_active ? 'active' : 'inactive',
      is_active: u.is_active,
      last_login: u.last_login,
      created_at: u.created_at,
      updated_at: u.updated_at
    }));

    return send(res, 200, {
      success: true,
      data: users,
      items: users,
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

    return send(res, 200, { success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error getting user:", error);
    return send(res, 500, { success: false, message: "Gagal mengambil data user" });
  }
}

async function createUser(req, res) {
  console.log('[CREATE USER REQUEST]', JSON.stringify(req.body, null, 2));
  const { username, email, name, password, role, status } = req.body || {};
  const nama = req.body.nama || name;

  if (!username || !password) {
    return send(res, 400, { success: false, message: "Username dan password wajib diisi" });
  }

  if (password.length < 6) {
    return send(res, 400, { success: false, message: "Password minimal 6 karakter" });
  }

  if (role && !VALID_ROLES.includes(role)) {
    return send(res, 400, { success: false, message: "Role tidak valid" });
  }

  try {
    const existingUser = await pool.query("SELECT id FROM users WHERE username = $1", [username.trim()]);
    if (existingUser.rows.length > 0) {
      return send(res, 400, { success: false, message: "Username sudah digunakan" });
    }

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
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, username, email, nama_lengkap as name, role, is_active, created_at`,
      [username.trim(), finalEmail, passwordHash, finalName, finalRole, status !== 'inactive']
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

async function updateUser(req, res, userId) {
  const { username, email, nama, role, status, password } = req.body || {};
  const name = req.body.name || nama;

  try {
    // Cek user exists
    const existingUser = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    if (existingUser.rows.length === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    // Update username
    if (username !== undefined && username !== '') {
      // Cek username tidak digunakan user lain
      const usernameCheck = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username.trim(), userId]
      );
      if (usernameCheck.rows.length > 0) {
        return send(res, 400, { success: false, message: "Username sudah digunakan" });
      }
      updates.push(`username = $${paramIndex}`);
      params.push(username.trim());
      paramIndex++;
    }

    // Update email
    if (email !== undefined && email !== '') {
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

    // Update nama_lengkap
    if (name !== undefined && name !== '') {
      updates.push(`nama_lengkap = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }
    
    // Update status
    if (status !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(status === 'inactive' ? false : true);
      paramIndex++;
    }
    
    // Update role
    if (role !== undefined && role !== '') {
      if (!VALID_ROLES.includes(role)) {
        return send(res, 400, { success: false, message: "Role tidak valid" });
      }
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    // Update password jika ada
    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        return send(res, 400, { success: false, message: "Password minimal 6 karakter" });
      }
      const passwordHash = hashPassword(password);
      updates.push(`password_hash = $${paramIndex}`);
      params.push(passwordHash);
      paramIndex++;
    }

    if (updates.length === 0) {
      return send(res, 400, { success: false, message: "Tidak ada data yang diupdate" });
    }

    updates.push(`updated_at = NOW()`);
    params.push(userId);

    console.log('[UPDATE USER] Payload:', { id: userId, role, email, nama, status, updates: updates });

    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    console.log('[UPDATE USER] Result:', { id: userId, role, rowCount: result.rowCount });

    if (result.rowCount === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { success: true, message: "User berhasil diupdate" });
  } catch (error) {
    console.error("Error updating user:", error);
    return send(res, 500, { success: false, message: "Gagal mengupdate user" });
  }
}

async function deleteUser(req, res, userId) {
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    if (result.rowCount === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { success: true, message: "User berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return send(res, 500, { success: false, message: "Gagal menghapus user" });
  }
}

async function enableUser(req, res, userId) {
  try {
    const result = await pool.query(
      `UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { success: true, message: "User berhasil diaktifkan" });
  } catch (error) {
    console.error("Error enabling user:", error);
    return send(res, 500, { success: false, message: "Gagal mengaktifkan user" });
  }
}

async function disableUser(req, res, userId) {
  try {
    const result = await pool.query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { success: true, message: "User berhasil dinonaktifkan" });
  } catch (error) {
    console.error("Error disabling user:", error);
    return send(res, 500, { success: false, message: "Gagal menonaktifkan user" });
  }
}

async function resetPassword(req, res, userId) {
  try {
    const tempPassword = generateTempPassword();
    const passwordHash = hashPassword(tempPassword);

    const result = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, userId]
    );

    if (result.rowCount === 0) {
      return send(res, 404, { success: false, message: "User tidak ditemukan" });
    }

    return send(res, 200, { success: true, message: "Password berhasil direset", data: { temp_password: tempPassword } });
  } catch (error) {
    console.error("Error resetting password:", error);
    return send(res, 500, { success: false, message: "Gagal reset password" });
  }
}

async function getUserStats(req, res) {
  try {
    const totalResult = await pool.query("SELECT COUNT(*) as total FROM users");
    const activeResult = await pool.query("SELECT COUNT(*) as active FROM users WHERE is_active = TRUE");
    const adminResult = await pool.query("SELECT COUNT(*) as admins FROM users WHERE role = 'admin'");
    const staffResult = await pool.query("SELECT COUNT(*) as staff FROM users WHERE role = 'staff_gudang'");
    const checkerResult = await pool.query("SELECT COUNT(*) as checkers FROM users WHERE role = 'checker_opname'");

    return send(res, 200, {
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

async function getRoles(req, res) {
  return send(res, 200, {
    success: true,
    data: [
      { value: "admin", label: "Admin" },
      { value: "staff_gudang", label: "Staff Gudang" },
      { value: "checker_opname", label: "Checker Opname" }
    ]
  });
}

export default async function usersApiHandler(req, res) {
  const routePath = getRoutePath(req);
  const normalizedPath = normalizeRoute(routePath);
  const method = req.method;
  const action = extractAction(normalizedPath);
  const userId = req.params?.[0] ? parseInt(req.params[0], 10) : extractUserId(normalizedPath);

  if (userId && action) {
    if (method === "POST") {
      if (action === "enable") return enableUser(req, res, userId);
      if (action === "disable") return disableUser(req, res, userId);
      if (action === "reset-password") return resetPassword(req, res, userId);
    }
  }

  if (method === "GET" && normalizedPath === "v1/users/stats") {
    return getUserStats(req, res);
  }

  if (method === "GET" && normalizedPath === "v1/users/roles") {
    return getRoles(req, res);
  }

  if (method === "GET" && normalizedPath === "v1/users") {
    return listUsers(req, res);
  }

  if (method === "POST" && normalizedPath === "v1/users") {
    return createUser(req, res);
  }

  if (userId) {
    if (method === "GET") {
      return getUser(req, res, userId);
    }
    if (method === "PUT") {
      return updateUser(req, res, userId);
    }
    if (method === "DELETE") {
      return deleteUser(req, res, userId);
    }
  }

  return send(res, 404, { success: false, message: `Route tidak ditemukan: ${method} ${routePath}` });
}
