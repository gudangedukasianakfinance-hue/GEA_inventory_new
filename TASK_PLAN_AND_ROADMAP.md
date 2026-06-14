# 📋 TASK PLAN & DEVELOPMENT ROADMAP
## CV EPIC Warehouse - Modul Inti Implementation

**Date:** 2026-06-14  
**Version:** 3.0.0  
**Priority:** Modul Inti (Tanpa modifikasi Dashboard V3)

---

## 1. AUDIT RESULTS

### 1.1 Database Structure (Already Exists)

#### Core Tables
| Table | Purpose | Status |
|-------|---------|--------|
| `produk` | Master produk (SKU, nama, harga) | ✅ Ready |
| `outlet` | Master outlet/customer | ✅ Ready |
| `penjualan` | Transaksi penjualan warehouse | ✅ Ready |
| `pembelian` | Transaksi pembelian | ✅ Ready |
| `stok_awal` | Stok awal per SKU | ✅ Ready |
| `stok_penyesuaian` | Penyesuaian stok | ✅ Ready |

#### Outlet Tables
| Table | Purpose | Status |
|-------|---------|--------|
| `outlet_stok_awal` | Stok awal per outlet | ✅ Ready |
| `outlet_stok_masuk` | barang masuk ke outlet | ✅ Ready |
| `outlet_penjualan` | Penjualan per outlet | ✅ Ready |
| `outlet_stok_penyesuaian` | Penyesuaian stok outlet | ✅ Ready |

---

### 1.2 Existing APIs

#### ✅ FULL CRUD APIs (Ready to use)
| Endpoint | Method | Handler | Status |
|----------|--------|---------|--------|
| `/v1/users` | GET, POST | users-api.js | ✅ OK |
| `/v1/users/:id` | GET, PUT, DELETE | users-api.js | ✅ OK |
| `/v1/produk` | GET, POST, PUT, DELETE | produk-list.js | ✅ OK |
| `/v3-dashboard` | GET | v3-dashboard.js | ✅ OK |
| `/v3-penjualan` | GET | v3-penjualan.js | ✅ OK (Read-only) |
| `/v3-persediaan` | GET | v3-persediaan.js | ✅ OK (Read-only) |
| `/opname-perintah` | GET, POST | opname-perintah.js | ✅ OK |
| `/opname-history` | GET | opname-history.js | ✅ OK |
| `/v1/auth/change-password` | POST | settings-api.js | ✅ OK |

#### ⚠️ PARTIAL APIs (Add/Create only)
| Endpoint | Method | Handler | Status | Missing |
|----------|--------|---------|--------|---------|
| `/add-penjualan` | POST | add-penjualan.js | ⚠️ Create only | GET list, PUT, DELETE |
| `/add-pembelian` | POST | add-pembelian.js | ⚠️ Create only | GET list, PUT, DELETE |
| `/add-outlet` | POST | add-outlet.js | ⚠️ Create only | GET list, PUT, DELETE |
| `/persediaan` | GET | persediaan.js | ⚠️ Read only | Full CRUD for mutation |

