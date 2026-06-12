# DATABASE AUDIT REPORT - PHASE 4

**Generated:** 2026-06-12
**Application:** CV EPIC Warehouse Inventory

---

## ACTIVE TABLES ✅

The following tables are confirmed ACTIVE and should be used:

| Table | Status | Usage |
|-------|--------|-------|
| `produk` | ✅ ACTIVE | All inventory, persediaan, penjualan |
| `pembelian` | ✅ ACTIVE | Warehouse purchases |
| `penjualan` | ✅ ACTIVE | All sales transactions |
| `outlet` | ✅ ACTIVE | Outlet management |
| `outlet_stok_masuk` | ✅ ACTIVE | Stock transfers to outlets |
| `stok_awal` | ✅ ACTIVE | Initial stock per SKU |
| `stok_opname` | ✅ ACTIVE | Stock opname headers |
| `stok_opname_detail` | ✅ ACTIVE | Stock opname line items |
| `stok_opname_perintah` | ✅ ACTIVE | Stock opname commands |
| `users` | ✅ ACTIVE | User management |
| `stok_penyesuaian` | ✅ ACTIVE | Stock adjustments (warehouse) |
| `outlet_stok_penyesuaian` | ✅ ACTIVE | Stock adjustments (outlet) |
| `outlet_penjualan` | ✅ ACTIVE | Outlet sales tracking |
| `outlet_stok_awal` | ✅ ACTIVE | Outlet initial stock |

---

## LEGACY TABLES ⚠️

The following tables/views are considered LEGACY:

### Views (Database Level)

| View | Status | Used By | Notes |
|------|--------|---------|-------|
| `vw_outlet_stock_monthly` | ⚠️ LEGACY | `audit.js` | Complex view for outlet stock analysis |
| `vw_outlet_level_analysis` | ⚠️ LEGACY | `audit.js` | Complex view for level analysis |

### Deprecated CTEs (Code Level)

| CTE | Status | Used By | Notes |
|-----|--------|---------|-------|
| `forecast_calc` | ❌ DEPRECATED | `forecast.js` | Forecast feature removed |
| `ema_calc` | ❌ DEPRECATED | `forecast.js` | Forecast feature removed |
| `monthly_sales` | ❌ DEPRECATED | `forecast.js` | Forecast feature removed |

### Auxiliary Tables

| Table | Status | Used By | Notes |
|-------|--------|---------|-------|
| `produk_level_mapping` | ⚠️ LEGACY | `v3-chart.js` | Level analysis for education products |
| `outlet_stok_opname` | ⚠️ LEGACY | - | Outlet stock opname (not implemented) |
| `audit_log` | ⚠️ LEGACY | `settings-api.js` | Activity logging table |

---

## DUPLICATED CODE PATTERNS 🔴

### 1. Rolling Stock CTE (5 files)

Identical CTE pattern duplicated in:
- `v3-persediaan.js` (lines 17-69)
- `v3-dashboard.js` (lines 58-81)
- `v3-opname-detail.js` (lines 46-77)
- `v3-opname-detail.js` (lines 107-123)
- `audit.js` (fallback mode)

**Recommendation:** Extract to shared utility function or materialized view.

### 2. Kategori Case Pattern (5 files)

Identical category extraction from nama_produk:
```sql
CASE
  WHEN UPPER(nama_produk) LIKE 'MODUL%' THEN 'modul'
  WHEN UPPER(nama_produk) LIKE 'TAS%' THEN 'tas'
  WHEN UPPER(nama_produk) LIKE 'BIRU%' OR ... THEN 'seragam'
  ELSE 'lain_lain'
END
```

Files: v3-persediaan.js, v3-penjualan.js, v3-opname-detail.js, v3-chart.js, persediaan.js

**Recommendation:** Extract to shared utility function.

### 3. Level Analysis Pattern (2 files)

Identical CTE for extracting modul type and level:
- `v3-penjualan.js` (analisisLevel)
- `v3-chart.js` (level chart)

**Recommendation:** Extract to shared utility function.

---

## SLOW QUERY ANALYSIS 🐢

### HIGH RISK

| File | Issue | Impact |
|------|-------|--------|
| `v3-persediaan.js` | 5 separate queries, each with 8+ CTE blocks | High CPU/memory |
| `audit.js` | 3-way UNION ALL, nested subqueries | High latency |
| `forecast.js` | CROSS JOIN with full table scans | DEPRECATED - can be removed |

### MEDIUM RISK

| File | Issue | Impact |
|------|-------|--------|
| `v3-opname-detail.js` | Similar rolling stock CTE (6 CTEs) | Medium latency |
| `v3-chart.js` | Multiple chart queries, GROUP BY without index | Medium latency |

### LOW RISK

| File | Issue | Impact |
|------|-------|--------|
| `v3-dashboard.js` | Simple COUNT/SUM queries | Fast |
| `v3-opname.js` | Simple CRUD operations | Fast |
| `v3-penjualan.js` | 7 queries but mostly simple | Fast |

---

## INDEX RECOMMENDATIONS 📊

Add indexes for frequently queried columns:

```sql
-- Core tables
CREATE INDEX IF NOT EXISTS idx_penjualan_tanggal ON penjualan(tanggal);
CREATE INDEX IF NOT EXISTS idx_penjualan_sku ON penjualan(sku);
CREATE INDEX IF NOT EXISTS idx_pembelian_tanggal ON pembelian(tanggal);
CREATE INDEX IF NOT EXISTS idx_pembelian_sku ON pembelian(sku);
CREATE INDEX IF NOT EXISTS idx_stok_opname_tanggal ON stok_opname(tanggal);
CREATE INDEX IF NOT EXISTS idx_stok_opname_detail_opname_id ON stok_opname_detail(opname_id);

-- Outlet tables
CREATE INDEX IF NOT EXISTS idx_outlet_stok_masuk_tanggal ON outlet_stok_masuk(tanggal);
CREATE INDEX IF NOT EXISTS idx_outlet_penjualan_tanggal ON outlet_penjualan(tanggal);
```

---

## RECOMMENDATIONS

1. **Remove forecast endpoint** - `forecast.js` should be removed as feature is deprecated
2. **Extract rolling stock to shared module** - Reduce code duplication
3. **Create materialized views** for rolling stock calculations
4. **Add indexes** on date and SKU columns
5. **Audit view dependencies** - `vw_outlet_stock_monthly` and `vw_outlet_level_analysis` should be reviewed for optimization

---

## FILES TO REVIEW

### Can Be Removed (Deprecated)
- `backend/forecast.js` - Forecast feature removed from UI

### Need Optimization
- `backend/v3-persediaan.js` - Consolidate queries
- `backend/audit.js` - Simplify complex queries
- `backend/v3-opname-detail.js` - Share CTE patterns

### Already Optimized
- `backend/v3-dashboard.js` - Simple queries, good structure
- `backend/v3-opname.js` - Clean CRUD operations