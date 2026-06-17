# AUDIT REPORT - FLOW STOCK OPNAME (SO)

## TANGGAL AUDIT: 2026-06-17

---

## 1. DIAGRAM FLOW AKTUAL SAAT INI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLOW STOCK OPNAME (SO)                               │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐
  │   DASHBOARD SO   │ ◄─── /pages/dashboard-so.html
  │  ?page=dashboard-so │     Route: 'dashboard-so'
  └────────┬─────────┘
           │
           ├──────────────────────────────────────────────────────────────────┐
           │                                                                  │
           ▼                                                                  ▼
  ┌──────────────────┐                                            ┌──────────────────┐
  │   PERINTAH SO    │                                            │  TASK SO SAYA    │
  │ ?page=perintah-so│                                            │ (Checker Only)   │
  └────────┬─────────┘                                            └────────┬─────────┘
           │                                                                  │
           │  [Tombol "Mulai SO"]                                           │
           │  → executePerintah()                                           │
           │  → localStorage set                                            │
           │  → navigateTo('pelaksanaan-so')                               │
           │                                                                  │
           │                                                                  │
           └─────────────────────────────────────────┐
                                                   │
                                                   ▼
                                         ┌──────────────────────┐
                                         │   PELAKSANAAN SO     │
                                         │?page=pelaksanaan-so  │
                                         └──────────┬───────────┘
                                                    │
          ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
          │                                         │                                         │
          ▼                                         ▼                                         ▼
  ┌──────────────────┐                    ┌──────────────────┐                    ┌──────────────────┐
  │  TAB: SCAN &     │                    │  TAB: PROGRESS   │                    │  RESET /         │
  │  INPUT           │                    │                  │                    │  SUBMIT HASIL    │
  └──────────────────┘                    └──────────────────┘                    └──────────────────┘
          │                                         │                                         │
          │  - Scan barcode                         │  - Daftar produk                        │  - Submit → status='selesai'
          │  - Manual input                        │  - Filter/search                        │  - Reset → hapus localStorage
          │  - API: POST /v3-opname-detail         │  - Update stats                         │    → navigateTo('perintah-so')
          │                                         │                                         │
          └─────────────────────────────────────────┼─────────────────────────────────────────┘
                                                    │
                                                    ▼
                                         ┌──────────────────────┐
                                         │     RIWAYAT SO       │
                                         │ ?page=riwayat-so     │
                                         └──────────────────────┘
                                                    │
                                                    │  - View Detail
                                                    │  - Download CSV
                                                    │  - Filter by bulan/tahun
                                                    ▼
                                         ┌──────────────────────┐
                                         │    DETAIL MODAL      │
                                         └──────────────────────┘
```

---

## 2. DAFTAR FILE YANG TERLIBAT

### 2.1 Frontend Files (Pages)

| No | File | Route | Fungsi |
|----|------|-------|--------|
| 1 | `pages/dashboard-so.html` | `dashboard-so` | Dashboard utama SO, KPI, Task checker |
| 2 | `pages/perintah-so.html` | `perintah-so` | CRUD perintah SO, detail modal |
| 3 | `pages/pelaksanaan-so.html` | `pelaksanaan-so` | Scan barcode, input qty fisik |
| 4 | `pages/riwayat-so.html` | `riwayat-so` | Riwayat hasil SO, detail modal |

### 2.2 Router

| No | File | Fungsi |
|----|------|--------|
| 1 | `js/app-router.js` | SPA router dengan cache mechanism |

### 2.3 Backend API Files

| No | File | Endpoint | Fungsi |
|----|------|----------|--------|
| 1 | `backend/v3-opname.js` | `GET/POST/PUT /api/v3-opname` | CRUD perintah SO, start/submit |
| 2 | `backend/v3-opname-detail.js` | `GET/POST /api/v3-opname-detail` | Detail produk, input qty fisik |
| 3 | `backend/opname-perintah.js` | `GET/POST/DELETE /api/opname-perintah` | List/hapus perintah SO |
| 4 | `backend/opname-history.js` | `GET /api/opname-history` | Riwayat SO |
| 5 | `backend/stok-opname-export.js` | `GET /api/opname-export` | Export CSV |

### 2.4 Main Application

| No | File | Fungsi |
|----|------|--------|
| 1 | `app.html` | Main SPA shell, navigation, auth |
| 2 | `api/index.js` | Route definitions |

---

## 3. DAFTAR ROUTE YANG DIGUNAKAN

| Halaman | Route Key | File Target |
|---------|-----------|-------------|
| Dashboard SO | `dashboard-so` | `pages/dashboard-so.html` |
| Perintah SO | `perintah-so` | `pages/perintah-so.html` |
| Pelaksanaan SO | `pelaksanaan-so` | `pages/pelaksanaan-so.html` |
| Riwayat SO | `riwayat-so` | `pages/riwayat-so.html` |

---

## 4. DAFTAR API YANG DIGUNAKAN

### 4.1 Dashboard SO Page
| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/opname-perintah` | GET | List perintah SO dengan filter bulan/tahun |
| `/api/v3-opname` | GET | Task checker yang sedang proses |
| `/api/v3-opname-detail` | GET | Detail produk per opname |

