# KPI BUSINESS VALIDATION REPORT

**Date**: 2026-06-12  
**Status**: VALIDATION ONLY - NO CHANGES MADE

---

## Summary

| Status | Count | KPIs |
|--------|-------|------|
| ✅ VALID | 4 | Total Produk, Total Outlet, Penjualan Hari Ini, SO Pending |
| ❌ INVALID | 4 | Stok Gudang, Stok Outlet, Distribusi Hari Ini, Stok Kritis |
| 🔧 NEEDS NEW QUERY | 2 | Stok Gudang, Stok Outlet |
| 📊 VALID BUT DIFFERENT | 1 | Stok Kritis (field exists but different definition) |

---

## KPI 1: Total Produk

### Business Definition
Jumlah total semua produk yang terdaftar dalam sistem.

### Source Table
`produk` table

### Source Query
```sql
SELECT COUNT(*) AS total FROM produk
```

### JSON Field Used
```javascript
data.produk.total
```

### Current Implementation
```javascript
document.getElementById('kpi-total-produk').textContent = formatNumber(data.produk?.total || 0);
```

### Status
✅ **VALID**

### Reason
Field `produk.total` directly represents the count of all products in the `produk` table.

---

## KPI 2: Total Outlet

### Business Definition
Jumlah total semua outlet/gerai yang terdaftar dalam sistem.

### Source Table
`outlet` table

### Source Query
```sql
SELECT COUNT(*) AS total FROM outlet
```

### JSON Field Used
```javascript
data.outlet.total
```

### Current Implementation
```javascript
document.getElementById('kpi-total-outlet').textContent = formatNumber(data.outlet?.total || 0);
```

### Status
✅ **VALID**

### Reason
Field `outlet.total` directly represents the count of all outlets in the `outlet` table.

---

## KPI 3: Stok Gudang

### Business Definition
Jumlah total stok fisik semua produk di gudang utama.
Formula: STOK_AWAL + PEMBELIAN - PENJUALAN + PENYESUAIAN

### Source Table
`stok_awal`, `pembelian`, `penjualan`, `stok_penyesuaian`

### Source Query
```sql
-- From v3-persediaan.js ringkasanStok
WITH params AS (
  SELECT (make_date($2::int, $1::int, 1) + interval '1 month')::date AS end_date
),
base_stock AS (SELECT COALESCE(SUM(qty_awal), 0) AS total FROM stok_awal),
pembelian_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM pembelian WHERE tanggal <= (SELECT end_date FROM params)),
penjualan_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM penjualan WHERE tanggal <= (SELECT end_date FROM params)),
penyesuaian_total AS (SELECT COALESCE(SUM(qty), 0) AS total FROM stok_penyesuaian WHERE tanggal <= (SELECT end_date FROM params))
SELECT bs.total + pt.total - pj.total + pen.total AS stok_akhir_total
FROM base_stock bs, pembelian_total pt, penjualan_total pj, penyesuaian_total pen
```

### JSON Field Currently Used
```javascript
data.produk.total  // ❌ WRONG!
```

### Current Implementation
```javascript
document.getElementById('kpi-stok-gudang').textContent = formatNumber(data.produk?.total || 0);
```

### Status
❌ **INVALID**

### Reason
- `produk.total` = jumlah produk (count of products)
- `Stok Gudang` = jumlah unit stok (sum of all product quantities)
- These are completely different values!

### Required Fix
Should use `ringkasan.stok_akhir` from `/api/v3-persediaan` endpoint, or add a new field in v3-dashboard.

### Available in Backend
```javascript
// v3-persediaan.js returns:
{
  "ringkasan": {
    "stok_akhir": Number(ringkasanStok.rows[0]?.stok_akhir_total || 0)
  }
}
```

---

## KPI 4: Stok Outlet

### Business Definition
Jumlah total stok yang saat ini berada di semua outlet.

### Source Table
This KPI may not be directly available in current data model.

### Analysis
The system tracks PENJUALAN to outlets, but does not maintain explicit "outlet stock" records.
- When products are sold, they go OUT of warehouse and into outlets
- But the system doesn't track what quantity remains at each outlet

### JSON Field Currently Used
```javascript
data.outlet.aktif  // ❌ WRONG!
```

### Current Implementation
```javascript
document.getElementById('kpi-stok-outlet').textContent = formatNumber(data.outlet?.aktif || 0);
```

### Status
❌ **INVALID**

### Reason
- `outlet.aktif` = count of outlets that have transactions this month
- `Stok Outlet` = total product quantity at outlets
- These are completely different values!

### Required Fix
Either:
1. Create new database table to track outlet stocks
2. Calculate from: Total Penjualan - Total Retur (if exists)
3. Or accept that this metric is not available in current system

### Note
This KPI may not be achievable without schema changes or new tracking mechanism.

---

## KPI 5: Distribusi Hari Ini

### Business Definition
Jumlah distribusi/pengiriman ke outlet hari ini.

### Source Table
Should come from `distribusi` or `pengiriman` table (if exists).

### Current Implementation
```javascript
document.getElementById('kpi-distribusi').textContent = formatNumber(data.today?.customer_count || 0);
```

### JSON Field Used
```javascript
data.today.customer_count
```

### Status
❌ **INVALID**

### Reason
- `customer_count` = distinct outlets that made purchases today
- `Distribusi` = shipments/deliveries TO outlets today
- These are different: A customer_count of 5 means 5 outlets bought, NOT 5 shipments

