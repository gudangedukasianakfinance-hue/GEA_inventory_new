# AUDIT REPORT - CHECKER OWNERSHIP FLOW

## TANGGAL AUDIT: 2026-06-17

---

## 1. DAFTAR KESELURUHAN PENGGUNAAN `pic_checker`

### 1.1 Backend: `backend/opname-perintah.js`

| No | Line | Konteks | Fungsi |
|----|------|---------|--------|
| 1 | 57 | Response GET by ID | Mengembalikan `pic_checker` dari database |
| 2 | 92 | Response GET List | Mengembalikan `pic_checker` dari database |
| 3 | 122 | UPDATE status 'proses' | `SET checker = COALESCE(NULLIF($2, ''), checker)` |
| 4 | 123 | UPDATE status 'proses' | Param: `[perintahId, body.pic_checker \|\| body.checker \|\| null]` |
| 5 | 141 | Variabel | `const picChecker = body.pic_checker;` |
| 6 | 163 | UPDATE perintah | `pic_checker = $4` |
| 7 | 177 | Variabel | `const picChecker = body.pic_checker;` |
| 8 | 199 | INSERT perintah | `pic_checker` di-INSERT ke database |

### 1.2 Frontend: `pages/perintah-so.html`

| No | Line | Konteks | Fungsi |
|----|------|---------|--------|
| 1 | 289 | Render table | Menampilkan `item.pic_checker` di kolom tabel |
| 2 | 391 | Form input | Mengambil value dari `#perintahPicChecker` |
| 3 | 455 | Modal detail | Menampilkan `item.pic_checker` |

---

## 2. DAFTAR KESELURUHAN PENGGUNAAN `checker`

### 2.1 Backend: `backend/opname-perintah.js`

| No | Line | Konteks | Fungsi |
|----|------|---------|--------|
| 1 | 58 | Response GET by ID | Mengembalikan `checker` dari database |
| 2 | 93 | Response GET List | Mengembalikan `checker` dari database |
| 3 | 122 | UPDATE status 'proses' | `SET checker = COALESCE(NULLIF($2, ''), checker)` |
| 4 | 123 | UPDATE status 'proses' | Param: `[perintahId, body.pic_checker \|\| body.checker \|\| null]` |
| 5 | 163 | UPDATE perintah | `checker = COALESCE(NULLIF($12, ''), checker)` |
| 6 | 199 | INSERT perintah | `checker` di-INSERT ke database |

### 2.2 Backend: `backend/v3-opname.js`

| No | Line | Konteks | Fungsi |
|----|------|---------|--------|
| 1 | 56 | GET response | `sop.checker` di-select |
| 2 | 142 | PUT body | `const { id, action, checker, lokasi } = req.body;` |
| 3 | 168 | UPDATE status 'start' | `SET status = 'proses', started_at = NOW(), checker = $2` |
| 4 | 170 | UPDATE status 'start' | Param: `[id, checker \|\| null]` |
| 5 | 174 | INSERT header | `stok_opname (tanggal, ..., checker, lokasi)` |
| 6 | 177 | INSERT header | `checker \|\| null` |

### 2.3 Frontend: `pages/dashboard-so.html`

| No | Line | Konteks | Fungsi |
|----|------|---------|--------|
| 1 | 455 | Comment | `// Get SO with status = proses and pic_checker = user` |
| 2 | 465-466 | Filter | `item.pic_checker === userNama \|\| item.pic_checker_name === userNama` |

---

## 3. DAFTAR KESELURUHAN PENGGUNAAN `checker_name`

### 3.1 Frontend: `pages/dashboard-so.html`

| No | Line | Konteks | Fungsi |
|----|------|---------|--------|
| 1 | 466 | Filter task | `item.pic_checker_name === userNama` |

**Catatan:** `checker_name` tidak ada di backend - ini adalah field yang tidak pernah terisi!

---

## 4. FIELD apa yang SEBENARNYA ADA di DATABASE?

### Schema: `stok_opname_perintah`

| Field | Type | Ada? | Keterangan |
|-------|------|------|------------|
| `pic_checker` | VARCHAR(255) | ✅ | Dari migration `002_add_pic_kategori_to_perintah.sql` |
| `checker` | VARCHAR(150) | ✅ | Dari schema.sql original |
| `checker_name` | - | ❌ | TIDAK ADA di database! |

### Schema: `stok_opname`

| Field | Type | Ada? | Keterangan |
|-------|------|------|------------|
| `checker` | VARCHAR(100) | ✅ | Dari schema.sql |

---

## 5. APAKAH MASIH DIPAKAI UNTUK OWNERSHIP TASK?

### Jawaban: **TIDAK ADA SISTEM OWNERSHIP**

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah ada assignment checker saat buat perintah? | ❌ **TIDAK** - `pic_checker` tidak wajib di form |
| Apakah ada filter berdasarkan checker? | ❌ **TIDAK** - filter hanya berdasarkan `status=proses` |
| Apakah ada authorization berdasarkan checker? | ❌ **TIDAK** |
| Apakah ada ownership claim system? | ❌ **TIDAK** |

**Kenyataan:**
- `pic_checker` hanya **DISIMPAN** ke database
- **TIDAK ADA** logic untuk membatasi siapa yang bisa mengerjakan task
- **TIDAK ADA** authorization checker
- Task SO di-DASHBOARD SO ditampilkan berdasarkan `status=proses` saja
- Filter `pic_checker === userNama` **TIDAK AKAN PERNAH MATCH** karena:
  1. Backend `/api/v3-opname` TIDAK return field `pic_checker`
  2. Backend `/api/v3-opname` HANYA return field `checker`

---

## 6. APAKAH MASIH DIPAKAI UNTUK FILTER TASK CHECKER?

