# CV EPIC Warehouse - Inventory Control Suite V4

## Project Overview

**Project Name:** CV EPIC Warehouse Inventory Control Suite  
**Version:** V3 → V4 (in progress)  
**Platform:** Node.js/Express + PostgreSQL (Neon)  
**Deployment:** Vercel Serverless Functions  
**Architecture Score:** 3.95/10 (needs improvement)

---

## Project Identity

- **Entry Point:** `index.html` (PRIMARY - only one)
- **Server:** `server.js` → `api/index.js` → `backend/*.js`
- **Database:** PostgreSQL via `services/db.js` (connection pool max 3)
- **Frontend:** Vanilla JavaScript SPA (no framework)

### CSS Files (loaded in index.html)
- `/css/design-system.css` - Design tokens
- `/css/style.css` - Main styles

---

## Database Structure (PostgreSQL/Neon)

### Core Tables (19 tables, 2 views)

| Table | Primary Key | Purpose |
|-------|-------------|---------|
| `produk` | `sku` (text) | Master produk |
| `outlet` | `id` (serial) | Master outlet/gerai |
| `users` | `id` (serial) | User login |
| `penjualan` | `id` (serial) | Transaksi penjualan |
| `pembelian` | `id` (serial) | Transaksi pembelian |
| `stok_awal` | `id` (serial) | Stok awal gudang |
| `stok_penyesuaian` | `id` (serial) | Penyesuaian stok |
| `stok_opname` | `id` (serial) | Header stock opname |
| `stok_opname_detail` | `id` (serial) | Detail stock opname |
| `stok_opname_perintah` | `id` (serial) | Perintah stock opname |
| `outlet_stok_masuk` | `id` (serial) | Stok masuk outlet |
| `produk_level_mapping` | `id` (serial) | Mapping produk ke level |
| `outlet_siswa_level_bulanan` | `id` (serial) | Siswa level per bulan |

### Key Relationships

```
produk(sku)
  ├─ penjualan.sku, pembelian.sku, stok_awal.sku
  ├─ stok_opname_detail.sku, outlet_stok_*.sku

outlet(id)
  └─ outlet_stok_masuk.outlet_id, outlet_siswa_level_bulanan.outlet_id

stok_opname(id) ←→ stok_opname_perintah(id)
```

### Product Categories (from data)

| Category | Pattern | Count |
|----------|---------|-------|
| MODUL | `nama_produk ILIKE 'MODUL%'` | 25 |
| TAS | `nama_produk ILIKE 'TAS%'` | 1 |
| SERAGAM | Contains "merah", "kuning", "biru" | 32 |
| LAIN-LAIN | Default | 41 |

---

## Feature Inventory (50 Features)

### Core Features
1. Login/Logout - Authentication
2. Role-based menu access
3. Dashboard with KPI
4. Sales chart & monitoring
5. Top products/outlets
6. Outlet status & transactions
7. Master data (produk, outlet)
8. Sales/purchase input & import
9. Persediaan/stock overview
10. Stock warning/restock
11. Audit outlet/stock
12. Forecasting

### Stock Opname Features
- Perintah SO (create, edit, activate, complete)
- Kategori target opname
- Scan/input stok opname
- Save opname results
- History opname
- Adjust from opname
- Export/import opname

### Hidden Features (need UI)
- Task Center
- Approval Center
- Activity Timeline
- Reports
- User Management (needs tab)
- Settings (needs tab)

---

## Role System

| Role | Code | Access Level |
|------|------|--------------|
| **Admin** | `admin` | Full access - all menus |
| **Staff Gudang** | `staff_gudang` | Warehouse operations, opname |
| **Checker Opname** | `checker_opname` | Stock counting only |

### Role Distribution
- Admin sidebar: 8 main menus
- User sidebar: My Dashboard, Tasks, Opname, Profile

---

## Navigation Structure V4

### 8 Main Menus (Admin)
1. **Dasbor** - Dashboard overview
2. **Task Center** - Tasks and assignments
3. **Warehouse** - Persediaan, Produk, Outlet, Penjualan, Pembelian
4. **Stock Opname** - Perintah, Input/Scan, Hasil, History, Export
5. **Approval** - Pending, Approved, Rejected
6. **Reports** - Laporan Stok, Penjualan, Opname, Export
7. **Audit** - Log Aktivitas, Audit Stok, Data Integrity
8. **Settings** - Profil Perusahaan, Manajemen User, Roles, Keamanan, Database, Audit Logs