### 4.2 Perintah SO Page
| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/opname-perintah` | GET | List semua perintah SO |
| `/api/opname-perintah` | POST | Buat perintah SO baru |
| `/api/opname-perintah/:id` | DELETE | Hapus perintah SO |
| `/api/v3-opname` | PUT | Start SO (action: start) |

### 4.3 Pelaksanaan SO Page
| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/opname-perintah` | GET | Detail perintah SO aktif |
| `/api/v3-opname-detail` | GET | List produk untuk opname |
| `/api/v3-opname-detail` | POST | Input/update qty fisik |
| `/api/v3-opname` | PUT | Submit hasil SO (action: submit) |

### 4.4 Riwayat SO Page
| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/opname-history` | GET | List riwayat SO dengan filter |
| `/api/opname-history` | GET | Detail riwayat SO (detail=true) |
| `/api/opname-export` | GET | Export CSV |

---

## 5. DAFTAR localStorage YANG DIGUNAKAN

| Key | Tipe Data | Digunakan Di | Fungsi |
|-----|-----------|--------------|--------|
| `activePerintahId` | string | Pelaksanaan SO | ID perintah SO yang aktif |
| `activePerintahKode` | string | Pelaksanaan SO | Kode SO yang aktif |
| `activePerintahKategori` | string | Pelaksanaan SO | Kategori SO (modul/seragam/poster/lain_lain) |
| `auth_user` | JSON object | Semua page | Data user yang login |

---

## 6. HUBUNGAN ANTAR HALAMAN

### 6.1 Dashboard SO → Perintah SO
- **Aksi:** Klik "Buat Perintah SO" atau link "Lihat Semua"
- **Method:** `AppRouter.navigateTo('perintah-so')`
- **localStorage:** Tidak ada perubahan

### 6.2 Dashboard SO → Pelaksanaan SO (Task Checker)
- **Aksi:** Klik "Mulai SO" pada task checker
- **Method:** `startCheckerSo(perintahId)` → `AppRouter.navigateTo('pelaksanaan-so', { perintah_id: perintahId })`
- **BUG POTENSIAL:** Parameter `perintah_id` di-pass tapi **TIDAK DI-SAVE** ke localStorage!
- **localStorage:** ❌ TIDAK ADA yang di-set

### 6.3 Dashboard SO → Pelaksanaan SO (Quick Action)
- **Aksi:** Klik "Pelaksanaan SO" di quick action
- **Method:** `AppRouter.navigateTo('pelaksanaan-so')`
- **localStorage:** Tidak ada perubahan

### 6.4 Perintah SO → Pelaksanaan SO
- **Aksi:** Klik "Mulai SO" atau "Lihat Pelaksanaan"
- **Method:** `executePerintah(id, kodeSo)`
- **localStorage:** ✅ `activePerintahId`, `activePerintahKode`, `activePerintahKategori` di-set

### 6.5 Perintah SO → Riwayat SO
- **Aksi:** Klik "Riwayat SO" di quick action
- **Method:** `AppRouter.navigateTo('riwayat-so')`
- **localStorage:** Tidak ada perubahan

### 6.6 Pelaksanaan SO → Perintah SO
- **Aksi:** Klik "Kembali ke Perintah SO" atau Reset
- **Method:** `AppRouter.navigateTo('perintah-so')`
- **localStorage:** Dihapus (reset session)

### 6.7 Riwayat SO → Detail Modal
- **Aksi:** Klik "Lihat Detail"
- **Method:** `viewDetail(opnameId)` - modal inline
- **localStorage:** Tidak ada perubahan

---

## 7. DAFTAR BUG YANG DITEMUKAN

### BUG #1: Task SO Checker Tidak Menyerahkan Parameter ID ke localStorage ⚠️ CRITICAL

**Lokasi:** `pages/dashboard-so.html` baris 520-524

**Kode Bermasalah:**
```javascript
function startCheckerSo(perintahId) {
  AppRouter.navigateTo('pelaksanaan-so', { perintah_id: perintahId });
}
```

**Masalah:**
- Fungsi ini menerima `perintahId` tapi TIDAK menyimpannya ke localStorage
- Di `pelaksanaan-so.html`, `initPelaksanaanSo()` hanya membaca dari localStorage
- Karena localStorage kosong, halaman Pelaksanaan SO akan menampilkan "Tidak Ada Perintah SO Aktif"

**Dampak:** User checker tidak bisa memulai SO dari Dashboard SO

**Solusi:**
```javascript
function startCheckerSo(perintahId) {
  localStorage.setItem('activePerintahId', perintahId);
  // Perlu juga fetch data dulu untuk dapat kode_so dan kategori
  AppRouter.navigateTo('pelaksanaan-so');
}
```

---

### BUG #2: isScanning Dideklarasikan sebagai `let` (Bukan di Namespace) ⚠️ HIGH

**Lokasi:** `pages/pelaksanaan-so.html` baris 617

**Kode Bermasalah:**
```javascript
let isScanning = false;
```

**Masalah:**
- Variabel `isScanning` menggunakan `let` biasa, bukan di namespace `window.SOPelaksanaan`
- Saat SPA cache di-load ulang, variabel ini tidak di-reset
- Bisa menyebabkan scanner tidak berfungsi setelah navigation

**Dampak:** Scanner barcode tidak bisa di-restart setelah pertama kali digunakan

**Solusi:**
```javascript
window.SOPelaksanaan.isScanning = false;
```

---

### BUG #3: AppRouter.navigateTo Parameter Params Tidak Digunakan ⚠️ HIGH

**Lokasi:** `js/app-router.js` baris 42-62

**Kode:**
```javascript
navigateTo(page, replace = false) {
  // ... tidak ada penggunaan parameter kedua
}
```

**Masalah:**
- Fungsi `navigateTo` menerima parameter kedua `{ perintah_id: perintahId }` tapi TIDAK digunakan
- Parameter tersebut diabaikan, hanya `page` yang dipakai

**Dampak:** Tidak ada mekanisme untuk passing params antar halaman

---

### BUG #4: Parameter Query `perintah_id` Diabaikan di Pelaksanaan SO ⚠️ HIGH

**Lokasi:** `pages/pelaksanaan-so.html` baris 491-507

**Kode:**
```javascript
function initPelaksanaanSo() {
  // Ambil active perintah dari localStorage
  window.SOPelaksanaan.activePerintahId = localStorage.getItem('activePerintahId');
  window.SOPelaksanaan.activePerintahKode = localStorage.getItem('activePerintahKode');
  // ... tidak membaca dari URL params
}
```

**Masalah:**
- Ketika nav dari dashboard dengan params, params tidak dibaca
- Hanya localStorage yang dibaca

**Dampak:** Task checker tidak bisa dijalankan dari dashboard

---

### BUG #5: API Endpoint Parameter Mismatch ⚠️ MEDIUM

**Lokasi:** `pages/pelaksanaan-so.html` baris 547

**Kode:**
```javascript
const response = await fetch(`/api/v3-opname-detail?perintah_id=${...}&kategori=${kategoriId}`);
```

**Backend expects:** `opname_id` dan `kategori_id`

**Masalah:**
- Frontend mengirim `perintah_id` dan `kategori`
- Backend menerima `opname_id` dan `kategori_id`
- Parameter tidak cocok!

**Lihat `backend/v3-opname-detail.js` baris 14, 22:**
```javascript
const { opname_id, kategori_id } = req.query;  // Backend expects these
```

**Dampak:** API call gagal karena parameter salah

---

### BUG #6: Double Init di Pelaksanaan SO ⚠️ MEDIUM

**Lokasi:** `pages/pelaksanaan-so.html` baris 1087-1089

**Kode:**
```javascript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPelaksanaanSo);
} else {
  initPelaksanaanSo();
}
```

**Masalah:**
- Saat page load dari SPA cache, `initPelaksanaanSo()` dipanggil 2x:
  1. Dari `DOMContentLoaded` event listener
  2. Dari AppRouter `initPage()` yang memanggil `SOPelaksanaanInit()`

**Solusi yang sudah ada:**
- `SOPelaksanaanInit()` adalah wrapper yang memanggil `initPelaksanaanSo()`
- Tapi keduanya tetap dipanggil karena SPA cache mechanism

---

### BUG #7: Script Variables di Namespace Tidak Konsisten ⚠️ MEDIUM

**Lokasi:** `pages/pelaksanaan-so.html` baris 617-619

**Kode:**
```javascript
window.SOPelaksanaan = window.SOPelaksanaan || {};
window.SOPelaksanaan.html5QrCode = window.SOPelaksanaan.html5QrCode || null;
let isScanning = false;  // ❌ Tidak di namespace
```

**Masalah:**
- `html5QrCode` sudah di-namespaced
- `isScanning` TIDAK di-namespaced
- Inkonsisten dan bisa menyebabkan redeclaration error

---

### BUG #8: Reset localStorage Tidak Lengkap ⚠️ LOW

**Lokasi:** `pages/pelaksanaan-so.html` baris 1055-1056

**Kode:**
```javascript
function resetSoSession() {
  localStorage.removeItem('activePerintahId');
  localStorage.removeItem('activePerintahKode');
  // ❌ activePerintahKategori tidak dihapus!
}
```

**Masalah:**
- `activePerintahKategori` tidak dihapus saat reset
- Bisa menyebabkan stale data di session berikutnya

---

## 8. DAFTAR PERUBAHAN YANG HARUS DILAKUKAN

### Priority: CRITICAL

| No | File | Perubahan |
|----|------|-----------|
| 1 | `pages/dashboard-so.html` | Fix `startCheckerSo()` untuk save ke localStorage |
| 2 | `pages/pelaksanaan-so.html` | Fix `loadProdukList()` - parameter API mismatch |
| 3 | `js/app-router.js` | Implementasikan params passing ATAU hapus params dari caller |

### Priority: HIGH

| No | File | Perubahan |
|----|------|-----------|
| 4 | `pages/pelaksanaan-so.html` | Namespacakan `isScanning` ke `window.SOPelaksanaan` |
| 5 | `pages/pelaksanaan-so.html` | Baca URL params jika localStorage kosong |

### Priority: MEDIUM

| No | File | Perubahan |
|----|------|-----------|
| 6 | `pages/pelaksanaan-so.html` | Hapus `activePerintahKategori` saat reset |
| 7 | `pages/pelaksanaan-so.html` | Hindari double init (cleanup listener) |

### Priority: LOW

| No | File | Perubahan |
|----|------|-----------|
| 8 | Konsistensi | Pastikan semua state di-namespaced |

---

## 9. RINGKASAN

### Total Bug Ditemukan: 8

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 1 |

### Alur yang berfungsi:
- ✅ Perintah SO → Pelaksanaan SO (via `executePerintah()`)
- ✅ Perintah SO → Riwayat SO
- ✅ Pelaksanaan SO → Submit hasil
- ✅ Riwayat SO → View detail

### Alur yang BUGGY:
- ❌ Dashboard SO → Task Checker → Pelaksanaan SO (BUG #1, #3, #4)
- ❌ Scanner Barcode (BUG #2, #7)
- ❌ Reset Session (BUG #8)

---

## 10. RECOMMENDATIONS

1. **Segera Fix BUG #1** - Task checker tidak bisa dipakai
2. **Segera Fix BUG #5** - API parameter mismatch
3. **Evaluasi architecture params passing** - Apakah perlu SPA params atau cukup localStorage?
4. **Standarisasi namespace** - Semua state harus di `window.SOPelaksanaan` atau objek terkait
5. **Tambahkan unit test** untuk alur navigasi SO

---

*Report generated by AI Audit Agent*
