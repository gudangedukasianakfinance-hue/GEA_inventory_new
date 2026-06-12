import crypto from "crypto";
import pool from "../services/db.js";
import { buildToken as createSignedToken } from "../services/auth.js";

function send(res, status, payload) {
  return res.status(status).json(payload);
}

function safeEqualHex(expected, actual) {
  const expectedBuffer = Buffer.from(String(expected || ""), "hex");
  const actualBuffer = Buffer.from(String(actual || ""), "hex");
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function verifyWerkzeug(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 3) return false;

  const methodParts = parts[0].split(":");
  if (methodParts[0] !== "pbkdf2" || methodParts[1] !== "sha256") return false;

  const iterations = Number(methodParts[2] || 260000);
  const salt = parts[1];
  const expected = parts[2];
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return safeEqualHex(expected, derived);
}

function verifySha256(password, storedHash) {
  const expected = crypto.createHash("sha256").update(password).digest("hex");
  return safeEqualHex(storedHash, expected);
}

function verifyPassword(password, storedHash) {
  const hash = String(storedHash || "");
  if (hash.startsWith("pbkdf2:sha256")) return verifyWerkzeug(password, hash);
  if (/^[a-f0-9]{64}$/i.test(hash)) return verifySha256(password, hash);
  return false;
}

function buildToken(user, portal) {
  // Use signed token builder from auth service
  return createSignedToken(user, portal);
}

async function login(req, res, portal = null) {
  const { username = "", password = "" } = req.body || {};
  const normalizedUsername = String(username).trim();

  if (!normalizedUsername || !password) {
    return send(res, 400, { success: false, message: "Username dan password wajib diisi" });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, email, password_hash, nama_lengkap, role, outlet_id, is_active
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [normalizedUsername]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      if (user) {
        await pool.query(
          "UPDATE users SET failed_login_count = COALESCE(failed_login_count, 0) + 1 WHERE id = $1",
          [user.id]
        ).catch(() => {});
      }
      return send(res, 401, { success: false, message: "Invalid username or password" });
    }

    if (user.is_active === false) {
      return send(res, 401, { success: false, message: "User account is inactive" });
    }

    if (portal === "admin" && user.role !== "admin") {
      return send(res, 401, { success: false, message: "Portal admin hanya untuk akun admin" });
    }
    if (portal === "user" && user.role === "admin") {
      return send(res, 401, { success: false, message: "Akun admin harus masuk melalui portal admin" });
    }

    await pool.query(
      "UPDATE users SET failed_login_count = 0, last_login = NOW() WHERE id = $1",
      [user.id]
    ).catch(() => {});

    const loginAs = user.role === "admin" ? "admin" : "user";
    const data = {
      user_id: user.id,
      username: user.username,
      email: user.email,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      outlet_id: user.outlet_id,
      login_as: loginAs,
      access_token: buildToken(user, loginAs),
      refresh_token: buildToken(user, `${loginAs}:refresh`),
      expires_in: 86400
    };

    return send(res, 200, { success: true, message: "Login successful", data });
  } catch (error) {
    console.error("auth login error", error);
    
    // Provide more specific error messages for debugging
    const errorMessage = error.message || "";
    
    if (!process.env.DATABASE_URL) {
      return send(res, 503, { 
        success: false, 
        message: "Konfigurasi database belum lengkap. DATABASE_URL belum diset.",
        error: "DATABASE_URL_NOT_SET"
      });
    }
    
    if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("connect")) {
      return send(res, 503, { 
        success: false, 
        message: "Tidak dapat terhubung ke database. Periksa konfigurasi koneksi.",
        error: "DATABASE_CONNECTION_FAILED"
      });
    }
    
    if (errorMessage.includes("authentication") || errorMessage.includes("password")) {
      return send(res, 503, { 
        success: false, 
        message: "Autentikasi database gagal. Periksa credentials.",
        error: "DATABASE_AUTH_FAILED"
      });
    }
    
    return send(res, 500, { 
      success: false, 
      message: "Gagal memproses login",
      error: errorMessage
    });
  }
}

export default async function authHandler(req, res) {
  const route = String(req.query?.route || "").replace(/^\/+/, "");
  if (req.method === "POST" && route === "v1/auth/login/admin") return login(req, res, "admin");
  if (req.method === "POST" && route === "v1/auth/login/user") return login(req, res, "user");
  if (req.method === "POST" && route === "v1/auth/login") return login(req, res, null);
  if (req.method === "POST" && route === "v1/auth/logout") {
    return send(res, 200, { success: true, message: "Logout successful", data: null });
  }
  return send(res, 404, { success: false, message: "Route auth tidak ditemukan" });
}
