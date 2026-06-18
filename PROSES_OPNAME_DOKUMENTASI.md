# 📋 DOKUMENTASI PROSES STOK OPNAME (SO)

## CV EPIC Warehouse - Inventory Application

---

## 📌 RINGKASAN EKSEKUTIF

Proses **Stok Opname (SO)** adalah kegiatan pemeriksaan dan pencocokan stok fisik dengan stok sistem di gudang. Sistem ini mendukung **workflow lengkap** dari pembuatan perintah hingga penyesuaian stok.

---

## 🗂️ STRUKTUR DATABASE

### Tabel Utama

| Tabel | Deskripsi |
|-------|-----------|
| `stok_opname_perintah` | Master perintah SO (header) |
| `stok_opname` | Header hasil opname |
| `stok_opname_detail` | Detail item hasil opname per SKU |
| `stok_penyesuaian` | Record penyesuaian stok hasil opname |
| `produk` | Master data produk (SKU, nama, harga) |

### Schema: `stok_opname_perintah`

```sql
id                  SERIAL PRIMARY KEY
kode_so             VARCHAR(50) UNIQUE NOT NULL  -- Kode unik SO
tanggal_perintah    DATE NOT NULL               -- Tanggal perintah dibuat
bulan               INTEGER NOT NULL             -- Bulan periode SO
tahun               INTEGER NOT NULL            -- Tahun periode SO
svp_nama            VARCHAR(150) NOT NULL        -- Nama Supervisor
lokasi              VARCHAR(150)                -- Lokasi gudang
keterangan          TEXT                        -- Catatan
status              VARCHAR(30) DEFAULT 'menunggu'
checker             VARCHAR(150)                -- PIC checker gudang
kategori_targets    TEXT                        -- JSON array kategori target
opname_id           INTEGER REFERENCES stok_opname(id)
target_sku          INTEGER DEFAULT 0           -- Total SKU target
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()
started_at          TIMESTAMP                   -- Waktu mulai SO
completed_at        TIMESTAMP                   -- Waktu selesai SO
```

### Schema: `stok_opname`

```sql
id                  SERIAL PRIMARY KEY
tanggal             DATE NOT NULL              -- Tanggal pelaksanaan
total_item          INTEGER DEFAULT 0          -- Jumlah item dihitung
total_selisih       INTEGER DEFAULT 0           -- Total selisih absolut
total_item_selisih  INTEGER DEFAULT 0          -- Jumlah item ada selisih
total_selisih_net   INTEGER DEFAULT 0         -- Selisih net (+/-)
checker             VARCHAR(150)               -- PIC checker
lokasi              VARCHAR(150)               -- Lokasi
keterangan          TEXT                        -- Catatan
perintah_id         INTEGER REFERENCES stok_opname_perintah(id)
disesuaikan_at      TIMESTAMP                   -- Waktu stok disesuaikan
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()
```

### Schema: `stok_opname_detail`

```sql
id                  SERIAL PRIMARY KEY
opname_id           INTEGER NOT NULL REFERENCES stok_opname(id)
sku                 VARCHAR(50) NOT NULL REFERENCES produk(sku)
stok_sistem         INTEGER NOT NULL           -- Stok dari sistem
stok_fisik          INTEGER NOT NULL           -- Stok hasil hitung fisik
selisih             INTEGER NOT NULL            -- Fisik - Sistem
input_at            TIMESTAMP DEFAULT NOW()
UNIQUE (opname_id, sku)
```

---

