# PROJECT FORENSIC ANALYSIS
## CV EPIC Warehouse - Inventory Control System V3

**Date:** June 13, 2026  
**Analyst:** Forensic Analysis Agent  
**Version:** 3.0.0

---

## SECTION A - PROJECT STRUCTURE

```
/workspace/project/inventory-app-new/
├── index.html                          # Landing page
├── app.html                            # Main SPA shell
├── app.html.backup                     # Backup of app.html
├── server.js                           # Express server
├── init-db.js                          # Database initialization
├── package.json                        # Dependencies
├── package-lock.json                   # Lock file
├── vercel.json                         # Vercel deployment config
├── PROJECT_FORENSIC_ANALYSIS.md        # This file
│
├── api/
│   └── index.js                        # API router (Vercel serverless)
│
├── backend/                            # 42 backend files
│   ├── add-outlet.js                   # Add outlet handler
│   ├── add-pembelian.js                # Add purchase handler
│   ├── add-penjualan.js                # Add sales handler
│   ├── add-stok_awal.js                # Add initial stock handler
│   ├── approval-api.js                 # Approval workflow API
│   ├── audit.js                        # Audit logging API
│   ├── auth.js                         # Authentication handler
│   ├── chart.js                        # Chart data API
│   ├── import-outlet.js                # Import outlets
│   ├── import-pembelian.js            # Import purchases
│   ├── import-penjualan.js            # Import sales
│   ├── import-stok_awal.js            # Import initial stock
│   ├── kpi.js                          # KPI data API
│   ├── mini-review.js                  # Mini review API
│   ├── opname-db-utils.js              # Opname utilities
│   ├── opname-history.js               # Opname history
│   ├── opname-kategori-utils.js       # Opname category utilities
│   ├── opname-perintah.js              # Opname command API
│   ├── outlet-list.js                  # Outlet list API
│   ├── outlet-status.js                # Outlet status API
│   ├── outlet-transaksi.js            # Outlet transaction API
│   ├── persediaan.js                   # Inventory API
│   ├── produk-list.js                  # Product list API
│   ├── sesuaikan-opname.js            # Adjust opname API
│   ├── settings-api.js                 # Settings & profile API
│   ├── simpan-opname.js                # Save opname API
│   ├── stok-opname-export.js          # Export opname API
│   ├── stok-sistem.js                  # System stock API
│   ├── template-outlet.js              # Outlet template
│   ├── template-pembelian.js          # Purchase template
│   ├── template-penjualan.js          # Sales template
│   ├── template-stok_awal.js          # Initial stock template
│   ├── top-outlet.js                    # Top outlet API
│   ├── top-produk.js                   # Top product API
│   ├── users-api.js                    # User management API
│   ├── v3-chart.js                     # V3 Chart API
│   ├── v3-dashboard.js                 # V3 Dashboard API
│   ├── v3-opname-detail.js            # V3 Opname detail API
│   ├── v3-opname.js                    # V3 Opname API
│   ├── v3-penjualan.js                # V3 Sales API
│   └── v3-persediaan.js               # V3 Inventory API
│
├── css/                                # 5 CSS files (5,507 total lines)
│   ├── dashboard.css                   # Dashboard styles (680 lines)
│   ├── design-system-v4.css           # Design system (2,745 lines)
│   ├── landing.css                    # Landing page styles (1,057 lines)
│   ├── loader.css                     # Loader styles (798 lines)
│   └── style.css                      # Utility styles (227 lines)
│
├── pages/                              # 13 page files
│   ├── dashboard.html                 # Dashboard (395 lines)
│   ├── distribusi-outlet.html         # Outlet distribution (109 lines)
│   ├── laporan.html                   # Reports (217 lines)
│   ├── monitoring-outlet.html         # Outlet monitoring (134 lines)
│   ├── pelaksanaan-so.html            # SO execution (258 lines)
│   ├── pembelian.html                 # Purchases (115 lines)
│   ├── pengaturan.html                # Settings (273 lines)
│   ├── perintah-so.html               # SO command (191 lines)
│   ├── produk.html                    # Products (252 lines)
│   ├── riwayat-so.html               # SO history (123 lines)
│   ├── stok-gudang.html              # Warehouse stock (114 lines)
│   ├── user.html                     # User management (271 lines)
│   └── dashboard.html.backup          # Dashboard backup
│
├── services/                           # 3 service files
│   ├── auth.js                        # JWT authentication service
│   └── db.js                         # PostgreSQL connection pool
│
├── assets/
│   └── logo.png                       # App logo
│
├── migrations/                         # 4 migration files
│   ├── migration_auth_login.sql
│   ├── migration_neon_safe.sql
│   ├── migration_opname_perintah.sql
│   └── (legacy auth migration)
│
├── schema.sql                         # Database schema (362 lines)
└── server.log                         # Server logs
```