### User Sidebar
- My Dashboard
- My Tasks
- Stock Opname
- My Reports
- Profile

### Valid Menu IDs
```javascript
const VALID_MENUS = [
  "dashboard", "admin", "penjualan", "persediaan",
  "forecast", "opname", "taskcenter", "approvalcenter",
  "activity", "audit", "reports"
];
```

---

## Implementation Roadmap (6 Phases)

| Phase | Focus | Duration | Priority |
|-------|-------|----------|----------|
| Phase A | Navigation | 1 week | Critical |
| Phase B | Dashboard | 1 week | High |
| Phase C | Users | 1 week | High |
| Phase D | Approval Center | 1 week | High |
| Phase E | Settings | 1 week | Medium |
| Phase F | Role Security | 1 week | Critical |

---

## Critical Technical Debt

### High Priority
1. Delete `/public/` folder (duplicate files)
2. Delete `index-v3.html`, `index-refactored.html` (duplicates)
3. Remove Flask legacy code (`flask_app/`, `app.py`, `config.py`)
4. Add API authorization middleware
5. Split monolithic `dashboard.js`

### Medium Priority
6. Add OpenAPI documentation
7. Implement centralized error handling
8. Add request validation (Joi/Zod)
9. Add rate limiting on auth endpoints

---

## API Endpoints Summary

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout

### Dashboard
- `GET /api/kpi` - KPI data
- `GET /api/chart` - Chart data
- `GET /api/v3-dashboard` - V3 dashboard

### Inventory
- `GET /api/v3-persediaan` - Stock list
- `GET /api/stok-sistem` - System stock
- `GET /api/produk-list` - Product list

### Sales
- `GET /api/v3-penjualan` - Sales list
- `POST /api/add-penjualan` - Add sale
- `POST /api/import-penjualan` - Import sales

### Opname
- `GET /api/v3-opname` - Opname list
- `POST /api/opname-perintah` - Create/update command
- `POST /api/simpan-opname` - Save results
- `GET /api/opname-history` - History
- `POST /api/sesuaikan-opname` - Adjust

---

## Design System Tokens

### Colors
- Primary: #2563EB
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444

### Typography
- H1: 32px, 700
- H2: 28px, 600
- H3: 24px, 600
- Body: 14px, 400

### Spacing
- xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, 2xl: 32px, 3xl: 48px

### Breakpoints
- Desktop: >= 1024px
- Tablet: 600px - 1023px
- Mobile: < 600px

---

## Files Reference

### Entry Points
- `/index.html` - PRIMARY entry point

### Frontend (Active)
- `/js/dashboard.js` - Main SPA logic
- `/js/dashboard-opname-perintah.js` - Opname workflow
- `/js/user-management.js` - User management (CRUD)
- `/js/sidebar-ui.js` - Sidebar interactions

### Backend (Active)
- `/api/index.js` - Route dispatcher (38 routes)
- `/backend/auth.js` - Authentication
- `/backend/kpi.js`, `/backend/chart.js` - Dashboard data
- `/backend/v3-*.js` - V3 versions
- `/backend/opname-*.js` - Opname handlers
- `/backend/import-*.js`, `/backend/add-*.js` - CRUD

### CSS (Active)
- `/css/design-system.css` - Design tokens
- `/css/style.css` - Main styles (164KB)

### Database
- `/services/db.js` - PostgreSQL pool

### Legacy (CLEANED)
- `/public/` - Already removed (not in repo)
- `/flask_app/` - Already removed (not in repo)
- `/app.py`, `/config.py` - Already removed (not in repo)
- `/alembic/` - Already removed (not in repo)
- `/index-v3.html`, `/index-refactored.html` - Already removed (not in repo)

---

## Version Info

- Last updated: 2026-06-12
- Based on: docs/MASTER_INDEX.md
- Cleanup completed: Missing `user-management.js` created, CSS files linked, all tabs verified