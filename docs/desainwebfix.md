# CV EPIC Warehouse - Web Design Fix Summary
## Dokumen Lengkap untuk Web Berfungsi Sempurna

**Version:** 1.0.0
**Date:** 2026-06-12
**Purpose:** Single source of truth untuk membuat web berfungsi sempurna

---

## 1. STRUKTUR UTAMA PROYEK

```
inventory-app-new/
├── index.html                 # Entry point utama (SATU SAJA)
├── js/
│   ├── dashboard.js          # Main SPA logic (180KB)
│   ├── dashboard-opname-perintah.js  # Opname workflow
│   └── user-management.js    # User CRUD
├── css/
│   ├── design-system.css     # Design tokens
│   └── style.css            # Main styles (HARUS DI-LOAD)
├── api/
│   └── index.js             # Route dispatcher (68 routes)
├── backend/
│   └── [37 handler files]  # API handlers
├── services/
│   └── db.js               # PostgreSQL connection pool
└── server.js                # Express entry point
```

---

## 2. HTML STRUCTURE - SEMUA TAB YANG DIPERLUKAN

### 16 Section Tabs (HARUS ADA di index.html):

| Line | Tab ID | Page | Status |
|------|--------|------|--------|
| 451 | `v3DashboardTab` | Admin Dashboard | ✅ |
| 553 | `opnameTab` | Stock Opname (Admin) | ✅ |
| 956 | `kpiTab` | Penjualan/KPI | ✅ |
| 972 | `persediaanTab` | Persediaan | ✅ |
| 992 | `forecastTab` | Forecast | ✅ |
| 1008 | `taskcenterTab` | Task Center | ✅ |
| 1028 | `approvalcenterTab` | Approval Center | ✅ |
| 1054 | `reportsTab` | Reports | ✅ |
| 1089 | `auditTab` | Audit | ✅ |
| 1108 | `operatorTab` | Operator Dashboard | ✅ |
| 1139 | `sotasksTab` | SO Tasks (User) | ✅ |
| 1158 | `sohistoryTab` | SO History (User) | ✅ |
| 1173 | `profileTab` | Profile | ✅ |
| 1207 | `usersTab` | User Management | ✅ |
| 1326 | `settingsTab` | Settings | ✅ |

### Modal yang Diperlukan:
1. **User Modal** (`#userModal`) - untuk Add/Edit User
2. **Settings Modal** - untuk various settings

---

## 3. JAVASCRIPT FUNCTIONS - PENTING

### Core Functions di dashboard.js:

```javascript
// Auth Functions
function isAuthenticated()
function performLogin(username, password, portal)
function performLogout()
function getStoredAuth()
function getCurrentUserRole()
function getAllowedMenus()
function canAccessMenu(menu)
function getDefaultMenuForRole()

// Navigation Functions
function selectMenu(event, menu)  // ROUTING UTAMA
function showOpnameTab(event, tabName)
function showModuleTab(event, module, subTab)
function toggleSubmenu(event, submenuId)

// Dashboard Functions
async function loadV3Dashboard()
async function loadKPI()
async function loadChart()
async function loadTopProduk()
async function loadTopOutlet()
async function loadMiniReview()
async function loadOutletTransactionMonitor()

// Inventory Functions
async function loadPersediaan()
async function loadAudit(section)
async function loadForecast()
async function loadProdukOptions()

// Opname Functions
async function loadOpnameKpiData()
async function loadStokSistem()
async function loadHistory()
async function loadPerintahList()
async function loadOperatorDashboard()
async function syncOpnamePeriodToLocal()

// Page Loaders
function loadTaskCenter()
function loadApprovalCenter()
function loadActivityTimeline()
function loadReportsPage()
function loadSettingsProfile()
function loadDatabaseStatus()
```

### Functions di user-management.js:

```javascript
async function loadUsersList()      // Load users dengan filter
function renderUsersTable(users)     // Render tabel
function openAddUserModal()         // Buka modal tambah
async function editUser(userId)     // Edit user
async function saveUser()           // Simpan (create/update)
async function deleteUser(userId)   // Hapus user
function closeUserModal()           // Tutup modal
function formatRole(role)           // Format role display
```