---

## SECTION B - FRONTEND INVENTORY

| Path | Fungsi | Route | Scripts | CSS | API Dipanggil |
|------|--------|-------|---------|-----|---------------|
| `index.html` | Landing page | `/` | lucide, inline login | landing.css | `/api/v1/auth/login/user`, `/api/v1/auth/login/admin` |
| `app.html` | SPA shell | `/app.html` | lucide, app-router.js, inline core | design-system-v4.css, dashboard.css, style.css, loader.css | - |
| `pages/dashboard.html` | Main dashboard | `?page=dashboard` | Chart.js, inline dashboard | - | `/api/v3-dashboard`, `/api/v3-chart`, `/api/v3-persediaan` |
| `pages/produk.html` | Product management | `?page=produk` | inline CRUD | - | `/api/v1/produk` (expected but not in api/index.js) |
| `pages/pembelian.html` | Purchase management | `?page=pembelian` | inline import | - | `/api/add-pembelian`, `/api/import-pembelian` |
| `pages/distribusi-outlet.html` | Outlet distribution | `?page=distribusi-outlet` | inline | - | `/api/outlet-list`, `/api/outlet-transaksi` |
| `pages/monitoring-outlet.html` | Outlet monitoring | `?page=monitoring-outlet` | inline | - | `/api/outlet-status` |
| `pages/perintah-so.html` | Stock opname command | `?page=perintah-so` | inline | - | `/api/opname-perintah` |
| `pages/pelaksanaan-so.html` | SO execution | `?page=pelaksanaan-so` | inline | - | `/api/v3-opname` |
| `pages/riwayat-so.html` | SO history | `?page=riwayat-so` | inline | - | `/api/opname-history` |
| `pages/laporan.html` | Reports | `?page=laporan` | inline | - | Various v3 APIs |
| `pages/user.html` | User management | `?page=user` | inline CRUD | inline styles | `/api/v1/users` |
| `pages/pengaturan.html` | Settings/Profile | `?page=pengaturan` | inline profile | inline styles | `/api/v1/auth/me`, `/api/v1/auth/change-password` |
| `pages/stok-gudang.html` | Warehouse stock | `?page=stok-gudang` | inline | - | `/api/stok-sistem` |

---

## SECTION C - CSS INVENTORY

| File | Lines | Primary Selectors | Used By |
|------|-------|-------------------|---------|
| `design-system-v4.css` | 2,745 | `:root`, `.btn`, `.form-input`, `.card`, `.modal`, `.table` | app.html |
| `dashboard.css` | 680 | `.dashboard-page`, `.kpi-card`, `.hero-card`, `.chart-area` | app.html |
| `landing.css` | 1,057 | `.landing-page`, `.hero`, `.features`, `.role-card` | index.html |
| `loader.css` | 798 | `.app-loader`, `.page-loader`, `@keyframes` | app.html |
| `style.css` | 227 | `.activity-list`, `.stats-card`, `.tabs`, `.avatar` | app.html |

### Duplicate Selector Analysis

