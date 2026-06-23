// Netlify Function - Auth Login
import crypto from "crypto";
import { Pool } from "pg";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

const JWT_SECRET = process.env.JWT_SECRET || "cvepic-warehouse-v3-secret-key-change-in-production";
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;
const VALID_ROLES = ["admin", "staff_gudang", "checker_opname"];

function safeEqualHex(expected, actual) {
  try {
    const expectedBuffer = Buffer.from(String(expected || ""), "hex");
    const actualBuffer = Buffer.from(String(actual || ""), "hex");
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch { return false; }
}

function verifyWerkzeug(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 3) return false;
  const methodParts = parts[0].split(":");
  if (methodParts[0] !== "pbkdf2" || methodParts[1] !== "sha256") return false;
  const iterations = Number(methodParts[2] || 260000);
  const salt = parts[1];
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return safeEqualHex(derived, parts[2]);
}

function verifySha256(password, storedHash) {
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  return safeEqualHex(hash, storedHash);
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
  const payload = { sub: String(user.id), username: user.username, nama_lengkap: user.nama_lengkap, role: user.role, loginAs, iat: now, exp: now + TOKEN_EXPIRY };
  const payloadBase = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payloadBase}`).digest("base64url");
  return `${header}.${payloadBase}.${signature}`;
}

async function parseBody(event) {
  const body = event.body;
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  if (body && typeof body === 'object' && typeof body.getReader === 'function') {
    try {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }
      result += decoder.decode();
      return JSON.parse(result);
    } catch { return {}; }
  }
  if (typeof body === 'object') return body;
  return {};
}

export default async function handler(event) {
  console.log('Auth function called');
  console.log('event:', JSON.stringify(event).substring(0, 300));
  
  if (event.httpMethod === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  const body = await parseBody(event);
  console.log('Parsed body:', JSON.stringify(body));
  
  const { username = "", password = "" } = body;
  
  // Detect portal from path or headers
  const path = event.path || event.rawUrl || '/';
  const portal = path.includes('/admin') ? 'admin' : (path.includes('/user') ? 'user' : null);
  console.log('Path:', path, 'Portal:', portal);

  if (!username || !password) {
    return new Response(JSON.stringify({ success: false, message: "Username dan password wajib diisi" }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new Response(JSON.stringify({ success: false, message: "Database URL not configured" }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    const result = await pool.query(
      "SELECT id, username, password_hash, nama_lengkap, role, email, is_active FROM users WHERE username = $1 LIMIT 1",
      [username.trim()]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return new Response(JSON.stringify({ success: false, message: "Username atau password salah" }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    if (user.is_active === false) {
      return new Response(JSON.stringify({ success: false, message: "Akun tidak aktif" }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    if (portal === 'admin' && user.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, message: "Portal admin hanya untuk admin" }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    if (portal === 'user') {
      if (user.role === 'admin') {
        return new Response(JSON.stringify({ success: false, message: "Gunakan portal admin" }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
      if (!["staff_gudang", "checker_opname"].includes(user.role)) {
        return new Response(JSON.stringify({ success: false, message: "Role tidak diizinkan" }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    }

    await pool.query("UPDATE users SET failed_login_count = 0, last_login = NOW() WHERE id = $1", [user.id]);
    const loginAs = user.role === 'admin' ? 'admin' : 'user';
    const token = buildToken(user, loginAs);

    return new Response(JSON.stringify({
      success: true,
      message: "Login berhasil",
      data: {
        token,
        user: { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role, email: user.email, loginAs }
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ success: false, message: "Server error: " + error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } finally {
    await pool.end();
  }
}
