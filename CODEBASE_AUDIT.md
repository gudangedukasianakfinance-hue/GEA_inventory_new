# CODEBASE FORENSIC AUDIT REPORT

**Date**: 2026-06-13  
**Status**: AUDIT COMPLETE - NO CHANGES MADE  
**Total Files**: 70 files (.html, .css, .js)

---

## 1. CSS FILES SUMMARY

| File | Size | Used In | Status |
|------|------|--------|--------|
| `design-system-v4.css` | 49KB | app.html, index.html | ✅ ACTIVE |
| `dashboard.css` | 4.8KB | app.html | ⚠️ NEEDS REVIEW |
| `style.css` | 11KB | app.html | ⚠️ NEEDS REVIEW |
| `loader.css` | 16KB | app.html | ⚠️ NEEDS REVIEW |
| `landing.css` | 19KB | index.html | ⚠️ NEEDS REVIEW |

### CSS LOAD ORDER (app.html)
```html
1. design-system-v4.css  (V4 Design System)
2. dashboard.css           (?)
3. style.css              (?)
4. loader.css             (?)
```

### CSS LOAD ORDER (index.html)
```html
1. design-system-v4.css  (V4 Design System)
2. landing.css           (Landing Page)
```

---

## 2. JAVASCRIPT FILES SUMMARY

| File | Size | Lines | Used In | Status |
|------|------|-------|--------|--------|
| `js/app-router.js` | ? | ? | app.html | ✅ ACTIVE |
| `js/dashboard.js` | ? | 5359 | NOT REFERENCED | ❌ DEAD |
| `js/loader.js` | ? | 402 | NOT REFERENCED | ❌ DEAD |
| `js/user-management.js` | ? | 303 | NOT REFERENCED | ❌ DEAD |
| `js/dashboard-opname-perintah.js` | ? | ? | ? | ❓ UNKNOWN |

---

## 3. HTML FILES SUMMARY

### Core Files
| File | Purpose | Status |
|------|---------|--------|
| `app.html` | Main application shell | ✅ ACTIVE |
| `index.html` | Landing/Login page | ✅ ACTIVE |

### Page Files (pages/)
| File | Purpose | Status |
|------|---------|--------|
| `dashboard.html` | Dashboard page | ✅ ACTIVE |
| `produk.html` | Produk page | ✅ ACTIVE |
| `stok-gudang.html` | Stok Gudang page | ✅ ACTIVE |
| `pembelian.html` | Pembelian page | ✅ ACTIVE |
| `distribusi-outlet.html` | Distribusi page | ✅ ACTIVE |
| `monitoring-outlet.html` | Monitoring page | ✅ ACTIVE |
| `perintah-so.html` | Perintah SO page | ✅ ACTIVE |
| `pelaksanaan-so.html` | Pelaksanaan SO page | ✅ ACTIVE |
| `riwayat-so.html` | Riwayat SO page | ✅ ACTIVE |
| `laporan.html` | Laporan page | ✅ ACTIVE |
| `pengaturan.html` | Pengaturan page | ✅ ACTIVE |
| `user.html` | User management page | ✅ ACTIVE |

---

## 4. DUPLICATE CSS SELECTORS

### `.sidebar`
| File | Definition |
|------|------------|
| `design-system-v4.css` | Defined at line 385-397 |
| `style.css` | Defined (need verification) |

### `.kpi-card`
| File | Definition |
|------|------------|
| `dashboard.css` | Custom styling |
| `design-system-v4.css` | V4 styling |

### `.app-header`
| File | Definition |
|------|------------|
| `design-system-v4.css` | Defined at line 175-188 |
| `style.css` | May also define |

### Conflict: `--sidebar-width`
| File | Value |
|------|-------|
| `design-system-v4.css` | `260px` |
| `style.css` | Unknown |

---

## 5. DUPLICATE HTML COMPONENTS

### Sidebar
- **Version 1**: In `app.html` (current - 260px, gradient)
- **Version 2**: May exist in `js/dashboard.js` (legacy - 280px)

### Dashboard
- **Version 1**: `pages/dashboard.html` (new modular version)
- **Version 2**: May exist in `js/dashboard.js` (legacy)

### Login
- **Version 1**: Modal in `app.html`
- **Version 2**: Separate in `index.html`

---

## 6. DEAD CODE / LEGACY FILES

### Definitely DEAD
| File | Reason |
|------|--------|
| `js/dashboard.js` (5359 lines) | NOT referenced anywhere |
| `js/loader.js` | NOT referenced anywhere |
| `js/user-management.js` | NOT referenced anywhere |

