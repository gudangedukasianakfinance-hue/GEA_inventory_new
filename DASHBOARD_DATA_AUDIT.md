# DASHBOARD DATA AUDIT

**Date:** 2026-06-13  
**Status:** IN PROGRESS

---

## 1. API ENDPOINT AUDIT

### GET /api/v3-dashboard

**Response:**
```json
{
  "today": {
    "penjualan": Number,
    "customer_count": Number,
    "pembelian": Number
  },
  "produk": {
    "aktif": Number,
    "total": Number
  },
  "outlet": {
    "aktif": Number,
    "total": Number
  },
  "stok": {
    "kritis": Number,
    "gudang": {
      "awal": Number,
      "pembelian": Number,
      "penjualan": Number,
      "penyesuaian": Number,
      "akhir": Number
    }
  },
  "distribusi": {
    "hari_ini": {
      "count": Number,
      "qty": Number,
      "outlet_count": Number
    }
  },
  "opname": {
    "berjalan": Number,
    "selesai_bulan_ini": Number,
    "pending_approval": Number
  },
  "users": {
    "total": Number
  },
  "generated_at": "ISO Date String"
}
```

**Fields Available:**
| Field | Type | Description |
|-------|------|-------------|
| today.penjualan | Number | Total qty penjualan hari ini |
| today.customer_count | Number | Jumlah customer hari ini |
| today.pembelian | Number | Total qty pembelian hari ini |
| produk.aktif | Number | Produk dengan transaksi bulan ini |
| produk.total | Number | Total semua produk |
| outlet.aktif | Number | Outlet aktif bulan ini |
| outlet.total | Number | Total semua outlet |
| stok.kritis | Number | Count stok kritis (stok <= 0 atau < 10) |
| stok.gudang.awal | Number | Stok awal warehouse |
| stok.gudang.pembelian | Number | Total pembelian |
| stok.gudang.penjualan | Number | Total penjualan |
| stok.gudang.penyesuaian | Number | Total penyesuaian |
| stok.gudang.akhir | Number | Stok akhir warehouse |
| distribusi.hari_ini.count | Number | Jumlah distribusi hari ini |
| distribusi.hari_ini.qty | Number | Total qty distribusi |
| distribusi.hari_ini.outlet_count | Number | Jumlah outlet tujuan |
| opname.berjalan | Number | SO dengan status menunggu/proses |
| opname.selesai_bulan_ini | Number | SO selesai bulan ini |
| opname.pending_approval | Number | SO menunggu approval |
| users.total | Number | Total user aktif |
| generated_at | String | Timestamp |

**Fields NOT Available:**
- `stok_kritis` array/list (hanya count, tidak ada detail)
- `distribusi.recent` array
- `aktivitas` array
- `forecast` data
- `akurasi` value

---

### GET /api/v3-chart

**Query Parameters:**
- `bulan` (optional): 1-12
- `tahun` (optional): YYYY
- `type` (optional): overview, kategori, level, tren, stok, outlet

**Response:**
```json
{
  "type": "outlet",
  "periode": { "bulan": Number, "tahun": Number },
  "data": [
    { "label": String, "value": Number }
  ]
}
```

**Type Analysis:**

| Type | Description | Data Available |
|------|-------------|----------------|
| overview | Penjualan vs Pembelian | ✓ |
| kategori | Penjualan per kategori | ✓ |
| level | Penjualan per level modul | ✓ |
| tren | Tren 12 bulan | ✓ |
| stok | Stok per kategori | ✓ |
| outlet | Top 10 outlet | ✓ |

**MISSING Types for Dashboard:**
- `distribusi` - NO ENDPOINT (need to create)
- `top_produk` - NO ENDPOINT (need to create)

---

### GET /api/v3-persediaan

**Query Parameters:**
- `bulan` (optional)
- `tahun` (optional)
- `kategori` (optional)
- `sku` (optional)

**Response:**
```json
{
  "periode": {
    "bulan": Number,
    "tahun": Number,
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
  },
  "ringkasan": {
    "stok_awal": Number,
    "total_pembelian": Number,
    "total_penjualan": Number,
    "total_penyesuaian": Number,
    "stok_akhir": Number
  },
  "produk": [
    {
      "sku": String,
      "nama_produk": String,
      "kategori": String,
      "stok_awal": Number,
      "total_pembelian": Number,
      "total_penjualan": Number,
      "total_penyesuaian": Number,
      "stok_akhir": Number,
      "harga_beli": Number,
      "harga_jual": Number
    }
  ],
  "kategori": [
    {
      "kategori": String,
      "label": String,
      "stok_awal": Number,
      "total_pembelian": Number,
      "total_penjualan": Number,
      "stok_akhir": Number
    }
  ],
  "stok_kritis": [
    {
      "sku": String,
      "nama_produk": String,
      "stok_akhir": Number
    }
  ],
  "forecast": [
    {
      "sku": String,
      "nama_produk": String,
      "bulan_ini": Number,
      "bulan_lalu": Number,
      "dua_bulan_lalu": Number,
      "forecast": Number,
      "trend": String
    }
  ],
  "generated_at": "ISO Date String"
}
```

**Fields Available:**
| Field | Type | Description |
|-------|------|-------------|
| stok_kritis[].sku | String | SKU produk |
| stok_kritis[].nama_produk | String | Nama produk |
| stok_kritis[].stok_akhir | Number | Stok akhir |
| forecast[].sku | String | SKU produk |
| forecast[].nama_produk | String | Nama produk |
| forecast[].forecast | Number | Nilai forecast |