### Available Data
- `today.customer_count` = outlets that purchased today
- `today.penjualan` = total quantity sold today

### Required Fix
If distribution tracking exists in `distribusi` table, create new query:
```sql
SELECT COUNT(*) FROM distribusi WHERE tanggal = CURRENT_DATE
```

---

## KPI 6: Penjualan Hari Ini

### Business Definition
Total quantity penjualan ke outlet hari ini.

### Source Table
`penjualan` table

### Source Query
```sql
SELECT COALESCE(SUM(qty), 0) AS total_qty
FROM penjualan 
WHERE tanggal = CURRENT_DATE
```

### JSON Field Used
```javascript
data.today.penjualan
```

### Current Implementation
```javascript
document.getElementById('kpi-penjualan').textContent = formatNumber(data.today?.penjualan || 0);
```

### Status
✅ **VALID**

### Reason
Field `today.penjualan` directly represents the sum of qty from `penjualan` table for today.

---

## KPI 7: SO Pending

### Business Definition
Jumlah Stock Opname yang sedang berjalan (belum selesai).

### Source Table
`stok_opname_perintah` table

### Source Query
```sql
SELECT COUNT(*) AS total
FROM stok_opname_perintah
WHERE status IN ('menunggu', 'proses')
```

### JSON Field Used
```javascript
data.opname.berjalan
```

### Current Implementation
```javascript
document.getElementById('kpi-so-pending').textContent = formatNumber(data.opname?.berjalan || 0);
```

### Status
✅ **VALID**

### Reason
Field `opname.berjalan` correctly counts SO commands with status 'menunggu' or 'proses'.

---

## KPI 8: Stok Kritis

### Business Definition
Jumlah produk yang stoknya di bawah minimum atau habis.

### Source Table
Calculated from `stok_awal`, `pembelian`, `penjualan`, `stok_penyesuaian`

### Source Query
```sql
-- From v3-dashboard.js
WITH params AS (
  SELECT CURRENT_DATE AS end_date
),
-- (rolling stock calculation)
SELECT COUNT(*) AS kritis_count
FROM rolling_stok
WHERE stok_akhir <= 0 OR stok_akhir < 10
```

### JSON Field Used
```javascript
data.stok.kritis
```

### Current Implementation
```javascript
document.getElementById('kpi-stok-kritis').textContent = formatNumber(data.stok?.kritis || 0);
```

### Status
⚠️ **VALID BUT DIFFERENT DEFINITION**

### Reason
- The field `stok.kritis` exists and is valid
- But it uses threshold `< 10` which may not match user's business definition
- If user expects "stok = 0" only, threshold should be `<= 0`

### Backend Definition (v3-dashboard.js line 96)
```sql
WHERE stok_akhir <= 0 OR stok_akhir < 10
```
This means: stok = 0 OR stok < 10

### Recommendation
If "Stok Kritis" should ONLY include products with stok = 0, change query to:
```sql
WHERE stok_akhir <= 0
```

---

## VALIDATION SUMMARY TABLE

| KPI | Field Used | Definition Match | Status | Action Needed |
|-----|------------|------------------|--------|---------------|
| Total Produk | `produk.total` | ✅ Match | VALID | None |
| Total Outlet | `outlet.total` | ✅ Match | VALID | None |
| Stok Gudang | `produk.total` | ❌ No Match | INVALID | Need new query |
| Stok Outlet | `outlet.aktif` | ❌ No Match | INVALID | Need schema change |
| Distribusi Hari Ini | `customer_count` | ❌ No Match | INVALID | Need new query |
| Penjualan Hari Ini | `today.penjualan` | ✅ Match | VALID | None |
| SO Pending | `opname.berjalan` | ✅ Match | VALID | None |
| Stok Kritis | `stok.kritis` | ⚠️ Partial | VALID* | May need threshold adjust |

---

## KPIs INVALID (4)

1. **Stok Gudang** - Using `produk.total` (product count) instead of total stock quantity
2. **Stok Outlet** - Using `outlet.aktif` (active outlets) instead of outlet stock
3. **Distribusi Hari Ini** - Using `customer_count` instead of distribution count
4. **Stok Kritis** - Field is valid but threshold may differ from business definition

---

## KPIs VALID (4)

1. **Total Produk** - ✅ Correct
2. **Total Outlet** - ✅ Correct
3. **Penjualan Hari Ini** - ✅ Correct
4. **SO Pending** - ✅ Correct

---

## RECOMMENDATIONS

### Option A: Fix Invalid KPIs
Create new query/endpoint for:
- Stok Gudang → Use `ringkasan.stok_akhir` from v3-persediaan
- Distribusi Hari Ini → Create new distribusi table and query
- Stok Outlet → Requires schema change to track outlet stocks

### Option B: Accept Current State
If accurate business data is not critical, current proxy values provide:
- Total Produk ✅
- Total Outlet ✅
- Penjualan Hari Ini ✅
- SO Pending ✅

### Option C: Change KPI Definitions
If the proxy values represent acceptable business metrics:
- Stok Gudang = Total Produk (count of product types in warehouse)
- Stok Outlet = Active Outlets (outlets with activity)
- Distribusi = Customer Count (outlets served today)

---

**Report Generated**: 2026-06-12  
**Action**: NO CHANGES MADE - Validation Only