---

## 4. API ENDPOINTS - COMPLETE LIST

### Authentication (`/api/v1/auth/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/auth/login` | POST | Login |
| `/v1/auth/login/admin` | POST | Admin login |
| `/v1/auth/login/user` | POST | User login |
| `/v1/auth/logout` | POST | Logout |

### Users (`/api/v1/users/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/users` | GET | List users |
| `/v1/users` | POST | Create user |
| `/v1/users/:id` | GET | Get user |
| `/v1/users/:id` | PUT | Update user |
| `/v1/users/:id` | DELETE | Delete user |
| `/v1/users/stats` | GET | User stats |

### Dashboard
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/kpi` | GET | KPI data |
| `/chart` | GET | Chart data |
| `/v3-dashboard` | GET | V3 dashboard |
| `/mini-review` | GET | Mini review |
| `/top-produk` | GET | Top products |
| `/top-outlet` | GET | Top outlets |

### Inventory
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v3-persediaan` | GET | Stock list |
| `/stok-sistem` | GET | System stock |
| `/produk-list` | GET | Product list |
| `/forecast` | GET | Forecast data |

### Opname
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v3-opname` | GET/POST | Opname list/create |
| `/opname-perintah` | GET/POST | Commands |
| `/opname-history` | GET | History |
| `/simpan-opname` | POST | Save results |
| `/sesuaikan-opname` | POST | Adjust |
| `/opname-export` | GET | Export |

### Sales
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v3-penjualan` | GET | Sales list |
| `/add-penjualan` | POST | Add sale |
| `/import-penjualan` | POST | Import sales |
| `/template-penjualan` | GET | CSV template |

### Outlets
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/outlet-list` | GET | Outlet list |
| `/outlet-transaksi` | GET | Outlet transactions |
| `/add-outlet` | POST | Add outlet |
| `/import-outlet` | POST | Import outlets |

---

## 5. DATABASE STRUCTURE - 19 TABLES

### Master Tables:
```sql
produk (sku PK, nama_produk, harga_beli, harga_jual)
outlet (id PK, nama_outlet UNIQUE, created_at)
users (id PK, username UNIQUE, email UNIQUE/INDEX, password_hash, 
        nama_lengkap, role, outlet_id, is_active, last_login, created_at)
```

### Transaction Tables:
```sql
penjualan (id PK, tanggal, nama_outlet, sku FK, qty)
pembelian (id PK, tanggal, sku FK, qty)
stok_awal (id PK, sku FK, qty_awal)
stok_penyesuaian (id PK, sku FK, qty, tanggal)
```

### Opname Tables:
```sql
stok_opname (id PK, tanggal, checker, lokasi, keterangan, perintah_id FK)
stok_opname_detail (id PK, opname_id FK, sku FK, qty_fisik, qty_selisih)
stok_opname_perintah (id PK, kode_so UNIQUE, tanggal_perintah, bulan, tahun, 
                      svp_nama, status, kategori_targets)
```

### Outlet Tables:
```sql
outlet_stok_masuk (id PK, outlet_id FK, sku FK, qty, ref_penjualan_id)
outlet_stok_awal (id PK, outlet_id FK, sku FK, qty, periode)
```

---

## 6. ROLE SYSTEM - 3 ROLES

| Role | Code | Access Level |
|------|------|--------------|
| Admin | `admin` | Full access - semua menu |
| Staff Gudang | `staff_gudang` | Warehouse operations, opname |
| Checker Opname | `checker_opname` | Stock counting only |

### Valid Menu IDs:
```javascript
const VALID_MENUS = [
  "dashboard", "admin", "penjualan", "persediaan",
  "forecast", "opname", "taskcenter", "approvalcenter",
  "activity", "audit", "reports", "users", "settings",
  "mydashboard", "sotasks", "sohistory", "profile"
];

