// Netlify Function - Generic API Handler
// Handles all /api/* requests by routing to appropriate backend handlers

import crypto from "crypto";
import { Pool } from "pg";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "cvepic-warehouse-v3-secret-key-change-in-production";
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;
const VALID_ROLES = ["admin", "staff_gudang", "checker_opname"];

// Password verification
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

function parseToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (!payload.sub || !payload.username || !payload.role) return null;
    if (!VALID_ROLES.includes(payload.role)) return null;
    return payload;
  } catch { return null; }
}

function authUser(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return parseToken(auth.replace('Bearer ', ''));
}

// Helper function
function num(val) { return Number(val || 0); }

// Database pool
function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not configured");
  return new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
}

// Get route from path
function getRoute(event) {
  const path = event.path || "";
  // Remove /api prefix
  let route = path.replace(/^\/api\/?/, "");
  // Remove query string
  route = route.split('?')[0];
  return route;
}

// Get query params
function getParams(event, originalPath) {
  const params = {};
  if (event.queryStringParameters) {
    Object.assign(params, event.queryStringParameters);
  }
  // Also parse from original path
  const url = new URL(originalPath || "/", "https://localhost");
  url.searchParams.forEach((v, k) => {
    if (!params[k]) params[k] = v;
  });
  return params;
}

// Parse body
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

// Format number
function formatNum(val) { return Number(val || 0); }

// ==================== ROUTE HANDLERS ====================

// Auth Login Handler
async function handleLogin(event) {
  const body = await parseBody(event);
  const { username = "", password = "" } = body;
  
  // Get original path from headers for portal detection
  const originalPath = event.headers?.['x-bb-path'] || 
                       event.headers?.['x-original-path'] ||
                       event.headers?.['x-forwarded-uri'] ||
                       event.rawUrl ||
                       event.path || '/';
  const portal = originalPath.includes('/admin') ? 'admin' : (originalPath.includes('/user') ? 'user' : null);
  
  console.log('Login - originalPath:', originalPath, 'portal:', portal);

  if (!username || !password) {
    return { status: 400, data: { success: false, message: "Username dan password wajib diisi" } };
  }

  const pool = createPool();
  try {
    const result = await pool.query("SELECT id, username, password_hash, nama_lengkap, role, email, is_active FROM users WHERE username = $1 LIMIT 1", [username.trim()]);
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return { status: 401, data: { success: false, message: "Username atau password salah" } };
    }
    if (user.is_active === false) {
      return { status: 401, data: { success: false, message: "Akun tidak aktif" } };
    }
    if (portal === 'admin' && user.role !== 'admin') {
      return { status: 401, data: { success: false, message: "Portal admin hanya untuk admin" } };
    }
    if (portal === 'user') {
      if (user.role === 'admin') return { status: 401, data: { success: false, message: "Gunakan portal admin" } };
      if (!["staff_gudang", "checker_opname"].includes(user.role)) {
        return { status: 401, data: { success: false, message: "Role tidak diizinkan" } };
      }
    }

    await pool.query("UPDATE users SET failed_login_count = 0, last_login = NOW() WHERE id = $1", [user.id]);
    const loginAs = user.role === 'admin' ? 'admin' : 'user';
    const token = buildToken(user, loginAs);

    return { status: 200, data: { success: true, message: "Login berhasil", data: { token, user: { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role, email: user.email, loginAs } } } };
  } finally {
    await pool.end();
  }
}