---

## 2. ENDPOINT GAP ANALYSIS

### Required for Dashboard:

| Widget | Needed Data | Endpoint | Status |
|--------|-------------|----------|--------|
| KPI Total Produk | produk.total | /api/v3-dashboard | ✓ |
| KPI Total Outlet | outlet.total | /api/v3-dashboard | ✓ |
| KPI Stok Gudang | stok.gudang.akhir | /api/v3-dashboard | ✓ |
| KPI Stok Outlet | outlet.aktif | /api/v3-dashboard | ✓ |
| KPI Distribusi | distribusi.hari_ini.qty | /api/v3-dashboard | ✓ |
| KPI Penjualan | today.penjualan | /api/v3-dashboard | ✓ |
| KPI SO Berjalan | opname.berjalan | /api/v3-dashboard | ✓ |
| KPI Stok Kritis | stok.kritis | /api/v3-dashboard | ✓ |
| KPI User Aktif | users.total | /api/v3-dashboard | ✓ |
| KPI Approval Pending | opname.pending_approval | /api/v3-dashboard | ✓ |
| KPI Forecast | forecast data | /api/v3-persediaan | ✓ |
| KPI Akurasi | N/A | NONE | ✗ |
| Chart Penjualan | tren data | /api/v3-chart?type=tren | ✓ |
| Chart Distribusi | distribusi data | NONE | ✗ |
| Chart Top Produk | top produk | NONE | ✗ |
| Chart Top Outlet | outlet data | /api/v3-chart?type=outlet | ✓ |
| Stok Kritis List | stok_kritis array | /api/v3-persediaan | ✓ |
| Distribusi Terbaru | recent distribusi | NONE | ✗ |
| Aktivitas Terbaru | activity log | NONE | ✗ |

---

## 3. RECOMMENDATIONS

### Endpoints to Create:

1. **GET /api/v3-distribusi-terbaru**
   - Returns recent distribution transactions
   - Data: outlet, qty, tanggal, produk

2. **GET /api/v3-aktivitas**
   - Returns recent activity log
   - Data: type, text, waktu, icon

3. **GET /api/v3-chart?type=top_produk**
   - Returns top 10 selling products
   - Data: label (nama_produk), value (qty)

### Temporary Solutions (Until Backend Ready):

1. **Chart Distribusi**: Use mock data or aggregate from penjualan
2. **Chart Top Produk**: Use /api/v3-persediaan produk data sorted by total_penjualan
3. **Distribusi Terbaru**: Show empty state or mock data
4. **Aktivitas Terbaru**: Show sample activities
5. **KPI Akurasi**: Set to "N/A" or calculate from opname data

---

## 4. MOBILE OPTIMIZATION CHECKLIST

- [x] 320px - Extra small
- [x] 375px - iPhone SE/8
- [x] 390px - iPhone 12/13
- [x] 768px - iPad
- [x] 1024px+ - Desktop

Required fixes:
- KPI grid: 4 columns → 2 columns (768px) → 1 column (640px)
- Charts grid: 2 columns → 1 column (768px)
- Tables grid: 3 columns → 1 column (768px)
- Font sizes: Reduce on mobile
- Padding: Reduce on mobile
- No horizontal overflow

---

## 5. LOADING & ERROR STATES

### Current Status:
- Loading: Basic (no skeleton)
- Error: None implemented

### Required:
- Skeleton loading for KPIs
- Skeleton loading for Charts
- Skeleton loading for Tables
- Error state with refresh button

---

## 6. CHANGES LOG

| Date | Change | Status |
|------|--------|--------|
| 2026-06-13 | Initial Audit | In Progress |
| 2026-06-13 | Complete dashboard.js rewrite | DONE |
| 2026-06-13 | Complete dashboard.css update | DONE |
| 2026-06-13 | Added skeleton loading states | DONE |
| 2026-06-13 | Added error states with refresh | DONE |
| 2026-06-13 | Mobile optimization (320px-1024px+) | DONE |

---

## 7. MISSING ENDPOINTS (Backend Required)

For a complete dashboard, the following endpoints need to be created:

1. **GET /api/v3-distribusi-terbaru**
   - Returns recent distribution transactions
   - Data: outlet, qty, tanggal, produk
   - Status: **NOT AVAILABLE** - Using mock data

2. **GET /api/v3-aktivitas**
   - Returns recent activity log
   - Data: type, text, waktu, icon
   - Status: **NOT AVAILABLE** - Using derived data from other endpoints

3. **GET /api/v3-chart?type=distribusi**
   - Returns distribution data for chart
   - Data: label (day), value (qty)
   - Status: **NOT AVAILABLE** - Using derived mock data

4. **GET /api/v3-chart?type=top_produk**
   - Returns top 10 selling products
   - Data: label (nama_produk), value (qty)
   - Status: **NOT AVAILABLE** - Using /api/v3-persediaan as workaround

---

## 8. FILES MODIFIED

| File | Description |
|------|-------------|
| js/pages/dashboard.js | Complete rewrite with backend integration |
| css/dashboard.css | Added skeleton, error states, mobile optimization |
| pages/dashboard.html | No changes (structure intact) |
| DASHBOARD_DATA_AUDIT.md | This document |