#### ❌ MISSING APIs (Need to create)
| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/v1/penjualan` | GET, PUT, DELETE | CRUD Penjualan | P1 |
| `/v1/pembelian` | GET, PUT, DELETE | CRUD Pembelian | P2 |
| `/v1/outlet` | GET, PUT, DELETE | CRUD Outlet | P2 |
| `/v1/stok/mutasi` | GET | Mutasi stok | P3 |
| `/v1/stok/kartu` | GET | Kartu stok | P3 |
| `/v1/stok/realtime` | GET | Stok realtime | P3 |

---

### 1.3 Missing Page Files

| Page | Route | Status | Priority |
|------|-------|--------|----------|
| `pages/penjualan.html` | `/app.html?page=penjualan` | ❌ MISSING | P1 |
| `pages/persediaan.html` | `/app.html?page=persediaan` | ❌ MISSING | P3 |
| `pages/forecasting.html` | `/app.html?page=forecasting` | ❌ MISSING | Deprecated |
| `pages/dashboard-so.html` | `/app.html?page=dashboard-so` | ❌ MISSING | N/A |

---

### 1.4 Existing Page Files (Partial)

| Page | File | Status | Issues |
|------|------|--------|--------|
| pembelian.html | pages/pembelian.html | ⚠️ Partial | UI exists, no CRUD API |
| stok-gudang.html | pages/stok-gudang.html | ⚠️ Partial | UI exists, no API |

---

## 2. TASK BREAKDOWN BY PRIORITY

### ═══════════════════════════════════════════════════════
### PRIORITY 1: PENJUALAN (Sales)
### ═══════════════════════════════════════════════════════

#### Tasks
| # | Task | Type | Est. Time | Status |
|---|------|------|-----------|--------|
| 1.1 | Create API Handler: CRUD Penjualan | Backend | 2 hours | TODO |
| 1.2 | Register API routes in api/index.js | Backend | 15 min | TODO |
| 1.3 | Create pages/penjualan.html | Frontend | 3 hours | TODO |
| 1.4 | Test full CRUD flow | Testing | 1 hour | TODO |

#### API Design: `/v1/penjualan`
```
GET    /v1/penjualan              - List all (with pagination, filters)
GET    /v1/penjualan/:id          - Get single
POST   /v1/penjualan              - Create (existing: /add-penjualan)
PUT    /v1/penjualan/:id          - Update
DELETE /v1/penjualan/:id          - Delete
```

#### Features Required
- [ ] Filter by date range (tanggal_awal, tanggal_akhir)
- [ ] Filter by outlet (nama_outlet)
- [ ] Filter by SKU (sku)
- [ ] Search by outlet name
- [ ] Pagination (page, limit)
- [ ] List view with edit/delete actions
- [ ] Form modal for create/edit
- [ ] Confirm delete dialog

**Estimated Time: 6-8 hours**

---

### ═══════════════════════════════════════════════════════
### PRIORITY 2: PEMBELIAN (Purchases)
### ═══════════════════════════════════════════════════════

#### Tasks
| # | Task | Type | Est. Time | Status |
|---|------|------|-----------|--------|
| 2.1 | Create API Handler: CRUD Pembelian | Backend | 2 hours | TODO |
| 2.2 | Register API routes in api/index.js | Backend | 15 min | TODO |
| 2.3 | Update pages/pembelian.html | Frontend | 2 hours | TODO |
| 2.4 | Test full CRUD flow | Testing | 1 hour | TODO |

#### API Design: `/v1/pembelian`
```
GET    /v1/pembelian              - List all (with pagination, filters)
GET    /v1/pembelian/:id          - Get single
POST   /v1/pembelian              - Create (existing: /add-pembelian)
PUT    /v1/pembelian/:id          - Update
DELETE /v1/pembelian/:id          - Delete
```

#### Features Required
- [ ] Filter by date range
- [ ] Filter by SKU
- [ ] Search by SKU
- [ ] Pagination
- [ ] List view with edit/delete
- [ ] Form modal for create/edit
- [ ] Confirm delete

**Estimated Time: 5-6 hours**

---

### ═══════════════════════════════════════════════════════
### PRIORITY 3: PERSEDIAAN (Inventory)
### ═══════════════════════════════════════════════════════

#### Tasks
| # | Task | Type | Est. Time | Status |
|---|------|------|-----------|--------|
| 3.1 | Create API: Kartu Stok | Backend | 3 hours | TODO |
| 3.2 | Create API: Mutasi Stok | Backend | 2 hours | TODO |
| 3.3 | Create API: Stok Realtime | Backend | 2 hours | TODO |
| 3.4 | Register API routes | Backend | 30 min | TODO |
| 3.5 | Create pages/persediaan.html | Frontend | 4 hours | TODO |
| 3.6 | Test all inventory features | Testing | 2 hours | TODO |

#### API Design: Inventory

**Kartu Stok (`/v1/stok/kartu`)**
```
GET /v1/stok/kartu?sku=XXX&bulan=6&tahun=2026
Response:
{
  sku: "SKU001",
  nama_produk: "Produk A",
  kartu: [
    { tanggal, keterangan, masuk, keluar, saldo }
  ]
}
```

**Mutasi Stok (`/v1/stok/mutasi`)**
```
GET /v1/stok/mutasi?bulan=6&tahun=2026&kategori=all
Response:
{
  periode: { bulan, tahun },
  mutasi: [
    { sku, nama_produk, stok_awal, masuk, keluar, penyesuaian, stok_akhir }
  ]
}
```

**Stok Realtime (`/v1/stok/realtime`)**
```
GET /v1/stok/realtime?kategori=modul
Response:
{
  produk: [
    { sku, nama_produk, kategori, stok, stok_minimum, status }
  ],
  ringkasan: { total_sku, total_unit, stok_rendah, stok_aman }
}
```

#### Features Required
- [ ] Tab: Kartu Stok (per SKU)
- [ ] Tab: Mutasi Stok (all SKU by period)
- [ ] Tab: Stok Realtime (current stock)
- [ ] Filter by kategori
- [ ] Filter by date range
- [ ] Search by SKU/Nama
- [ ] Export to CSV
- [ ] Alert for low stock

**Estimated Time: 13-16 hours**

---

## 3. DEVELOPMENT ROADMAP

### Phase 1: Penjualan (Week 1)
```
Day 1-2: Backend CRUD API + Route Registration
Day 3-4: Frontend HTML/JS + Integration
Day 5:   Testing + Bug Fixes
```

### Phase 2: Pembelian (Week 2)
```
Day 1:   Backend CRUD API + Route Registration
Day 2:   Update existing HTML + Integration
Day 3:   Testing + Bug Fixes
```

### Phase 3: Persediaan (Week 3-4)
```
Day 1-2: Backend APIs (Kartu, Mutasi, Realtime)
Day 3-4: Frontend HTML with tabs
Day 5:   Integration + Testing
Day 6-7: Polish + Bug Fixes
```

---

## 4. FILE STRUCTURE TO CREATE/MODIFY

### Backend Files (Create/Modify)
```
backend/
├── api-penjualan.js      [NEW - CRUD handler]
├── api-pembelian.js      [NEW - CRUD handler]
├── stok-kartu.js         [NEW - Kartu stok]
├── stok-mutasi.js        [NEW - Mutasi stok]
├── stok-realtime.js      [NEW - Realtime stock]
└── api/index.js          [MODIFY - Add routes]
```

### Frontend Files (Create/Modify)
```
pages/
├── penjualan.html        [NEW - Full page]
├── persediaan.html       [NEW - Full page]
└── pembelian.html        [MODIFY - Add CRUD]
```

---

## 5. ESTIMATED TOTAL WORK

| Module | Backend | Frontend | Testing | Total |
|--------|---------|----------|---------|-------|
| Penjualan | 2.5 hrs | 3 hrs | 1.5 hrs | **7 hrs** |
| Pembelian | 2.5 hrs | 2 hrs | 1.5 hrs | **6 hrs** |
| Persediaan | 8 hrs | 4 hrs | 2 hrs | **14 hrs** |
| **TOTAL** | **13 hrs** | **9 hrs** | **5 hrs** | **27 hrs** |

---

## 6. EXECUTION PLAN

### Step 1: Create Penjualan API Handler
```javascript
// File: backend/api-penjualan.js
// Methods: GET list, GET by id, POST create, PUT update, DELETE
```

### Step 2: Register Routes
```javascript
// File: api/index.js
// Add: GET/POST/PUT/DELETE /v1/penjualan
```

### Step 3: Create Penjualan Page
```html
<!-- File: pages/penjualan.html -->
<!-- Features: Filter bar, data table, form modal -->
```

### Step 4: Create Pembelian API Handler
```javascript
// File: backend/api-pembelian.js
// Methods: GET list, GET by id, POST create, PUT update, DELETE
```

### Step 5: Update Pembelian Page
```html
<!-- File: pages/pembelian.html -->
<!-- Add CRUD functionality -->
```

### Step 6: Create Persediaan APIs
```javascript
// Files: stok-kartu.js, stok-mutasi.js, stok-realtime.js
```

### Step 7: Create Persediaan Page
```html
<!-- File: pages/persediaan.html -->
<!-- Tabs: Kartu Stok, Mutasi, Realtime -->
```

---

## 7. BACKWARDS COMPATIBILITY

### Keep Existing APIs Working
| Endpoint | Action |
|----------|--------|
| `/add-penjualan` | Keep as alias to POST /v1/penjualan |
| `/add-pembelian` | Keep as alias to POST /v1/pembelian |
| `/v3-penjualan` | Keep for dashboard analytics |
| `/v3-persediaan` | Keep for dashboard analytics |

---

## 8. SUCCESS CRITERIA

### Penjualan Module
- [ ] Can create new sale transaction
- [ ] Can view list with filters
- [ ] Can edit existing transaction
- [ ] Can delete transaction with confirmation
- [ ] Form validation works

### Pembelian Module
- [ ] Can create new purchase
- [ ] Can view list with filters
- [ ] Can edit existing purchase
- [ ] Can delete purchase
- [ ] Stock automatically updates

### Persediaan Module
- [ ] Kartu Stok shows complete history per SKU
- [ ] Mutasi shows monthly stock movement
- [ ] Realtime shows current stock with alerts
- [ ] All filters work correctly
- [ ] Export functionality works

---

## 9. NEXT STEPS

1. ✅ Approve this plan
2. Start with **Priority 1: Penjualan API**
3. Create `backend/api-penjualan.js`
4. Register routes in `api/index.js`
5. Test API with Postman/curl
6. Create `pages/penjualan.html`
7. Integrate frontend with backend
8. Test full flow

---

**Document Status:** Ready for Implementation  
**Prepared by:** AI Assistant  
**Date:** 2026-06-14