| Selector | File A | File B | Conflict Level |
|----------|--------|--------|----------------|
| `.btn` | design-system-v4.css | style.css | LOW - style.css extends |
| `.card` | design-system-v4.css | dashboard.css | LOW - dashboard extends |
| `.form-input` | design-system-v4.css | pages/* inline | LOW - consistent |
| `.badge` | design-system-v4.css | produk.html inline | LOW |
| `.modal` | design-system-v4.css | app.html inline | LOW |

---

## SECTION D - JAVASCRIPT INVENTORY

### Main JS Files

| File | Fungsi Utama | Event Listeners | Dependencies | Pages |
|------|-------------|-----------------|--------------|-------|
| `app-router.js` | SPA Router, page loading, navigation | `popstate`, `click [data-page]`, `DOMContentLoaded` | lucide | app.html |
| `dashboard-opname-perintah.js` | Opname command initialization | - | AppRouter | perintah-so.html |

### Inline Scripts in Pages

| Page | Functions | Events |
|------|-----------|--------|
| dashboard.html | `loadDashboardData`, `loadKPIData`, `loadDistributionChart`, `loadRecentDistribution`, `loadStokKritis`, `loadRecentActivity`, `formatNumber` | DOMContentLoaded |
| user.html | `loadUsers`, `renderUsersTable`, `showAddUserModal`, `editUser`, `saveUser`, `deleteUser` | DOMContentLoaded, filter change |
| produk.html | `loadProduk`, `renderProdukTable`, `showAddProdukModal`, `editProduk`, `saveProduk`, `deleteProduk` | DOMContentLoaded, input search |
| pengaturan.html | `loadProfileData`, `saveProfile`, `changePassword`, tab switching | DOMContentLoaded |
| perintah-so.html | `loadPerintah`, `renderPerintahTable`, `showBuatPerintah`, `savePerintah` | DOMContentLoaded |

---

## SECTION E - ROUTER ANALYSIS

### app-router.js Route Mapping

```javascript
routes = {
  'dashboard': 'pages/dashboard.html',
  'produk': 'pages/produk.html',
  'stok-gudang': 'pages/stok-gudang.html',
  'pembelian': 'pages/pembelian.html',
  'distribusi-outlet': 'pages/distribusi-outlet.html',
  'monitoring-outlet': 'pages/monitoring-outlet.html',
  'perintah-so': 'pages/perintah-so.html',
  'pelaksanaan-so': 'pages/pelaksanaan-so.html',
  'riwayat-so': 'pages/riwayat-so.html',
  'laporan': 'pages/laporan.html',
  'user': 'pages/user.html',
  'pengaturan': 'pages/pengaturan.html'
}
```

### Route → File Mapping

| Route | File Path | Page Functions |
|-------|-----------|----------------|
| `dashboard` | `pages/dashboard.html` | Dashboard KPIs, charts, activity lists |
| `produk` | `pages/produk.html` | Product CRUD with search |
| `stok-gudang` | `pages/stok-gudang.html` | Warehouse stock view |
| `pembelian` | `pages/pembelian.html` | Purchase management |
| `distribusi-outlet` | `pages/distribusi-outlet.html` | Outlet distribution |
| `monitoring-outlet` | `pages/monitoring-outlet.html` | Outlet status monitoring |
| `perintah-so` | `pages/perintah-so.html` | SO command creation |
| `pelaksanaan-so` | `pages/pelaksanaan-so.html` | SO execution |
| `riwayat-so` | `pages/riwayat-so.html` | SO history |
| `laporan` | `pages/laporan.html` | Reports generation |
| `user` | `pages/user.html` | User management CRUD |
| `pengaturan` | `pages/pengaturan.html` | Profile & settings |

---

## SECTION F - API INVENTORY

### api/index.js Routes

| Method | Endpoint | Backend File | Description |
|--------|----------|--------------|-------------|
| GET | `/v1/health` | inline | Health check |
| GET | `/health` | inline | Health check alias |
| POST | `/v1/auth/login` | auth.js | Generic login |
| POST | `/v1/auth/login/admin` | auth.js | Admin login |
| POST | `/v1/auth/login/user` | auth.js | User login |
| POST | `/v1/auth/logout` | auth.js | Logout |
| GET | `/v1/users` | users-api.js | List users |
| POST | `/v1/users` | users-api.js | Create user |
| GET | `/v1/users/stats` | users-api.js | User statistics |
| GET | `/v1/users/roles` | users-api.js | Get roles |
| GET | `/v1/users/:id` | users-api.js | Get user by ID |
| PUT | `/v1/users/:id` | users-api.js | Update user |
| DELETE | `/v1/users/:id` | users-api.js | Delete user |
| POST | `/v1/users/:id/enable` | users-api.js | Enable user |
| POST | `/v1/users/:id/disable` | users-api.js | Disable user |
| POST | `/v1/users/:id/reset-password` | users-api.js | Reset password |
| GET | `/v1/approvals` | approval-api.js | List approvals |
| GET | `/v1/approvals/stats` | approval-api.js | Approval stats |
| GET | `/v1/approvals/:id` | approval-api.js | Get approval |
| POST | `/v1/approvals/:id/approve` | approval-api.js | Approve |
| POST | `/v1/approvals/:id/reject` | approval-api.js | Reject |
| POST | `/v1/approvals/:id/recount` | approval-api.js | Recount |
| GET | `/v1/auth/me` | settings-api.js | Current user profile |
| PUT | `/v1/users/profile` | settings-api.js | Update profile |
| POST | `/v1/auth/change-password` | settings-api.js | Change password |
| GET | `/v1/settings/system` | settings-api.js | System settings |
| GET | `/v1/settings/database` | settings-api.js | DB status |
| GET | `/v1/audit/logs` | settings-api.js | Audit logs |
| GET | `/kpi` | kpi.js | KPI data |
| GET | `/chart` | chart.js | Chart data |
| GET | `/mini-review` | mini-review.js | Mini review |
| GET | `/top-produk` | top-produk.js | Top products |
| GET | `/top-outlet` | top-outlet.js | Top outlets |
| GET | `/outlet-status` | outlet-status.js | Outlet status |
| GET | `/outlet-list` | outlet-list.js | Outlet list |
| GET | `/outlet-transaksi` | outlet-transaksi.js | Outlet transactions |
| GET | `/template-outlet` | template-outlet.js | Outlet template |
| GET | `/template-penjualan` | template-penjualan.js | Sales template |
| GET | `/template-pembelian` | template-pembelian.js | Purchase template |
| GET | `/template-stok_awal` | template-stok_awal.js | Initial stock template |
| GET | `/stok-sistem` | stok-sistem.js | System stock |
| GET | `/opname-history` | opname-history.js | SO history |
| GET | `/opname-perintah` | opname-perintah.js | SO commands |
| POST | `/opname-perintah` | opname-perintah.js | Create SO command |
| GET | `/opname-export` | stok-opname-export.js | Export SO |
| GET | `/persediaan` | persediaan.js | Inventory |
| GET | `/audit` | audit.js | Audit logs |
| GET | `/produk-list` | produk-list.js | Product list |
| GET | `/v3-dashboard` | v3-dashboard.js | V3 Dashboard |
| GET | `/v3-penjualan` | v3-penjualan.js | V3 Sales |
| GET | `/v3-persediaan` | v3-persediaan.js | V3 Inventory |
| GET | `/v3-opname` | v3-opname.js | V3 Opname |
| POST | `/v3-opname` | v3-opname.js | Create V3 Opname |
| PUT | `/v3-opname` | v3-opname.js | Update V3 Opname |
| GET | `/v3-opname-detail` | v3-opname-detail.js | V3 Opname detail |
| POST | `/v3-opname-detail` | v3-opname-detail.js | Save opname detail |
| GET | `/v3-chart` | v3-chart.js | V3 Chart |
| POST | `/add-penjualan` | add-penjualan.js | Add sale |
| POST | `/add-pembelian` | add-pembelian.js | Add purchase |
| POST | `/add-stok_awal` | add-stok_awal.js | Add initial stock |
| POST | `/add-outlet` | add-outlet.js | Add outlet |
| POST | `/import-penjualan` | import-penjualan.js | Import sales |
| POST | `/import-pembelian` | import-pembelian.js | Import purchases |
| POST | `/import-stok_awal` | import-stok_awal.js | Import initial stock |
| POST | `/import-outlet` | import-outlet.js | Import outlets |
| POST | `/simpan-opname` | simpan-opname.js | Save opname |
| POST | `/sesuaikan-opname` | sesuaikan-opname.js | Adjust opname |

---

## SECTION G - AUTH ANALYSIS

### Login User

**Endpoint:** `POST /api/v1/auth/login/user`

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user_id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "nama_lengkap": "Administrator",
    "role": "admin",
    "outlet_id": null,
    "login_as": "admin",
    "access_token": "base64.payload.signature",
    "refresh_token": "base64.payload.signature",
    "expires_in": 86400
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid username or password"
}
```

### Login Admin

**Endpoint:** `POST /api/v1/auth/login/admin`

**Request Body:** Same as user login

**Success Response:** Same structure

**Constraint:** Only accounts with `role: "admin"` can login via admin portal

### Logout

**Endpoint:** `POST /api/v1/auth/logout`

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

### Profile

**Endpoint:** `GET /api/v1/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "nama_lengkap": "Administrator",
    "role": "admin",
    "outlet_id": null,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "last_login": "2024-06-13T10:00:00.000Z",
    "failed_login_count": 0
  }
}
```

### Change Password

**Endpoint:** `POST /api/v1/auth/change-password`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "oldPassword": "string",
  "newPassword": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password berhasil diubah"
}
```

---

## SECTION H - DASHBOARD ANALYSIS

### 1. KPI List

| KPI ID | Label | Source API | Format |
|--------|-------|------------|--------|
| `kpi-stok-gudang` | Stok Gudang | `/api/v3-dashboard` → `stok.gudang.akhir` | Number |
| `kpi-total-produk` | Total Produk | `/api/v3-dashboard` → `produk.total` | Number |
| `kpi-total-outlet` | Total Outlet | `/api/v3-dashboard` → `outlet.total` | Number |
| `kpi-so-pending` | SO Pending | `/api/v3-dashboard` → `opname.berjalan` | Number |
| `kpi-stok-kritis` | Stok Kritis | `/api/v3-dashboard` → `stok.kritis` | Number |
| `kpi-distribusi` | Distribusi Hari Ini | `/api/v3-dashboard` → `distribusi.hari_ini.qty` | Number |
| `kpi-penjualan` | Penjualan Hari Ini | `/api/v3-dashboard` → `today.penjualan` | Number |
| `kpi-stok-outlet` | Stok Outlet | `/api/v3-dashboard` → `outlet.aktif` | Number |

### 2. Chart List

| Chart ID | Type | API | Data Source |
|----------|------|-----|-------------|
| `distributionChart` | Bar | `/api/v3-chart` | `distribusi.labels`, `distribusi.values` |

### 3. Table/List

| Container ID | Type | API | Content |
|--------------|------|-----|---------|
| `recentDistribution` | Activity List | `/api/v3-dashboard` | Recent distribution items |
| `stokKritisList` | Stok List | `/api/v3-persediaan` | Critical stock items |
| `recentActivity` | Activity List | `/api/v3-dashboard` | Recent activities |

### 4. API Endpoints Used

| Endpoint | Method | Used For |
|----------|--------|----------|
| `/api/v3-dashboard` | GET | All KPIs, distribution, activities |
| `/api/v3-chart` | GET | Distribution chart data |
| `/api/v3-persediaan` | GET | Critical stock list |

### 5. DOM IDs

| ID | Element Type | Purpose |
|----|---------------|---------|
| `currentDate` | div | Current date display |
| `currentDay` | div | Current day display |
| `kpi-stok-gudang` | div | Stok Gudang value |
| `kpi-total-produk` | div | Total Produk value |
| `kpi-total-outlet` | div | Total Outlet value |
| `kpi-so-pending` | div | SO Pending value |
| `kpi-stok-kritis` | div | Stok Kritis value |
| `kpi-distribusi` | div | Distribusi value |
| `kpi-penjualan` | div | Penjualan value |
| `kpi-stok-outlet` | div | Stok Outlet value |
| `distributionChart` | canvas | Chart canvas |
| `chartEmpty` | div | Empty state for chart |
| `stokKritisList` | div | Critical stock list container |
| `recentDistribution` | div | Recent distribution container |
| `recentActivity` | div | Recent activity container |

### 6. CSS Classes

| Class | Element | Location |
|-------|---------|----------|
| `.dashboard-page` | section | dashboard.html |
| `.welcome-card` | div | dashboard.html |
| `.hero-card` | div | dashboard.html |
| `.kpi-card` | div | dashboard.html |
| `.kpi-row` | div | dashboard.html |
| `.content-grid` | div | dashboard.html |
| `.card` | div | dashboard.html |
| `.activity-list` | div | dashboard.html |
| `.stok-list` | div | dashboard.html |

### 7. Inline Scripts

```javascript
// Date display update
updateDateDisplay()

// Main data loading
loadDashboardData()
  ├── loadKPIData()
  ├── loadDistributionChart()
  ├── loadRecentDistribution()
  ├── loadStokKritis()
  └── loadRecentActivity()

// Helper functions
formatNumber(num)
```

### 8. Dependency Map

```
dashboard.html
├── Inline Script
│   ├── loadDashboardData() → Promise.all([
│   │   ├── loadKPIData() → fetch('/api/v3-dashboard')
│   │   ├── loadDistributionChart() → fetch('/api/v3-chart')
│   │   ├── loadRecentDistribution() → fetch('/api/v3-dashboard')
│   │   ├── loadStokKritis() → fetch('/api/v3-persediaan')
│   │   └── loadRecentActivity() → fetch('/api/v3-dashboard')
│   └── formatNumber()
├── AppRouter
│   └── initDashboard() → initDashboard() from inline
├── Lucide Icons
│   └── createIcons() for rendered content
└── Chart.js (external CDN)
```

---

## SECTION I - DATABASE ANALYSIS

### Main Tables

| Table | Columns | Primary Key | Foreign Keys |
|-------|---------|-------------|--------------|
| `produk` | 4 | `sku` | - |
| `outlet` | 3 | `id` (SERIAL) | - |
| `penjualan` | 6 | `id` (SERIAL) | `sku → produk(sku)` |
| `pembelian` | 5 | `id` (SERIAL) | `sku → produk(sku)` |
| `stok_awal` | 4 | `id` (SERIAL) | `sku → produk(sku)` |
| `stok_penyesuaian` | 6 | `id` (SERIAL) | `sku → produk(sku)` |
| `stok_opname` | 10 | `id` (SERIAL) | `perintah_id → stok_opname_perintah(id)` |
| `stok_opname_detail` | 7 | `id` (SERIAL) | `opname_id → stok_opname(id)`, `sku → produk(sku)` |
| `stok_opname_perintah` | 12 | `id` (SERIAL) | `opname_id → stok_opname(id)` |

### Outlet Tables

| Table | Columns | Primary Key | Foreign Keys |
|-------|---------|-------------|--------------|
| `outlet_stok_awal` | 6 | `id` (SERIAL) | `outlet_id → outlet(id)`, `sku → produk(sku)` |
| `outlet_stok_masuk` | 10 | `id` (SERIAL) | `outlet_id → outlet(id)`, `sku → produk(sku)` |
| `outlet_penjualan` | 8 | `id` (SERIAL) | `outlet_id → outlet(id)`, `sku → produk(sku)` |
| `outlet_stok_penyesuaian` | 8 | `id` (SERIAL) | `outlet_id → outlet(id)`, `sku → produk(sku)` |
| `outlet_stok_opname` | 8 | `id` (SERIAL) | `outlet_id → outlet(id)` |
| `outlet_stok_opname_detail` | 6 | `id` (SERIAL) | `opname_id → outlet_stok_opname(id)`, `sku → produk(sku)` |

### Level Mapping Tables

| Table | Columns | Primary Key | Foreign Keys |
|-------|---------|-------------|--------------|
| `produk_level_mapping` | 6 | `id` (SERIAL) | `sku → produk(sku)` |
| `outlet_siswa_level_bulanan` | 6 | `id` (SERIAL) | `outlet_id → outlet(id)` |

### Dashboard Tables (Used by v3-dashboard.js)

| Table | Usage |
|-------|-------|
| `penjualan` | Daily sales count, outlet transactions |
| `pembelian` | Daily purchase qty |
| `produk` | Total product count |
| `outlet` | Total outlet count |
| `stok_awal` | Base stock calculation |
| `stok_opname_perintah` | SO running count, pending approval |
| `users` | Active user count |
| `outlet_stok_masuk` | Daily distribution qty |

### Inventory Tables (Used by persediaan/stok)

| Table | Usage |
|-------|-------|
| `produk` | Product master |
| `stok_awal` | Initial stock per SKU |
| `pembelian` | Purchase transactions |
| `penjualan` | Sales transactions |
| `stok_penyesuaian` | Stock adjustments |

### Opname Tables

| Table | Usage |
|-------|-------|
| `stok_opname_perintah` | SO commands/orders |
| `stok_opname` | SO execution records |
| `stok_opname_detail` | SO item details |
| `produk` | Products to opname |

### Views

| View | Purpose |
|------|---------|
| `vw_outlet_stock_monthly` | Monthly rolling stock per outlet |
| `vw_outlet_level_analysis` | Level-based analysis per outlet |

---

## SECTION J - LEGACY COMPARISON

| Legacy Feature | Exists Now | Missing | Rebuild Priority |
|----------------|------------|---------|-------------------|
| Dashboard KPI | YES | - | KEEP |
| Chart Distribusi | YES | - | KEEP |
| Chart Penjualan | YES | - | KEEP |
| Chart Pembelian | YES | - | KEEP |
| Forecast | NO | Missing | HIGH |
| Top Produk | YES | - | KEEP |
| Top Outlet | YES | - | KEEP |
| Monitor Outlet | YES | - | KEEP |
| Distribusi Outlet | YES | - | KEEP |
| Stok Gudang | YES | - | KEEP |
| Persediaan | YES | - | KEEP |
| Stock Opname | YES | - | KEEP |
| Perintah SO | YES | - | KEEP |
| Pelaksanaan SO | YES | - | KEEP |
| Riwayat SO | YES | - | KEEP |
| Pembelian | YES | - | KEEP |
| Import Data | YES | - | KEEP |
| User Management | YES | - | KEEP |
| Role-based Access | YES | - | KEEP |
| Audit Log | PARTIAL | Audit log viewer not connected | MEDIUM |
| Laporan | PARTIAL | Reports page exists but needs data | MEDIUM |
| Approval Workflow | PARTIAL | API exists but UI incomplete | MEDIUM |

---

## SECTION K - REBUILD READINESS

### KEEP (100%)

These files are production-ready and should NOT be modified:

```
backend/
├── auth.js                    # Authentication - solid
├── users-api.js               # User CRUD - complete
├── settings-api.js            # Profile/settings - complete
├── v3-dashboard.js            # Dashboard API - complete
├── v3-chart.js                # Chart API - complete
├── v3-opname.js               # Opname API - complete
├── v3-persediaan.js           # Inventory API - complete
├── v3-penjualan.js            # Sales API - complete
├── v3-opname-detail.js       # Opname detail - complete
├── approval-api.js            # Approval workflow - complete
├── opname-perintah.js         # SO commands - complete
├── persediaan.js              # Legacy inventory - keep for compatibility
├── kpi.js                     # Legacy KPI - keep for compatibility
└── [all other backend files]

api/
└── index.js                   # Router - solid

services/
├── auth.js                    # JWT service - complete
└── db.js                      # DB pool - solid

schema.sql                     # Database schema - solid
```

### REBUILD (Frontend)

These files need rebuild or major refactoring:

```
index.html                     # Landing page - minor cleanup needed
app.html                       # App shell - needs refactoring
pages/
├── dashboard.html             # Good but inline scripts could be modular
├── produk.html                # Missing API endpoint in router
├── stok-gudang.html           # Needs implementation
├── pembelian.html             # Needs full implementation
├── distribusi-outlet.html      # Needs full implementation
├── monitoring-outlet.html      # Needs full implementation
├── perintah-so.html           # Good structure
├── pelaksanaan-so.html        # Needs full implementation
├── riwayat-so.html            # Needs full implementation
├── laporan.html               # Needs full implementation
└── pengaturan.html            # Minor fixes needed

css/
├── design-system-v4.css       # Large, consider splitting
├── dashboard.css              # Consider CSS variables
├── landing.css                # OK
├── loader.css                 # OK
└── style.css                 # Consider merging

js/
├── app-router.js              # Good but could use lazy loading
└── [all inline scripts]       # Move to modular JS files
```

### RISK (Critical Endpoints)

These endpoints must be maintained to prevent breaking changes:

```
CRITICAL - DO NOT MODIFY:
├── POST /api/v1/auth/login/user     → auth.js
├── POST /api/v1/auth/login/admin   → auth.js
├── GET  /api/v3-dashboard          → v3-dashboard.js
├── GET  /api/v3-chart              → v3-chart.js
├── GET  /api/v3-persediaan          → v3-persediaan.js
├── GET  /api/v3-opname             → v3-opname.js
├── GET  /api/v1/users              → users-api.js
├── POST /api/v1/users              → users-api.js
└── PUT  /api/v1/users/:id          → users-api.js

MODERATE RISK:
├── GET /kpi                        → kpi.js (legacy)
├── GET /chart                      → chart.js (legacy)
├── GET /persediaan                 → persediaan.js (legacy)
├── GET /opname-perintah            → opname-perintah.js
└── POST /opname-perintah           → opname-perintah.js
```

---

## SECTION L - FINAL SCORE

### Backend Readiness: **95/100**

| Aspect | Score | Notes |
|--------|-------|-------|
| Authentication | 100 | JWT auth, password hashing, role-based access |
| User Management | 100 | Full CRUD, pagination, enable/disable/reset |
| Dashboard APIs | 100 | V3 dashboard, charts, real-time KPIs |
| Stock Opname | 100 | Commands, execution, details, approval flow |
| Inventory | 95 | Complete but some legacy overlap |
| Reports | 80 | API exists but reports page incomplete |
| Data Import | 100 | All import handlers complete |

**Notes:** Backend is production-ready. Minor improvement on report generation and audit log viewer.

### Database Readiness: **100/100**

| Aspect | Score | Notes |
|--------|-------|-------|
| Schema Design | 100 | Proper foreign keys, indexes, constraints |
| Stock Calculation | 100 | Rolling stock with adjustments |
| Opname Tables | 100 | Complete SO workflow tables |
| Views | 100 | Monthly rolling stock, level analysis |
| Migrations | 100 | Safe migrations with neon compatibility |

**Notes:** Database schema is well-designed with proper indexes and views.

### Frontend Readiness: **70/100**

| Aspect | Score | Notes |
|--------|-------|-------|
| Router/SPA | 90 | Good structure, needs lazy loading |
| Dashboard | 85 | Complete KPIs and charts |
| User Management | 90 | Full CRUD UI |
| Stock Opname | 75 | Commands done, execution incomplete |
| Product Management | 60 | UI exists, API endpoint missing |
| Settings/Profile | 75 | Basic functionality, needs polish |
| Reports | 40 | Page exists but no implementation |
| Mobile UX | 85 | Good responsive design |

**Notes:** Frontend has good structure but several pages need full implementation. Missing API endpoint for produk management.

---

## KESIMPULAN

### Strengths (apa yang sudah baik)

1. **Backend Solid** - Authentication, authorization, user management, dashboard APIs semua lengkap dan production-ready
2. **Database Schema** - Well-designed dengan proper indexes, foreign keys, dan views untuk rolling stock
3. **Design System** - CSS architecture yang modular dengan design-system-v4.css yang comprehensive
4. **Router** - SPA router yang solid dengan caching dan URL state management
5. **API Structure** - Consistent REST API dengan versioning (/v1/)

### Weaknesses (apa yang perlu diperbaiki)

1. **Frontend Incomplete** - Several pages exist but lack full implementation
2. **Missing API Endpoint** - `/api/v1/produk` endpoint not registered in api/index.js
3. **Inline Scripts** - Too much inline JavaScript in pages, should be modular
4. **Report Generation** - Laporan page exists but no real implementation
5. **Audit Log Viewer** - API exists but not connected to UI

### Recommended Actions

1. **CRITICAL:** Add missing `/api/v1/produk` endpoint
2. **HIGH:** Complete implementation for: laporan.html, pelaksanaan-so.html, riwayat-so.html
3. **MEDIUM:** Refactor inline scripts to modular JS files
4. **MEDIUM:** Connect audit log viewer to API
5. **LOW:** Add lazy loading to router for better performance

---

**Analysis Complete**
*Generated: June 13, 2026*