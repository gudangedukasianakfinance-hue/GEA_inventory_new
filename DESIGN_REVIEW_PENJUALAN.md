# 📋 DESIGN REVIEW: MODUL PENJUALAN
## CV EPIC Warehouse Inventory App

**Document Version:** 1.0  
**Date:** 2026-06-14  
**Status:** Draft - Pending Approval  
**Priority:** P1 - Critical

---

## 1. DATABASE MAPPING

### 1.1 Current Table Structure: `penjualan`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `tanggal` | DATE | NOT NULL | Tanggal transaksi |
| `nama_outlet` | VARCHAR(255) | NOT NULL | Nama outlet/pelanggan |
| `sku` | VARCHAR(50) | NOT NULL, FK → produk(sku) | SKU produk |
| `qty` | INTEGER | NOT NULL, CHECK (qty >= 0) | Jumlah terjual |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Waktu created |

### 1.2 Related Tables

#### `produk` (Master Produk)
| Column | Type | Description |
|--------|------|-------------|
| sku | VARCHAR(50) PK | SKU produk |
| nama_produk | VARCHAR(255) | Nama produk |
| harga_beli | NUMERIC(14,2) | Harga beli |
| harga_jual | NUMERIC(14,2) | Harga jual |

#### `outlet` (Master Outlet)
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | ID outlet |
| nama_outlet | VARCHAR(255) UNIQUE | Nama outlet |
| created_at | TIMESTAMP | Waktu dibuat |

#### `users` (User Management)
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | ID user |
| username | VARCHAR(100) UNIQUE | Username |
| nama_lengkap | VARCHAR(200) | Nama lengkap |
| role | VARCHAR(50) | Role (admin, staff_gudang, checker_opname) |

### 1.3 Current Relationships

```
┌─────────────────┐       ┌─────────────────┐
│   penjualan     │       │    produk       │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ sku (PK)        │
│ tanggal         │       │ nama_produk     │
│ nama_outlet     │──────►│ harga_beli      │
│ sku (FK)────────┼───────│ harga_jual      │
│ qty             │       └─────────────────┘
│ created_at      │
└─────────────────┘
        │
        │ (via nama_outlet)
        ▼
┌─────────────────┐
│     outlet      │
├─────────────────┤
│ id (PK)         │
│ nama_outlet     │
│ created_at      │
└─────────────────┘

┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ username        │
│ nama_lengkap    │
│ role            │
└─────────────────┘
     (NO LINK)
```

### 1.4 Gap Analysis: Current vs Required

| Field | Current | Required | Gap |
|-------|---------|----------|-----|
| user_id | ❌ Missing | ✅ Needed | **CRITICAL** - Can't track who created transaction |
| harga_satuan | ❌ Missing | ✅ Needed | Can't show unit price |
| total_harga | ❌ Missing | ✅ Needed | Can't show total without calculation |
| outlet_id | ❌ Missing (only nama_outlet) | ⚠️ Optional | FK relationship weak |
| no_transaksi | ❌ Missing | ✅ Needed | Need auto-generated transaction number |
| keterangan | ❌ Missing | ⚠️ Optional | Notes field for transactions |
| updated_at | ❌ Missing | ⚠️ Optional | Track last update |

### 1.5 Recommended Schema Changes

**Option A: Minimal Changes (Recommended for MVP)**
```sql
-- Add only necessary columns
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS no_transaksi VARCHAR(50) UNIQUE;
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_penjualan_user ON penjualan (user_id);
CREATE INDEX IF NOT EXISTS idx_penjualan_notransaksi ON penjualan (no_transaksi);
```

**Option B: Full Schema (For Production)**
```sql
-- Complete schema redesign
ALTER TABLE penjualan 
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS no_transaksi VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS keterangan TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;  -- Soft delete

-- Add outlet_id FK (requires data migration)
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
```

---

## 2. API SPECIFICATION

### 2.1 Base URL
```
/api/v1/penjualan
```

### 2.2 Endpoints

