# 🔍 AUDIT LANJUTAN - SPA ROUTER & GLOBAL STATE
**Date**: 2026-06-15  
**Branch**: sprint-4-modul-persediaan  
**Status**: READY FOR APPROVAL

---

## 1. SELURUH VARIABLE GLOBAL (let/const/var)

### dashboard.js
```javascript
// window.Dashboard = { ... }  // Object declaration (OK, wrapped)
```
**Status**: ✅ Already wrapped with guard

---

### penjualan.html (line 580+)
```javascript
let penjualanList = [];        // ❌ LINE 582 - PROBLEMATIC
let currentPage = 1;           // ❌ LINE 583 - PROBLEMATIC
let totalPages = 1;             // ❌ LINE 584 - PROBLEMATIC
let totalData = 0;              // ❌ LINE 585 - PROBLEMATIC
let editingId = null;           // ❌ LINE 586 - PROBLEMATIC
let deleteId = null;            // ❌ LINE 587 - PROBLEMATIC
let searchTimeout = null;       // ❌ LINE 588 - PROBLEMATIC
let produkList = [];            // ❌ LINE 589 - PROBLEMATIC
let outletList = [];            // ❌ LINE 590 - PROBLEMATIC
```

---

### pembelian.html (line 574+)
```javascript
let pembelianList = [];         // ❌ LINE 575 - PROBLEMATIC
let transactionItems = [];      // ❌ LINE 576 - PROBLEMATIC
let editingId = null;           // ❌ LINE 577 - PROBLEMATIC
let deleteId = null;            // ❌ LINE 578 - PROBLEMATIC
let debounceTimer = null;       // ❌ LINE 579 - PROBLEMATIC
let currentPage = 1;            // ❌ LINE 580 - PROBLEMATIC
```

---

### persediaan.html (line 422+)
```javascript
let stokPeriodeData = [];       // ❌ LINE 424 - PROBLEMATIC
let kartuStokData = [];         // ❌ LINE 425 - PROBLEMATIC
let currentPagePeriode = 1;     // ❌ LINE 426 - PROBLEMATIC
let currentPageKartu = 1;       // ❌ LINE 427 - PROBLEMATIC
let debounceTimerPeriode = null; // ❌ LINE 428 - PROBLEMATIC
let debounceTimerKartu = null;  // ❌ LINE 429 - PROBLEMATIC
let selectedKategori = 'semua'; // ❌ LINE 430 - PROBLEMATIC
```

---

## 2. SELURUH FUNCTION GLOBAL

### penjualan.html - 9 functions
| Line | Function |
|------|----------|
| 631 | `loadPenjualan()` |
| 806 | `loadOutlets()` |
| 828 | `loadProduk()` |
| 892 | `processImport()` |
| 1144 | `saveAllPenjualan()` |
| 1266 | `viewPenjualan(id)` |
| 1321 | `editPenjualan(id)` |
| 1391 | `confirmDelete()` |
| 1484 | `initPenjualanPage()` |

### pembelian.html - 9 functions
| Line | Function |
|------|----------|
| 597 | `loadProduk()` |
| 641 | `loadSupplier()` |
| 670 | `loadPembelian()` |
| 890 | `processImport()` |
| 1085 | `saveAllPembelian()` |
| 1207 | `viewPembelian(id)` |
| 1262 | `editPembelian(id)` |
| 1329 | `confirmDelete()` |
| 1421 | `initPembelianPage()` |

### persediaan.html - 18 functions
| Line | Function |
|------|----------|
| 440 | `switchTab(tabName)` |
| 463 | `formatNumber(num)` |
| 468 | `formatDate(dateStr)` |
| 480 | `initializeDropdowns()` |
| 505 | `loadProdukDropdown()` |
| 529 | `renderProdukDropdown(produkList)` |
| 541 | `debounceSearchPeriode()` |
| 549 | `filterKategori(element, kategori)` |
| 560 | `loadStokPeriode(page)` |
| 628 | `renderPeriodeTable(data)` |
| 660 | `renderPaginationPeriode(pagination)` |
| 728 | `debounceSearchKartu()` |
| 736 | `loadKartuStok(page)` |
| 803 | `renderKartuTable(data)` |
| 847 | `getAktivitasClass(aktivitas)` |
| 860 | `renderPaginationKartu(pagination)` |
| 931 | `exportExcel()` |
| 992 | `showToast(message, isSuccess)` |
| 1025 | `initPersediaanPage()` |

---

## 3. APP-ROUTER FLOW ANALYSIS

### Current Flow (app-router.js)
```
loadPage(page)
├── IF cached:
│   ├── container.appendChild(loadedPages[page].cloneNode(true))
│   └── initPage(page)
│
└── IF NOT cached:
    ├── fetch HTML
    ├── container.innerHTML = html
    ├── executeScripts(container)  ← Creates new <script> elements
    ├── loadedPages[page] = container.cloneNode(true)  ← Clones WITH scripts
    └── initPage(page)
```

### Problem in executeScripts():
```javascript
executeScripts(container) {
  const scripts = container.querySelectorAll('script');
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    // Copy attributes & content
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode.replaceChild(newScript, oldScript);
    // ⚠️ newScript is created but NOT executed here
  });
}
```

---

## 4. ROOT CAUSE ANALYSIS

### Why Scripts Still Execute

**Step 1-4: First Load**
```
container.innerHTML = html        // Browser parses HTML, executes scripts
executeScripts()                  // Replaces oldScript with newScript
loadedPages[page] = cloneNode(true) // Clones DOM WITH script elements
```