const ADMIN_MENUS = [
  "dashboard", "admin", "penjualan", "persediaan",
  "forecast", "opname", "taskcenter", "approvalcenter",
  "activity", "audit", "reports", "users", "settings"
];
```

---

## 7. NAVIGATION STRUCTURE V4

### Admin Sidebar (8 Menus):
1. **Dasbor** - Dashboard
2. **Operasional** → Penyedia, Stok Opname
3. **Manajemen** → Pengguna, Pengaturan
4. **Task Center** - Hidden but functional
5. **Approval Center** - Hidden but functional
6. **Reports** - Hidden but functional
7. **Audit** - Hidden but functional
8. **Settings** - Hidden but functional

### User Sidebar:
1. **Dasbor Saya** → mydashboard
2. **Tugas** → sotasks
3. **Riwayat** → sohistory
4. **Profil** → profile

### selectMenu() Routing:
```javascript
if (menu === "dashboard" || menu === "admin") → v3DashboardTab
if (menu === "penjualan") → kpiTab
if (menu === "persediaan") → persediaanTab
if (menu === "forecast") → forecastTab
if (menu === "opname" && role === 'admin') → opnameTab
if (menu === "opname" && role !== 'admin') → operatorTab
if (menu === "taskcenter") → taskcenterTab
if (menu === "approvalcenter") → approvalcenterTab
if (menu === "audit") → auditTab
if (menu === "reports") → reportsTab
if (menu === "users") → usersTab
if (menu === "settings") → settingsTab
if (menu === "mydashboard") → operatorTab
if (menu === "sotasks") → taskcenterTab
if (menu === "sohistory") → sohistoryTab
if (menu === "profile") → profileTab
```

---

## 8. DESIGN TOKENS - CSS VARIABLES

```css
:root {
  /* Colors */
  --primary: #2563EB;
  --primary-dark: #1D4ED8;
  --success: #10B981;
  --warning: #F59E0B;
  --error: #EF4444;
  --background: #F8FAFC;
  --surface: #FFFFFF;
  --border: #E2E8F0;
  --text-primary: #1E293B;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;

  /* Spacing */
  --xs: 4px;
  --sm: 8px;
  --md: 12px;
  --lg: 16px;
  --xl: 24px;
  --2xl: 32px;
  --3xl: 48px;

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-h1: 32px;
  --font-size-h2: 28px;
  --font-size-h3: 24px;
  --font-size-h4: 20px;
  --font-size-body: 14px;
  --font-size-small: 12px;
  --font-size-caption: 11px;

  /* Layout */
  --header-height: 64px;
  --sidebar-width: 240px;
  --bottom-nav-height: 56px;

  /* Breakpoints */
  --mobile: 640px;
  --tablet: 1024px;
}
```

---

## 9. CSS FILES - HARUS DI-LOAD

### index.html HEAD:
```html
<link rel="stylesheet" href="/css/design-system.css?v=v3-20260610">
<link rel="stylesheet" href="/css/style.css?v=v3-20260610">
```

### JavaScript Order:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
<script src="/js/dashboard.js?v=opname-history-20260521e"></script>
<script src="/js/user-management.js"></script>
```

---

## 10. KEY FIXES YANG DIPERLUKAN

### Critical Fixes:
1. **#usersTab** - TAMBAHKAN (sudah ada di index.html line 1207)
2. **#settingsTab** - TAMBAHKAN (sudah ada di index.html line 1326)
3. **#operatorTab** - Pastikan ada konten (loadOperatorDashboard)
4. **style.css** - HARUS di-load di index.html (sudah ditambahkan)
5. **user-management.js** - HARUS di-load (sudah dibuat)

### user-management.js Functions:
- loadUsersList() - dengan filter search, role, status
- renderUsersTable() - render tabel dengan action buttons
- openAddUserModal() - buka modal tambah user
- editUser() - populate form dengan data user
- saveUser() - POST/PUT ke /v1/users
- deleteUser() - DELETE ke /v1/users/:id
- closeUserModal() - hide modal