### Jawaban: **TIDAK - FILTER TIDAK AKAN BEKERJA**

**Filter saat ini (dashboard-so.html):**
```javascript
// Filter by pic_checker
if (userNama) {
  items = items.filter(item =>
    item.pic_checker === userNama ||
    item.pic_checker_name === userNama  // ❌ Field tidak ada di API
  );
}
```

**API Response dari `/api/v3-opname?status=proses`:**
```json
{
  "commands": [{
    "id": 1,
    "kode_so": "SO-001",
    "checker": "John Doe",      // ← Field yang ADA
    "pic_checker": undefined,    // ← Field yang TIDAK ADA di response!
    "pic_checker_name": undefined
  }]
}
```

**Masalah:**
1. API `v3-opname.js` **TIDAK SELECT `pic_checker`** - hanya select `checker`
2. Filter `pic_checker === userNama` akan **SELALU FALSE**
3. Filter `pic_checker_name` akan **SELALU FALSE** (field tidak ada)

---

## 7. APAKAH MASIH DIPAKAI UNTUK ASSIGNMENT CHECKER?

### Jawaban: **SEBAGIAN - INPUT ADA, TAPI TIDAK WAJIB**

**Form Buat Perintah (perintah-so.html):**
```html
<div class="form-group">
  <label>PIC Checker</label>
  <input type="text" id="perintahPicChecker" placeholder="Nama PIC Checker Gudang">
</div>
```

**Masalah:**
1. Input `pic_checker` adalah **OPSIONAL** (tidak ada `required`)
2. Bisa kosong saat submit
3. Ketika kosong, `checker` di-database juga tidak ter-set

---

## 8. DIAGRAM FLOW OWNERSHIP AKTUAL

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLOW CHECKER OWNERSHIP - ACTUAL                        │
└─────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────┐
  │   ADMIN BUAT SO     │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  Form Perintah SO   │     ┌─────────────────────────┐
  │  - Kode SO          │     │  INPUT (OPSIONAL)       │
  │  - PIC Checker ─────┼────►│  pic_checker = ""       │
  │  - Kategori         │     │  (bisa kosong)          │
  └──────────┬──────────┘     └─────────────────────────┘
             │
             ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  DATABASE: stok_opname_perintah                                      │
  │  ┌────────────────────────────────────────────────────────────────┐ │
  │  │ id | kode_so | pic_checker | checker | status | ...            │ │
  │  │ 1  | SO-001  | (kosong)   | NULL   | menunggu                  │ │
  │  └────────────────────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌─────────────────────┐
  │  MULAI SO           │
  │  (executePerintah)  │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  v3-opname.js - PUT action='start'                                   │
  │  body: { id, action, checker, lokasi }                               │
  │                                                                      │
  │  UPDATE stok_opname_perintah                                         │
  │    SET status = 'proses', checker = $2                               │
  │    WHERE id = $1                                                     │
  │                                                                      │
  │  checker = NULL (karena body.checker kosong)                         │
  └─────────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  DATABASE: stok_opname_perintah (setelah start)                      │
  │  ┌────────────────────────────────────────────────────────────────┐ │
  │  │ id | kode_so | pic_checker | checker | status | ...            │ │
  │  │ 1  | SO-001  | (kosong)   | NULL   | proses                    │ │
  │  └────────────────────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  DASHBOARD SO - Task Checker                                         │
  │  ┌────────────────────────────────────────────────────────────────┐  │
  │  │ API: /api/v3-opname?status=proses                              │  │
  │  │                                                                 │  │
  │  │ Response:                                                       │  │
  │  │ { commands: [{ id, kode_so, checker, ... }] }                   │  │
  │  │                           ↑                                     │  │
  │  │                    checker ADA, pic_checker TIDAK ADA          │  │
  │  └────────────────────────────────────────────────────────────────┘  │
  │             │                                                        │
  │             ▼                                                        │
  │  ┌────────────────────────────────────────────────────────────────┐  │
  │  │ Filter: item.pic_checker === userNama                          │  │
  │  │                                                                 │  │
  │  │ item.pic_checker = undefined                                   │  │
  │  │ userNama = "John Doe"                                          │  │
  │  │                                                                 │  │
  │  │ undefined === "John Doe" = FALSE ❌                             │  │
  │  └────────────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌─────────────────────┐
  │  TASK TIDAK MUNCUL │
  │  ❌ FILTER GAGAL    │
  └─────────────────────┘
```

---

## 9. KESIMPULAN

### Sistem Checker Ownership Saat Ini:

| Komponen | Status | Keterangan |
|----------|--------|------------|
| Input `pic_checker` | ⚠️ Ada tapi OPSIONAL | Form tidak wajib diisi |
| Field `pic_checker` di DB | ✅ Ada | Tapi hampir selalu kosong |
| Field `checker` di DB | ✅ Ada | Terisi saat start (bisa NULL) |
| Filter task oleh `pic_checker` | ❌ TIDAK BEKERJA | Field tidak ada di API |
| Filter task oleh `checker` | ❌ TIDAK ADA | Tidak ada filter di frontend |
| Authorization checker | ❌ TIDAK ADA | Semua user bisa lihat task |
| Claim system | ❌ TIDAK ADA | Tidak ada mekanisme claim |

### Flow Aktual:

1. Admin buat SO → `pic_checker` kosong
2. User mulai SO → `checker` = NULL
3. Task muncul di dashboard → tanpa filter checker
4. **Semua checker melihat SEMUA task proses** (bukan miliknya saja)

### Tidak Ada Ownership:
- **TIDAK ADA** mekanisme untuk memastikan task hanya dilihat oleh checker yang ditugaskan
- **TIDAK ADA** authorization
- **TIDAK ADA** claim system

---

*Report generated by AI Audit Agent*