#### GET /v1/penjualan
**Description:** List all penjualan with pagination and filters

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number |
| limit | integer | No | 20 | Items per page (max: 100) |
| tanggal_awal | date | No | - | Filter start date (YYYY-MM-DD) |
| tanggal_akhir | date | No | - | Filter end date (YYYY-MM-DD) |
| outlet | string | No | - | Filter by outlet name |
| sku | string | No | - | Filter by SKU |
| produk | string | No | - | Search by product name |
| user_id | integer | No | - | Filter by user |

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "no_transaksi": "TRX-20260614-001",
      "tanggal": "2026-06-14",
      "outlet": {
        "id": 1,
        "nama_outlet": "OUTLET 1"
      },
      "produk": {
        "sku": "SKU001",
        "nama_produk": "Produk A",
        "harga_jual": 15000
      },
      "qty": 5,
      "harga_satuan": 15000,
      "total_harga": 75000,
      "user": {
        "id": 1,
        "nama_lengkap": "Admin"
      },
      "keterangan": null,
      "created_at": "2026-06-14T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 150,
    "total_pages": 8
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid date format for tanggal_awal"
}
```

---

#### GET /v1/penjualan/:id
**Description:** Get single penjualan by ID

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | integer | Penjualan ID |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "no_transaksi": "TRX-20260614-001",
    "tanggal": "2026-06-14",
    "outlet": {
      "id": 1,
      "nama_outlet": "OUTLET 1"
    },
    "produk": {
      "sku": "SKU001",
      "nama_produk": "Produk A",
      "harga_beli": 10000,
      "harga_jual": 15000
    },
    "qty": 5,
    "harga_satuan": 15000,
    "total_harga": 75000,
    "user": {
      "id": 1,
      "username": "admin",
      "nama_lengkap": "Administrator"
    },
    "keterangan": "Penjualan pertama",
    "created_at": "2026-06-14T10:30:00Z",
    "updated_at": "2026-06-14T10:30:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Penjualan tidak ditemukan"
}
```

---

#### POST /v1/penjualan
**Description:** Create new penjualan