**Step 5-8: Return from Cache**
```
container.appendChild(loadedPages[page].cloneNode(true))
                                     ↑ CloneNode creates NEW script elements
                                     ↓ These scripts execute IMMEDIATELY
"Identifier 'transactionItems' has already been declared"
```

### SPEC BEHAVIOR EXPLANATION
When `cloneNode(true)` is called on a DOM element containing `<script>` tags:
- **Inline scripts DO execute** when cloned and inserted into DOM
- Scripts execute **IMMEDIATELY** when inserted via `appendChild()`
- This is browser behavior, not a bug

### Summary
| Problem | Cause |
|---------|-------|
| Scripts execute on cache restore | `cloneNode(true)` triggers script execution |
| Global variables conflict | `let x` redeclared on re-execution |
| `transactionItems` error | `let transactionItems` in pembelian.html |
| `penjualanList` error | `let penjualanList` in penjualan.html |
| `stokPeriodeData` error | `let stokPeriodeData` in persediaan.html |

---

## 5. PROPOSED FIX (Revised - Strip Scripts from Cache)

### Better Approach: Strip Scripts Before Caching

Instead of changing all variable declarations, the cleanest fix is:

**Modify app-router.js to strip scripts before caching:**
```javascript
// After executeScripts(), before caching:
const scripts = container.querySelectorAll('script');
scripts.forEach(s => {
  // Remove script tags from cached DOM
  // Scripts will be re-injected on restore
});
loadedPages[page] = container.cloneNode(true);
```

Then on restore:
```javascript
if (this.loadedPages[page]) {
  container.innerHTML = '';  // Clear
  // Re-fetch just the scripts from cache
  const cachedHTML = this.loadedPages[page];
  container.appendChild(cachedHTML.cloneNode(true));
  // Re-inject scripts fresh
  const freshScripts = cachedHTML.querySelectorAll('script');
  freshScripts.forEach(s => {
    const newScript = document.createElement('script');
    newScript.textContent = s.textContent;
    container.appendChild(newScript);
  });
  this.initPage(page);
  return;
}
```

---

### Alternative Fix: Namespace Pattern (More Invasive)

If we want to keep scripts in cache, we need to change all `let` to namespace:

**penjualan.html** - Change ALL state variables:
```javascript
// Line 580 - Replace all "let x" with:
const P = window.PenjualanPage = window.PenjualanPage || {
  penjualanList: [],
  currentPage: 1,
  totalPages: 1,
  totalData: 0,
  editingId: null,
  deleteId: null,
  searchTimeout: null,
  produkList: [],
  outletList: []
};
// Then add convenience references:
var {penjualanList, currentPage, totalPages, totalData, editingId, deleteId, searchTimeout, produkList, outletList} = P;
```

**pembelian.html** - Change ALL state variables:
```javascript
// Line 574 - Replace all "let x" with:
const P = window.PembelianPage = window.PembelianPage || {
  pembelianList: [],
  transactionItems: [],
  editingId: null,
  deleteId: null,
  debounceTimer: null,
  currentPage: 1
};
```

**persediaan.html** - Change ALL state variables:
```javascript
// Line 422 - Replace all "let x" with:
const P = window.PersediaanPage = window.PersediaanPage || {
  stokPeriodeData: [],
  kartuStokData: [],
  currentPagePeriode: 1,
  currentPageKartu: 1,
  debounceTimerPeriode: null,
  debounceTimerKartu: null,
  selectedKategori: 'semua'
};
```

---

## RECOMMENDED FIX (User's Approach: Namespace Pattern)

Per user request, gunakan namespace pattern untuk wrap state variables:

### Files to Modify:

**1. pages/penjualan.html (replace state section)**
```javascript
// Replace lines 580-590 with:
window.PenjualanPage = window.PenjualanPage || {
  penjualanList: [],
  transactionItems: [],
  currentPage: 1,
  totalPages: 1,
  totalData: 0,
  editingId: null,
  deleteId: null,
  searchTimeout: null,
  produkList: [],
  outletList: []
};
```

**2. pages/pembelian.html (replace state section)**
```javascript
// Replace lines 574-580 with:
window.PembelianPage = window.PembelianPage || {
  pembelianList: [],
  transactionItems: [],
  editingId: null,
  deleteId: null,
  debounceTimer: null,
  currentPage: 1
};
```

**3. pages/persediaan.html (replace state section)**
```javascript
// Replace lines 422-430 with:
window.PersediaanPage = window.PersediaanPage || {
  stokPeriodeData: [],
  kartuStokData: [],
  currentPagePeriode: 1,
  currentPageKartu: 1,
  debounceTimerPeriode: null,
  debounceTimerKartu: null,
  selectedKategori: 'semua'
};
```

**4. js/pages/dashboard.js** - ✅ Already fixed with guard

---

## IMPACT SUMMARY

| Item | Before Fix | After Fix |
|------|------------|-----------|
| Files Modified | 4 | 4 |
| Variable Changes | 24 vars | 24 vars wrapped |
| Function Changes | 0 | 0 |
| UI Changes | 0 | 0 |
| API Changes | 0 | 0 |
| Database Changes | 0 | 0 |

---

## APPROVAL CHECKLIST

- [ ] Approve namespace pattern fix
- [ ] Approve files to modify (4 files)
- [ ] Ready to code

---

## PENDING APPROVAL

**DO NOT CODE UNTIL APPROVED**

If approved, I will:
1. Apply namespace pattern to all 4 pages
2. Test 20x navigation without errors
3. Verify no console errors
4. Commit with clear message