### API Integration:
```javascript
// Load users
fetch('/v1/users?search=xxx&role=admin&is_active=true')

// Save user (create)
POST /v1/users
{ username, email, name, password, role, is_active }

// Save user (update)
PUT /v1/users/:id
{ username, email, name, role, is_active }

// Delete user
DELETE /v1/users/:id
```

---

## 11. FILE STRUCTURE - YANG PERLU ADA

### Frontend:
- ✅ index.html (entry point)
- ✅ css/design-system.css
- ✅ css/style.css
- ✅ js/dashboard.js
- ✅ js/dashboard-opname-perintah.js
- ✅ js/user-management.js (DIBUAT)
- ✅ js/sidebar-ui.js

### Backend:
- ✅ api/index.js
- ✅ backend/auth.js
- ✅ backend/users-api.js
- ✅ backend/kpi.js
- ✅ backend/chart.js
- ✅ backend/v3-dashboard.js
- ✅ backend/v3-opname.js
- ✅ backend/opname-perintah.js
- ✅ backend/simpan-opname.js
- ✅ backend/opname-history.js
- ✅ backend/v3-penjualan.js
- ✅ backend/v3-persediaan.js
- ✅ backend/forecast.js
- ✅ backend/audit.js
- ✅ backend/approval-api.js
- ✅ backend/settings-api.js

### Database:
- ✅ services/db.js
- ✅ schema.sql
- ✅ migration_*.sql

---

## 12. STOK OPNAME WORKFLOW

### Perintah SO Flow:
```
1. Buat Perintah → POST /v1/opname-perintah
   - kode_so (unique)
   - tanggal_perintah
   - bulan, tahun
   - svp_nama (nama SVP)
   - lokasi
   - kategori_targets

2. Aktifkan → PUT /v1/opname-perintah/:id (status: aktif)

3. Scan/Input → POST /v1/simpan-opname
   - items: [{sku, qty_fisik}]
   - checker
   - lokasi

4. Selesai → PUT /v1/opname-perintah/:id (status: selesai)

5. Sesuaikan → POST /v1/sesuaikan-opname
   - opname_id
   - Apply to stok_penyesuaian
```

---

## 13. APPROVAL WORKFLOW

### Approval Types:
1. **User Registration** - New signup pending admin approval
2. **Opname Results** - Checker submission pending review
3. **Stock Adjustment** - Manual adjustment pending approval
4. **Data Import** - Bulk import preview pending approval

### Approval Actions:
- **Approve** → POST /v1/approvals/:id/approve
- **Reject** → POST /v1/approvals/:id/reject
- **Request Changes** → POST /v1/approvals/:id/recount

---

## 14. RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, bottom nav |
| Tablet | 640-1024px | Collapsible sidebar |
| Desktop | > 1024px | Full sidebar, multi-column |

### Mobile Bottom Nav:
| Icon | Label | Action |
|------|-------|--------|
| 🏠 | Home | /mydashboard |
| 📋 | Tasks | /mytasks |
| 🔢 | Opname | /opname/scan |
| ✓ | Approval | /approval |
| ⚙ | Settings | /profile |

---

## 15. CSS CLASSES YANG DIPERLUKAN

### Cards:
```css
.card { background: white; border: 1px solid var(--border); 
       border-radius: 8px; padding: 24px; }
.card-header { font-weight: 600; margin-bottom: 16px; }
.card-body { /* content */ }
.card-footer { /* actions */ }
```

### Buttons:
```css
.btn-primary { background: var(--primary); color: white; }
.btn-secondary { background: var(--background); border: 1px solid var(--border); }
.btn-danger { background: var(--error); color: white; }
.btn-icon { /* icon only buttons */ }
```

### Tables:
```css
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { background: var(--background); font-weight: 600; 
                padding: 12px 16px; text-align: left; }
.data-table td { padding: 12px 16px; border-bottom: 1px solid var(--border); }
.data-table tr:hover { background: var(--background); }
```