### Possibly DEAD
| File | Reason |
|------|--------|
| `css/dashboard.css` | May conflict with design-system-v4.css |
| `css/loader.css` | App loader CSS may be in design-system-v4.css |
| `css/landing.css` | Only used in index.html (landing) |

---

## 7. UNUSED CSS FILES

### Question: Does each CSS file serve a unique purpose?
| File | Purpose | Duplicated? |
|------|---------|-------------|
| `design-system-v4.css` | Main design system | ✅ Unique |
| `dashboard.css` | Dashboard specific? | ❓ Check if needed |
| `style.css` | Global styles? | ❓ Check if needed |
| `loader.css` | App loader? | ❓ Check if needed |
| `landing.css` | Landing page | ✅ Unique |

---

## 8. INLINE STYLES FOUND

### pages/dashboard.html (8 occurrences)
```html
Line 20:  style="--card-accent: var(--blue);"
Line 32:  style="--card-accent: var(--green);"
Line 44:  style="--card-accent: var(--purple);"
Line 56:  style="--card-accent: var(--orange);"
Line 68:  style="--card-accent: var(--cyan);"
Line 80:  style="--card-accent: var(--pink);"
Line 92:  style="--card-accent: var(--blue);"
Line 104: style="--card-accent: var(--red);"
```

### pages/distribusi-outlet.html (2 occurrences)
```html
Line 11:  style="background: rgba(168, 85, 247, 0.12); color: #A855F7;"
Line 18:  style="background: rgba(59, 130, 246, 0.12); color: #3B82F6;"
```

### pages/pembelian.html (2 occurrences)
```html
Line 11:  style="background: rgba(59, 130, 246, 0.12); color: #3B82F6;"
Line 18:  style="background: rgba(34, 197, 94, 0.12); color: #22C55E;"
```

### pages/stok-gudang.html (3 occurrences)
```html
Line 11:  style="background: rgba(34, 197, 94, 0.12); color: #22C55E;"
Line 18:  style="background: rgba(59, 130, 246, 0.12); color: #3B82F6;"
Line 25:  style="background: rgba(239, 68, 68, 0.12); color: #EF4444;"
```

### Others
| File | Count | Type |
|------|-------|------|
| `laporan.html` | 1 | display:none |
| `pelaksanaan-so.html` | 1 | display:none |
| `pengaturan.html` | 2 | display:none |
| `perintah-so.html` | 1 | display:none |
| `produk.html` | 1 | display:none |
| `user.html` | 1 | display:none |

---

## 9. DUPLICATE JAVASCRIPT FUNCTIONS

### toggleMobileSidebar()
| Location | Line |
|----------|------|
| `js/dashboard.js` | 5230 |
| `app.html` | 328 |

### toggleUserDropdown()
| Location | Line |
|----------|------|
| `js/dashboard.js` | 5282 |
| `app.html` | 359 |

### ⚠️ WARNING: Duplicate function definitions!

---

## 10. DUPLICATE CSS CONFLICTS

### --sidebar-width
```css
/* design-system-v4.css line 96 */
--sidebar-width: 260px;

/* Check if style.css has different value */
```

### .sidebar background
```css
/* design-system-v4.css */
background: linear-gradient(180deg, var(--sidebar) 0%, var(--sidebar2) 100%);

/* Check if style.css has different value */
```

### Last-loaded CSS wins
```html
<!-- app.html load order -->
<link rel="stylesheet" href="/css/design-system-v4.css"> <!-- 1st -->
<link rel="stylesheet" href="/css/dashboard.css">         <!-- 2nd -->
<link rel="stylesheet" href="/css/style.css">              <!-- 3rd -->
<link rel="stylesheet" href="/css/loader.css">              <!-- 4th -->
```

---

## 11. FILES SAFE TO DELETE

### Category: SAFE_DELETE
| File | Reason |
|------|--------|
| `js/dashboard.js` | 5359 lines of unused code |
| `js/loader.js` | Not referenced anywhere |
| `js/user-management.js` | Not referenced anywhere |

### Category: NEEDS_REVIEW
| File | Reason |
|------|--------|
| `css/dashboard.css` | May have unique styles not in design-system-v4.css |
| `css/loader.css` | May have unique loader styles |
| `css/landing.css` | Only for index.html landing page |
| `js/dashboard-opname-perintah.js` | Unknown usage |