**Request Body:**
```json
{
  "tanggal": "2026-06-14",
  "outlet_id": 1,
  "nama_outlet": "OUTLET 1",
  "sku": "SKU001",
  "qty": 5,
  "keterangan": "Penjualan pertama"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| tanggal | date | Yes | Valid date, not future |
| outlet_id | integer | No | Must exist in outlet table |
| nama_outlet | string | Yes | Max 255 chars |
| sku | string | Yes | Must exist in produk table |
| qty | integer | Yes | Min: 1, Max: 999999 |
| keterangan | string | No | Max 500 chars |

**Success Response (201):**
```json
{
  "success": true,
  "message": "Penjualan berhasil ditambahkan",
  "data": {
    "id": 1,
    "no_transaksi": "TRX-20260614-001",
    "tanggal": "2026-06-14",
    "outlet": {
      "id": 1,
      "nama_outlet": "OUTLET 1"
    },
    "produk": {
      "sku": "SKU001",
      "nama_produk": "Produk A"
    },
    "qty": 5,
    "harga_satuan": 15000,
    "total_harga": 75000,
    "created_at": "2026-06-14T10:30:00Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "SKU tidak ditemukan di database"
}
```

---

#### PUT /v1/penjualan/:id
**Description:** Update existing penjualan

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | integer | Penjualan ID |

**Request Body:**
```json
{
  "tanggal": "2026-06-15",
  "nama_outlet": "OUTLET 2",
  "sku": "SKU002",
  "qty": 10,
  "keterangan": "Updated transaction"
}
```

**Notes:**
- Only admin can update other's transactions
- Updating qty affects stock calculations
- Cannot update if linked to approved/opname

**Success Response (200):**
```json
{
  "success": true,
  "message": "Penjualan berhasil diupdate",
  "data": {
    "id": 1,
    "no_transaksi": "TRX-20260614-001",
    "tanggal": "2026-06-15",
    "qty": 10,
    "total_harga": 250000,
    "updated_at": "2026-06-15T11:00:00Z"
  }
}
```

---

#### DELETE /v1/penjualan/:id
**Description:** Delete penjualan (soft delete recommended)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | integer | Penjualan ID |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Penjualan berhasil dihapus"
}
```

**Error Response (403):**
```json
{
  "success": false,
  "error": "Tidak dapat menghapus penjualan yang sudah di-opname"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Penjualan tidak ditemukan"
}
```

---

### 2.3 Transaction Number Format
```
TRX-YYYYMMDD-XXX
Example: TRX-20260614-001
```
- TRX: Prefix
- YYYYMMDD: Date
- XXX: Sequential number (001-999)

---

## 3. UI MOCKUP STRUCTURE

### 3.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search...                    [+ Tambah] [📊 Export]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ FILTER BAR                                                      │
│ ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐    │
│ │Tanggal   │  │Tanggal   │  │ Outlet ▼     │  │ SKU ▼   │    │
│ │Awal      │  │Akhir    │  │ Semua Outlet │  │Semua SKU│    │
│ └──────────┘  └──────────┘  └──────────────┘  └──────────┘    │
│                                    [🔄 Reset] [🔍 Filter]      │
├─────────────────────────────────────────────────────────────────┤
│ SUMMARY CARDS                                                    │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐     │
│ │Total Trans │ │Items Sold │ │ Total Omset│ │Top Outlet │     │
│ │   150      │ │   1,250   │ │ Rp 25M    │ │ OUTLET 1  │     │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│ DATA TABLE                                                       │
│ ┌────┬──────────┬────────┬─────────┬──────────┬─────┬─────────┐ │
│ │ # │No Trans  │Tanggal │ Outlet  │ Produk   │Qty  │ Total   │ │
│ ├────┼──────────┼────────┼─────────┼──────────┼─────┼─────────┤ │
│ │ 1 │TRX-001  │14 Jun  │OUTLET 1 │ Produk A │ 5   │ Rp 75K  │ │
│ │ 2 │TRX-002  │14 Jun  │OUTLET 2 │ Produk B │ 10  │ Rp 250K │ │
│ │ 3 │TRX-003  │13 Jun  │OUTLET 1 │ Produk C │ 3   │ Rp 60K  │ │
│ └────┴──────────┴────────┴─────────┴──────────┴─────┴─────────┘ │
│                                                                 │
│ [< Prev] Page 1 of 8 [Next >]     Showing 1-20 of 150          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Add/Edit Modal

```
┌─────────────────────────────────────────────────────────────┐
│ TAMBAH PENJUALAN                                    [X]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tanggal *                                                   │
│  ┌────────────────────────────┐                             │
│  │ 2026-06-14                 │                             │
│  └────────────────────────────┘                             │
│                                                              │
│  Outlet / Pelanggan *                                        │
│  ┌────────────────────────────┐                             │
│  │ Pilih Outlet...         ▼  │                             │
│  │ ┌──────────────────────┐  │                             │
│  │ │OUTLET 1               │  │                             │
│  │ │OUTLET 2               │  │                             │
│  │ │OUTLET 3               │  │                             │
│  │ └──────────────────────┘  │                             │
│  └────────────────────────────┘                             │
│                                                              │
│  Produk *                                                    │
│  ┌────────────────────────────┐                             │
│  │ Pilih Produk...         ▼  │                             │
│  │ ┌──────────────────────┐  │                             │
│  │ │SKU001 - Produk A     │  │                             │
│  │ │SKU002 - Produk B     │  │                             │
│  │ └──────────────────────┘  │                             │
│  └────────────────────────────┘                             │
│                                                              │
│  Qty *                    Harga Satuan                      │
│  ┌────────────┐           ┌────────────────────┐            │
│  │    5       │           │ Rp 15.000          │            │
│  └────────────┘           └────────────────────┘            │
│                                                              │
│  Total                                                        │
│  ┌────────────────────────────────────────────┐              │
│  │ Rp 75.000                                  │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
│  Keterangan                                                    │
│  ┌────────────────────────────────────────────┐              │
│  │                                            │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                        [Batal]  [Simpan]                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Component Specifications

#### Filter Bar
- **Date Range:** Datepicker with preset options (Today, This Week, This Month, Custom)
- **Outlet Dropdown:** Searchable select with "Semua Outlet" default
- **SKU Dropdown:** Searchable select with autocomplete
- **Reset Button:** Clears all filters to default
- **Filter Button:** Applies selected filters

#### Summary Cards
- **Total Transaksi:** Count of records in current filter
- **Items Sold:** Sum of qty
- **Total Omset:** Sum of (qty × harga_jual)
- **Top Outlet:** Outlet with highest sales in period

#### Data Table
- **Sortable Columns:** No Transaksi, Tanggal, Outlet, Qty, Total
- **Row Actions:** 
  - View (eye icon)
  - Edit (pencil icon)
  - Delete (trash icon)
- **Pagination:** 20 items per page default
- **Export Options:** CSV, Excel

#### Form Modal
- **Auto-calculate Total:** Updates when qty or product changes
- **Product Selection:** Shows stock info when hovering
- **Validation:** Real-time validation with error messages
- **Submit:** Shows loading state during save

---

## 4. VALIDATION RULES

### 4.1 Client-Side Validation

| Field | Rules | Error Message |
|-------|-------|--------------|
| tanggal | Required, Valid date, Not future date | "Tanggal harus diisi" / "Tanggal tidak boleh lebih dari hari ini" |
| nama_outlet | Required, Max 255 chars | "Nama outlet harus diisi" |
| sku | Required, Must exist in produk | "SKU harus dipilih dari daftar" |
| qty | Required, Integer, Min 1, Max 999999 | "Qty harus angka positif" / "Qty maksimal 999.999" |
| keterangan | Optional, Max 500 chars | "Keterangan maksimal 500 karakter" |

### 4.2 Server-Side Validation

| Field | Rules | Error Code |
|-------|-------|------------|
| tanggal | Required, Valid date format (YYYY-MM-DD), Not > today | `VALIDATION_DATE_INVALID` |
| nama_outlet | Required, Trim, Max 255, Uppercase on save | `VALIDATION_OUTLET_REQUIRED` |
| sku | Required, Must exist in produk table | `VALIDATION_SKU_NOT_FOUND` |
| qty | Required, Integer, >= 1, <= 999999 | `VALIDATION_QTY_INVALID` |
| user_id | Optional, If provided must exist in users | `VALIDATION_USER_NOT_FOUND` |

### 4.3 Business Logic Validation

| Rule | Description | Error Code |
|------|-------------|------------|
| STOCK_CHECK | Qty should not exceed available stock (if tracking) | `BUSINESS_STOCK_INSUFFICIENT` |
| NO_FUTURE_DATE | Cannot create transactions with future dates | `BUSINESS_FUTURE_DATE_NOT_ALLOWED` |
| OUTLET_EXISTS | Auto-create outlet if not exists | Auto-create |
| DUPLICATE_CHECK | Warn if same transaction exists (same date, outlet, sku) | `BUSINESS_DUPLICATE_WARNING` |

---

## 5. RISIKO INTEGRASI DENGAN DASHBOARD V3

### 5.1 Dashboard V3 Components Affected

| Component | Endpoint Used | Risk Level | Impact |
|-----------|--------------|------------|--------|
| KPI Cards | `/v3-dashboard` | LOW | May show different totals if CRUD affects data |
| Trend Chart | `/v3-penjualan` | MEDIUM | Query directly from `penjualan` table |
| Top Produk | `/v3-dashboard` | MEDIUM | Uses aggregation from `penjualan` table |
| Top Outlet | `/v3-dashboard` | MEDIUM | Uses aggregation from `penjualan` table |

### 5.2 Integration Risk Analysis

#### Risk 1: Data Consistency
```
Description: Dashboard V3 queries `penjualan` table directly
Impact: Any CRUD operation will immediately reflect in Dashboard
Mitigation: Use transactions for all write operations
```

#### Risk 2: Read vs Write Performance
```
Description: Dashboard may experience slow queries during heavy CRUD
Impact: Dashboard load time may increase
Mitigation: 
- Use database indexes on frequently queried columns
- Consider read replicas for Dashboard queries
```

#### Risk 3: Concurrent Modifications
```
Description: Multiple users editing same transaction
Impact: Race conditions, data inconsistency
Mitigation:
- Implement optimistic locking (version column)
- Add updated_at check before save
```

#### Risk 4: Delete Cascade Effects
```
Description: Deleting penjualan might affect:
  - outlet_stok_masuk (mirrored records)
  - v3-penjualan aggregations
Impact: Orphan records, inaccurate Dashboard
Mitigation:
- Use soft delete instead of hard delete
- Add deleted_at column
- Update Dashboard queries to exclude deleted records
```

### 5.3 Recommended Safeguards

#### Database Level
```sql
-- Add soft delete column
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Update all queries to exclude deleted
CREATE OR REPLACE VIEW v_penjualan_active AS
SELECT * FROM penjualan WHERE deleted_at IS NULL;

-- Add version column for optimistic locking
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_penjualan_deleted ON penjualan (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_penjualan_composite ON penjualan (tanggal, deleted_at);
```

#### API Level
```javascript
// Add version check in UPDATE
const result = await pool.query(`
  UPDATE penjualan 
  SET qty = $1, updated_at = NOW(), version = version + 1
  WHERE id = $2 AND version = $3 AND deleted_at IS NULL
  RETURNING *
`, [qty, id, version]);

if (result.rows.length === 0) {
  return res.status(409).json({ 
    error: "Data sudah diubah oleh pengguna lain" 
  });
}
```

#### Frontend Level
```javascript
// Show warning before delete
async function deletePenjualan(id) {
  const response = await fetch(`/api/v1/penjualan/${id}`);
  const data = await response.json();
  
  if (data.data.linked_opname) {
    showAlert('Tidak dapat menghapus penjualan yang sudah di-opname');
    return;
  }
  
  confirmDelete(id);
}
```

### 5.4 Dashboard V3 Compatibility Checklist

| Item | Status | Action Required |
|------|--------|-----------------|
| Dashboard reads from `penjualan` table | ✅ Compatible | None |
| No unique transaction number | ⚠️ Need Fix | Add no_transaksi column |
| No user tracking | ⚠️ Need Fix | Add user_id column |
| No soft delete | ⚠️ Need Fix | Add deleted_at column |
| Direct aggregation queries | ✅ Compatible | Ensure indexes exist |
| Real-time updates | ✅ Compatible | No polling mechanism affected |

### 5.5 Rollback Plan

If CRUD operations cause Dashboard issues:
1. **Immediate:** Disable create/edit/delete buttons (read-only mode)
2. **Short-term:** Add feature flag to toggle CRUD functionality
3. **Long-term:** Implement event-driven updates for Dashboard cache

---

## 6. DEPENDENCIES & PREREQUISITES

### 6.1 Database Migration Required

```sql
-- File: migration_penjualan_crud.sql

-- 1. Add columns for CRUD functionality
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS no_transaksi VARCHAR(50) UNIQUE;
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE penjualan ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 2. Generate transaction numbers for existing records
UPDATE penjualan 
SET no_transaksi = 'TRX-' || TO_CHAR(tanggal, 'YYYYMMDD') || '-' || LPAD(id::TEXT, 3, '0')
WHERE no_transaksi IS NULL;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_penjualan_user ON penjualan (user_id);
CREATE INDEX IF NOT EXISTS idx_penjualan_notransaksi ON penjualan (no_transaksi);
CREATE INDEX IF NOT EXISTS idx_penjualan_deleted ON penjualan (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_penjualan_composite ON penjualan (tanggal, deleted_at);

-- 4. Create sequence for transaction numbers
CREATE SEQUENCE IF NOT EXISTS seq_penjualan_notransaksi START 1;

-- 5. Create function to generate transaction number
CREATE OR REPLACE FUNCTION generate_penjualan_notransaksi()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.no_transaksi IS NULL THEN
    NEW.no_transaksi := 'TRX-' || TO_CHAR(COALESCE(NEW.tanggal, CURRENT_DATE), 'YYYYMMDD') 
                        || '-' || LPAD(nextval('seq_penjualan_notransaksi')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger
DROP TRIGGER IF EXISTS trg_generate_notransaksi ON penjualan;
CREATE TRIGGER trg_generate_notransaksi
  BEFORE INSERT ON penjualan
  FOR EACH ROW
  EXECUTE FUNCTION generate_penjualan_notransaksi();
```

### 6.2 Files to Create

| File | Type | Purpose |
|------|------|---------|
| `backend/api-penjualan.js` | Handler | CRUD operations |
| `pages/penjualan.html` | Page | Main page UI |
| `migration_penjualan_crud.sql` | Migration | Database changes |
| `api/index.js` | Modify | Register routes |

### 6.3 Files to Modify

| File | Changes |
|------|---------|
| `api/index.js` | Add route registrations |
| `app.html` | (No changes needed) |
| `js/app-router.js` | (No changes - route already defined) |

---

## 7. APPROVAL CHECKLIST

### 7.1 Design Review Sign-off

| Item | Status | Reviewer Notes |
|------|--------|----------------|
| Database Schema | ☐ Approved | |
| API Specification | ☐ Approved | |
| UI Mockup Structure | ☐ Approved | |
| Validation Rules | ☐ Approved | |
| Integration Risks | ☐ Approved | |
| Migration Script | ☐ Approved | |

### 7.2 Questions for Stakeholder

1. Should we implement **soft delete** or **hard delete**?
2. Should **non-admin users** be able to edit/delete their own transactions only?
3. Should we track **stock deduction** when creating penjualan?
4. Do we need **audit trail** for all CRUD operations?
5. Should **duplicate transactions** (same date/outlet/sku) be allowed?

---

## 8. NEXT STEPS (After Approval)

1. ✅ **APPROVED** → Create database migration script
2. ✅ **APPROVED** → Implement API handler (`api-penjualan.js`)
3. ✅ **APPROVED** → Register routes in `api/index.js`
4. ✅ **APPROVED** → Create page UI (`pages/penjualan.html`)
5. ✅ **APPROVED** → Integration testing
6. ✅ **APPROVED** → Dashboard V3 smoke test

---

**Document Status: PENDING APPROVAL**  
**Prepared by:** AI Assistant  
**Date:** 2026-06-14