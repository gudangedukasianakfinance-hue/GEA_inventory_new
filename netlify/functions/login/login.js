// Netlify Function - Auth Login
import crypto from "crypto";
import { Pool } from "pg";

const JWT_SECRET = process.env.JWT_SECRET || "cvepic-warehouse-v3-secret-key-change-in-production";
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

const USER_PORTAL_ROLES = ["staff_gudang", "checker_opname"];

function send(res, status, payload) {
  res.statusCode = status;
  res.body = JSON.stringify(payload);
}

function safeEqualHex(expected, actual) {
  try {
    const expectedBuffer = Buffer.from(String(expected || ""), "hex");
    const actualBuffer = Buffer.from(String(actual || ""), "hex");
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
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

function buildToken(user, loginAs) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Date.now();
  const payload = {
    sub: String(user.id),
    username: user.username,
    nama_lengkap: user.nama_lengkap,
    role: user.role,
    loginAs: loginAs,
    iat: now,
    exp: now + TOKEN_EXPIRY
  };
  const payloadBase = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payloadBase}`).digest("base64url");
  return `${header}.${payloadBase}.${signature}`;
}

async function login(req) {
  const { username = "", password = "" } = req.body || {};
  const normalizedUsername = String(username).trim();
  const portal = req.query?.portal || null;

  if (!normalizedUsername || !password) {
    return { success: false, message: "Username dan password wajib diisi" };
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { success: false, message: "Database tidak dikonfigurasi" };
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(
      `SELECT id, username, email, password_hash, nama_lengkap, role, outlet_id, is_active
       FROM users WHERE username = $1 LIMIT 1`,
      [normalizedUsername]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return { success: false, message: "Username atau password salah" };
    }

    if (user.is_active === false) {
      return { success: false, message: "Akun tidak aktif. Hubungi administrator" };
    }

    if (portal === "admin" && user.role !== "admin") {
      return { success: false, message: "Portal admin hanya untuk akun administrator" };
    }

    if (portal === "user") {
      if (user.role === "admin") {
        return { success: false, message: "Akun administrator harus masuk melalui portal admin" };
      }
      if (!USER_PORTAL_ROLES.includes(user.role)) {
        return { success: false, message: "Role tidak diizinkan login melalui portal ini" };
      }
    }

    await pool.query(
      "UPDATE users SET failed_login_count = 0, last_login = NOW() WHERE id = $1",
      [user.id]
    );

    const loginAs = user.role === "admin" ? "admin" : "user";
    const token = buildToken(user, loginAs);

    return {
      success: true,
      message: "Login berhasil",
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          nama_lengkap: user.nama_lengkap,
          role: user.role,
          email: user.email,
          loginAs
        }
      }
    };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, message: "Terjadi kesalahan server" };
  } finally {
    await pool.end();
  }
}

export default async function handler(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const response = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: ''
  };

  try {
    // Parse route from path
    const pathParts = event.path.split('/').filter(Boolean);
    const isAdmin = pathParts.includes('admin');
    const isUser = pathParts.includes('user');

    let portal = null;
    if (isAdmin) portal = "admin";
    else if (isUser) portal = "user";

    const mockReq = {
      body: event.body ? JSON.parse(event.body) : {},
      query: { ...event.queryStringParameters, portal }
    };

    const result = await login(mockReq);
    response.body = JSON.stringify(result);
    response.statusCode = result.success ? 200 : (result.message?.includes('salah') ? 401 : 400);

  } catch (error) {
    console.error('Handler error:', error);
    response.statusCode = 500;
    response.body = JSON.stringify({ success: false, message: 'Internal server error' });
  }

  return response;
}