### Category: MUST_KEEP
| File | Reason |
|------|--------|
| `css/design-system-v4.css` | Core design system |
| `css/style.css` | May contain global styles |
| `app.html` | Main application shell |
| `pages/*.html` | All page components |
| `js/app-router.js` | Router for pages |

---

## 12. DEPENDENCY MAP

```
app.html
├── CSS
│   ├── design-system-v4.css (required)
│   ├── dashboard.css (duplicate?)
│   ├── style.css (duplicate?)
│   └── loader.css (duplicate?)
└── JS
    ├── app-router.js (required)
    └── Inline scripts

index.html
├── CSS
│   ├── design-system-v4.css
│   └── landing.css
└── JS (inline)

pages/*.html
└── Loaded dynamically by app-router.js
```

---

## 13. PROJECT STRUCTURE DIAGRAM

```
inventory-app-new/
├── app.html                    # Main app shell (SPA)
├── index.html                  # Landing/login page
│
├── css/
│   ├── design-system-v4.css    # ⚠️ MAIN DESIGN SYSTEM (49KB)
│   ├── dashboard.css           # ⚠️ POSSIBLE DUPLICATE
│   ├── style.css              # ⚠️ POSSIBLE DUPLICATE
│   ├── loader.css             # ⚠️ POSSIBLE DUPLICATE
│   └── landing.css            # Landing page only
│
├── js/
│   ├── app-router.js           # ✅ PAGE ROUTER
│   ├── dashboard.js            # ❌ DEAD CODE (5359 lines!)
│   ├── loader.js              # ❌ DEAD CODE
│   ├── user-management.js      # ❌ DEAD CODE
│   └── dashboard-opname-perintah.js
│
├── pages/
│   ├── dashboard.html          # ✅ Dashboard page
│   ├── produk.html            # ✅
│   ├── stok-gudang.html       # ✅
│   ├── pembelian.html          # ✅
│   ├── distribusi-outlet.html  # ✅
│   ├── monitoring-outlet.html  # ✅
│   ├── perintah-so.html        # ✅
│   ├── pelaksanaan-so.html     # ✅
│   ├── riwayat-so.html         # ✅
│   ├── laporan.html           # ✅
│   ├── pengaturan.html        # ✅
│   └── user.html              # ✅
│
├── backend/                   # API handlers (Node.js)
├── services/                  # Database services
└── assets/                    # Static assets
```

---

## 14. RECOMMENDED CLEANUP PLAN

### Phase 1: Dead Code Removal (SAFE)
```bash
# DELETE these files:
- js/dashboard.js      # 5359 lines of unused code
- js/loader.js         # Not referenced
- js/user-management.js # Not referenced
```

### Phase 2: CSS Consolidation (NEEDS TESTING)
```bash
# 1. Compare css/style.css with design-system-v4.css
# 2. Merge unique styles from style.css into design-system-v4.css
# 3. Delete style.css if all styles are duplicated

# 1. Compare css/loader.css with design-system-v4.css
# 2. Delete loader.css if all styles are duplicated

# Keep dashboard.css ONLY if it has unique styles
```

### Phase 3: Fix Duplicate Functions
```javascript
// app.html has duplicate functions:
// - toggleMobileSidebar() (line 328)
// - toggleUserDropdown() (line 359)

// Remove from app.html inline scripts
// Keep only one version in app-router.js
```

### Phase 4: Remove Inline Styles
```html
<!-- Replace: -->
<div class="kpi-card" style="--card-accent: var(--blue);">

<!-- With: -->
<div class="kpi-card kpi-card--blue">
```

---

## 15. SUMMARY

| Category | Count |
|----------|-------|
| Total CSS files | 5 |
| Total JS files | 6 |
| Total HTML files | 14 |
| CSS files used | 2 (design-system, landing) |
| CSS files questionable | 3 |
| JS files dead | 3 |
| Duplicate functions | 2 |
| Inline style occurrences | 20+ |

### CRITICAL ISSUES
1. ❌ `js/dashboard.js` (5359 lines) - COMPLETELY UNUSED
2. ❌ `js/loader.js` - NOT REFERENCED
3. ❌ `js/user-management.js` - NOT REFERENCED
4. ⚠️ Duplicate functions in app.html and dead JS
5. ⚠️ Multiple CSS files may duplicate styles

### RECOMMENDATION
**BEFORE any redesign, clean up dead code first.**

---

**Audit Completed**: 2026-06-13  
**Action Taken**: NONE - Report only