## 🔄 WORKFLOW PROSES OPNAME

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WORKFLOW STOK OPNAME                            │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │ 1. PERINTAH  │  Admin membuat perintah SO baru
  │   (CREATE)   │  dengan kode, periode, supervisor
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ 2. DAFTAR    │  List semua perintah SO
  │   PERINTAH   │  dengan status (menunggu/proses/selesai)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ 3. MULAI SO  │  User memilih perintah → status "proses"
  │   (START)    │  Membuat header stok_opname
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────────────────┐
  │ 4. PELAKSANAAN - INPUT QTY FISIK                  │
  │                                                  │
  │  ┌────────────┐    ┌────────────┐                │
  │  │ SCAN/Scan  │    │  MANUAL    │                │
  │  │  Barcode   │    │  Input     │                │
  │  └─────┬──────┘    └─────┬──────┘                │
  │        │                 │                       │
  │        └────────┬────────┘                       │
  │                 ▼                                │
  │         ┌─────────────┐                         │
  │         │ Qty Fisik   │                         │
  │         │ per SKU      │                         │
  │         └──────┬──────┘                         │
  │                ▼                                 │
  │    ┌───────────────────────┐                     │
  │    │ Simpan ke             │                     │
  │    │ stok_opname_detail    │                     │
  │    └───────────────────────┘                     │
  └──────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │ 5. SUBMIT    │  User submit hasil → status "selesai"
  │   HASIL SO   │  Semua qty fisik disimpan
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ 6. RIWAYAT   │  View semua hasil SO selesai
  │   HASIL SO   │  dengan detail per item
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ 7. SESUAIKAN │  Admin menyesuaikan stok
  │   STOK       │  Membuat record di stok_penyesuaian
  │   (ADJUST)   │  Tandai disesuaikan_at
  └──────────────┘
```

---

## 📊 STATUS OPNAME

| Status | Label | Deskripsi |
|--------|-------|-----------|
| `menunggu` | Menunggu | Perintah dibuat, belum dimulai |
| `proses` | Proses | SO sedang dilaksanakan |
| `selesai` | Selesai | SO selesai, hasil tercatat |
| `ditolak` | Ditolak | SO ditolak admin |
| `recount` | Recount | Perlu hitung ulang |

---

## 📁 FILE-FILE TERKAIT OPNAME

### Backend (Node.js/Express)

| File | Fungsi |
|------|--------|
| `backend/opname-perintah.js` | CRUD perintah SO |
| `backend/simpan-opname.js` | Simpan hasil opname |
| `backend/sesuaikan-opname.js` | Penyesuaian stok |
| `backend/opname-history.js` | Riwayat hasil SO |
| `backend/opname-db-utils.js` | Utility database |
| `backend/opname-kategori-utils.js` | Kategori label |
| `backend/v3-opname.js` | API v3 opname |
| `backend/v3-opname-detail.js` | Detail opname v3 |
| `backend/approval-api.js` | Approval workflow |
| `backend/stok-opname-export.js` | Export hasil SO |

### Frontend (HTML/JS)

| File | Halaman |
|------|---------|
| `pages/perintah-so.html` | Halaman daftar & buat perintah SO |
| `pages/pelaksanaan-so.html` | Halaman input qty fisik |
| `pages/riwayat-so.html` | Halaman riwayat hasil SO |
| `pages/dashboard-so.html` | Dashboard SO |
| `js/dashboard-opname-perintah.js` | Logic perintah SO di dashboard |

---

## 🔌 API ENDPOINTS

### Perintah SO

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/opname-perintah` | List perintah (filter: bulan, tahun) |
| GET | `/api/opname-perintah/:id` | Detail perintah |
| POST | `/api/opname-perintah` | Buat perintah baru |
| POST | `/api/opname-perintah` (action=start) | Mulai SO |
| POST | `/api/opname-perintah` (action=update) | Update perintah |
| PUT | `/api/opname-perintah/:id` | Update status |
| DELETE | `/api/opname-perintah/:id` | Hapus perintah |

### Pelaksanaan SO

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/v3-opname-detail?opname_id=&kategori_id=` | List produk per kategori |
| POST | `/api/v3-opname-detail` | Input qty fisik per SKU |
| GET | `/api/produk-list` | List semua produk |
| PUT | `/api/v3-opname` (action=submit) | Submit hasil SO |

### Riwayat & Penyesuaian

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/opname-history` | List hasil SO |
| GET | `/api/opname-history?opname_id=&detail=true` | Detail hasil SO |
| POST | `/api/sesuaikan-opname` | Sesuaikan stok |
| GET | `/api/opname-export?opname_id=` | Export CSV |

---

## 📝 FIELD PERMINTAAN SO (POST /api/opname-perintah)

```javascript
{
  action: "create" | "start" | "update",
  kode_so: "SO-2026-06-001",      // Required (create)
  tanggal_perintah: "2026-06-18", // Required
  bulan: 6,                        // Required
  tahun: 2026,                     // Required
  svp_nama: "Nama Supervisor",     // Required
  pic_checker: "Nama PIC",        // Optional
  kategori_id: "modul",           // Optional (single)
  kategori_targets: ["modul", "seragam", "poster", "lain-lain"], // Optional (array)
  lokasi: "Gudang Utama",         // Optional
  keterangan: "Catatan"           // Optional
}
```