### Modals:
```css
.modal { display: none; position: fixed; top: 0; left: 0; 
         width: 100%; height: 100%; background: rgba(0,0,0,0.5); 
         justify-content: center; align-items: center; }
.modal__content { background: white; border-radius: 8px; 
                  max-width: 500px; width: 90%; }
.modal__header { padding: 16px 24px; border-bottom: 1px solid var(--border); }
.modal__body { padding: 24px; }
.modal__footer { padding: 16px 24px; border-top: 1px solid var(--border); 
                display: flex; justify-content: flex-end; gap: 12px; }
```

### Status Badges:
```css
.status-active { background: var(--success); color: white; }
.status-inactive { background: var(--text-muted); color: white; }
.role-admin { background: var(--primary); color: white; }
.role-staff_gudang { background: var(--warning); color: white; }
.role-checker_opname { background: var(--text-secondary); color: white; }
```

---

## 16. VALIDATION RULES

### User Registration:
- Username: 3-50 chars, alphanumeric, unique
- Email: valid format, unique
- Password: min 8 chars, 1 uppercase, 1 number
- Nama Lengkap: 2-100 chars
- Role: admin, staff_gudang, checker_opname

### Opname Command:
- Kode SO: unique, format (SO-YYYY-NNN)
- Tanggal: valid date
- SVP Nama: required
- Kategori targets: modul, seragam, poster, lain_lain

### Sales/Purchase Input:
- Tanggal: valid date
- SKU: must exist in produk table
- Qty: positive integer

---

## 17. ERROR HANDLING

### API Error Responses:
```javascript
// Success
{ success: true, data: {...}, message: "Success" }

// Error
{ success: false, error: "Error message", code: "ERROR_CODE" }

// HTTP Status
400 - Bad Request (validation error)
401 - Unauthorized (not logged in)
403 - Forbidden (no permission)
404 - Not Found
500 - Server Error
```

### Frontend Error Handling:
```javascript
async function fetchJson(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    showToast(error.message, false);
    throw error;
  }
}
```

---

## 18. LOCAL STORAGE KEYS

```javascript
const AUTH_STORAGE_KEY = 'epic_auth';
const MENU_STORAGE_KEY = 'epic_menu';
const PERIOD_STORAGE_KEY = 'epic_period';
```

---

## 19. CHECKLIST UNTUK WEB BERFUNGSI

### HTML:
- [x] index.html (single entry point)
- [x] All 16 section tabs present
- [x] User modal (#userModal)
- [x] CSS links (design-system.css, style.css)
- [x] JS scripts (dashboard.js, user-management.js)

### JavaScript:
- [x] selectMenu() function (routing)
- [x] loadUsersList() function
- [x] saveUser() function
- [x] editUser() function
- [x] deleteUser() function
- [x] loadV3Dashboard() function
- [x] loadOpnameKpiData() function
- [x] showOpnameTab() function

### API:
- [x] Auth endpoints working
- [x] Users CRUD endpoints
- [x] Dashboard endpoints
- [x] Opname endpoints

### Database:
- [x] users table
- [x] produk table
- [x] outlet table
- [x] penjualan table
- [x] stok_opname tables

### Styling:
- [x] CSS variables defined
- [x] Design tokens applied
- [x] Responsive breakpoints set

---

## 20. QUICK REFERENCE

### Login Credentials (Test):
- Admin: username `admin`, password `admin123`
- User: username `checker`, role `checker_opname`

### Database Connection:
```javascript
// services/db.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3
});
```

### URL Structure:
```
/                       → Login page
/dashboard             → Admin dashboard
/mydashboard           → User dashboard
/opname                → Stock opname
/users                 → User management
/settings             → System settings
```

---

**Document Version:** 1.0.0
**Last Updated:** 2026-06-12
**Source:** docs/MASTER_INDEX.md, docs/PROJECT-AUDIT.md, docs/NAVIGATION-V4.md, docs/API-AUDIT.md, docs/DATABASE-MAP.md, docs/UI-WIREFRAME-V4.md, docs/DESIGN-SYSTEM.md