// V3 Dashboard Handler
async function handleDashboard(event, originalPath) {
  const params = getParams(event, originalPath);
  const pool = createPool();
  const now = new Date();
  const filterBulan = parseInt(params.bulan) || now.getMonth() + 1;
  const filterTahun = parseInt(params.tahun) || now.getFullYear();

  const startDate = new Date(filterTahun, filterBulan - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(filterTahun, filterBulan, 0).toISOString().split('T')[0];

  try {
    // Distribusi
    const distribusi = await pool.query(`
      SELECT COUNT(DISTINCT j.sku) AS distribusi_count, COALESCE(SUM(j.qty), 0) AS total_qty,
        COUNT(DISTINCT j.nama_outlet) AS outlet_count
      FROM penjualan j WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // Penjualan
    const penjualan = await pool.query(`
      SELECT COALESCE(SUM(qty), 0) AS total_qty, COALESCE(SUM(j.qty * p.harga_jual), 0) AS nominal,
        COUNT(DISTINCT nama_outlet) AS customer_count
      FROM penjualan j JOIN produk p ON p.sku = j.sku WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // Profit
    const profit = await pool.query(`
      SELECT COALESCE(SUM((p.harga_jual - p.harga_beli) * j.qty), 0) AS total_profit
      FROM penjualan j JOIN produk p ON p.sku = j.sku WHERE j.tanggal >= $1 AND j.tanggal <= $2
    `, [startDate, endDate]);

    // Siswa Aktif
    const siswa = await pool.query(`
      SELECT COALESCE(SUM(jumlah_siswa), 0) AS total_siswa FROM outlet_siswa_level_bulanan
      WHERE EXTRACT(MONTH FROM periode) = $1 AND EXTRACT(YEAR FROM periode) = $2
    `, [filterBulan, filterTahun]);

    // Produk Aktif
    const produkAktif = await pool.query(`SELECT COUNT(DISTINCT sku) AS total FROM penjualan WHERE tanggal >= $1 AND tanggal <= $2`, [startDate, endDate]);

    // Outlet Aktif
    const outletAktif = await pool.query(`SELECT COUNT(DISTINCT nama_outlet) AS total FROM penjualan WHERE tanggal >= $1 AND tanggal <= $2`, [startDate, endDate]);

    // Total Produk
    const totalProduk = await pool.query(`SELECT COUNT(*) AS total FROM produk`);

    // Total Outlet
    const totalOutlet = await pool.query(`SELECT COUNT(*) AS total FROM outlet`);

    // Stok Kritis
    let stokKritis = { rows: [{ kritis_count: 0 }] };
    let stokKritisList = { rows: [] };
    try {
      stokKritis = await pool.query(`
        WITH produk_stok AS (
          SELECT p.sku, p.nama_produk,
            COALESCE((SELECT SUM(qty_awal) FROM stok_awal WHERE sku = p.sku GROUP BY sku), 0)
            + COALESCE((SELECT SUM(qty) FROM pembelian WHERE sku = p.sku GROUP BY sku), 0)
            - COALESCE((SELECT SUM(qty) FROM penjualan WHERE sku = p.sku GROUP BY sku), 0)
            + COALESCE((SELECT SUM(qty) FROM stok_penyesuaian WHERE sku = p.sku GROUP BY sku), 0) AS stok_akhir
          FROM produk p
        )
        SELECT COUNT(*) AS kritis_count FROM produk_stok WHERE stok_akhir <= 0 OR stok_akhir < 10
      `);
      stokKritisList = await pool.query(`
        WITH produk_stok AS (
          SELECT p.sku, p.nama_produk,
            COALESCE((SELECT SUM(qty_awal) FROM stok_awal WHERE sku = p.sku GROUP BY sku), 0)
            + COALESCE((SELECT SUM(qty) FROM pembelian WHERE sku = p.sku GROUP BY sku), 0)
            - COALESCE((SELECT SUM(qty) FROM penjualan WHERE sku = p.sku GROUP BY sku), 0)
            + COALESCE((SELECT SUM(qty) FROM stok_penyesuaian WHERE sku = p.sku GROUP BY sku), 0) AS stok_akhir
          FROM produk p
        )
        SELECT sku, nama_produk, stok_akhir FROM produk_stok WHERE stok_akhir <= 0 OR stok_akhir < 10 ORDER BY stok_akhir ASC LIMIT 20
      `);
    } catch (e) { /* ignore */ }

    // SO Berjalan
    const soBerjalan = await pool.query(`SELECT COUNT(*) AS total FROM stok_opname_perintah WHERE status IN ('menunggu', 'proses')`);

    // SO Selesai
    const soSelesai = await pool.query(`SELECT COUNT(*) AS total FROM stok_opname_perintah WHERE status = 'selesai' AND bulan = $1 AND tahun = $2`, [filterBulan, filterTahun]);

    // Users
    const totalUsers = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE is_active = true`);

    // Stok Gudang
    const stokGudang = await pool.query(`
      WITH params AS (SELECT CURRENT_DATE AS end_date),
      base_stock AS (SELECT COALESCE(SUM(qty_awal), 0) AS total FROM stok_awal),
      pembelian_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM pembelian WHERE tanggal <= (SELECT end_date FROM params)),
      penjualan_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM penjualan WHERE tanggal <= (SELECT end_date FROM params)),
      penyesuaian_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM stok_penyesuaian WHERE tanggal <= (SELECT end_date FROM params))
      SELECT bs.total AS stok_awal, pt.total AS pembelian, pj.total AS penjualan, pen.total AS penyesuaian,
        bs.total + pt.total - pj.total + pen.total AS stok_akhir
      FROM base_stock bs, pembelian_total pt, penjualan_total pj, penyesuaian_total pen
    `);

    return { status: 200, data: {
      filter: { bulan: filterBulan, tahun: filterTahun },
      periode: {
        distribusi: { count: num(distribusi.rows[0]?.distribusi_count), qty: num(distribusi.rows[0]?.total_qty), outlet_count: num(distribusi.rows[0]?.outlet_count) },
        penjualan: { qty: num(penjualan.rows[0]?.total_qty), nominal: num(penjualan.rows[0]?.nominal), customer_count: num(penjualan.rows[0]?.customer_count) },
        profit: num(profit.rows[0]?.total_profit),
        total_siswa: num(siswa.rows[0]?.total_siswa)
      },
      produk: { aktif: num(produkAktif.rows[0]?.total), total: num(totalProduk.rows[0]?.total) },
      outlet: { aktif: num(outletAktif.rows[0]?.total), total: num(totalOutlet.rows[0]?.total) },
      stok: {
        kritis: num(stokKritis.rows[0]?.kritis_count),
        kritis_list: stokKritisList.rows.map(r => ({ sku: r.sku, nama_produk: r.nama_produk, stok: num(r.stok_akhir) })),
        gudang: { awal: num(stokGudang.rows[0]?.stok_awal), pembelian: num(stokGudang.rows[0]?.pembelian), penjualan: num(stokGudang.rows[0]?.penjualan), penyesuaian: num(stokGudang.rows[0]?.penyesuaian), akhir: num(stokGudang.rows[0]?.stok_akhir) }
      },
      opname: { berjalan: num(soBerjalan.rows[0]?.total), selesai_bulan_ini: num(soSelesai.rows[0]?.total) },
      users: { total: num(totalUsers.rows[0]?.total) }
    }};
  } finally {
    await pool.end();
  }
}

// V3 Chart Handler
async function handleChart(event, originalPath) {
  const params = getParams(event, originalPath);
  const pool = createPool();
  const now = new Date();
  const filterBulan = parseInt(params.bulan) || now.getMonth() + 1;
  const filterTahun = parseInt(params.tahun) || now.getFullYear();
  const chartType = params.type || 'tren_penjualan';

  const startDate = new Date(filterTahun, filterBulan - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(filterTahun, filterBulan, 0).toISOString().split('T')[0];

  try {
    let data = [];

    if (chartType === 'tren_penjualan') {
      const result = await pool.query(`
        SELECT DATE_TRUNC('day', tanggal) AS date, SUM(j.qty * p.harga_jual) AS total
        FROM penjualan j JOIN produk p ON p.sku = j.sku
        WHERE j.tanggal >= $1 AND j.tanggal <= $2
        GROUP BY DATE_TRUNC('day', tanggal)
        ORDER BY date
      `, [startDate, endDate]);
      data = result.rows.map(r => ({ date: r.date.toISOString().split('T')[0], total: num(r.total) }));

    } else if (chartType === 'outlet') {
      const result = await pool.query(`
        SELECT o.nama_outlet, SUM(j.qty * p.harga_jual) AS total, SUM(j.qty) AS qty
        FROM penjualan j JOIN produk p ON p.sku = j.sku JOIN outlet o ON o.nama_outlet = j.nama_outlet
        WHERE j.tanggal >= $1 AND j.tanggal <= $2
        GROUP BY o.id, o.nama_outlet ORDER BY total DESC LIMIT 10
      `, [startDate, endDate]);
      data = result.rows.map(r => ({ outlet: r.nama_outlet, total: num(r.total), qty: num(r.qty) }));

    } else if (chartType === 'top_produk') {
      const result = await pool.query(`
        SELECT p.sku, p.nama_produk, SUM(j.qty) AS qty, SUM(j.qty * p.harga_jual) AS total
        FROM penjualan j JOIN produk p ON p.sku = j.sku
        WHERE j.tanggal >= $1 AND j.tanggal <= $2
        GROUP BY p.sku, p.nama_produk ORDER BY qty DESC LIMIT 10
      `, [startDate, endDate]);
      data = result.rows.map(r => ({ sku: r.sku, nama_produk: r.nama_produk, qty: num(r.qty), total: num(r.total) }));

    } else if (chartType === 'modul_level') {
      const result = await pool.query(`
        SELECT sl.level_num, sl.level_nama, SUM(sl.jumlah_siswa) AS jumlah
        FROM outlet_siswa_level_bulanan sl
        WHERE EXTRACT(MONTH FROM sl.periode) = $1 AND EXTRACT(YEAR FROM sl.periode) = $2
        GROUP BY sl.level_num, sl.level_nama ORDER BY sl.level_num
      `, [filterBulan, filterTahun]);
      data = result.rows.map(r => ({ level: r.level_num, nama: r.level_nama, jumlah: num(r.jumlah) }));
    }

    return { status: 200, data: { type: chartType, filter: { bulan: filterBulan, tahun: filterTahun }, data } };
  } finally {
    await pool.end();
  }
}

// Outlet Transaksi Summary Handler
async function handleOutletTransaksiSummary(event, originalPath) {
  const params = getParams(event, originalPath);
  const pool = createPool();
  const type = params.type || 'transaksi';
  const bulan = parseInt(params.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(params.tahun) || new Date().getFullYear();

  const startDate = new Date(tahun, bulan - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(tahun, bulan, 0).toISOString().split('T')[0];

  try {
    let result;
    if (type === 'transaksi') {
      result = await pool.query(`
        SELECT o.id AS outlet_id, o.nama_outlet, COUNT(DISTINCT j.id) AS total_transaksi,
          COALESCE(SUM(j.qty), 0) AS total_qty, COALESCE(SUM(j.qty * p.harga_jual), 0) AS total_nominal
        FROM outlet o
        INNER JOIN penjualan j ON j.nama_outlet = o.nama_outlet AND j.tanggal >= $1 AND j.tanggal <= $2
        LEFT JOIN produk p ON p.sku = j.sku
        GROUP BY o.id, o.nama_outlet ORDER BY total_nominal DESC
      `, [startDate, endDate]);
    } else {
      result = await pool.query(`
        SELECT o.id AS outlet_id, o.nama_outlet, 0 AS total_transaksi, 0 AS total_qty, 0 AS total_nominal
        FROM outlet o
        WHERE o.id NOT IN (SELECT DISTINCT o2.id FROM outlet o2 INNER JOIN penjualan j ON j.nama_outlet = o2.nama_outlet WHERE j.tanggal >= $1 AND j.tanggal <= $2)
        ORDER BY o.nama_outlet ASC
      `, [startDate, endDate]);
    }

    return { status: 200, data: {
      type, periode: { bulan, tahun }, start_date: startDate, end_date: endDate,
      total_count: result.rows.length,
      data: result.rows.map((r, i) => ({ no: i + 1, outlet_id: r.outlet_id, nama_outlet: r.nama_outlet, total_transaksi: num(r.total_transaksi), total_qty: num(r.total_qty), total_nominal: num(r.total_nominal) }))
    }};
  } finally {
    await pool.end();
  }
}

// Users Handler
async function handleUsers(event) {
  const user = authUser(event);
  if (!user) return { status: 401, data: { error: "Unauthorized" } };
  if (user.role !== 'admin') return { status: 403, data: { error: "Forbidden" } };

  const pool = createPool();
  const method = event.httpMethod;

  try {
    if (method === 'GET') {
      const result = await pool.query(`SELECT id, username, nama_lengkap, email, role, is_active, created_at FROM users ORDER BY created_at DESC`);
      return { status: 200, data: result.rows.map(r => ({ id: r.id, username: r.username, nama_lengkap: r.nama_lengkap, email: r.email, role: r.role, is_active: r.is_active, created_at: r.created_at })) };
    }

    if (method === 'POST') {
      const body = await parseBody(event);
      const { username, password, nama_lengkap, email, role } = body;
      if (!username || !password) return { status: 400, data: { error: "Username dan password wajib diisi" } };

      const hash = crypto.createHash("sha256").update(password).digest("hex");
      const result = await pool.query(
        `INSERT INTO users (username, password_hash, nama_lengkap, email, role, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, username, nama_lengkap, email, role, is_active`,
        [username, hash, nama_lengkap || username, email || '', role || 'staff_gudang']
      );
      return { status: 201, data: result.rows[0] };
    }

    return { status: 405, data: { error: "Method not allowed" } };
  } finally {
    await pool.end();
  }
}

// Top Outlet Handler
async function handleTopOutlet(event) {
  const params = getParams(event);
  const pool = createPool();
  const limit = parseInt(params.limit) || 10;
  const bulan = parseInt(params.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(params.tahun) || new Date().getFullYear();
  const startDate = new Date(tahun, bulan - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(tahun, bulan, 0).toISOString().split('T')[0];

  try {
    const result = await pool.query(`
      SELECT o.id, o.nama_outlet, SUM(j.qty * p.harga_jual) AS total_nominal, SUM(j.qty) AS total_qty, COUNT(DISTINCT j.id) AS transaksi_count
      FROM outlet o
      INNER JOIN penjualan j ON j.nama_outlet = o.nama_outlet AND j.tanggal >= $1 AND j.tanggal <= $2
      JOIN produk p ON p.sku = j.sku
      GROUP BY o.id, o.nama_outlet
      ORDER BY total_nominal DESC
      LIMIT $3
    `, [startDate, endDate, limit]);

    return { status: 200, data: result.rows.map(r => ({
      id: r.id, nama_outlet: r.nama_outlet, total_nominal: num(r.total_nominal), total_qty: num(r.total_qty), transaksi_count: num(r.transaksi_count)
    }))};
  } finally {
    await pool.end();
  }
}

// Top Produk Handler
async function handleTopProduk(event) {
  const params = getParams(event);
  const pool = createPool();
  const limit = parseInt(params.limit) || 10;
  const bulan = parseInt(params.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(params.tahun) || new Date().getFullYear();
  const startDate = new Date(tahun, bulan - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(tahun, bulan, 0).toISOString().split('T')[0];

  try {
    const result = await pool.query(`
      SELECT p.sku, p.nama_produk, p.kategori, SUM(j.qty) AS total_qty, SUM(j.qty * p.harga_jual) AS total_nominal
      FROM penjualan j JOIN produk p ON p.sku = j.sku
      WHERE j.tanggal >= $1 AND j.tanggal <= $2
      GROUP BY p.sku, p.nama_produk, p.kategori ORDER BY total_qty DESC LIMIT $3
    `, [startDate, endDate, limit]);

    return { status: 200, data: result.rows.map(r => ({
      sku: r.sku, nama_produk: r.nama_produk, kategori: r.kategori, total_qty: num(r.total_qty), total_nominal: num(r.total_nominal)
    }))};
  } finally {
    await pool.end();
  }
}

// Outlet List Handler
async function handleOutletList(event) {
  const pool = createPool();
  try {
    const result = await pool.query(`SELECT id, nama_outlet, alamat, is_active FROM outlet ORDER BY nama_outlet`);
    return { status: 200, data: result.rows.map(r => ({ id: r.id, nama_outlet: r.nama_outlet, alamat: r.alamat, is_active: r.is_active })) };
  } finally {
    await pool.end();
  }
}

// Produk List Handler
async function handleProdukList(event) {
  const pool = createPool();
  const params = getParams(event);
  try {
    let query = `SELECT sku, nama_produk, kategori, harga_beli, harga_jual FROM produk`;
    const values = [];
    if (params.kategori) {
      query += ` WHERE kategori = $1`;
      values.push(params.kategori);
    }
    query += ` ORDER BY nama_produk LIMIT 500`;
    const result = await pool.query(query, values);
    return { status: 200, data: result.rows };
  } finally {
    await pool.end();
  }
}

// Health Handler
async function handleHealth(event) {
  const connectionString = process.env.DATABASE_URL;
  const dbHealthy = Boolean(connectionString);
  return { status: 200, data: { status: dbHealthy ? 'healthy' : 'degraded', timestamp: new Date().toISOString(), database: { configured: dbHealthy } } };
}

// ==================== MAIN HANDLER ====================

export default async function handler(event) {
  console.log('=== API HANDLER START ===');
  console.log('event.httpMethod:', event.httpMethod);
  console.log('event.path:', event.path);
  console.log('event.rawUrl:', event.rawUrl);
  console.log('event.headers:', JSON.stringify(event.headers).substring(0, 500));
  
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  // Try to get original path from various sources
  const originalPath = event.headers?.['x-bb-path'] || 
                       event.headers?.['x-original-path'] ||
                       event.headers?.['x-forwarded-uri'] ||
                       event.headers?.['x-nfrequesturi'] ||
                       event.rawUrl ||
                       event.path || 
                       '/';
  
  const path = originalPath.split('?')[0];
  const method = event.httpMethod || 'GET';
  
  console.log('originalPath:', originalPath);
  console.log('path:', path);
  console.log('method:', method);

  try {
    let result;

    // Auth routes
    if (path.includes('/auth/login')) {
      console.log('Routing to handleLogin');
      result = await handleLogin(event);
    }
    // Dashboard
    else if (path.includes('/v3-dashboard')) {
      result = await handleDashboard(event, originalPath);
    }
    // Charts
    else if (path.includes('/v3-chart')) {
      result = await handleChart(event, originalPath);
    }
    // Outlet Transaksi Summary
    else if (path.includes('/outlet-transaksi-summary')) {
      result = await handleOutletTransaksiSummary(event, originalPath);
    }
    // Users
    else if (path.includes('/v1/users')) {
      result = await handleUsers(event);
    }
    // Top Outlet
    else if (path.includes('/top-outlet')) {
      result = await handleTopOutlet(event);
    }
    // Top Produk
    else if (path.includes('/top-produk')) {
      result = await handleTopProduk(event);
    }
    // Outlet List
    else if (path.includes('/outlet-list')) {
      result = await handleOutletList(event);
    }
    // Produk List
    else if (path.includes('/produk-list')) {
      result = await handleProdukList(event);
    }
    // Health
    else if (path.includes('/health')) {
      result = await handleHealth(event);
    }
    // Not found
    else {
      console.log('No route matched, returning 404');
      result = { status: 404, data: { error: "Route not found: " + path } };
    }

    console.log('Returning:', result.status, JSON.stringify(result.data).substring(0, 200));
    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}