---

## 📝 FIELD SIMPAN OPNAME (POST /api/simpan-opname)

```javascript
{
  tanggal: "2026-06-18",
  perintah_id: 1,
  checker: "Nama Checker",
  lokasi: "Gudang Utama",
  keterangan: "Catatan",
  partial: false,
  items: [
    {
      sku: "SKU001",
      sistem: 100,  // Stok sistem
      fisik: 95     // Stok fisik hasil hitung
    },
    {
      sku: "SKU002",
      sistem: 50,
      fisik: 52
    }
  ]
}
```

---

## 📝 FIELD SESUAIKAN STOK (POST /api/sesuaikan-opname)

```javascript
{
  opname_id: 1
}
```

**Proses:**
1. Hapus penyesuaian lama dengan pattern `Stok Opname {kode_so} [opname:{id}]`
2. Insert penyesuaian baru untuk setiap item dengan selisih ≠ 0
3. Update `disesuaikan_at` pada header stok_opname

---

## 🎯 KATEGORI PRODUK

| ID | Label | Deskripsi |
|----|-------|-----------|
| `modul` | Modul | Produk modul belajar |
| `seragam` | Seragam | Produk seragam |
| `poster` | Poster | Produk poster |
| `lain_lain` / `lain-lain` | Lain-Lain | Produk lainnya |

---

## 💡 FITUR UTAMA

### 1. Perintah SO
- [x] Buat perintah SO dengan kode unik
- [x] Tentukan periode (bulan/tahun)
- [x] Pilih target SKU berdasarkan kategori
- [x] Assign supervisor (SVP) dan PIC checker
- [x] Track progress (target vs dicek)

### 2. Pelaksanaan SO
- [x] Scan barcode/SKU untuk input
- [x] Input manual qty fisik
- [x] Real-time progress tracking
- [x] Auto-calculate selisih
- [x] Histori scan terbaru

### 3. Riwayat & Detail
- [x] View semua hasil SO per periode
- [x] Detail per SKU (sistem vs fisik)
- [x] Total selisih dan item bermasalah
- [x] Export CSV

### 4. Penyesuaian Stok
- [x] Adjust stok berdasarkan selisih
- [x] Cegah double adjustment
- [x] Track timestamp penyesuaian
- [x] Bulk insert ke stok_penyesuaian

---

## 🔍 ALUR DATA

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Admin     │      │  stok_opname_    │      │   stok_opname   │
│   Buat      │ ───► │  perintah        │ ───► │   (header)      │
│   Perintah  │      │                  │      │                 │
└─────────────┘      └──────────────────┘      └────────┬────────┘
                                                        │
       ┌────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐      ┌──────────────────────┐
│   User      │      │   stok_opname_detail │
│   Input     │ ───► │   (per SKU)          │
│   Qty Fisik │      │                      │
└─────────────┘      └──────────────────────┘
       │
       ▼
┌─────────────┐      ┌──────────────────────┐
│   Submit    │      │   Update status      │
│   Hasil     │ ───► │   perintah → selesai │
└─────────────┘      └──────────────────────┘
       │
       ▼
┌─────────────┐      ┌──────────────────────┐
│   Admin     │      │   stok_penyesuaian   │
│   Sesuai    │ ───► │   (adjustment)       │
│   kan Stok  │      │                      │
└─────────────┘      └──────────────────────┘
```

---

## 📈 TRACKING & METRICS

### Progress Calculation

```javascript
progress_percent = (checked_sku / target_sku) * 100
```

### Total Selisih

```javascript
total_selisih = SUM(ABS(stok_fisik - stok_sistem))
total_selisih_net = SUM(stok_fisik - stok_sistem)
total_item_selisih = COUNT(selisih ≠ 0)
```

---

## 🛡️ VALIDASI

1. **Kode SO Unik** - Tidak boleh duplikat
2. **SKU Valid** - Harus ada di master produk
3. **Status Transisi** - Hanya dari `menunggu` ke `proses`, `proses` ke `selesai`
4. **Belum Disesuaikan** - Tidak bisa adjust twice
5. **Periode Valid** - Bulan 1-12, tahun > 2000

---

## 📄 Dokumen ini terakhir di-update: 2026-06-18

*Generated from codebase analysis of inventory-app-new*
