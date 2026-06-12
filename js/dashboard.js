let chart = null;
let chartTopProduk = null;
let chartTopOutlet = null;
let chartOutletStatus = null;
let currentMenu = "penjualan";
let selectedSalesOutlet = "";
const MENU_STORAGE_KEY = "inventoryActiveMenu";
const VALID_MENUS = ["dashboard", "admin", "penjualan", "persediaan", "forecast", "opname", "taskcenter", "approvalcenter", "activity", "audit", "reports", "mydashboard", "sotasks", "sohistory", "profile", "users", "settings", "produk", "outlet", "pembelian"];
const USER_ONLY_MENUS = ["opname", "mydashboard", "sotasks", "sohistory", "profile"];
const ADMIN_MENUS = ["dashboard", "admin", "penjualan", "persediaan", "forecast", "opname", "taskcenter", "approvalcenter", "activity", "audit", "reports", "users", "settings"];
let isMobileMenuOpen = false;

// Chart management - prevent memory leaks
const chartManager = {
  caches: {},
  
  // Safely destroy existing chart
  destroyChart(chartInstance) {
    if (chartInstance && typeof chartInstance.destroy === 'function') {
      try {
        chartInstance.destroy();
      } catch (e) {
        console.warn('Chart destroy error:', e);
      }
    }
    return null;
  },
  
  // Destroy all charts to prevent memory leaks
  destroyAllCharts() {
    chart = this.destroyChart(chart);
    chartTopProduk = this.destroyChart(chartTopProduk);
    chartOutletStatus = this.destroyChart(chartOutletStatus);
    chartTopOutlet = this.destroyChart(chartTopOutlet);
    this.caches = {};
  },
  
  // Safe chart creation with destroy protection
  createChart(canvasId, config, cacheKey) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn(`Canvas #${canvasId} not found`);
      return null;
    }
    
    // Check cache to prevent unnecessary re-renders
    const cache = this.caches[cacheKey];
    if (cache && cache.config && JSON.stringify(cache.config) === JSON.stringify(config)) {
      return cache.instance;
    }
    
    // Destroy existing chart on same canvas
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (e) {
        console.warn('Existing chart destroy error:', e);
      }
    }
    
    try {
      const instance = new Chart(canvas, config);
      this.caches[cacheKey] = { instance, config };
      return instance;
    } catch (e) {
      console.error('Chart creation error:', e);
      return null;
    }
  },
  
  // Check if chart data changed (for re-render decision)
  shouldUpdate(cacheKey, newData) {
    const cache = this.caches[cacheKey];
    if (!cache) return true;
    return JSON.stringify(cache.data) !== JSON.stringify(newData);
  },
  
  // Update chart with new data
  updateChartData(canvasId, cacheKey, newConfig, newData) {
    if (!this.shouldUpdate(cacheKey, newData)) return this.caches[cacheKey]?.instance;
    
    this.destroyAllCharts();
    return this.createChart(canvasId, newConfig, cacheKey);
  }
};

// Cleanup charts on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => chartManager.destroyAllCharts());
window.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Optionally pause chart animations when tab is hidden
    [chart, chartTopProduk, chartTopOutlet, chartOutletStatus].forEach(c => {
      if (c?.stop) c.stop();
    });
  }
});

const state = {
  produkOptions: [],
  auditOutlets: [],
  outletTransactions: {
    outlets: [],
    detail: [],
    selected_outlet: ""
  },
  persediaan: [],
  persediaanCategory: "all",
  outletDetailCategory: "all",
  forecastCategory: "all",
  forecast: [],
  audit: {
    db_ready: false,
    summary: {},
    outlet_summary: [],
    movements: [],
    flags: [],
    analysis: [],
    notes: []
  },
  opname: [],
  opnameScan: {},
  perintahList: [],
  activePerintah: null,
  opnameHistory: []
};


function getStoredAuth() {
  try {
    return JSON.parse(window.localStorage.getItem('auth_user') || 'null');
  } catch {
    return null;
  }
}

function isAuthenticated() {
  return Boolean(getStoredAuth()?.access_token);
}

function getCurrentUserRole() {
  return getStoredAuth()?.role || null;
}

function getAllowedMenus() {
  if (!isAuthenticated()) return [];
  return getCurrentUserRole() === 'admin' ? ADMIN_MENUS : USER_ONLY_MENUS;
}

function getDefaultMenuForRole() {
  return getCurrentUserRole() === 'admin' ? 'dashboard' : 'opname';
}

function canAccessMenu(menu) {
  return getAllowedMenus().includes(menu);
}

const pageMeta = {
  dashboard: {
    eyebrow: "Control Center",
    title: "Admin Dashboard",
    caption: "Monitoring operasional warehouse dan approval status untuk admin."
  },
  admin: {
    eyebrow: "Control Center",
    title: "Admin Panel",
    caption: "Panel administrasi untuk mengelola warehouse dan sistem."
  },
  penjualan: {
    eyebrow: "Sales Monitor",
    title: "Dashboard Penjualan",
    caption: "Monitoring penjualan warehouse per periode, outlet, dan produk aktif."
  },
  audit: {
    eyebrow: "Outlet Stock Assurance",
    title: "Audit Stok Outlet",
    caption: "Pantau stok masuk outlet, penjualan outlet, penyesuaian, dan flag audit dalam satu periode."
  },
  persediaan: {
    eyebrow: "Inventory Health",
    title: "Persediaan Warehouse",
    caption: "Rolling stock dihitung mengikuti cutoff bulan database agar mutasi masuk dan keluar tetap konsisten."
  },
  forecast: {
    eyebrow: "Demand Planning",
    title: "Forecast Penjualan",
    caption: "Forecast memakai EMA 3 bulan + buffer 10% dan dibulatkan ke atas agar stok tidak seret."
  },
  opname: {
    eyebrow: "Stock Control",
    title: "Stok Opname Gudang",
    caption: "Stok opname mengikuti periode yang sama dengan persediaan agar selisih rolling lebih akurat."
  },
  taskcenter: {
    eyebrow: "Task Management",
    title: "Task Center",
    caption: "Kelola dan lacak semua tugas operasional warehouse dalam satu tempat."
  },
  approvalcenter: {
    eyebrow: "Review & Approval",
    title: "Approval Center",
    caption: "Tinjau dan approve submitted work dari counters dan operators."
  },
  activity: {
    eyebrow: "System Logs",
    title: "Activity Timeline",
    caption: "Lacak semua aktivitas dan perubahan dalam sistem secara chronological."
  },
  audit: {
    eyebrow: "Compliance & Security",
    title: "Audit Center",
    caption: "Lacak perubahan critical, approve actions, dan audit trails untuk compliance."
  },
  reports: {
    eyebrow: "Analytics & Reports",
    title: "Laporan",
    caption: "Generate dan download laporan inventory, penjualan, dan aktivitas."
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  initTahun("tahun");
  initTahun("opnameTahun");
  setInitialPeriod();
  bindGlobalFilters();
  await loadProdukOptions();
  initOpnameQtyModal();

  if (!isAuthenticated()) {
    window.applyAuthState?.();
    return;
  }

  await loadProdukOptions();
  window.applyAuthState?.();
  selectMenu(null, getSavedMenu());
});

function getSavedMenu() {
  const savedMenu = window.localStorage.getItem(MENU_STORAGE_KEY);
  return canAccessMenu(savedMenu) ? savedMenu : getDefaultMenuForRole();
}

function closeMobileMenu() {
  const overlay = document.getElementById('mobileMenuOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove("mobile-menu-open");
  document.body.style.overflow = '';
  isMobileMenuOpen = false;
}

function bindGlobalFilters() {
  document.getElementById("bulan")?.addEventListener("change", applyCurrentFilters);
  document.getElementById("tahun")?.addEventListener("change", applyCurrentFilters);
  document.getElementById("filterProduk")?.addEventListener("change", applyCurrentFilters);
  document.getElementById("filterProduk")?.addEventListener("input", debounce(applyCurrentFilters, 200));
  document.getElementById("opnameBulan")?.addEventListener("change", syncOpnamePeriodFromLocal);
  document.getElementById("opnameTahun")?.addEventListener("change", syncOpnamePeriodFromLocal);
}

function debounce(fn, delay = 200) {
  let timeout = null;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => fn(...args), delay);
  };
}

function initTahun(id) {
  const select = document.getElementById(id);
  if (!select) return;

  const now = new Date().getFullYear();
  select.innerHTML = "";
  for (let year = now + 1; year >= now - 5; year -= 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    select.appendChild(option);
  }
}

function setInitialPeriod() {
  const now = new Date();
  const bulan = String(now.getMonth() + 1);
  const tahun = String(now.getFullYear());
  setValue("bulan", bulan);
  setValue("tahun", tahun);
  setValue("opnameBulan", bulan);
  setValue("opnameTahun", tahun);
  updateFilterStatus();
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getBulan() {
  return document.getElementById("bulan")?.value || String(new Date().getMonth() + 1);
}

function getTahun() {
  return document.getElementById("tahun")?.value || String(new Date().getFullYear());
}

function getProdukFilter() {
  return (document.getElementById("filterProduk")?.value || "").trim();
}

function getAuditOutletFilter() {
  return (document.getElementById("auditOutletFilter")?.value || "").trim();
}

function getAuditSectionKey(id = "") {
  const map = {
    auditOverview: "overview",
    auditOutletStock: "outlet",
    auditLog: "log",
    auditControl: "control",
    auditIntegration: "integration"
  };
  return map[id] || "overview";
}

function getCurrentAuditSection() {
  const visible = [...document.querySelectorAll("#auditTab .module-content")]
    .find(el => el.style.display !== "none");
  return getAuditSectionKey(visible?.id || "auditOverview");
}

function getSelectedSku() {
  const raw = getProdukFilter();
  if (!raw) return "";

  const exact = state.produkOptions.find(item => {
    const label = `${item.sku} - ${item.nama_produk}`;
    return label.toLowerCase() === raw.toLowerCase() || item.sku.toLowerCase() === raw.toLowerCase();
  });

  if (exact) return exact.sku;
  return "";
}

function getBulanLabel(bulan = getBulan()) {
  const names = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];
  return names[Number(bulan)] || "-";
}

function updateFilterStatus() {
  const produk = getSelectedSku();
  const outlet = currentMenu === "audit" ? getAuditOutletFilter() : "";
  const text = `Periode aktif: ${getBulanLabel()} ${getTahun()}${produk ? ` | Produk: ${produk}` : " | Produk: Semua"}${outlet ? ` | Outlet: ${outlet}` : ""}`;
  setText("filterStatus", text);
}

function updatePageHeader(menu) {
  const meta = pageMeta[menu] || pageMeta.penjualan;
  setText("pageEyebrow", meta.eyebrow);
  setText("pageTitle", meta.title);
  setText("pageCaption", meta.caption);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? 0;
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("id-ID");
}

function formatRupiah(value) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID")}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID");
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return `${date.toLocaleDateString("id-ID")} ${date.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAuthHeaders() {
  try {
    const auth = JSON.parse(window.localStorage.getItem('auth_user') || 'null');
    return auth?.access_token ? { Authorization: `Bearer ${auth.access_token}` } : {};
  } catch {
    return {};
  }
}

async function fetchJson(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Response bukan JSON yang valid" };
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }

  if (data && typeof data === 'object' && data.hasOwnProperty('success')) {
    if (data.hasOwnProperty('data') && data.data !== undefined) {
      return data.data;
    }
    return data;
  }

  return data;
}

function toArray(data) {
  return Array.isArray(data) ? data : [];
}

function toObject(data) {
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function showLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
}

function showToast(message, success = true) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${success ? 'success' : 'error'}`;
  
  const iconName = success ? 'check-circle' : 'alert-circle';
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast__icon"></i>
    <div class="toast__content">
      <p class="toast__message">${message}</p>
    </div>
    <button class="toast__close" onclick="this.parentElement.remove()">
      <i data-lucide="x"></i>
    </button>
  `;

  container.appendChild(toast);
  
  // Re-initialize Lucide icons for the new toast
  if (window.lucide) {
    lucide.createIcons({ nodes: [toast] });
  }

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add animation for toast removal
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes toastSlideOut {
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(styleSheet);

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target?.result || "");
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function syncOpnamePeriodFromLocal() {
  if (currentMenu !== "opname") return;
  setValue("bulan", document.getElementById("opnameBulan")?.value || getBulan());
  setValue("tahun", document.getElementById("opnameTahun")?.value || getTahun());
  applyCurrentFilters();
}

function syncOpnamePeriodToLocal() {
  setValue("opnameBulan", getBulan());
  setValue("opnameTahun", getTahun());
}

function clearProdukFilter() {
  setValue("filterProduk", "");
  applyCurrentFilters();
}

async function loadProdukOptions() {
  try {
    state.produkOptions = toArray(await fetchJson("/api/produk-list"));
    const list = document.getElementById("produkList");
    if (!list) return;
    list.innerHTML = state.produkOptions
      .map(item => `<option value="${escapeHtml(item.sku)} - ${escapeHtml(item.nama_produk)}"></option>`)
      .join("");
  } catch (error) {
    console.error("Produk list error:", error);
  }
}

async function loadAuditOutletOptions() {
  try {
    state.auditOutlets = toArray(await fetchJson("/api/outlet-list"));
    const select = document.getElementById("auditOutletFilter");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = `<option value="">Semua Outlet</option>${state.auditOutlets
      .map(item => `<option value="${escapeHtml(item.nama_outlet)}">${escapeHtml(item.nama_outlet)}</option>`)
      .join("")}`;
    select.value = currentValue;
  } catch (error) {
    console.error("Audit outlet list error:", error);
  }
}



function getSelectedBarcodeProduct() {
  const raw = (document.getElementById("barcodeProductInput")?.value || "").trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  return state.produkOptions.find(item => {
    const label = `${item.sku} - ${item.nama_produk}`;
    return label.toLowerCase() === normalized
      || item.sku.toLowerCase() === normalized
      || label.toLowerCase().includes(normalized);
  }) || null;
}

function loadBarcodeGenerator() {
  setText("productBarcodeValue", "-");
  setText("rackBarcodeValue", "-");
  const productSvg = document.getElementById("productBarcodeSvg");
  const rackSvg = document.getElementById("rackBarcodeSvg");
  if (productSvg) productSvg.innerHTML = "";
  if (rackSvg) rackSvg.innerHTML = "";
}

function renderProductBarcode() {
  const produk = getSelectedBarcodeProduct();
  if (!produk) {
    showToast("Produk tidak valid. Pilih dari daftar.", false);
    return;
  }

  const barcodeValue = produk.sku;
  setText("productBarcodeValue", barcodeValue);

  const svg = document.getElementById("productBarcodeSvg");
  if (svg && window.JsBarcode) {
    svg.innerHTML = "";
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "120");
    JsBarcode(svg, barcodeValue, {
      format: "CODE128",
      displayValue: true,
      fontSize: 16,
      height: 80,
      width: 2,
      margin: 10,
      textMargin: 6
    });
  }
}

function renderRackBarcode() {
  const kodeRak = (document.getElementById("barcodeRackInput")?.value || "").trim();
  if (!kodeRak) {
    showToast("Masukkan kode rak terlebih dahulu.", false);
    return;
  }

  const barcodeValue = `RAK-${kodeRak}`;
  setText("rackBarcodeValue", barcodeValue);

  const svg = document.getElementById("rackBarcodeSvg");
  if (svg && window.JsBarcode) {
    svg.innerHTML = "";
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "120");
    JsBarcode(svg, barcodeValue, {
      format: "CODE128",
      displayValue: true,
      fontSize: 16,
      height: 80,
      width: 2,
      margin: 10,
      textMargin: 6
    });
  }
}

function downloadBarcodeSvg(svgId, prefix) {
  const svg = document.getElementById(svgId);
  if (!svg || !svg.innerHTML.trim()) {
    showToast("Generate barcode terlebih dahulu sebelum mengunduh.", false);
    return;
  }

  const serializer = new XMLSerializer();
  const svgData = serializer.serializeToString(svg);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${prefix}-${Date.now()}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function getQueryParams(includeProduct = true) {
  const qs = new URLSearchParams({
    bulan: getBulan(),
    tahun: getTahun()
  });

  const sku = getSelectedSku();
  if (includeProduct && sku) qs.set("sku", sku);
  return qs;
}

function showTab(event, id) {
  document.querySelectorAll("#v3DashboardTab, #kpiTab, #chartTab, #miniReviewTab, #outletTransactionTab")
    .forEach(tab => { tab.style.display = "none"; });

  document.querySelectorAll("#salesTabMenu button")
    .forEach(button => button.classList.remove("active-tab"));

  const target = document.getElementById(id);
  if (target) target.style.display = "block";
  if (event) event.target.classList.add("active-tab");

  if (id === "v3DashboardTab") {
    loadV3Dashboard();
  }
  if (id === "chartTab") {
    loadChart();
  }
  if (id === "miniReviewTab") {
    loadMiniReview();
  }
  if (id === "outletTransactionTab") loadOutletTransactionMonitor();
}

async function loadMiniReview() {
  const content = document.getElementById("miniReviewContent");
  if (!content) return;

  try {
    const data = await fetchJson(`/api/mini-review?${getQueryParams(false).toString()}`);
    if (!data || !Array.isArray(data.modul)) {
      const message = data?.message || "Data mini review tidak tersedia untuk periode ini.";
      content.innerHTML = `<p>${escapeHtml(message)}</p>`;
      return;
    }

    if (data.message) {
      content.innerHTML = `<p>${escapeHtml(data.message)}</p>`;
      return;
    }

    const modulRows = data.modul
      .map(item => `
        <li>
          <span>${escapeHtml(item.level)}</span>
          <strong>${formatNumber(item.total)}</strong>
        </li>
      `)
      .join("");

    content.innerHTML = `
      <div class="mini-review-block">
        <p><strong>Ringkasan Modul per Level</strong></p>
        <ul class="mini-review-list">
          ${modulRows}
        </ul>
      </div>
      <div class="mini-review-block">
        <p><strong>Ringkasan Tas</strong></p>
        <p>${formatNumber(data.tas_total)} unit</p>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p>Gagal memuat mini review penjualan.</p>`;
    console.error("Mini review load error:", err);
  }
}

function showModuleTab(event, module, id) {
  document.querySelectorAll(`#${module}Tab .module-content`)
    .forEach(el => { el.style.display = "none"; });

  document.querySelectorAll(`#${module}Menu button`)
    .forEach(button => button.classList.remove("active-tab"));

  const target = document.getElementById(id);
  if (target) target.style.display = "block";
  if (event) event.target.classList.add("active-tab");

  if (module === "audit") {
    loadAudit(getAuditSectionKey(id));
  }
}

function showOpnameTab(event, id) {
  document.querySelectorAll(".opname-content")
    .forEach(el => { el.style.display = "none"; });

  document.querySelectorAll(".tab-menu-opname button")
    .forEach(button => button.classList.remove("active-tab"));

  const target = document.getElementById(id);
  if (target) target.style.display = "block";
  const activeButton = event?.currentTarget
    || document.querySelector(`.tab-menu-opname button[data-opname-tab="${id}"]`)
    || [...document.querySelectorAll(".tab-menu-opname button")].find(button => button.getAttribute("onclick")?.includes(`'${id}'`));
  activeButton?.classList.add("active-tab");

  if (id === "opnameHistory") loadHistory();
  if (id === "opnamePerintah") {
    initPerintahFormDefaults();
    loadPerintahList();
  }
  if (id === "opnameHasil") {
    loadPerintahList();
    goBackHasilSoList();
  }
  if (id === "opnameInput") {
    if (!guardOpnameScanTab()) {
      showToast('Pilih perintah SO dari tab Hasil SO terlebih dahulu', false);
    }
  }
  if (id === "opnameBarcode") loadBarcodeGenerator();
  if (id === "opnameKPI") loadOpnameKpiData();
  if (window.lucide) lucide.createIcons();
}

function selectMenu(event, menu) {
  if (!isAuthenticated()) {
    window.applyAuthState?.();
    return;
  }
  if (!VALID_MENUS.includes(menu)) menu = getDefaultMenuForRole();
  if (!canAccessMenu(menu)) {
    showToast('Akses user hanya untuk Stok Opname', false);
    menu = getDefaultMenuForRole();
  }
  currentMenu = menu;
  window.localStorage.setItem(MENU_STORAGE_KEY, menu);
  closeMobileMenu();
  updateMobileNavHighlight();
  updatePageHeader(menu);
  updateFilterStatus();

  document.querySelectorAll(".sidebar li")
    .forEach(item => item.classList.remove("active"));

  const activeItem = event?.currentTarget
    || [...document.querySelectorAll(".sidebar li")].find(item => item.getAttribute("onclick")?.includes(`'${menu}'`));
  activeItem?.classList.add("active");

  document.querySelectorAll(".tab-content")
    .forEach(tab => { tab.style.display = "none"; });

  // Safe element access with null checks
  const salesTabMenu = document.getElementById("salesTabMenu");
  if (salesTabMenu) salesTabMenu.style.display = menu === "penjualan" ? "flex" : "none";
  document.querySelectorAll("#salesTabMenu button")
    .forEach(button => button.classList.remove("active-tab"));

  // Handle dashboard and admin menu
  if (menu === "dashboard" || menu === "admin") {
    const v3DashboardTab = document.getElementById("v3DashboardTab");
    if (v3DashboardTab) v3DashboardTab.style.display = "block";
    loadV3Dashboard();
    return;
  }

  if (menu === "penjualan") {
    const kpiTab = document.getElementById("kpiTab");
    if (kpiTab) kpiTab.style.display = "block";
    document.querySelector("#salesTabMenu button")?.classList.add("active-tab");
    loadV3Dashboard();
    return;
  }

  if (menu === "persediaan") {
    const persediaanTab = document.getElementById("persediaanTab");
    if (persediaanTab) {
      persediaanTab.style.display = "block";
      showModuleTab(null, "persediaan", "persediaanOverview");
    }
    document.querySelector("#persediaanMenu button")?.classList.add("active-tab");
    return;
  }

  // Audit menu removed from UI; related code cleaned up

  if (menu === "forecast") {
    const forecastTab = document.getElementById("forecastTab");
    if (forecastTab) {
      forecastTab.style.display = "block";
      showModuleTab(null, "forecast", "forecastOverview");
    }
    document.querySelector("#forecastMenu button")?.classList.add("active-tab");
    return;
  }

  if (menu === "opname") {
    // For non-admin users, show operator dashboard instead of full opname
    if (getCurrentUserRole() !== 'admin') {
      const operatorTab = document.getElementById("operatorTab");
      if (operatorTab) operatorTab.style.display = "block";
      loadOperatorDashboard();
    } else {
      // For admin users, show the full opname tab
      const opnameTab = document.getElementById("opnameTab");
      if (opnameTab) {
        opnameTab.style.display = "block";
        showOpnameTab(null, "opnameKPI");
        document.querySelector(".tab-menu-opname button")?.classList.add("active-tab");
        syncOpnamePeriodToLocal();
        initPerintahFormDefaults();
        loadPerintahList();
        loadOpnameKpiData();
        updateOpnameInputVisibility();
      }
    }
  }

  if (menu === "taskcenter") {
    const taskcenterTab = document.getElementById("taskcenterTab");
    if (taskcenterTab) taskcenterTab.style.display = "block";
  }

  if (menu === "approvalcenter") {
    const approvalcenterTab = document.getElementById("approvalcenterTab");
    if (approvalcenterTab) approvalcenterTab.style.display = "block";
  }

  if (menu === "activity") {
    const activityTab = document.getElementById("activityTab");
    if (activityTab) activityTab.style.display = "block";
  }

  if (menu === "audit") {
    const auditTab = document.getElementById("auditTab");
    if (auditTab) auditTab.style.display = "block";
  }

  if (menu === "reports") {
    const reportsTab = document.getElementById("reportsTab");
    if (reportsTab) reportsTab.style.display = "block";
  }

  // User-specific menus
  if (menu === "mydashboard") {
    // Show user dashboard - reuse operator dashboard logic
    const operatorTab = document.getElementById("operatorTab");
    if (operatorTab) operatorTab.style.display = "block";
    return;
  }

  if (menu === "sotasks") {
    // User tasks - show opname commands assigned to user
    const taskcenterTab = document.getElementById("taskcenterTab");
    if (taskcenterTab) taskcenterTab.style.display = "block";
    return;
  }

  if (menu === "sohistory") {
    // User history - show opname history
    const approvalTab = document.getElementById("approvalcenterTab");
    if (approvalTab) approvalTab.style.display = "block";
    return;
  }

  if (menu === "profile") {
    // User profile - show placeholder for now
    showToast('Profil user - dalam pengembangan', true);
    return;
  }

  // Admin-only menus
  if (menu === "users") {
    // User management - show users tab
    const usersTab = document.getElementById("usersTab");
    if (usersTab) {
      usersTab.style.display = "block";
      // Load users list when tab is shown
      if (typeof loadUsersList === 'function') {
        loadUsersList();
      }
    }
    return;
  }

  if (menu === "settings") {
    // Settings - load settings page
    showSettingsTab();
    return;
  }

  // V4 Warehouse Menus
  if (menu === "produk") {
    // Show produk list
    const persediaanTab = document.getElementById("persediaanTab");
    if (persediaanTab) persediaanTab.style.display = "block";
    return;
  }

  if (menu === "outlet") {
    // Show outlet management
    const persediaanTab = document.getElementById("persediaanTab");
    if (persediaanTab) persediaanTab.style.display = "block";
    return;
  }

  if (menu === "pembelian") {
    // Show pembelian
    const kpiTab = document.getElementById("kpiTab");
    if (kpiTab) kpiTab.style.display = "block";
    return;
  }
}

// Show settings tab
function showSettingsTab() {
  hideAllTabs();
  hideAllSubmenus();
  
  const settingsTab = document.getElementById('settingsTab');
  if (settingsTab) {
    settingsTab.style.display = 'block';
  }
  
  currentMenu = "settings";
  updateActiveMenuItem("settings");
  
  // Initialize settings page if function exists
  if (typeof initSettingsPage === 'function') {
    initSettingsPage();
  }
}

async function applyCurrentFilters() {
  updateFilterStatus();

  if (currentMenu === "penjualan") {
    await loadV3Dashboard();
    return;
  }

  if (currentMenu === "persediaan") {
    return;
  }

  // Audit removed — no action required here

  if (currentMenu === "forecast") {
    return;
  }

  if (currentMenu === "opname") {
    syncOpnamePeriodToLocal();
    await loadPerintahList();
    await loadOpnameKpiData();
    if (state.activePerintah?.id) await loadStokSistem();
    updateOpnameInputVisibility();
  }
}

// V3 Dashboard Loader - MODERN ERP
async function loadV3Dashboard() {
  try {
    const data = await fetchJson('/api/v3-dashboard');

    if (data.generated_at) {
      const ts = document.getElementById('v3DashboardTimestamp');
      if (ts) ts.textContent = new Date(data.generated_at).toLocaleString('id-ID');
    }

    setText("kpi_penjualan", formatNumber(data.today?.penjualan || 0));
    setText("kpi_pembelian", formatNumber(data.today?.pembelian || 0));
    setText("kpi_produk_aktif", formatNumber(data.produk?.aktif || 0));
    setText("kpi_customer", formatNumber(data.today?.customer_count || 0));

    const kritis = Number(data.stok?.kritis || 0);
    setText("kpi_stok_kritis", formatNumber(kritis));
    const kritisCard = document.getElementById('kpi_stok_kritis_card');
    if (kritisCard) kritisCard.classList.toggle('erp-kpi--alert', kritis > 0);

    setText("kpi_so_berjalan", formatNumber(data.opname?.berjalan || 0));

    const pending = Number(data.opname?.pending_approval || 0);
    setText("kpi_pending", formatNumber(pending));
    const pendingCard = document.getElementById('kpi_pending_card');
    if (pendingCard) pendingCard.classList.toggle('erp-kpi--alert', pending > 0);

    setText("kpi_so_selesai", formatNumber(data.opname?.selesai_bulan_ini || 0));
    setText("kpi_users", formatNumber(data.users?.total || 0));
    setText("kpi_outlet", `${formatNumber(data.outlet?.aktif || 0)} / ${formatNumber(data.outlet?.total || 0)}`);

  } catch (error) {
    console.error("Dashboard load error:", error);
    ["kpi_penjualan","kpi_pembelian","kpi_produk_aktif","kpi_customer",
     "kpi_stok_kritis","kpi_so_berjalan","kpi_pending","kpi_so_selesai",
     "kpi_users","kpi_outlet"].forEach(id => setText(id, "Error"));
  }
}

// Mobile SO Input Handler - FASE 13
let mobileSOCurrentIndex = 0;
let mobileSOData = [];

async function openMobileSO(opnameId) {
  try {
    const data = await fetchJson(`/api/v3-opname-detail?opname_id=${opnameId}`);
    
    mobileSOData = data.produk || [];
    mobileSOCurrentIndex = mobileSOData.findIndex(p => !p.stok_fisik || p.stok_fisik === 0);
    if (mobileSOCurrentIndex === -1) mobileSOCurrentIndex = 0;
    
    showMobileSOInput();
  } catch (error) {
    console.error("Error loading SO data:", error);
    showToast("Gagal memuat data SO", false);
  }
}

function showMobileSOInput() {
  const container = document.getElementById('mobileSOContainer');
  if (!container || mobileSOData.length === 0) return;
  
  const current = mobileSOData[mobileSOCurrentIndex];
  const progress = mobileSOData.filter(p => p.stok_fisik > 0).length;
  const progressPercent = Math.round((progress / mobileSOData.length) * 100);
  
  container.innerHTML = `
    <!-- Progress Bar -->
    <div class="so-progress">
      <div class="so-progress__bar">
        <div class="so-progress__fill" style="width: ${progressPercent}%"></div>
      </div>
      <span class="so-progress__text">${progress}/${mobileSOData.length} (${progressPercent}%)</span>
    </div>
    
    <!-- Input Form -->
    <div class="so-mobile-input">
      <div class="so-mobile-input__header">
        <div>
          <p class="so-mobile-input__produk">${escapeHtml(current.nama_produk)}</p>
          <p class="so-mobile-input__sku">${escapeHtml(current.sku)}</p>
        </div>
        <span class="status-badge status-${current.kategori === 'modul' ? 'info' : 'default'}">${escapeHtml(current.kategori)}</span>
      </div>
      
      <div class="so-mobile-input__stok-info">
        <div class="so-mobile-input__stok-item">
          <p class="so-mobile-input__stok-label">Stok Sistem</p>
          <p class="so-mobile-input__stok-value">${formatNumber(current.stok_sistem || 0)}</p>
        </div>
        <div class="so-mobile-input__stok-item">
          <p class="so-mobile-input__stok-label">Stok Fisik</p>
          <p class="so-mobile-input__stok-value">${formatNumber(current.stok_fisik || 0)}</p>
        </div>
      </div>
      
      <div class="so-mobile-input__field">
        <label for="mobileStokFisik">Qty Fisik:</label>
        <input type="number" id="mobileStokFisik" placeholder="0" value="${current.stok_fisik || ''}" min="0">
      </div>
      
      <div class="so-mobile-input__actions">
        <button class="so-mobile-input__skip" onclick="skipMobileSO()">Skip</button>
        <button class="so-mobile-input__submit" onclick="submitMobileSO('${current.sku}')">Simpan</button>
      </div>
    </div>
  `;
  
  // Focus on input
  setTimeout(() => {
    const input = document.getElementById('mobileStokFisik');
    if (input) {
      input.focus();
      input.select();
    }
  }, 100);
}

async function submitMobileSO(sku) {
  const input = document.getElementById('mobileStokFisik');
  if (!input) return;
  
  const qty = Number(input.value) || 0;
  const current = mobileSOData[mobileSOCurrentIndex];
  
  try {
    const res = await fetch('/api/v3-opname-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opname_id: current.detail_id ? current.detail_id.split('/')[0] : 0,
        sku: sku,
        stok_fisik: qty
      })
    });
    
    if (!res.ok) throw new Error('Save failed');
    
    // Update local data
    mobileSOData[mobileSOCurrentIndex].stok_fisik = qty;
    
    showToast(`Qty fisik untuk ${sku} disimpan`, true);
    
    // Move to next
    moveToNextSOItem();
    
  } catch (error) {
    console.error("Error saving SO:", error);
    showToast("Gagal menyimpan qty fisik", false);
  }
}

function skipMobileSO() {
  moveToNextSOItem();
}

function moveToNextSOItem() {
  mobileSOCurrentIndex++;
  if (mobileSOCurrentIndex >= mobileSOData.length) {
    mobileSOCurrentIndex = 0;
    showToast("Semua produk sudah diinput", true);
  }
  showMobileSOInput();
}

async function loadOutletTransactionMonitor(showSpinner = true) {
  if (showSpinner) showLoader();

  try {
    const qs = getQueryParams();
    const status = document.getElementById("outletTransactionStatus")?.value || "";
    if (status) qs.set("status", status);
    if (selectedSalesOutlet) qs.set("outlet", selectedSalesOutlet);

    state.outletTransactions = toObject(await fetchJson(`/api/outlet-transaksi?${qs.toString()}`));
    const outlets = toArray(state.outletTransactions.outlets);
    const detail = toArray(state.outletTransactions.detail);
    const totals = toObject(state.outletTransactions.totals);
    const selectedOutlet = state.outletTransactions.selected_outlet || selectedSalesOutlet || "";
    selectedSalesOutlet = selectedOutlet;

    const selectedRow = outlets.find(item => item.nama_outlet === selectedOutlet);
    const selectedStock = detail.reduce((sum, item) => sum + Number(item.stok_akhir || 0), 0);
    const doneCount = Number(totals.sudah ?? 0);
    const pendingCount = Number(totals.belum ?? 0);

    setText("sales_outlet_done", formatNumber(doneCount));
    setText("sales_outlet_pending", formatNumber(pendingCount));
    setText("sales_outlet_selected", selectedOutlet || "-");
    setText("sales_outlet_stock", formatNumber(selectedStock));

    renderOutletTransactionTable(outlets, selectedOutlet);
    renderOutletTransactionDetail(detail, selectedRow);
  } catch (error) {
    console.error("Outlet transaction monitor error:", error);
    showToast(error.message || "Gagal memuat transaksi outlet", false);
  } finally {
    if (showSpinner) hideLoader();
  }
}

function renderOutletTransactionTable(outlets, selectedOutlet) {
  const body = document.getElementById("outletTransactionBody");
  if (!body) return;

  if (!outlets.length) {
    body.innerHTML = `<div class="outlet-list-empty">Tidak ada data outlet untuk periode ini.</div>`;
    return;
  }

  body.innerHTML = outlets.map(item => {
    const statusClass = item.status_transaksi === "sudah" ? "status-safe" : "status-out";
    const statusLabel = item.status_transaksi === "sudah" ? "Sudah Transaksi" : "Belum Transaksi";
    const isActive = item.nama_outlet === selectedOutlet ? "active" : "";
    return `
      <button
        type="button"
        class="outlet-list-item ${isActive}"
        data-outlet="${escapeHtml(item.nama_outlet)}"
        onclick="selectSalesOutlet(this.dataset.outlet)"
      >
        <div class="outlet-list-head">
          <h4 class="outlet-list-name">${escapeHtml(item.nama_outlet)}</h4>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="outlet-list-meta">
          <div class="outlet-stat">
            <span class="outlet-stat-label">Qty Transaksi</span>
            <span class="outlet-stat-value">${formatNumber(item.qty_transaksi)}</span>
          </div>
          <div class="outlet-stat">
            <span class="outlet-stat-label">Stok Outlet</span>
            <span class="outlet-stat-value">${formatNumber(item.stok_akhir)}</span>
          </div>
        </div>
        <p class="outlet-list-note">${escapeHtml(item.catatan || "-")}</p>
      </button>
    `;
  }).join("");
}

function renderOutletTransactionDetail(detail, selectedRow) {
  const title = document.getElementById("outletDetailTitle");
  const summary = document.getElementById("outletDetailSummary");
  const body = document.getElementById("outletTransactionDetailBody");
  const heroBadge = document.getElementById("outletDetailStatusBadge");
  const heroText = document.getElementById("outletDetailStatusText");
  const heroNote = document.getElementById("outletDetailStatusNote");
  if (!title || !summary || !body || !heroBadge || !heroText || !heroNote) return;

  if (!selectedRow) {
    title.textContent = "Pilih outlet";
    heroBadge.className = "status-badge status-low";
    heroBadge.textContent = "Menunggu";
    heroText.textContent = "Belum ada outlet dipilih";
    heroNote.textContent = "Klik salah satu nama outlet di panel kiri untuk melihat rincian lengkapnya.";
    summary.innerHTML = `
      <h4>Belum ada outlet dipilih</h4>
      <p>Klik salah satu outlet untuk melihat detail stok dan alasan kenapa outlet tersebut sudah atau belum transaksi pada periode ini.</p>
    `;
    body.innerHTML = `<tr><td colspan="8">Belum ada detail outlet dipilih.</td></tr>`;
    setText("outletDetailQty", "0");
    setText("outletDetailStock", "0");
    return;
  }

  const isDone = selectedRow.status_transaksi === "sudah";
  const detailQty = Number(selectedRow.qty_transaksi || 0);
  const detailStock = detail.reduce((sum, item) => sum + Number(item.stok_akhir || 0), 0);

  title.textContent = selectedRow.nama_outlet;
  heroBadge.className = `status-badge ${isDone ? "status-safe" : "status-out"}`;
  heroBadge.textContent = isDone ? "Sudah Transaksi" : "Belum Transaksi";
  heroText.textContent = `${formatNumber(detailQty)} qty transaksi pada periode aktif`;
  heroNote.textContent = selectedRow.catatan || "-";
  summary.innerHTML = `
    <h4>Status ${isDone ? "Sudah Transaksi" : "Belum Transaksi"}</h4>
    <p>${escapeHtml(selectedRow.catatan || "-")}</p>
  `;
  setText("outletDetailQty", formatNumber(detailQty));
  setText("outletDetailStock", formatNumber(detailStock));

  body.innerHTML = "";
  if (!detail.length) {
    body.innerHTML = `<tr><td colspan="8">Belum ada detail stok outlet pada periode ini.</td></tr>`;
    return;
  }

  const filteredDetail = detail.filter(item => {
    const category = getOpnameCategory(item.nama_produk);
    return state.outletDetailCategory === "all" || category === state.outletDetailCategory;
  });

  if (!filteredDetail.length) {
    body.innerHTML = `<tr><td colspan="8">Tidak ada detail produk pada kategori ini.</td></tr>`;
    return;
  }

  filteredDetail.forEach(item => {
    const stock = Number(item.stok_akhir || 0);
    const stockClass = stock <= 0 ? "status-out" : stock <= 10 ? "status-low" : "status-safe";
    const stockLabel = stock <= 0 ? "Habis" : stock <= 10 ? "Menipis" : "Masih Ada";
    body.innerHTML += `
      <tr>
        <td>${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.nama_produk)}</td>
        <td>${formatNumber(item.opening_stok)}</td>
        <td>${formatNumber(item.stok_masuk)}</td>
        <td>${formatNumber(item.stok_keluar)}</td>
        <td>${formatNumber(item.penyesuaian)}</td>
        <td>${formatNumber(stock)}</td>
        <td><span class="status-badge ${stockClass}">${stockLabel}</span></td>
      </tr>
    `;
  });
}

function selectSalesOutlet(outletName) {
  selectedSalesOutlet = outletName;
  loadOutletTransactionMonitor();
}

function selectOutletDetailCategory(event, category) {
  state.outletDetailCategory = category;
  document.querySelectorAll("#outletDetailCategoryTabs button")
    .forEach(button => button.classList.remove("active-mini-tab"));
  document.querySelector(`#outletDetailCategoryTabs button[onclick*="'${category}'"]`)?.classList.add("active-mini-tab");
  renderOutletTransactionDetail(
    toArray(state.outletTransactions.detail),
    toArray(state.outletTransactions.outlets).find(item => item.nama_outlet === selectedSalesOutlet)
  );
}

function selectImport(event, type) {
  if (event) {
    document.querySelectorAll("#importTab .mini-sidebar div")
      .forEach(item => item.classList.remove("active-mini"));
    event.target.classList.add("active-mini");
  }

  document.getElementById("importContent").innerHTML = buildImportPanel(type, "previewCSV");
}

function selectPersediaanImport(event, type) {
  if (event) {
    document.querySelectorAll("#persediaanImportMenu div")
      .forEach(item => item.classList.remove("active-mini"));
    event.target.classList.add("active-mini");
  }

  document.getElementById("persediaanImportContent").innerHTML = buildImportPanel(type, "persediaanPreviewCSV");
}

function buildImportPanel(type, previewId) {
  return `
    <h3>Import ${escapeHtml(type)}</h3>
    <div class="section-actions">
      <button class="btn-secondary" onclick="downloadTemplate('${type}')">Download Template</button>
    </div>
    <div class="top-space">
      <input type="file" id="${previewId}_file" accept=".csv,text/csv">
      <button class="btn-primary" onclick="previewCSV('${type}','${previewId}')">Preview</button>
    </div>
    <div id="${previewId}" class="top-space"></div>
  `;
}

function downloadTemplate(type = "outlet") {
  const map = {
    outlet: "/api/template-outlet",
    penjualan: "/api/template-penjualan",
    pembelian: "/api/template-pembelian",
    stok_awal: "/api/template-stok_awal"
  };
  window.open(map[type], "_blank");
}

async function previewCSV(type, previewId) {
  const file = document.getElementById(`${previewId}_file`)?.files?.[0];
  if (!file) {
    showToast("Pilih file CSV terlebih dahulu", false);
    return;
  }

  const csv = await readFileAsText(file);
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    showToast("CSV belum berisi data", false);
    return;
  }

  let html = `<div class="table-shell"><table class="table"><thead><tr>`;
  lines[0].split(/[,;]/).forEach(header => {
    html += `<th>${escapeHtml(header.trim())}</th>`;
  });
  html += `</tr></thead><tbody>`;

  for (let index = 1; index < Math.min(lines.length, 6); index += 1) {
    html += "<tr>";
    lines[index].split(/[,;]/).forEach(cell => {
      html += `<td>${escapeHtml(cell.trim())}</td>`;
    });
    html += "</tr>";
  }

  html += `</tbody></table></div>
    <div class="top-space">
      <button class="btn-primary" onclick="importCSV('${type}','${previewId}')">Import Data</button>
    </div>`;

  const previewEl = document.getElementById(previewId);
  previewEl.innerHTML = html;
  previewEl.dataset.csv = csv;
}

async function importCSV(type, previewId) {
  const previewEl = document.getElementById(previewId);
  const csv = previewEl?.dataset.csv;
  if (!csv) {
    showToast("Preview file terlebih dahulu", false);
    return;
  }

  showLoader();
  try {
    const data = await fetchJson(`/api/import-${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv })
    });

    showToast(data.message || "Import selesai");
    await applyCurrentFilters();
  } catch (error) {
    console.error("Import error:", error);
    showToast(error.message || "Import gagal", false);
  } finally {
    hideLoader();
  }
}

async function loadPersediaan() {
  showLoader();
  try {
    state.persediaan = toArray(await fetchJson(`/api/persediaan?${getQueryParams().toString()}`));
    renderPersediaanTables();
  } catch (error) {
    console.error("Persediaan error:", error);
    showToast(error.message || "Gagal memuat persediaan", false);
  } finally {
    hideLoader();
  }
}

function renderPersediaanTables() {
  const body = document.getElementById("persediaanBody");
  const restockBody = document.getElementById("persediaanRestockBody");
  if (!body || !restockBody) return;

  body.innerHTML = "";
  restockBody.innerHTML = "";

  let totalStok = 0;
  let lowStock = 0;
  let outStock = 0;

  const filteredItems = state.persediaan.filter(item => {
    const category = getOpnameCategory(item.nama_produk);
    return state.persediaanCategory === "all" || category === state.persediaanCategory;
  });

  filteredItems.forEach(item => {
    const stokAkhir = Number(item.stok_akhir || 0);
    const category = getOpnameCategory(item.nama_produk);
    const categoryLabel = getOpnameCategoryLabel(category);
    totalStok += stokAkhir;
    if (stokAkhir <= 0) outStock += 1;
    if (stokAkhir > 0 && stokAkhir <= 10) lowStock += 1;

    body.innerHTML += `
      <tr>
        <td>${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.nama_produk)}</td>
        <td><span class="status-badge category-badge category-${category}">${categoryLabel}</span></td>
        <td>${formatNumber(item.stok_awal)}</td>
        <td>${formatNumber(item.pembelian)}</td>
        <td>${formatNumber(item.penjualan)}</td>
        <td>${formatNumber(item.penyesuaian)}</td>
        <td>${formatNumber(stokAkhir)}</td>
      </tr>
    `;

    if (stokAkhir <= 10) {
      const statusClass = stokAkhir <= 0 ? "status-out" : "status-low";
      const label = stokAkhir <= 0 ? "Minus / Habis" : "Prioritas Restock";
      restockBody.innerHTML += `
        <tr>
          <td>${escapeHtml(item.sku)}</td>
          <td>${escapeHtml(item.nama_produk)}</td>
          <td>${formatNumber(stokAkhir)}</td>
          <td><span class="status-badge ${statusClass}">${label}</span></td>
        </tr>
      `;
    }
  });

  if (!filteredItems.length) {
    body.innerHTML = `<tr><td colspan="8">Tidak ada data persediaan pada kategori ini.</td></tr>`;
    restockBody.innerHTML = `<tr><td colspan="4">Tidak ada data restock pada kategori ini.</td></tr>`;
  } else if (!restockBody.innerHTML) {
    restockBody.innerHTML = `<tr><td colspan="4">Tidak ada item restock pada kategori ini.</td></tr>`;
  }

  setText("persediaan_total_sku", formatNumber(filteredItems.length));
  setText("persediaan_total_stok", formatNumber(totalStok));
  setText("persediaan_low_stock", formatNumber(lowStock));
  setText("persediaan_out_stock", formatNumber(outStock));
}

function selectPersediaanCategory(event, category) {
  state.persediaanCategory = category;
  document.querySelectorAll("#persediaanCategoryTabs button, #persediaanRestockCategoryTabs button")
    .forEach(button => button.classList.remove("active-mini-tab"));
  document.querySelectorAll(`#persediaanCategoryTabs button[onclick*="'${category}'"], #persediaanRestockCategoryTabs button[onclick*="'${category}'"]`)
    .forEach(button => button.classList.add("active-mini-tab"));
  renderPersediaanTables();
}

async function loadAudit(section = "overview") {
  showLoader();
  try {
    const qs = getQueryParams();
    const outlet = getAuditOutletFilter();
    if (outlet) qs.set("outlet", outlet);
    qs.set("section", section);
    const response = toObject(await fetchJson(`/api/audit?${qs.toString()}`));

    state.audit.db_ready = Boolean(response.db_ready ?? state.audit.db_ready);
    if ("summary" in response) state.audit.summary = toObject(response.summary);
    if ("outlet_summary" in response) state.audit.outlet_summary = toArray(response.outlet_summary);
    if ("movements" in response) state.audit.movements = toArray(response.movements);
    if ("flags" in response) state.audit.flags = toArray(response.flags);
    if ("analysis" in response) state.audit.analysis = toArray(response.analysis);
    if ("notes" in response) state.audit.notes = toArray(response.notes);

    if (section === "overview") renderAuditOverview();
    if (section === "outlet") renderAuditOutletTable();
    if (section === "log") renderAuditMovementTable();
    if (section === "control") renderAuditFlagTable();
    if (section === "integration") renderAuditIntegration();
  } catch (error) {
    console.error("Audit error:", error);
    showToast(error.message || "Gagal memuat audit", false);
  } finally {
    hideLoader();
  }
}

function renderAuditOverview() {
  const summary = toObject(state.audit.summary);
  const flags = toArray(state.audit.flags);
  const analysis = toArray(state.audit.analysis);
  const insightCards = document.getElementById("auditInsightCards");
  const analysisBody = document.getElementById("auditAnalysisBody");
  if (!insightCards || !analysisBody) return;

  setText("audit_total_log", formatNumber(summary.total_mutasi));
  setText("audit_penjualan_total", formatNumber(summary.stok_masuk_outlet));
  setText("audit_pembelian_total", formatNumber(summary.penjualan_outlet));
  setText("audit_qty_total", formatNumber(summary.qty_bergerak));
  setText("audit_problem_outlet", formatNumber(summary.problem_outlet));

  insightCards.innerHTML = "";
  analysisBody.innerHTML = "";

  const insightItems = [
    {
      title: "Status Database Audit",
      detail: state.audit.db_ready
        ? "Audit sudah memakai rolling stock, stok keluar outlet, dan analisis level siswa."
        : "Migrasi audit belum lengkap. Sistem masih perlu penyempurnaan struktur database."
    },
    {
      title: "Outlet Terpantau",
      detail: `${formatNumber(summary.total_outlet || 0)} outlet tercakup pada periode ${getBulanLabel()} ${getTahun()}.`
    },
    {
      title: "Flag Audit",
      detail: `${formatNumber(flags.length)} indikator risiko terdeteksi pada ringkasan audit.`
    },
    {
      title: "Analisis Level",
      detail: analysis.length
        ? `${formatNumber(analysis.filter(item => Number(item.selisih || 0) !== 0).length)} baris level siswa tidak cocok dengan modul keluar outlet.`
        : "Belum ada data analisis level siswa untuk periode ini."
    }
  ];

  insightItems.forEach(item => {
    insightCards.innerHTML += `
      <div class="insight-card">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.detail)}</p>
      </div>
    `;
  });

  analysis.forEach(item => {
    const diff = Number(item.selisih || 0);
    const badgeClass = diff === 0 ? "status-safe" : diff > 0 ? "status-low" : "status-out";
    analysisBody.innerHTML += `
      <tr>
        <td>${escapeHtml(item.nama_outlet || "-")}</td>
        <td>${escapeHtml(item.level_code || "-")}</td>
        <td>${formatNumber(item.jumlah_siswa)}</td>
        <td>${formatNumber(item.modul_keluar)}</td>
        <td>${formatNumber(item.target_modul)}</td>
        <td>${formatNumber(diff)}</td>
        <td><span class="status-badge ${badgeClass}">${escapeHtml(item.status || "-")}</span></td>
      </tr>
    `;
  });

  if (!analysis.length) {
    analysisBody.innerHTML = `<tr><td colspan="7">Belum ada data analisis level siswa pada periode ini.</td></tr>`;
  }
}

function renderAuditOutletTable() {
  const outletSummary = toArray(state.audit.outlet_summary);
  const outletBody = document.getElementById("auditOutletBody");
  if (!outletBody) return;

  outletBody.innerHTML = "";
  outletSummary.forEach(item => {
    outletBody.innerHTML += `
      <tr>
        <td>${escapeHtml(item.nama_outlet || "-")}</td>
        <td>${escapeHtml(item.sku || "-")}</td>
        <td>${escapeHtml(item.nama_produk || "-")}</td>
        <td>${formatNumber(item.opening_stok)}</td>
        <td>${formatNumber(item.stok_masuk)}</td>
        <td>${formatNumber(item.stok_keluar)}</td>
        <td>${formatNumber(item.penyesuaian)}</td>
        <td>${formatNumber(item.stok_akhir)}</td>
      </tr>
    `;
  });

  if (!outletSummary.length) {
    outletBody.innerHTML = `<tr><td colspan="8">Belum ada data stok outlet pada periode ini.</td></tr>`;
  }
}

function renderAuditMovementTable() {
  const movements = toArray(state.audit.movements);
  const movementBody = document.getElementById("auditBody");
  if (!movementBody) return;

  movementBody.innerHTML = "";
  movements.forEach(item => {
    movementBody.innerHTML += `
      <tr>
        <td>${formatDate(item.tanggal)}</td>
        <td>${escapeHtml(item.sumber || "-")}</td>
        <td>${escapeHtml(item.jenis || "-")}</td>
        <td>${escapeHtml(item.nama_outlet || "-")}</td>
        <td>${escapeHtml(item.sku || "-")}</td>
        <td>${formatNumber(item.qty)}</td>
        <td>${escapeHtml(item.referensi || "-")}</td>
        <td>${escapeHtml(item.keterangan || "-")}</td>
      </tr>
    `;
  });

  if (!movements.length) {
    movementBody.innerHTML = `<tr><td colspan="8">Belum ada mutasi pada periode ini.</td></tr>`;
  }
}

function renderAuditFlagTable() {
  const flags = toArray(state.audit.flags);
  const flagBody = document.getElementById("auditFlagBody");
  if (!flagBody) return;

  flagBody.innerHTML = "";
  flags.forEach(item => {
    flagBody.innerHTML += `
      <tr>
        <td>${escapeHtml(item.nama_outlet || "-")}</td>
        <td>${escapeHtml(item.sku || "-")}</td>
        <td>${escapeHtml(item.flag || "-")}</td>
        <td>${escapeHtml(item.detail || "-")}</td>
      </tr>
    `;
  });

  if (!flags.length) {
    flagBody.innerHTML = `<tr><td colspan="4">Belum ada flag audit pada periode ini.</td></tr>`;
  }
}

function renderAuditIntegration() {
  const dbStatus = document.getElementById("auditDbStatus");
  const notePanel = document.getElementById("auditIntegrationNotes");
  if (!dbStatus || !notePanel) return;

  dbStatus.textContent = state.audit.db_ready
    ? "Siap dipakai. Audit sudah memakai query bertahap agar menu lebih ringan dibuka."
    : "Migrasi audit belum lengkap. Jalankan SQL migrasi baru agar query audit lebih stabil dan akurat.";

  const notes = [
    ...toArray(state.audit.notes),
    "Gunakan filter Outlet atau Produk sebelum membuka tabel berat seperti Mutasi dan Stok Outlet.",
    "Mulai dari tab Ringkasan dulu. Tab lain sekarang dimuat saat dibuka agar browser tidak cepat berat.",
    "Jika data outlet sangat besar, pastikan index pada migration_neon_safe.sql sudah dijalankan di database."
  ];

  notePanel.innerHTML = `
    <h4>Instruksi Sinkron API & DB</h4>
    <ul>
      ${notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}
    </ul>
  `;
}

async function loadForecast() {
  showLoader();
  try {
    state.forecast = toArray(await fetchJson(`/api/forecast?${getQueryParams().toString()}`));
    renderForecast();
  } catch (error) {
    console.error("Forecast error:", error);
    showToast(error.message || "Gagal memuat forecast", false);
  } finally {
    hideLoader();
  }
}

function renderForecast() {
  const body = document.getElementById("forecastBody");
  const recommendationCards = document.getElementById("forecastRecommendationCards");
  if (!body || !recommendationCards) return;

  body.innerHTML = "";
  recommendationCards.innerHTML = "";

  let totalForecast = 0;
  let totalActual = 0;
  let totalGap = 0;
  let produkAktif = 0;
  let accuracyTotal = 0;
  let accuracyCount = 0;

  const filteredItems = state.forecast.filter(item => {
    const category = getOpnameCategory(item.nama_produk);
    return state.forecastCategory === "all" || category === state.forecastCategory;
  });

  filteredItems.forEach(item => {
    const forecast = Number(item.forecast_bulan_depan || 0);
    const actual = Number(item.bulan_3 || 0);
    const gap = forecast - actual;
    totalForecast += forecast;
    totalActual += actual;
    totalGap += gap;
    if (forecast > 0) produkAktif += 1;

    const accuracy = getForecastAccuracy(forecast, actual);
    if (accuracy !== null) {
      accuracyTotal += accuracy;
      accuracyCount += 1;
    }

    body.innerHTML += `
      <tr>
        <td>${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.nama_produk)}</td>
        <td>${formatNumber(item.bulan_1)}</td>
        <td>${formatNumber(item.bulan_2)}</td>
        <td>${formatNumber(item.bulan_3)}</td>
        <td>${formatNumber(item.ema_3_bulan)}</td>
        <td>${formatNumber(item.forecast_bulan_depan)}</td>
      </tr>
    `;
  });

  if (!filteredItems.length) {
    body.innerHTML = `<tr><td colspan="7">Tidak ada data forecast pada kategori ini.</td></tr>`;
  }

  const sorted = [...filteredItems].sort((a, b) => Number(b.forecast_bulan_depan || 0) - Number(a.forecast_bulan_depan || 0));
  const topDemand = sorted[0];

  setText("forecast_total_produk", formatNumber(filteredItems.length));
  setText("forecast_total_value", formatNumber(totalForecast));
  setText("forecast_actual_value", formatNumber(totalActual));
  setText("forecast_gap_value", formatNumber(totalGap));
  setText("forecast_accuracy", `${formatForecastPercentage(accuracyCount ? accuracyTotal / accuracyCount : 0)}%`);
  setText("forecast_avg_tahunan", formatNumber(filteredItems.length ? Math.ceil(totalForecast / filteredItems.length) : 0));
  setText("forecast_top_demand", topDemand ? topDemand.nama_produk : "-");
  setText("forecast_produk_aktif", formatNumber(produkAktif));

  sorted.filter(item => Number(item.forecast_bulan_depan || 0) > 0).slice(0, 3).forEach((item, index) => {
    recommendationCards.innerHTML += `
      <div class="insight-card">
        <h4>Prioritas ${index + 1}</h4>
        <p>${escapeHtml(item.nama_produk)} diproyeksikan membutuhkan ${formatNumber(item.forecast_bulan_depan)} unit bulan depan. Siapkan stok minimal di atas angka ini.</p>
      </div>
    `;
  });

  if (!recommendationCards.innerHTML) {
    recommendationCards.innerHTML = `
      <div class="insight-card">
        <h4>Belum ada rekomendasi</h4>
        <p>Histori penjualan 3 bulan masih belum cukup untuk memberi prioritas forecast.</p>
      </div>
    `;
  }
}

function selectForecastCategory(event, category) {
  state.forecastCategory = category;
  document.querySelectorAll("#forecastCategoryTabs button")
    .forEach(button => button.classList.remove("active-mini-tab"));
  document.querySelector(`#forecastCategoryTabs button[onclick*="'${category}'"]`)?.classList.add("active-mini-tab");
  renderForecast();
}

function getForecastAccuracy(forecast, actual) {
  const safeForecast = Number(forecast || 0);
  const safeActual = Number(actual || 0);

  if (safeForecast === 0 && safeActual === 0) return 100;
  if (safeActual === 0) return 0;

  const accuracy = 100 - (Math.abs(safeForecast - safeActual) / safeActual) * 100;
  return Math.max(0, Math.min(100, accuracy));
}

function formatForecastPercentage(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function getOpnameCategory(namaProduk = "") {
  const nama = namaProduk.toLowerCase().trim();
  if (nama.startsWith("modul")) return "modul";
  if (nama.startsWith("poster") || nama.startsWith("flash")) return "poster";
  if (nama.includes("merah") || nama.includes("kuning") || nama.includes("biru") || nama.includes(" my")) return "seragam";
  return "lain-lain";
}

function getOpnameCategoryLabel(category) {
  const labels = {
    modul: "Modul",
    seragam: "Seragam",
    poster: "Poster",
    "lain-lain": "Lain-lain"
  };
  return labels[category] || "Lain-lain";
}

let opnameScanner = null;
let opnameScannerMode = 'barang';

function getProductStokSistem(product) {
  return Number(product?.stok_sistem ?? product?.qty_stok ?? product?.stok ?? 0);
}

function getOpnameOutletId() {
  const outletSelect = document.getElementById('opnameOutletSelect');
  const raw = outletSelect?.value;
  return raw ? Number(raw) : undefined;
}

function getTodayLocalDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getOpnameRange() {
  const bulan = document.getElementById('opnameBulan')?.value || getBulan();
  const tahun = document.getElementById('opnameTahun')?.value || getTahun();
  const month = String(bulan).padStart(2, '0');
  const startDate = `${tahun}-${month}-01`;
  const endDate = `${tahun}-${month}-${new Date(Number(tahun), Number(bulan), 0).getDate()}`;
  return { bulan, tahun, startDate, endDate };
}

async function loadOpnameKpiData(options = {}) {
  const { showSpinner = false } = options;
  if (showSpinner) showLoader();
  try {
    const { bulan, tahun } = getOpnameRange();
    const qs = new URLSearchParams({ bulan, tahun });
    const sku = getSelectedSku();
    if (sku) qs.set('sku', sku);
    state.opname = toArray(await fetchJson(`/api/stok-sistem?${qs.toString()}`));
    refreshOpnameMetrics();
  } catch (error) {
    console.error('Load opname KPI error:', error);
    refreshOpnameMetrics();
  } finally {
    if (showSpinner) hideLoader();
  }
}

async function loadStokSistem() {
  showLoader();
  try {
    const { bulan, tahun } = getOpnameRange();
    const qs = new URLSearchParams({
      bulan,
      tahun
    });

    const sku = getSelectedSku();
    if (sku) qs.set('sku', sku);

    state.opname = toArray(await fetchJson(`/api/stok-sistem?${qs.toString()}`));
    const body = document.getElementById('opnameBody');

    if (body) {
      body.innerHTML = '';

      if (!state.opname.length) {
        body.innerHTML = `<tr><td colspan="7">Belum ada stok sistem pada periode ini.</td></tr>`;
      }

      state.opname.forEach((item) => {
        const skuValue = item.sku || item.kode_barang || '';
        const namaValue = item.nama_barang || item.nama_produk || '-';
        const category = getOpnameCategory(namaValue);
        const rakLabel = item.rak_code ? escapeHtml(item.rak_code) : '-';
        const stokLabel = getProductStokSistem(item);

        body.innerHTML += `
          <tr id="row-${escapeHtml(skuValue)}" data-category="${category}" data-rak-barcode="${escapeHtml(item.rak_barcode || '')}" data-visible="true" data-scanned="false">
            <td>${escapeHtml(skuValue)}</td>
            <td>${escapeHtml(namaValue)}</td>
            <td>${rakLabel}</td>
            <td><span class="status-badge status-safe">${getOpnameCategoryLabel(category)}</span></td>
            <td id="sys-${escapeHtml(skuValue)}">${formatNumber(stokLabel)}</td>
            <td>
              <input
                type="number"
                class="input-opname"
                id="fisik-${escapeHtml(skuValue)}"
                oninput="hitungSelisih('${escapeHtml(skuValue)}')"
                onkeydown="handleOpnameInputKey(event, '${escapeHtml(skuValue)}')"
                placeholder="Qty fisik"
                min="0"
              />
            </td>
            <td id="selisih-${escapeHtml(skuValue)}">0</td>
          </tr>
        `;
      });

      updateSummary();
      filterOpname();
    } else {
      refreshOpnameMetrics();
    }
  } catch (error) {
    console.error('Stok sistem error:', error);
    showToast(error.message || 'Gagal memuat stok sistem', false);
  } finally {
    hideLoader();
  }
}

function nextInput(event, index) {
  if (event.key !== 'Enter') return;
  const inputs = document.querySelectorAll('.input-opname');
  inputs[index + 1]?.focus();
}

function hideAllOpnameRows() {
  document.querySelectorAll('#opnameBody tr').forEach(row => {
    row.style.display = 'none';
    row.classList.remove('active-opname-row');
  });
}

function showOpnameRow(row) {
  document.querySelectorAll('#opnameBody tr').forEach(item => {
    item.classList.remove('active-opname-row');
  });
  row.dataset.visible = 'true';
  row.style.display = '';
  row.classList.add('active-opname-row');
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function handleOpnameInputKey(event, sku) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  saveScannedOpnameRow(sku).catch((error) => {
    console.error('Save scan row error:', error);
    showToast(error.message || 'Gagal menyimpan data scan', false);
  });
}

async function saveScannedOpnameRow(sku) {
  const input = document.getElementById(`fisik-${sku}`);
  if (!input) return;

  if (input.value === '') {
    showToast('Isi stok fisik sebelum menyimpan.', false);
    input.focus();
    return;
  }

  hitungSelisih(sku);

  const row = document.getElementById(`row-${sku}`);
  const nama = row?.children[1]?.textContent?.trim() || '';
  const sistem = Number((document.getElementById(`sys-${sku}`)?.textContent || '0').replace(/\./g, '').replace(/,/g, ''));
  const fisik = Number(input.value || 0);
  const selisih = fisik - sistem;

  state.opnameScan[sku] = {
    nama,
    sistem,
    fisik,
    selisih
  };

  if (row) {
    row.dataset.scanned = 'true';
    row.dataset.visible = 'true';
    row.style.display = '';
    row.classList.remove('active-opname-row');
    row.classList.add('counted-opname-row');
  }

  updateSummary();
  updateOpnameScanSummary();
  const scanResultInput = document.getElementById('scanOpnameResult');
  if (scanResultInput) scanResultInput.value = '';
  document.getElementById('scanOpnameStatus').textContent = `Mode scan: ${opnameScannerMode}`;
  showToast(`Data ${sku} disimpan. Lanjut scan berikutnya.`);
  await autoSaveOpname({ silent: true });
}

function hitungSelisih(sku) {
  const sistem = Number((document.getElementById(`sys-${sku}`)?.textContent || '0').replace(/\./g, '').replace(/,/g, ''));
  const input = document.getElementById(`fisik-${sku}`);
  const fisik = input?.value === '' ? sistem : Number(input?.value || 0);
  const selisih = fisik - sistem;

  const selisihEl = document.getElementById(`selisih-${sku}`);
  const row = document.getElementById(`row-${sku}`);

  if (selisihEl) {
    selisihEl.textContent = formatNumber(selisih);
    selisihEl.classList.remove('selisih-plus', 'selisih-minus');
    if (selisih > 0) selisihEl.classList.add('selisih-plus');
    if (selisih < 0) selisihEl.classList.add('selisih-minus');
  }

  row?.classList.toggle('row-problem', selisih !== 0);
  updateSummary();
}

function hasOpnameInput(row) {
  const sku = row.id.replace('row-', '');
  const input = document.getElementById(`fisik-${sku}`);
  return row.dataset.scanned === 'true' || (input && input.value !== '');
}

function refreshOpnameMetrics() {
  const hasTable = Boolean(document.getElementById('opnameBody'));
  if (hasTable) {
    updateSummary();
    return;
  }

  const products = Array.isArray(state.opname) ? state.opname : [];
  const totalSku = products.length || state.produkOptions.length || 0;
  let totalStokSistemProduk = 0;

  products.forEach((item) => {
    totalStokSistemProduk += getProductStokSistem(item);
  });

  let totalSistemScan = 0;
  let totalFisik = 0;
  let totalSelisih = 0;
  let problem = 0;
  const scannedCount = Object.keys(state.opnameScan).length;

  Object.values(state.opnameScan).forEach(item => {
    totalSistemScan += Number(item.sistem || 0);
    totalFisik += Number(item.fisik || 0);
    totalSelisih += Number(item.selisih ?? (item.fisik - item.sistem));
    if (Number(item.selisih ?? (item.fisik - item.sistem)) !== 0) problem += 1;
  });

  const remaining = Math.max(totalSku - scannedCount, 0);
  const progress = totalSku ? Math.round((scannedCount / totalSku) * 100) : 0;
  const stokSistemDisplay = scannedCount > 0 ? totalSistemScan : totalStokSistemProduk;

  setText('kpi_opname_total', formatNumber(totalSku));
  setText('kpi_opname_counted', formatNumber(scannedCount));
  setText('kpi_opname_progress', `${progress}% progress`);
  setText('kpi_opname_sistem', formatNumber(stokSistemDisplay));
  setText('kpi_opname_fisik', formatNumber(totalFisik));
  setText('kpi_opname_selisih', formatNumber(totalSelisih));
  setText('kpi_opname_problem', formatNumber(problem));
  setText('kpi_opname_remaining', `${formatNumber(remaining)} belum dihitung`);
  setText('sum_total', formatNumber(scannedCount));
  setText('sum_selisih', formatNumber(totalSelisih));
  setText('sum_problem', formatNumber(problem));

  const progressBar = document.getElementById('opnameProgressBar');
  if (progressBar) progressBar.style.width = `${progress}%`;

  const lastScan = Object.keys(state.opnameScan).at(-1);
  setText('opnameLastScanBadge', lastScan ? `Terakhir: ${lastScan}` : 'Belum ada scan');
}

function updateSummary() {
  const body = document.getElementById('opnameBody');
  if (!body) {
    refreshOpnameMetrics();
    return;
  }

  const totalSku = document.querySelectorAll('#opnameBody tr[id^="row-"]').length;
  let totalSistem = 0;
  let totalFisik = 0;
  let totalSelisih = 0;
  let problem = 0;
  let scannedCount = 0;

  document.querySelectorAll('#opnameBody tr').forEach(row => {
    if (!hasOpnameInput(row)) return;

    const sku = row.id.replace('row-', '');
    const sistem = Number((document.getElementById(`sys-${sku}`)?.textContent || '0').replace(/\./g, '').replace(/,/g, ''));
    const input = document.getElementById(`fisik-${sku}`);
    const fisik = input?.value === '' ? sistem : Number(input?.value || 0);
    const selisih = fisik - sistem;

    scannedCount += 1;
    totalSistem += sistem;
    totalFisik += fisik;
    totalSelisih += selisih;
    if (selisih !== 0) problem += 1;
  });

  const remaining = Math.max(totalSku - scannedCount, 0);
  const progress = totalSku ? Math.round((scannedCount / totalSku) * 100) : 0;

  setText('kpi_opname_total', formatNumber(totalSku));
  setText('kpi_opname_counted', formatNumber(scannedCount));
  setText('kpi_opname_progress', `${progress}% progress`);
  setText('kpi_opname_sistem', formatNumber(totalSistem));
  setText('kpi_opname_fisik', formatNumber(totalFisik));
  setText('kpi_opname_selisih', formatNumber(totalSelisih));
  setText('kpi_opname_problem', formatNumber(problem));
  setText('kpi_opname_remaining', `${formatNumber(remaining)} belum dihitung`);
  setText('sum_total', formatNumber(scannedCount));
  setText('sum_selisih', formatNumber(totalSelisih));
  setText('sum_problem', formatNumber(problem));

  const progressBar = document.getElementById('opnameProgressBar');
  if (progressBar) progressBar.style.width = `${progress}%`;
}

function filterOpname() {
  const keyword = (document.getElementById('searchOpname')?.value || '').toLowerCase();
  const category = document.getElementById('opnameCategoryFilter')?.value || 'all';

  document.querySelectorAll('#opnameCategoryTabs button')
    .forEach(button => button.classList.remove('active-mini-tab'));
  document.querySelector(`#opnameCategoryTabs button[onclick*="'${category}'"]`)?.classList.add('active-mini-tab');

  const activeTargets = state.activePerintah?.kategori_targets || [];

  document.querySelectorAll('#opnameBody tr').forEach(row => {
    if (row.dataset.visible !== 'true') {
      row.style.display = 'none';
      return;
    }

    const matchText = row.textContent.toLowerCase().includes(keyword);
    const matchCategory = category === 'all' || row.dataset.category === category;
    const matchPerintahTarget = !activeTargets.length || activeTargets.includes(row.dataset.category);
    row.style.display = matchText && matchCategory && matchPerintahTarget ? '' : 'none';
  });

  if (typeof renderActivePerintahKategoriIndicator === 'function') {
    renderActivePerintahKategoriIndicator();
  }
}

function selectOpnameCategoryTab(event, category) {
  const select = document.getElementById('opnameCategoryFilter');
  if (select) select.value = category;
  filterOpname();
}

function formatHistoryKodeSo(item) {
  return escapeHtml(item.kode_so || `OPNAME-${item.opname_id}`);
}

async function loadHistory() {
  try {
    const { bulan, tahun } = getOpnameRange();
    const qs = new URLSearchParams({ bulan, tahun });
    state.opnameHistory = toArray(await fetchJson(`/api/opname-history?${qs.toString()}`));
    const body = document.getElementById('historyBody');
    if (!body) return;
    body.innerHTML = '';

    state.opnameHistory.forEach(item => {
      body.innerHTML += `
        <tr>
          <td><strong>${formatHistoryKodeSo(item)}</strong></td>
          <td>${formatDate(item.tanggal_perintah)}</td>
          <td>${formatDateTime(item.tanggal_pelaksanaan)}</td>
          <td>${escapeHtml(item.svp_nama || '-')}</td>
          <td>${escapeHtml(item.pic_pelaksana || item.checker || '-')}</td>
          <td>${escapeHtml(item.lokasi || '-')}</td>
          <td>${formatNumber(item.total_item)}</td>
          <td>${formatNumber(item.total_selisih)}</td>
          <td>
            <button type="button" class="btn-secondary btn-sm" onclick="showHistoryDetail(${item.opname_id})">
              <i data-lucide="eye"></i><span>Detail</span>
            </button>
          </td>
        </tr>
      `;
    });

    if (!state.opnameHistory.length) {
      body.innerHTML = `<tr><td colspan="9">Belum ada history SO pada periode ini.</td></tr>`;
    }

    closeHistoryDetail();
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('History opname error:', error);
    showToast(error.message || 'Gagal memuat history opname', false);
  }
}

function closeHistoryDetail() {
  const panel = document.getElementById('historyDetailPanel');
  if (panel) panel.style.display = 'none';
}

async function sesuaikanHistoryOpname() {
  const btn = document.getElementById('historySesuaikanBtn');
  const opnameId = Number(btn?.dataset.opnameId);
  if (!opnameId) {
    showToast('Data opname tidak ditemukan', false);
    return;
  }

  if (!window.confirm('Terapkan selisih hasil opname ke stok gudang (penyesuaian)?')) {
    return;
  }

  showLoader();
  try {
    const data = await fetchJson('/api/sesuaikan-opname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opname_id: opnameId })
    });
    showToast(data.message || 'Stok berhasil disesuaikan');
    await loadHistory();
    await showHistoryDetail(opnameId);
    await loadOpnameKpiData();
  } catch (error) {
    console.error('Sesuaikan history opname error:', error);
    showToast(error.message || 'Gagal menyesuaikan stok', false);
  } finally {
    hideLoader();
  }
}

async function showHistoryDetail(opnameId) {
  showLoader();
  try {
    const data = await fetchJson(`/api/opname-history?opname_id=${opnameId}`);
    const { header, details } = data;

    document.getElementById('historyDetailTitle').textContent =
      `${header.kode_so || `OPNAME-${header.opname_id}`} — ${formatDateTime(header.tanggal_pelaksanaan)}`;

    document.getElementById('historyDetailMeta').innerHTML = `
      <div><label>Kode SO</label><p style="font-weight:600;margin:0;color:#000">${escapeHtml(header.kode_so || '-')}</p></div>
      <div><label>Tanggal Perintah</label><p style="font-weight:600;margin:0;color:#000">${formatDate(header.tanggal_perintah)}</p></div>
      <div><label>Tanggal Pelaksanaan</label><p style="font-weight:600;margin:0;color:#000">${formatDateTime(header.tanggal_pelaksanaan)}</p></div>
      <div><label>SVP</label><p style="font-weight:600;margin:0;color:#000">${escapeHtml(header.svp_nama || '-')}</p></div>
      <div><label>PIC Pelaksana</label><p style="font-weight:600;margin:0;color:#000">${escapeHtml(header.pic_pelaksana || '-')}</p></div>
      <div><label>Lokasi</label><p style="font-weight:600;margin:0;color:#000">${escapeHtml(header.lokasi || '-')}</p></div>
      <div><label>Total Item / Selisih</label><p style="font-weight:600;margin:0;color:#000">${formatNumber(header.total_item)} / ${formatNumber(header.total_selisih)}</p></div>
      <div><label>Keterangan</label><p style="font-weight:600;margin:0;color:#000">${escapeHtml(header.keterangan || '-')}</p></div>
      <div><label>Status Stok</label><p style="font-weight:600;margin:0;color:#000">${header.stok_disesuaikan || header.disesuaikan_at ? `Sudah disesuaikan (${formatDateTime(header.disesuaikan_at)})` : 'Dicatat, belum disesuaikan'}</p></div>
    `;

    const sesuaikanBtn = document.getElementById('historySesuaikanBtn');
    const adaSelisih = details.some(row => Number(row.selisih) !== 0);
    if (sesuaikanBtn) {
      sesuaikanBtn.style.display = 'inline-flex';
      sesuaikanBtn.disabled = Boolean(header.stok_disesuaikan || header.disesuaikan_at) || !adaSelisih;
      sesuaikanBtn.dataset.opnameId = String(header.opname_id);
    }

    const tbody = document.getElementById('historyDetailBody');
    tbody.innerHTML = details.length
      ? details.map(row => `
        <tr>
          <td>${escapeHtml(row.sku)}</td>
          <td>${escapeHtml(row.nama_produk || '-')}</td>
          <td style="text-align:right">${formatNumber(row.stok_sistem)}</td>
          <td style="text-align:right">${formatNumber(row.stok_fisik)}</td>
          <td style="text-align:right;color:${row.selisih === 0 ? '#000' : row.selisih > 0 ? '#e65100' : '#c62828'}">${formatNumber(row.selisih)}</td>
          <td>${formatDateTime(row.input_at)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="6">Tidak ada detail produk.</td></tr>';

    const historyPanel = document.getElementById('historyDetailPanel');
    if (historyPanel) historyPanel.style.display = 'block';
    document.getElementById('historyDetailPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('History detail error:', error);
    showToast(error.message || 'Gagal memuat detail history', false);
  } finally {
    hideLoader();
  }
}

async function exportOpnameHistory() {
  try {
    const { bulan, tahun } = getOpnameRange();
    const qs = new URLSearchParams({ bulan, tahun, detail: 'true' });
    const data = await fetchJson(`/api/opname-history?${qs.toString()}`);

    if (!data?.details?.length) {
      showToast('Tidak ada detail history SO untuk diekspor', false);
      return;
    }

    downloadCsv(
      `history_so_${tahun}_${String(bulan).padStart(2, '0')}.csv`,
      [
        'kode_so', 'tanggal_perintah', 'tanggal_pelaksanaan', 'svp_nama', 'pic_pelaksana',
        'lokasi', 'sku', 'nama_produk', 'stok_sistem', 'stok_fisik', 'selisih', 'waktu_input'
      ],
      data.details.map(row => [
        row.kode_so || `OPNAME-${row.opname_id}`,
        formatDate(row.tanggal_perintah),
        formatDateTime(row.tanggal_pelaksanaan),
        row.svp_nama || '',
        row.pic_pelaksana || '',
        row.lokasi || '',
        row.sku,
        row.nama_produk || '',
        row.stok_sistem,
        row.stok_fisik,
        row.selisih,
        formatDateTime(row.input_at)
      ])
    );
  } catch (error) {
    console.error('Export history error:', error);
    showToast(error.message || 'Gagal mengekspor history opname', false);
  }
}

async function simpanOpname() {
  if (!state.activePerintah?.id) {
    showToast('Pilih perintah SO dari tab Hasil SO terlebih dahulu', false);
    showOpnameTab(null, 'opnameHasil');
    return;
  }

  const checker = document.getElementById('opnameChecker')?.value?.trim();
  const lokasi = document.getElementById('opnameGudang')?.value?.trim();

  if (!checker) {
    showToast('Isi nama PIC pelaksana terlebih dahulu', false);
    return;
  }

  if (!lokasi) {
    showToast('Isi lokasi gudang terlebih dahulu', false);
    return;
  }

  const items = Object.entries(state.opnameScan).map(([sku, data]) => ({
    sku,
    sistem: data.sistem,
    fisik: data.fisik
  }));

  if (!items.length) {
    showToast('Tidak ada data scan untuk disimpan. Lakukan scan minimal 1 barang', false);
    return;
  }

  showLoader();
  try {
    const body = {
      tanggal: getTodayLocalDate(),
      checker,
      lokasi,
      items,
      perintah_id: state.activePerintah.id,
      keterangan: state.activePerintah.keterangan || null
    };

    const data = await fetchJson('/api/simpan-opname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    showToast(data.message || 'Hasil opname berhasil difinalisasi');
    stopOpnameScanner();
    state.activePerintah = null;
    state.opnameScan = {};
    updateOpnameInputVisibility();
    updateOpnameScanSummary();
    refreshOpnameMetrics();
    await loadPerintahList();
    await loadHistory();
    showOpnameTab(null, 'opnameHasil');
  } catch (error) {
    console.error('Simpan opname error:', error);
    showToast(error.message || 'Gagal menyimpan opname', false);
  } finally {
    hideLoader();
  }
}

function exportOpname() {
  const rows = [...document.querySelectorAll('#opnameBody tr')]
    .filter(row => hasOpnameInput(row))
    .map(row => {
      const sku = row.children[0].textContent.trim();
      const kategori = row.children[3].textContent.trim();
      const sistem = row.children[4].textContent.trim();
      const input = document.getElementById(`fisik-${sku}`);
      const fisik = input?.value === '' ? sistem : input?.value || '0';
      const selisih = Number(String(fisik).replace(/\./g, '').replace(/,/g, '')) - Number(String(sistem).replace(/\./g, '').replace(/,/g, ''));
      return [sku, row.children[1].textContent.trim(), row.children[2].textContent.trim(), kategori, sistem, fisik, selisih];
    });

  downloadCsv(`opname_${getTahun()}_${getBulan()}.csv`, ['sku', 'nama_produk', 'rak', 'kategori', 'stok_sistem', 'stok_fisik', 'selisih'], rows);
}

function downloadOpnameTemplate() {
  const csv = 'sku,stok_fisik\nSKU001,10\nSKU002,5';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'template_opname.csv';
  link.click();
  URL.revokeObjectURL(url);
}

async function previewOpnameImport() {
  const file = document.getElementById('opnameImportFile')?.files?.[0];
  if (!file) {
    showToast('Pilih file CSV opname terlebih dahulu', false);
    return;
  }

  const csv = await readFileAsText(file);
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const previewEl = document.getElementById('opnameImportPreview');

  let html = `<div class="table-shell"><table class="table"><thead><tr>`;
  lines[0].split(',').forEach(header => {
    html += `<th>${escapeHtml(header.trim())}</th>`;
  });
  html += `</tr></thead><tbody>`;

  for (let index = 1; index < Math.min(lines.length, 6); index += 1) {
    html += '<tr>';
    lines[index].split(',').forEach(cell => {
      html += `<td>${escapeHtml(cell.trim())}</td>`;
    });
    html += '</tr>';
  }

  html += `</tbody></table></div>
    <div class="top-space">
      <button class="btn-primary" onclick="importOpnameCSV()">Import ke Tabel Opname</button>
    </div>`;

  previewEl.innerHTML = html;
  previewEl.dataset.csv = csv;
}

async function importOpnameCSV() {
  const previewEl = document.getElementById('opnameImportPreview');
  const csv = previewEl?.dataset.csv;
  if (!csv) {
    showToast('Preview file opname dulu sebelum import', false);
    return;
  }

  if (!state.opname.length) {
    await loadStokSistem();
  }

  let applied = 0;
  let skipped = 0;
  const hasTable = Boolean(document.getElementById('opnameBody'));

  csv.split(/\r?\n/).slice(1).filter(Boolean).forEach(line => {
    const [skuRaw, stokFisikRaw] = line.split(',').map(item => item.trim());
    if (!skuRaw || !stokFisikRaw) {
      skipped += 1;
      return;
    }

    const product = state.opname.find(item =>
      String(item.sku || item.kode_barang || '').toLowerCase() === skuRaw.toLowerCase()
    );

    if (!product) {
      skipped += 1;
      return;
    }

    const fisikQty = Number(stokFisikRaw);
    if (!Number.isFinite(fisikQty) || fisikQty < 0) {
      skipped += 1;
      return;
    }

    const sistem = getProductStokSistem(product);
    const sku = product.sku || product.kode_barang;

    if (hasTable) {
      const input = document.getElementById(`fisik-${sku}`);
      if (!input) {
        skipped += 1;
        return;
      }

      input.value = String(fisikQty);
      input.closest('tr')?.setAttribute('data-scanned', 'true');
      input.closest('tr')?.setAttribute('data-visible', 'true');
      hitungSelisih(sku);
    } else {
      state.opnameScan[sku] = {
        nama: product.nama_barang || product.nama_produk,
        sistem,
        fisik: fisikQty,
        selisih: fisikQty - sistem
      };
      updateOpnameScanSummary();
    }

    applied += 1;
  });

  showToast(`Import opname selesai (${applied} diterapkan, ${skipped} dilewati)`, applied > 0);
  showOpnameTab(null, 'opnameInput');
  document.querySelector('.tab-menu-opname button:nth-child(2)')?.classList.add('active-tab');
}

async function applyManualOpnameScan() {
  try {
    if (!state.activePerintah?.id) {
      showToast('Pilih perintah SO dari tab Hasil SO terlebih dahulu', false);
      showOpnameTab(null, 'opnameHasil');
      return;
    }

    const input = document.getElementById('manualOpnameScan');
    const sku = input?.value?.trim();
    if (!sku) {
      showToast('Isi SKU atau barcode produk terlebih dahulu', false);
      return;
    }

    if (!state.opname.length) {
      await loadStokSistem();
    }

    const product = state.opname.find(p => 
      p.sku?.toLowerCase() === sku.toLowerCase() || 
      p.kode_barang?.toLowerCase() === sku.toLowerCase()
    );

    if (!product) {
      showToast(`SKU "${sku}" tidak ditemukan di stok sistem periode ini`, false);
      input.value = '';
      input.focus();
      return;
    }

    await promptOpnameQty(product);
  } catch (error) {
    console.error('Manual opname scan error:', error);
    showToast(error.message || 'Gagal memproses scan manual', false);
  }
}

let opnameQtyModalResolver = null;
let opnameQtyModalProduct = null;
let opnameQtyModalSystemQty = 0;

function initOpnameQtyModal() {
  const modal = document.getElementById('opnameQtyModal');
  const input = document.getElementById('opnameQtyModalInput');
  const preview = document.getElementById('opnameQtySelisihPreview');
  if (!modal || !input) return;

  const closeModal = (value) => {
    modal.classList.remove('app-modal--open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    const resolve = opnameQtyModalResolver;
    opnameQtyModalResolver = null;
    opnameQtyModalProduct = null;
    resolve?.(value);
  };

  const updateSelisihPreview = () => {
    if (!preview) return;
    const raw = input.value.trim();
    if (raw === '') {
      preview.hidden = true;
      return;
    }

    const fisik = Number(raw);
    if (!Number.isFinite(fisik)) {
      preview.hidden = true;
      return;
    }

    const selisih = fisik - opnameQtyModalSystemQty;
    preview.hidden = false;
    preview.className = 'opname-qty-selisih';
    if (selisih === 0) {
      preview.classList.add('opname-qty-selisih--match');
      preview.textContent = 'Selisih: 0 — stok sesuai sistem';
    } else if (selisih > 0) {
      preview.classList.add('opname-qty-selisih--plus');
      preview.textContent = `Selisih: +${formatNumber(selisih)} (lebih dari sistem)`;
    } else {
      preview.classList.add('opname-qty-selisih--minus');
      preview.textContent = `Selisih: ${formatNumber(selisih)} (kurang dari sistem)`;
    }
  };

  const adjustQty = (delta) => {
    const current = input.value === '' ? opnameQtyModalSystemQty : Number(input.value || 0);
    const next = Math.max(0, current + delta);
    input.value = String(next);
    updateSelisihPreview();
  };

  const confirmQty = () => {
    const raw = input.value.trim();
    if (raw === '') {
      showToast('Masukkan qty fisik terlebih dahulu', false);
      input.focus();
      return;
    }

    const fisikQty = Number(raw);
    if (!Number.isFinite(fisikQty) || fisikQty < 0) {
      showToast('Qty fisik harus angka positif', false);
      input.focus();
      return;
    }

    closeModal(fisikQty);
  };

  modal.querySelectorAll('[data-opname-qty-close]').forEach(el => {
    el.addEventListener('click', () => closeModal(null));
  });

  document.getElementById('opnameQtyModalCancel')?.addEventListener('click', () => closeModal(null));
  document.getElementById('opnameQtyModalConfirm')?.addEventListener('click', confirmQty);
  document.getElementById('opnameQtyDec')?.addEventListener('click', () => adjustQty(-1));
  document.getElementById('opnameQtyInc')?.addEventListener('click', () => adjustQty(1));
  input.addEventListener('input', updateSelisihPreview);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      confirmQty();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal(null);
    }
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal(null);
  });
}

function openOpnameQtyModal(product, systemQty, currentQty = '') {
  const modal = document.getElementById('opnameQtyModal');
  const input = document.getElementById('opnameQtyModalInput');
  const preview = document.getElementById('opnameQtySelisihPreview');
  if (!modal || !input) {
    return Promise.resolve(null);
  }

  const nama = product.nama_barang || product.nama_produk || '-';
  const sku = product.sku || product.kode_barang || '-';

  opnameQtyModalProduct = product;
  opnameQtyModalSystemQty = systemQty;

  document.getElementById('opnameQtyModalTitle').textContent = nama;
  document.getElementById('opnameQtyModalSku').textContent = `SKU: ${sku}`;
  document.getElementById('opnameQtyModalSistem').textContent = formatNumber(systemQty);
  input.value = currentQty === '' || currentQty === undefined ? '' : String(currentQty);

  if (preview) {
    preview.hidden = true;
    preview.className = 'opname-qty-selisih';
  }

  modal.classList.add('app-modal--open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (window.lucide) lucide.createIcons();

  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 80);

  return new Promise(resolve => {
    opnameQtyModalResolver = resolve;
  });
}

async function promptOpnameQty(product) {
  const systemQty = getProductStokSistem(product);
  const currentQty = state.opnameScan[product.sku]?.fisik ?? '';
  const fisikQty = await openOpnameQtyModal(product, systemQty, currentQty);

  if (fisikQty === null) return;

  state.opnameScan[product.sku] = {
    nama: product.nama_barang || product.nama_produk,
    sistem: systemQty,
    fisik: fisikQty,
    selisih: fisikQty - systemQty
  };

  displayScanResult(product, fisikQty, systemQty);
  updateOpnameScanSummary();
  refreshOpnameMetrics();
  await autoSaveOpname({ silent: true });

  const input = document.getElementById('manualOpnameScan');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function displayScanResult(product, fisik, sistem) {
  const selisih = fisik - sistem;
  const resultDiv = document.getElementById('scanResultDetail');
  const resultPanel = document.getElementById('opnameScanResult');

  if (!resultDiv || !resultPanel) return;

  resultDiv.innerHTML = `
    <div style="background: #2a2e33; padding: 12px; border-radius: 6px; color: #f5f7fa;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div>
          <label style="font-size: 12px; color: #a8b0ba;">SKU</label>
          <p style="font-weight: 600; margin: 0; color: #f5f7fa;">${escapeHtml(product.sku)}</p>
        </div>
        <div>
          <label style="font-size: 12px; color: #a8b0ba;">Produk</label>
          <p style="font-weight: 600; margin: 0; color: #f5f7fa;">${escapeHtml(product.nama_barang || product.nama_produk)}</p>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
        <div style="text-align: center; padding: 12px; background: #25292e; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #a8b0ba;">Sistem</p>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #f5f7fa;">${formatNumber(sistem)}</p>
        </div>
        <div style="text-align: center; padding: 12px; background: #25292e; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #a8b0ba;">Fisik</p>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #f5f7fa;">${formatNumber(fisik)}</p>
        </div>
        <div style="text-align: center; padding: 12px; background: ${selisih === 0 ? 'rgba(52,199,89,0.18)' : selisih > 0 ? 'rgba(255,176,32,0.18)' : 'rgba(255,107,107,0.18)'}; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #a8b0ba;">Selisih</p>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: ${selisih === 0 ? '#34c759' : selisih > 0 ? '#ffb020' : '#ff6b6b'};">${formatNumber(selisih)}</p>
        </div>
      </div>
    </div>
  `;
  
  resultPanel.style.display = 'block';
}

function updateOpnameScanSummary() {
  let totalCount = 0;
  let totalSistem = 0;
  let totalFisik = 0;
  let totalSelisih = 0;

  Object.values(state.opnameScan).forEach(item => {
    totalCount++;
    totalSistem += item.sistem;
    totalFisik += item.fisik;
    totalSelisih += item.selisih;
  });

  setText('scanCount', formatNumber(totalCount));
  setText('scanSistem', formatNumber(totalSistem));
  setText('scanFisik', formatNumber(totalFisik));
  setText('scanSelisih', formatNumber(totalSelisih));
  refreshOpnameMetrics();
  if (typeof renderActivePerintahKategoriIndicator === 'function') {
    renderActivePerintahKategoriIndicator();
  }
}

async function autoSaveOpname({ silent = true } = {}) {
  if (!state.activePerintah?.id) return;
  const items = Object.entries(state.opnameScan).map(([sku, data]) => ({
    sku,
    sistem: Number(data.sistem || 0),
    fisik: Number(data.fisik || 0)
  }));
  if (!items.length) return;

  try {
    const body = {
      tanggal: getTodayLocalDate(),
      checker: document.getElementById('opnameChecker')?.value?.trim() || null,
      lokasi: document.getElementById('opnameGudang')?.value?.trim() || null,
      items,
      perintah_id: state.activePerintah.id,
      keterangan: state.activePerintah.keterangan || null,
      partial: true
    };

    await fetchJson('/api/simpan-opname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error('Auto save opname error:', error);
    if (!silent) showToast(error.message || 'Gagal menyimpan opname otomatis', false);
  }
}

function loadScannerLibrary() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
  ];

  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) {
      resolve();
      return;
    }

    const tryLoad = index => {
      if (index >= urls.length) {
        reject(new Error('Gagal memuat library scanner dari semua CDN'));
        return;
      }

      const script = document.createElement('script');
      script.src = urls[index];
      script.async = true;
      script.onload = () => {
        if (window.Html5Qrcode) {
          resolve();
        } else {
          tryLoad(index + 1);
        }
      };
      script.onerror = () => {
        script.remove();
        tryLoad(index + 1);
      };
      document.head.appendChild(script);
    };

    tryLoad(0);
  });
}

async function startOpnameScanner() {
  if (!state.activePerintah?.id) {
    showToast('Pilih perintah SO dari tab Hasil SO terlebih dahulu', false);
    return;
  }

  const scanContainer = document.getElementById('scannerPreview');
  if (!scanContainer) {
    showToast('Container scanner tidak ditemukan', false);
    return;
  }

  if (!window.Html5Qrcode) {
    try {
      await loadScannerLibrary();
    } catch (error) {
      console.error(error);
      showToast('Library scanner tidak tersedia', false);
      return;
    }
  }

  if (opnameScanner) {
    opnameScanner.clear().catch(() => {});
  }

  opnameScanner = new Html5Qrcode('scannerPreview');
  const config = { fps: 10, qrbox: { width: 280, height: 180 } };

  opnameScanner.start(
    { facingMode: 'environment' },
    config,
    qrCodeMessage => {
      const statusEl = document.getElementById('scanOpnameStatus');
      if (statusEl) statusEl.textContent = 'Barcode terbaca';
      applyScannedOpname(qrCodeMessage);
    },
    errorMessage => {
      console.debug('Scanner info:', errorMessage);
    }
  ).catch(error => {
    console.error('Scanner gagal dimulai:', error);
    showToast('Gagal mengaktifkan kamera scan', false);
  });
}

function stopOpnameScanner() {
  if (!opnameScanner) return;
  opnameScanner.stop().then(() => {
    opnameScanner.clear().catch(() => {});
    opnameScanner = null;
    document.getElementById('scanOpnameStatus').textContent = 'Scanner berhenti';
  }).catch(error => {
    console.error('Gagal stop scanner', error);
  });
}

function resetOpnameScanState() {
  stopOpnameScanner();
  state.opnameScan = {};
  const manualInput = document.getElementById('manualOpnameScan');
  if (manualInput) manualInput.value = '';
  const statusEl = document.getElementById('scanOpnameStatus');
  if (statusEl) statusEl.textContent = 'Siap scan';
  const resultPanel = document.getElementById('opnameScanResult');
  if (resultPanel) resultPanel.style.display = 'none';
  updateOpnameScanSummary();
  refreshOpnameMetrics();
  manualInput?.focus();
}

function setOpnameScannerMode(mode) {
  opnameScannerMode = mode;
  document.getElementById('scanOpnameStatus').textContent = `Mode scan: ${mode}`;
}

function applyScannedOpname(barcode) {
  const normalized = barcode.trim();
  if (!normalized) return;

  const manualInput = document.getElementById('manualOpnameScan');
  if (manualInput) {
    manualInput.value = normalized;
    applyManualOpnameScan();
    return;
  }

  const rows = [...document.querySelectorAll('#opnameBody tr')];
  let found = false;

  rows.forEach(row => {
    const sku = row.children[0].textContent.trim();
    const nama = row.children[1].textContent.trim();
    const rakBarcode = row.dataset.rakBarcode || '';

    if (opnameScannerMode === 'rak' && rakBarcode && rakBarcode === normalized) {
      showOpnameRow(row);
      setText('opnameLastScanBadge', `Rak: ${normalized}`);
      found = true;
    }

    if (opnameScannerMode === 'barang' && (sku === normalized || nama.toLowerCase().includes(normalized.toLowerCase()))) {
      showOpnameRow(row);
      row.querySelector('.input-opname')?.focus();
      setText('opnameLastScanBadge', `Produk: ${sku}`);
      found = true;
    }
  });

  if (!found) {
    showToast('Barcode tidak ditemukan', false);
  }
}

function printOpname() {
  const checker = document.getElementById('opnameChecker')?.value?.trim() || '................................';
  const gudang = document.getElementById('opnameGudang')?.value?.trim() || '................................';
  const category = document.getElementById('opnamePrintCategory')?.value || 'all';
  const rows = [...document.querySelectorAll('#opnameBody tr')]
    .filter(row => hasOpnameInput(row))
    .filter(row => category === 'all' || row.dataset.category === category);

  if (!rows.length) {
    showToast('Tidak ada data opname yang sudah diisi untuk kategori yang dipilih', false);
    return;
  }

  const tableRows = rows.map((row, index) => {
    const sku = row.children[0].textContent.trim();
    const sistem = row.children[4].textContent.trim();
    const fisik = document.getElementById(`fisik-${sku}`)?.value || '';
    const selisih = row.children[6].textContent.trim();

    return [
      index + 1,
      sku,
      row.children[1].textContent.trim(),
      row.children[2].textContent.trim(),
      row.children[3].textContent.trim(),
      sistem,
      fisik,
      selisih
    ];
  });

  const title = `Form Stok Opname Gudang - ${getBulanLabel(document.getElementById('opnameBulan')?.value)} ${document.getElementById('opnameTahun')?.value}`;
  const summary = [
    ['Checker', checker],
    ['Gudang / Lokasi', gudang],
    ['Tanggal Cetak', formatDate(new Date())]
  ];

  openPrintWindow({
    title,
    subtitle: `Periode ${getBulanLabel(document.getElementById('opnameBulan')?.value)} ${document.getElementById('opnameTahun')?.value}`,
    summary,
    headers: ['No', 'SKU', 'Nama Produk', 'Rak', 'Kategori', 'Stok Sistem', 'Stok Fisik', 'Selisih'],
    rows: tableRows
  });
}

function exportCurrentModule() {
  if (currentMenu === "persediaan") {
    downloadCsv(
      `persediaan_${getTahun()}_${getBulan()}.csv`,
      ["sku", "nama_produk", "kategori", "opening", "pembelian", "keluar_gudang", "penyesuaian", "stok_akhir"],
      state.persediaan.map(item => [
        item.sku,
        item.nama_produk,
        getOpnameCategoryLabel(getOpnameCategory(item.nama_produk)),
        item.stok_awal,
        item.pembelian,
        item.penjualan,
        item.penyesuaian,
        item.stok_akhir
      ])
    );
    return;
  }

  if (currentMenu === "audit") {
    const outletVisible = document.getElementById("auditOutletStock")?.style.display !== "none";
    if (outletVisible) {
      downloadCsv(
        `audit_stok_outlet_${getTahun()}_${getBulan()}.csv`,
        ["outlet", "sku", "nama_produk", "opening", "stok_masuk", "stok_keluar", "penyesuaian", "stok_akhir"],
        state.audit.outlet_summary.map(item => [item.nama_outlet, item.sku, item.nama_produk, item.opening_stok, item.stok_masuk, item.stok_keluar, item.penyesuaian, item.stok_akhir])
      );
    } else {
      downloadCsv(
        `audit_mutasi_${getTahun()}_${getBulan()}.csv`,
        ["tanggal", "sumber", "jenis", "outlet", "sku", "qty", "referensi", "keterangan"],
        state.audit.movements.map(item => [item.tanggal, item.sumber, item.jenis, item.nama_outlet, item.sku, item.qty, item.referensi, item.keterangan])
      );
    }
    return;
  }

  if (currentMenu === "forecast") {
    downloadCsv(
      `forecast_${getTahun()}_${getBulan()}.csv`,
      ["sku", "nama_produk", "bulan_1", "bulan_2", "bulan_3", "ema_3_bulan", "forecast_bulan_depan"],
      state.forecast.map(item => [item.sku, item.nama_produk, item.bulan_1, item.bulan_2, item.bulan_3, item.ema_3_bulan, item.forecast_bulan_depan])
    );
  }
}

function downloadCsv(filename, headers, rows) {
  const content = [
    headers.join(","),
    ...rows.map(row => row.map(cell => csvEscape(cell)).join(","))
  ].join("\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function printCurrentView() {
  if (currentMenu === "penjualan") {
    openPrintWindow({
      title: "Ringkasan Penjualan Warehouse",
      subtitle: `Periode ${getBulanLabel()} ${getTahun()}${getSelectedSku() ? ` | SKU ${getSelectedSku()}` : ""}`,
      summary: [
        ["Total Qty", document.getElementById("kpi_qty")?.textContent || "0"],
        ["Total Penjualan", document.getElementById("kpi_nilai")?.textContent || "Rp 0"],
        ["Total Modal", document.getElementById("kpi_modal")?.textContent || "Rp 0"],
        ["Profit", document.getElementById("kpi_profit")?.textContent || "Rp 0"]
      ]
    });
    return;
  }

  if (currentMenu === "persediaan") {
    openPrintWindow({
      title: "Laporan Persediaan Warehouse",
      subtitle: `Periode ${getBulanLabel()} ${getTahun()}`,
      headers: ["SKU", "Nama Produk", "Kategori", "Opening", "Pembelian", "Keluar Gudang", "Penyesuaian", "Stok Akhir"],
      rows: state.persediaan.map(item => [
        item.sku,
        item.nama_produk,
        getOpnameCategoryLabel(getOpnameCategory(item.nama_produk)),
        item.stok_awal,
        item.pembelian,
        item.penjualan,
        item.penyesuaian,
        item.stok_akhir
      ])
    });
    return;
  }

  if (currentMenu === "audit") {
    openPrintWindow({
      title: "Laporan Audit Stok Outlet",
      subtitle: `Periode ${getBulanLabel()} ${getTahun()}`,
      summary: [
        ["Status DB Audit", state.audit.db_ready ? "Siap" : "Perlu tabel tambahan"],
        ["Total Mutasi", formatNumber(state.audit.summary?.total_mutasi)],
        ["Stok Masuk Outlet", formatNumber(state.audit.summary?.stok_masuk_outlet)],
        ["Penjualan Outlet", formatNumber(state.audit.summary?.penjualan_outlet)]
      ],
      headers: ["Outlet", "SKU", "Nama Produk", "Opening", "Masuk", "Keluar", "Penyesuaian", "Stok Akhir"],
      rows: state.audit.outlet_summary.map(item => [item.nama_outlet, item.sku, item.nama_produk, item.opening_stok, item.stok_masuk, item.stok_keluar, item.penyesuaian, item.stok_akhir])
    });
    return;
  }

  if (currentMenu === "forecast") {
    openPrintWindow({
      title: "Laporan Forecast Penjualan",
      subtitle: `Periode ${getBulanLabel()} ${getTahun()}`,
      headers: ["SKU", "Nama Produk", "Bulan -2", "Bulan -1", "Bulan Aktif", "EMA 3 Bulan", "Forecast +10%"],
      rows: state.forecast.map(item => [item.sku, item.nama_produk, item.bulan_1, item.bulan_2, item.bulan_3, item.ema_3_bulan, item.forecast_bulan_depan])
    });
    return;
  }

  if (currentMenu === "opname") {
    printOpname();
  }
}

function openPrintWindow({ title, subtitle = "", summary = [], headers = [], rows = [] }) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) {
    showToast("Popup print diblokir browser", false);
    return;
  }

  const summaryHtml = summary.length
    ? `
      <table class="summary">
        <tbody>
          ${summary.map(item => `<tr><td>${escapeHtml(item[0])}</td><td>${escapeHtml(item[1])}</td></tr>`).join("")}
        </tbody>
      </table>
    `
    : "";

  const tableHtml = headers.length
    ? `
      <table class="main">
        <thead>
          <tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.length
            ? rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${headers.length}">Tidak ada data untuk dicetak.</td></tr>`}
        </tbody>
      </table>
    `
    : "";

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2933; padding: 30px; }
          .brand { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
          .brand img { width: 68px; height: 68px; object-fit: contain; }
          .brand h1 { margin: 0; font-size: 28px; }
          .brand p { margin: 4px 0 0; color: #677788; }
          .summary, .main { width: 100%; border-collapse: collapse; margin-top: 18px; }
          .summary td, .main td, .main th { border: 1px solid #d9dee7; padding: 10px 12px; font-size: 13px; }
          .main th { background: #f8f2e7; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
          .footer { margin-top: 18px; color: #677788; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="brand">
          <img src="/assets/logo.png" alt="CV EPIC Warehouse">
          <div>
            <h1>CV EPIC Warehouse</h1>
            <p>${escapeHtml(title)}</p>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>
        ${summaryHtml}
        ${tableHtml}
        <div class="footer">Dicetak pada ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// ============================================
// Admin Dashboard Functions
// ============================================

// ============================================
// Operator Dashboard Functions
// ============================================

function loadOperatorDashboard() {
  // Update operator info from auth
  const auth = getStoredAuth();
  if (auth) {
    const displayName = auth.nama_lengkap || auth.username || 'Operator';
    const initial = displayName.charAt(0).toUpperCase();
    
    const operatorAvatar = document.getElementById("operatorAvatar");
    const operatorName = document.getElementById("operatorName");
    
    if (operatorAvatar) operatorAvatar.textContent = initial;
    if (operatorName) operatorName.textContent = displayName;
  }
  
  // Set current date
  const operatorDate = document.getElementById("operatorDate");
  if (operatorDate) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    operatorDate.textContent = now.toLocaleDateString('id-ID', options);
  }
  
  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function startTask(taskId) {
  showToast(`Memulai task: ${taskId}`, true);
  // Navigate to opname for stock opname tasks
  if (taskId.startsWith('opname')) {
    selectMenu(null, 'opname');
  }
}

function continueTask(taskId) {
  showToast(`Melanjutkan task: ${taskId}`, true);
  if (taskId.startsWith('opname')) {
    selectMenu(null, 'opname');
  }
}

function viewTask(taskId) {
  showToast(`Melihat detail task: ${taskId}`, true);
}

function continueOpname() {
  showToast("Melanjutkan opname...", true);
  selectMenu(null, 'opname');
}

function navigateToOperatorSection(section) {
  showToast(`Navigasi ke ${section}...`, true);
  
  const sectionMap = {
    'all-tasks': 'opname',
    'opname-history': 'opname',
    'scan': 'opname'
  };
  
  const targetMenu = sectionMap[section] || 'opname';
  selectMenu(null, targetMenu);
}

// Initialize operator dashboard on page load
document.addEventListener("DOMContentLoaded", () => {
  // Operator dashboard is shown for non-admin users when they select opname
  // The actual visibility is handled in selectMenu function
});

/* ============================================
   Task Center Functions
   ============================================ */

const TASK_STATUSES = {
  draft: { label: 'Draft', class: 'status-chip--draft' },
  assigned: { label: 'Assigned', class: 'status-chip--assigned' },
  in_progress: { label: 'In Progress', class: 'status-chip--in_progress' },
  review: { label: 'Review', class: 'status-chip--review' },
  approved: { label: 'Approved', class: 'status-chip--approved' },
  closed: { label: 'Closed', class: 'status-chip--closed' }
};

const TASK_PRIORITIES = {
  high: { label: 'High', class: 'priority-badge--high' },
  medium: { label: 'Medium', class: 'priority-badge--medium' },
  low: { label: 'Low', class: 'priority-badge--low' }
};

let currentTaskView = 'list';

function loadTaskCenter() {
  renderTaskList();
  updateTaskStats();
  populateBoardView();
}

function renderTaskList(filteredTasks) {
  const taskListBody = document.getElementById('taskListBody');
  if (!taskListBody) return;

  if (filteredTasks.length === 0) {
    taskListBody.innerHTML = `
      <div class="task-row" style="justify-content: center; padding: 40px;">
        <p style="color: var(--muted);">Tidak ada task yang ditemukan</p>
      </div>
    `;
    return;
  }

  taskListBody.innerHTML = filteredTasks.map(task => `
    <div class="task-row" onclick="openTaskDetail('${task.id}')">
      <div class="task-row__title">
        <i data-lucide="clipboard"></i>
        <span>${escapeHtml(task.title)}</span>
      </div>
      <div>
        <span class="status-chip ${TASK_STATUSES[task.status]?.class || ''}">${TASK_STATUSES[task.status]?.label || task.status}</span>
      </div>
      <div>
        <span class="priority-badge ${TASK_PRIORITIES[task.priority]?.class || ''}">${TASK_PRIORITIES[task.priority]?.label || task.priority}</span>
      </div>
      <div>
        <div class="task-assignee">
          <div class="task-assignee__avatar">${task.assignee.initials}</div>
          <span class="task-assignee__name">${task.assignee.name}</span>
        </div>
      </div>
      <div>
        <span class="task-due ${isOverdue(task.dueDate) ? 'overdue' : ''}">${formatDate(task.dueDate)}</span>
      </div>
      <div class="task-actions">
        <button type="button" class="task-action-btn" onclick="event.stopPropagation(); openTaskDetail('${task.id}')" title="View">
          <i data-lucide="eye"></i>
        </button>
        <button type="button" class="task-action-btn" onclick="event.stopPropagation(); updateTaskStatus('${task.id}')" title="Update Status">
          <i data-lucide="edit-2"></i>
        </button>
      </div>
    </div>
  `).join('');

  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function updateTaskStats() {
  const stats = {
    total: mockTasks.length,
    draft: 0,
    assigned: 0,
    in_progress: 0,
    review: 0,
    closed: 0
  };

  mockTasks.forEach(task => {
    if (stats[task.status] !== undefined) {
      stats[task.status]++;
    }
  });

  document.getElementById('taskCountTotal').textContent = stats.total;
  document.getElementById('taskCountDraft').textContent = stats.draft;
  document.getElementById('taskCountAssigned').textContent = stats.assigned + stats.in_progress;
  document.getElementById('taskCountInProgress').textContent = stats.in_progress;
  document.getElementById('taskCountReview').textContent = stats.review;
  document.getElementById('taskCountClosed').textContent = stats.closed;
}

function populateBoardView() {
  const statuses = ['draft', 'assigned', 'in_progress', 'review', 'approved', 'closed'];
  
  statuses.forEach(status => {
    const container = document.getElementById(`board${status.charAt(0).toUpperCase() + status.slice(1).replace('_', '')}`);
    if (!container) return;

    const tasks = mockTasks.filter(t => t.status === status);
    
    if (tasks.length === 0) {
      container.innerHTML = '<p style="color: var(--muted); font-size: 12px; text-align: center; padding: 20px;">Tidak ada task</p>';
      return;
    }

    container.innerHTML = tasks.map(task => `
      <div class="task-board-card" onclick="openTaskDetail('${task.id}')">
        <div class="task-board-card__header">
          <span class="priority-badge ${TASK_PRIORITIES[task.priority]?.class || ''}">${TASK_PRIORITIES[task.priority]?.label || task.priority}</span>
        </div>
        <div class="task-board-card__title">${escapeHtml(task.title)}</div>
        <div class="task-board-card__meta">
          <div class="task-board-card__assignee">
            <div class="task-board-card__avatar">${task.assignee.initials}</div>
            <span class="task-board-card__name">${task.assignee.name}</span>
          </div>
          <span class="task-board-card__due ${isOverdue(task.dueDate) ? 'overdue' : ''}">${formatDate(task.dueDate)}</span>
        </div>
      </div>
    `).join('');
  });

  // Update column counts
  document.querySelector('.task-board-column[data-status="draft"] .task-board-column__count').textContent = mockTasks.filter(t => t.status === 'draft').length;
  document.querySelector('.task-board-column[data-status="assigned"] .task-board-column__count').textContent = mockTasks.filter(t => t.status === 'assigned').length;
  document.querySelector('.task-board-column[data-status="in_progress"] .task-board-column__count').textContent = mockTasks.filter(t => t.status === 'in_progress').length;
  document.querySelector('.task-board-column[data-status="review"] .task-board-column__count').textContent = mockTasks.filter(t => t.status === 'review').length;
  document.querySelector('.task-board-column[data-status="approved"] .task-board-column__count').textContent = mockTasks.filter(t => t.status === 'approved').length;
  document.querySelector('.task-board-column[data-status="closed"] .task-board-column__count').textContent = mockTasks.filter(t => t.status === 'closed').length;
}

function setTaskView(view) {
  currentTaskView = view;
  
  const listView = document.getElementById('taskcenterListView');
  const boardView = document.getElementById('taskcenterBoardView');
  const viewBtns = document.querySelectorAll('.view-btn');

  if (view === 'list') {
    listView.style.display = 'block';
    boardView.style.display = 'none';
  } else {
    listView.style.display = 'none';
    boardView.style.display = 'flex';
  }

  viewBtns.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.view-btn[onclick="setTaskView('${view}')"]`)?.classList.add('active');
}

function filterTasks() {
  const search = document.getElementById('taskcenterSearch')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('taskcenterStatusFilter')?.value || '';
  const priorityFilter = document.getElementById('taskcenterPriorityFilter')?.value || '';
  const assigneeFilter = document.getElementById('taskcenterAssigneeFilter')?.value || '';

  const filtered = mockTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search) || task.id.toLowerCase().includes(search);
    const matchesStatus = !statusFilter || task.status === statusFilter;
    const matchesPriority = !priorityFilter || task.priority === priorityFilter;
    const matchesAssignee = !assigneeFilter || task.assignee.id === assigneeFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });

  renderTaskList(filtered);
}

function openTaskDetail(taskId) {
  const task = mockTasks.find(t => t.id === taskId);
  if (!task) return;

  // Create or show drawer
  let drawer = document.querySelector('.task-detail-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.className = 'task-detail-drawer';
    document.body.appendChild(drawer);
  }

  drawer.innerHTML = `
    <div class="task-detail-drawer__header">
      <h3>${escapeHtml(task.id)}</h3>
      <button type="button" class="task-detail-drawer__close" onclick="closeTaskDetail()">
        <i data-lucide="x"></i>
      </button>
    </div>
    <div class="task-detail-drawer__body">
      <div class="task-detail-section">
        <h4>Detail Task</h4>
        <div class="task-detail-meta">
          <div class="task-detail-item">
            <span class="task-detail-item__label">Status</span>
            <span class="status-chip ${TASK_STATUSES[task.status]?.class || ''}">${TASK_STATUSES[task.status]?.label || task.status}</span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-item__label">Priority</span>
            <span class="priority-badge ${TASK_PRIORITIES[task.priority]?.class || ''}">${TASK_PRIORITIES[task.priority]?.label || task.priority}</span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-item__label">Assignee</span>
            <span class="task-detail-item__value">${task.assignee.name}</span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-item__label">Due Date</span>
            <span class="task-detail-item__value ${isOverdue(task.dueDate) ? 'overdue' : ''}" style="${isOverdue(task.dueDate) ? 'color: var(--danger);' : ''}">${formatDate(task.dueDate)}</span>
          </div>
        </div>
      </div>
      <div class="task-detail-section">
        <h4>Judul</h4>
        <p class="task-detail-description">${escapeHtml(task.title)}</p>
      </div>
      <div class="task-detail-section">
        <h4>Deskripsi</h4>
        <p class="task-detail-description">${escapeHtml(task.description)}</p>
      </div>
      <div class="task-detail-section">
        <h4>Aktivitas</h4>
        <div class="task-activity-feed">
          ${task.activity.map(a => `
            <div class="activity-feed-item">
              <div class="activity-feed-item__avatar">${a.user.charAt(0)}</div>
              <div class="activity-feed-item__content">
                <p class="activity-feed-item__text"><strong>${a.user}</strong> ${a.action}</p>
                <p class="activity-feed-item__time">${a.time}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="task-detail-drawer__footer">
      <button type="button" class="btn-secondary" onclick="closeTaskDetail()">Tutup</button>
      <button type="button" class="btn-primary" onclick="updateTaskStatus('${task.id}')">Update Status</button>
    </div>
  `;

  drawer.classList.add('open');
  
  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeTaskDetail() {
  const drawer = document.querySelector('.task-detail-drawer');
  if (drawer) {
    drawer.classList.remove('open');
  }
}

function openCreateTaskModal() {
  let modal = document.querySelector('.task-create-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'task-create-modal';
    modal.innerHTML = `
      <div class="task-create-modal__content">
        <div class="task-create-modal__header">
          <h3>Buat Task Baru</h3>
          <button type="button" class="task-create-modal__close" onclick="closeCreateTaskModal()">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="task-create-modal__body">
          <div class="task-form-group">
            <label for="taskTitle">Judul Task</label>
            <input type="text" id="taskTitle" placeholder="Masukkan judul task">
          </div>
          <div class="task-form-group">
            <label for="taskDescription">Deskripsi</label>
            <textarea id="taskDescription" placeholder="Masukkan deskripsi task"></textarea>
          </div>
          <div class="task-form-row">
            <div class="task-form-group">
              <label for="taskPriority">Priority</label>
              <select id="taskPriority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div class="task-form-group">
              <label for="taskAssignee">Assignee</label>
              <select id="taskAssignee">
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
              </select>
            </div>
          </div>
          <div class="task-form-group">
            <label for="taskDueDate">Due Date</label>
            <input type="date" id="taskDueDate">
          </div>
        </div>
        <div class="task-create-modal__footer">
          <button type="button" class="btn-secondary" onclick="closeCreateTaskModal()">Batal</button>
          <button type="button" class="btn-primary" onclick="createTask()">Simpan</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  
  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeCreateTaskModal() {
  const modal = document.querySelector('.task-create-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function createTask() {
  const title = document.getElementById('taskTitle')?.value;
  const description = document.getElementById('taskDescription')?.value;
  const priority = document.getElementById('taskPriority')?.value;
  const assigneeId = document.getElementById('taskAssignee')?.value;
  const dueDate = document.getElementById('taskDueDate')?.value;

  if (!title) {
    showToast('Judul task harus diisi', false);
    return;
  }

  const assigneeMap = {
    'admin': { id: 'admin', name: 'Admin', initials: 'AD' },
    'operator': { id: 'operator', name: 'Operator', initials: 'OP' }
  };

  const newTask = {
    id: `TASK-${String(mockTasks.length + 1).padStart(3, '0')}`,
    title,
    description: description || '',
    status: 'draft',
    priority: priority || 'medium',
    assignee: assigneeMap[assigneeId] || assigneeMap['admin'],
    dueDate: dueDate || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    activity: [
      { user: getCurrentUserRole() === 'admin' ? 'Admin' : 'Operator', action: 'membuat task', time: 'baru saja' }
    ]
  };

  mockTasks.unshift(newTask);
  closeCreateTaskModal();
  loadTaskCenter();
  showToast('Task berhasil dibuat', true);
}

function updateTaskStatus(taskId) {
  const task = mockTasks.find(t => t.id === taskId);
  if (!task) return;

  const statusOrder = ['draft', 'assigned', 'in_progress', 'review', 'approved', 'closed'];
  const currentIndex = statusOrder.indexOf(task.status);
  
  if (currentIndex < statusOrder.length - 1) {
    const nextStatus = statusOrder[currentIndex + 1];
    task.status = nextStatus;
    task.activity.unshift({
      user: getCurrentUserRole() === 'admin' ? 'Admin' : 'Operator',
      action: `mengubah status ke ${TASK_STATUSES[nextStatus]?.label || nextStatus}`,
      time: 'baru saja'
    });
    
    loadTaskCenter();
    closeTaskDetail();
    showToast(`Status task diupdate ke ${TASK_STATUSES[nextStatus]?.label}`, true);
  } else {
    showToast('Task sudah dalam status terakhir', false);
  }
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

// Initialize Task Center when page loads
document.addEventListener("DOMContentLoaded", () => {
  // Task center data will be loaded when user selects the menu
});

/* ============================================
   Approval Center Functions
   ============================================ */

const APPROVAL_TYPES = {
  opname: { label: 'Stok Opname', class: 'approval-type-badge--opname' },
  adjustment: { label: 'Penyesuaian', class: 'approval-type-badge--adjustment' },
  task: { label: 'Task', class: 'approval-type-badge--task' }
};

const APPROVAL_STATUSES = {
  pending: { label: 'Pending', class: 'approval-status-chip--pending' },
  approved: { label: 'Approved', class: 'approval-status-chip--approved' },
  rejected: { label: 'Rejected', class: 'approval-status-chip--rejected' },
  recount: { label: 'Recount', class: 'approval-status-chip--recount' }
};

const mockApprovals = [];

let currentApprovalFilter = 'pending';

function loadApprovalCenter() {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    showToast('Silakan login untuk melihat approval', false);
    return;
  }

  fetch('/api/v1/approvals', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      realApprovals = data.data || [];
      if (typeof updateApprovalStats === 'function' && data.stats) {
        updateApprovalStatsFromData(data.stats);
      }
      renderApprovalList(realApprovals);
    } else {
      showToast(data.message || 'Gagal memuat data approval', false);
      renderApprovalList([]);
    }
  })
  .catch(err => {
    console.error('Error loading approvals:', err);
    showToast('Terjadi kesalahan saat memuat data', false);
    renderApprovalList([]);
  });
}

// Store real approvals from API
let realApprovals = [];

// Update approval stats from API data
function updateApprovalStatsFromData(stats) {
  const elements = {
    total: 'approvalCountTotal',
    pending: 'approvalCountTotal',
    urgent: 'approvalCountUrgent',
    opname: 'approvalCountOpname',
    adjustment: 'approvalCountAdjustment',
    approved: 'approvalCountApproved'
  };

  for (const [key, elementId] of Object.entries(elements)) {
    const el = document.getElementById(elementId);
    if (el && stats[key] !== undefined) {
      el.textContent = stats[key];
    }
  }

  const pendingEl = document.getElementById('pendingCount');
  const approvedEl = document.getElementById('approvedCount');
  const rejectedEl = document.getElementById('rejectedCount');
  const recountEl = document.getElementById('recountCount');

  if (pendingEl) pendingEl.textContent = stats.pending || 0;
  if (approvedEl) approvedEl.textContent = stats.approved || 0;
  if (rejectedEl) rejectedEl.textContent = stats.rejected || 0;
  if (recountEl) recountEl.textContent = stats.recount || 0;
}

function renderApprovalList(filteredApprovals) {
  const approvalListBody = document.getElementById('approvalListBody');
  const emptyState = document.getElementById('approvalEmptyState');
  const listView = document.getElementById('approvalListView');
  
  if (!approvalListBody) return;

  // Use realApprovals if no filtered data provided
  const approvals = filteredApprovals !== undefined ? filteredApprovals : realApprovals;

  // Filter by current tab
  let filtered = approvals;
  if (currentApprovalFilter !== 'all') {
    filtered = approvals.filter(a => a.status === currentApprovalFilter);
  }

  if (filtered.length === 0) {
    listView.style.display = 'none';
    emptyState.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    return;
  }

  listView.style.display = 'block';
  emptyState.style.display = 'none';

  approvalListBody.innerHTML = filtered.map(approval => `
    <div class="approval-row" onclick="openApprovalDetail('${approval.id}')">
      <div>
        <span class="approval-type-badge ${APPROVAL_TYPES[approval.type]?.class || ''}">${APPROVAL_TYPES[approval.type]?.label || approval.type}</span>
      </div>
      <div class="approval-row__title">
        <i data-lucide="clipboard"></i>
        <span>${escapeHtml(approval.title)}</span>
      </div>
      <div>
        <div class="approval-submitter">
          <div class="approval-submitter__avatar">${approval.submitter?.initials || 'U'}</div>
          <span class="approval-submitter__name">${approval.submitter?.name || 'Unknown'}</span>
        </div>
      </div>
      <div>
        <span class="approval-date">${formatDateTime(approval.submittedAt)}</span>
      </div>
      <div>
        <span class="priority-badge priority-badge--${approval.priority}">${approval.priority?.toUpperCase() || 'MEDIUM'}</span>
      </div>
      <div>
        <span class="approval-status-chip ${APPROVAL_STATUSES[approval.status]?.class || ''}">${APPROVAL_STATUSES[approval.status]?.label || approval.status}</span>
      </div>
      <div class="approval-actions" onclick="event.stopPropagation()">
        ${approval.status === 'pending' ? `
          <button type="button" class="approval-action-btn approval-action-btn--approve" onclick="approveItem('${approval.id}')" title="Approve">
            <i data-lucide="check"></i>
          </button>
          <button type="button" class="approval-action-btn approval-action-btn--reject" onclick="rejectItem('${approval.id}')" title="Reject">
            <i data-lucide="x"></i>
          </button>
          <button type="button" class="approval-action-btn approval-action-btn--recount" onclick="recountItem('${approval.id}')" title="Recount">
            <i data-lucide="refresh-cw"></i>
          </button>
        ` : `
          <button type="button" class="approval-action-btn approval-action-btn--view" onclick="openApprovalDetail('${approval.id}')" title="View">
            <i data-lucide="eye"></i>
          </button>
        `}
      </div>
    </div>
  `).join('');

  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function updateApprovalStats() {
  const a = realApprovals;
  const pending = a.filter(x => x.status === 'pending');
  document.getElementById('approvalCountTotal').textContent = pending.length;
  document.getElementById('approvalCountUrgent').textContent = pending.filter(x => x.priority === 'high').length;
  document.getElementById('approvalCountOpname').textContent = pending.filter(x => x.type === 'opname').length;
  document.getElementById('approvalCountAdjustment').textContent = pending.filter(x => x.type === 'adjustment').length;
  document.getElementById('approvalCountApproved').textContent = a.filter(x => x.status === 'approved').length;
  document.getElementById('pendingCount').textContent = pending.length;
  document.getElementById('approvedCount').textContent = a.filter(x => x.status === 'approved').length;
  document.getElementById('rejectedCount').textContent = a.filter(x => x.status === 'rejected').length;
  document.getElementById('recountCount').textContent = a.filter(x => x.status === 'recount').length;
}

function setApprovalFilter(filter) {
  currentApprovalFilter = filter;
  
  // Update tab active state
  document.querySelectorAll('.approval-filter-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelector(`.approval-filter-tab[onclick="setApprovalFilter('${filter}')"]`)?.classList.add('active');
  
  renderApprovalList();
}

function filterApprovals() {
  const search = document.getElementById('approvalcenterSearch')?.value.toLowerCase() || '';
  const typeFilter = document.getElementById('approvalTypeFilter')?.value || '';

  const filtered = realApprovals.filter(approval => {
    const matchesSearch = approval.title?.toLowerCase().includes(search) || approval.id?.toString().includes(search);
    const matchesType = !typeFilter || approval.type === typeFilter;

    return matchesSearch && matchesType;
  });

  renderApprovalList(filtered);
}

function openApprovalDetail(approvalId) {
  const approval = realApprovals.find(a => a.id === approvalId);
  if (!approval) return;

  // Create or show drawer
  let drawer = document.querySelector('.approval-detail-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.className = 'approval-detail-drawer';
    document.body.appendChild(drawer);
  }

  const discrepancyHtml = approval.discrepancy ? `
    <div class="approval-discrepancy">
      <p class="approval-discrepancy__title">Discrepancy Analysis</p>
      <div class="approval-discrepancy__stats">
        <div class="approval-discrepancy__stat">
          <span class="approval-discrepancy__stat-value">${approval.discrepancy.sistem}</span>
          <span class="approval-discrepancy__stat-label">Stok Sistem</span>
        </div>
        <div class="approval-discrepancy__stat">
          <span class="approval-discrepancy__stat-value">${approval.discrepancy.fisik}</span>
          <span class="approval-discrepancy__stat-label">Stok Fisik</span>
        </div>
        <div class="approval-discrepancy__stat">
          <span class="approval-discrepancy__stat-value" style="color: ${approval.discrepancy.selisih < 0 ? 'var(--danger)' : 'var(--success)'}">${approval.discrepancy.selisih > 0 ? '+' : ''}${approval.discrepancy.selisih}</span>
          <span class="approval-discrepancy__stat-label">Selisih</span>
        </div>
      </div>
    </div>
  ` : '';

  const actionsPanelHtml = approval.status === 'pending' ? `
    <div class="approval-actions-panel">
      <div class="approval-actions-panel__notes">
        <label for="approvalNotes">Catatan Review</label>
        <textarea id="approvalNotes" placeholder="Tambahkan catatan untuk approval ini..."></textarea>
      </div>
      <div class="approval-actions-panel__buttons">
        <button type="button" class="btn-secondary" onclick="rejectItem('${approval.id}')" style="background: var(--danger); color: #fff;">Reject</button>
        <button type="button" class="btn-secondary" onclick="recountItem('${approval.id}')" style="background: #8b5cf6; color: #fff;">Request Recount</button>
        <button type="button" class="btn-primary" onclick="approveItem('${approval.id}')">Approve</button>
      </div>
    </div>
  ` : '';

  drawer.innerHTML = `
    <div class="approval-detail-drawer__header">
      <h3>${escapeHtml(approval.id)}</h3>
      <button type="button" class="approval-detail-drawer__close" onclick="closeApprovalDetail()">
        <i data-lucide="x"></i>
      </button>
    </div>
    <div class="approval-detail-drawer__body">
      <div class="approval-detail-section">
        <h4>Detail Approval</h4>
        <div class="approval-detail-meta">
          <div class="approval-detail-item">
            <span class="approval-detail-item__label">Tipe</span>
            <span class="approval-type-badge ${APPROVAL_TYPES[approval.type]?.class || ''}">${APPROVAL_TYPES[approval.type]?.label || approval.type}</span>
          </div>
          <div class="approval-detail-item">
            <span class="approval-detail-item__label">Status</span>
            <span class="approval-status-chip ${APPROVAL_STATUSES[approval.status]?.class || ''}">${APPROVAL_STATUSES[approval.status]?.label || approval.status}</span>
          </div>
          <div class="approval-detail-item">
            <span class="approval-detail-item__label">Submitter</span>
            <span class="approval-detail-item__value">${approval.submitter.name}</span>
          </div>
          <div class="approval-detail-item">
            <span class="approval-detail-item__label">Priority</span>
            <span class="priority-badge priority-badge--${approval.priority}">${approval.priority.toUpperCase()}</span>
          </div>
          <div class="approval-detail-item">
            <span class="approval-detail-item__label">Submitted</span>
            <span class="approval-detail-item__value">${formatDateTime(approval.submittedAt)}</span>
          </div>
        </div>
      </div>
      <div class="approval-detail-section">
        <h4>Judul</h4>
        <p class="task-detail-description">${escapeHtml(approval.title)}</p>
      </div>
      <div class="approval-detail-section">
        <h4>Deskripsi</h4>
        <p class="task-detail-description">${escapeHtml(approval.description)}</p>
      </div>
      ${discrepancyHtml}
      <div class="approval-detail-section">
        <h4>History</h4>
        <div class="approval-timeline">
          ${approval.history.map(h => `
            <div class="approval-timeline-item">
              <div class="approval-timeline-item__icon"></div>
              <div class="approval-timeline-item__content">
                <p class="approval-timeline-item__text"><strong>${h.user}</strong> ${h.action}</p>
                <p class="approval-timeline-item__time">${h.time}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    ${actionsPanelHtml}
  `;

  drawer.classList.add('open');
  
  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeApprovalDetail() {
  const drawer = document.querySelector('.approval-detail-drawer');
  if (drawer) {
    drawer.classList.remove('open');
  }
}

function approveItem(approvalId) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    showToast('Silakan login terlebih dahulu', false);
    return;
  }

  fetch(`/api/v1/approvals/${approvalId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      closeApprovalDetail();
      loadApprovalCenter();
      showToast(`Approval berhasil disetujui`, true);
    } else {
      showToast(data.message || 'Gagal menyetujui approval', false);
    }
  })
  .catch(err => {
    console.error('Error approving:', err);
    showToast('Terjadi kesalahan saat menyetujui', false);
  });
}

function rejectItem(approvalId) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    showToast('Silakan login terlebih dahulu', false);
    return;
  }

  const notes = document.getElementById('approvalNotes')?.value;

  fetch(`/api/v1/approvals/${approvalId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason: notes || '' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      closeApprovalDetail();
      loadApprovalCenter();
      showToast(`Approval berhasil ditolak`, true);
    } else {
      showToast(data.message || 'Gagal menolak approval', false);
    }
  })
  .catch(err => {
    console.error('Error rejecting:', err);
    showToast('Terjadi kesalahan saat menolak', false);
  });
}

function recountItem(approvalId) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    showToast('Silakan login terlebih dahulu', false);
    return;
  }

  fetch(`/api/v1/approvals/${approvalId}/recount`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      closeApprovalDetail();
      loadApprovalCenter();
      showToast(`Recount berhasil diminta`, true);
    } else {
      showToast(data.message || 'Gagal meminta recount', false);
    }
  })
  .catch(err => {
    console.error('Error requesting recount:', err);
    showToast('Terjadi kesalahan saat meminta recount', false);
  });
}

/* ============================================
   Activity Timeline Functions
   ============================================ */

const ACTIVITY_TYPES = {
  opname: { label: 'Stok Opname', class: 'activity-type-badge--opname', icon: 'package-check' },
  task: { label: 'Task', class: 'activity-type-badge--task', icon: 'clipboard-check' },
  approval: { label: 'Approval', class: 'activity-type-badge--approval', icon: 'check-circle' },
  adjustment: { label: 'Penyesuaian', class: 'activity-type-badge--adjustment', icon: 'sliders' },
  auth: { label: 'Authentication', class: 'activity-type-badge--auth', icon: 'user-check' },
  stok: { label: 'Stok', class: 'activity-type-badge--stok', icon: 'boxes' }
};

const mockActivities = [];

let currentActivityView = 'timeline';
let activityPage = 1;
const ACTIVITY_PER_PAGE = 10;

function loadActivityTimeline() {
  renderActivityList();
  updateActivityStats();
}

function renderActivityList(filteredActivities = mockActivities) {
  const activityListBody = document.getElementById('activityListBody');
  const emptyState = document.getElementById('activityEmptyState');
  const timelineView = document.getElementById('activityTimelineView');
  
  if (!activityListBody) return;

  // Group by date
  const groupedActivities = groupActivitiesByDate(filteredActivities);
  
  if (filteredActivities.length === 0) {
    timelineView.style.display = 'none';
    emptyState.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    return;
  }

  timelineView.style.display = 'block';
  emptyState.style.display = 'none';

  let html = '';
  
  if (currentActivityView === 'timeline') {
    Object.keys(groupedActivities).forEach(date => {
      html += `<div class="activity-date-group"><span class="activity-date-group__label">${date}</span></div>`;
      groupedActivities[date].forEach(activity => {
        html += renderActivityItem(activity);
      });
    });
  } else {
    // Compact view
    filteredActivities.forEach(activity => {
      html += renderActivityItemCompact(activity);
    });
  }

  activityListBody.innerHTML = html;

  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderActivityItem(activity) {
  const typeInfo = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.stok;
  
  return `
    <div class="activity-item-timeline" onclick="openActivityDetail('${activity.id}')">
      <div class="activity-icon ${typeInfo.class.replace('activity-type-badge', 'activity-icon')}">
        <i data-lucide="${typeInfo.icon}"></i>
      </div>
      <div class="activity-content">
        <div class="activity-content__header">
          <span class="activity-content__title">${escapeHtml(activity.title)}</span>
          <span class="activity-time">${activity.timestamp}</span>
        </div>
        <div class="activity-content__meta">
          <div class="activity-actor">
            <div class="activity-actor__avatar">${activity.actor.initials}</div>
            <span class="activity-actor__name">${activity.actor.name}</span>
          </div>
          <span class="activity-type-badge ${typeInfo.class}">${typeInfo.label}</span>
        </div>
        <p class="activity-content__description">${escapeHtml(activity.description)}</p>
        <div class="activity-details">
          ${activity.resourceId ? `
            <a href="#" class="activity-resource" onclick="event.preventDefault(); navigateToResource('${activity.resourceType}', '${activity.resourceId}');">
              <i data-lucide="external-link"></i>
              ${activity.resourceType}: ${activity.resourceId}
            </a>
          ` : ''}
          ${activity.details.skuCount ? `<span class="activity-detail"><i data-lucide="package"></i><strong>${activity.details.skuCount}</strong> SKU</span>` : ''}
          ${activity.details.items ? `<span class="activity-detail"><i data-lucide="box"></i><strong>${activity.details.items}</strong> items</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderActivityItemCompact(activity) {
  const typeInfo = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.stok;
  
  return `
    <div class="activity-compact-item" onclick="openActivityDetail('${activity.id}')">
      <div class="activity-compact-item__icon ${typeInfo.class.replace('activity-type-badge', 'activity-icon')}">
        <i data-lucide="${typeInfo.icon}"></i>
      </div>
      <span class="activity-compact-item__text"><strong>${activity.actor.name}</strong> ${activity.description.toLowerCase()}</span>
      <span class="activity-compact-item__time">${activity.timestamp}</span>
    </div>
  `;
}

function groupActivitiesByDate(activities) {
  const groups = {
    'Hari Ini': [],
    'Kemarin': [],
    '7 Hari Terakhir': [],
    'Lebih Lama': []
  };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  activities.forEach(activity => {
    const activityDate = new Date(activity.timestamp);
    const diffDays = Math.floor((today - activityDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      groups['Hari Ini'].push(activity);
    } else if (diffDays === 1) {
      groups['Kemarin'].push(activity);
    } else if (diffDays <= 7) {
      groups['7 Hari Terakhir'].push(activity);
    } else {
      groups['Lebih Lama'].push(activity);
    }
  });
  
  // Filter out empty groups
  return Object.fromEntries(Object.entries(groups).filter(([_, items]) => items.length > 0));
}

function updateActivityStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const stats = {
    total: mockActivities.length,
    today: 0,
    opname: 0,
    task: 0,
    approval: 0
  };
  
  mockActivities.forEach(activity => {
    const activityDate = new Date(activity.timestamp);
    if (activityDate >= today) {
      stats.today++;
    }
    if (activity.type === 'opname') stats.opname++;
    if (activity.type === 'task') stats.task++;
    if (activity.type === 'approval') stats.approval++;
  });
  
  document.getElementById('activityCountTotal').textContent = stats.total;
  document.getElementById('activityCountToday').textContent = stats.today;
  document.getElementById('activityCountOpname').textContent = stats.opname;
  document.getElementById('activityCountTask').textContent = stats.task;
  document.getElementById('activityCountApproval').textContent = stats.approval;
}

function setActivityView(view) {
  currentActivityView = view;
  
  const viewBtns = document.querySelectorAll('.activity-view-toggle .view-btn');
  viewBtns.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.activity-view-toggle .view-btn[onclick="setActivityView('${view}')"]`)?.classList.add('active');
  
  renderActivityList();
}

function filterActivity() {
  const search = document.getElementById('activitySearch')?.value.toLowerCase() || '';
  const typeFilter = document.getElementById('activityTypeFilter')?.value || '';
  const actorFilter = document.getElementById('activityActorFilter')?.value || '';
  const dateFilter = document.getElementById('activityDateFilter')?.value || '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const filtered = mockActivities.filter(activity => {
    const matchesSearch = activity.title.toLowerCase().includes(search) || 
                          activity.description.toLowerCase().includes(search) ||
                          activity.id.toLowerCase().includes(search);
    
    const matchesType = !typeFilter || activity.type === typeFilter;
    
    const matchesActor = !actorFilter || 
                         (actorFilter === 'admin' && activity.actor.id === 'admin1') ||
                         (actorFilter === 'operator' && activity.actor.id !== 'admin1' && activity.actor.id !== 'system') ||
                         (actorFilter === 'system' && activity.actor.id === 'system');
    
    let matchesDate = true;
    if (dateFilter) {
      const activityDate = new Date(activity.timestamp);
      if (dateFilter === 'today') {
        matchesDate = activityDate >= today;
      } else if (dateFilter === 'yesterday') {
        matchesDate = activityDate >= yesterday && activityDate < today;
      } else if (dateFilter === 'week') {
        matchesDate = activityDate >= weekAgo;
      } else if (dateFilter === 'month') {
        matchesDate = activityDate >= monthAgo;
      }
    }

    return matchesSearch && matchesType && matchesActor && matchesDate;
  });

  renderActivityList(filtered);
}

function refreshActivity() {
  showToast('Memuat ulang aktivitas...', true);
  loadActivityTimeline();
}

function loadMoreActivity() {
  activityPage++;
  showToast('Memuat lebih banyak aktivitas...', true);
  // In a real app, this would fetch more data from the API
}

function openActivityDetail(activityId) {
  const activity = mockActivities.find(a => a.id === activityId);
  if (!activity) return;
  
  showToast(`Melihat detail aktivitas: ${activityId}`, true);
  // In a real app, this would open a detail drawer or modal
}

function navigateToResource(resourceType, resourceId) {
  showToast(`Navigasi ke ${resourceType}: ${resourceId}`, true);
  // In a real app, this would navigate to the resource detail page
}

/* ============================================
   Audit Center Functions
   ============================================ */

const AUDIT_ACTIONS = {
  created: { label: 'Created', class: 'audit-action-badge--created', icon: 'plus' },
  updated: { label: 'Updated', class: 'audit-action-badge--updated', icon: 'edit' },
  submitted: { label: 'Submitted', class: 'audit-action-badge--submitted', icon: 'send' },
  approved: { label: 'Approved', class: 'audit-action-badge--approved', icon: 'check-circle' },
  rejected: { label: 'Rejected', class: 'audit-action-badge--rejected', icon: 'x-circle' },
  deleted: { label: 'Deleted', class: 'audit-action-badge--deleted', icon: 'trash-2' },
  login: { label: 'Login', class: 'audit-action-badge--login', icon: 'log-in' },
  logout: { label: 'Logout', class: 'audit-action-badge--logout', icon: 'log-out' }
};

const AUDIT_ORIGINS = {
  web: { label: 'Web UI', icon: 'monitor' },
  api: { label: 'API', icon: 'code' },
  mobile: { label: 'Mobile', icon: 'smartphone' }
};

const mockAuditLogs = [];

let currentAuditView = 'table';
let auditPage = 1;
const AUDIT_PER_PAGE = 10;
const AUDIT_TOTAL = mockAuditLogs.length;

function loadAuditCenter() {
  renderAuditTable();
  renderAuditTimeline();
  updateAuditStats();
  renderAuditPagination();
}

function renderAuditTable(filteredLogs = mockAuditLogs) {
  const auditTableBody = document.getElementById('auditTableBody');
  const emptyState = document.getElementById('auditEmptyState');
  const tableView = document.getElementById('auditTableView');
  
  if (!auditTableBody) return;

  if (filteredLogs.length === 0) {
    tableView.style.display = 'none';
    emptyState.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    return;
  }

  tableView.style.display = 'block';
  emptyState.style.display = 'none';

  // Paginate
  const start = (auditPage - 1) * AUDIT_PER_PAGE;
  const end = start + AUDIT_PER_PAGE;
  const pageLogs = filteredLogs.slice(start, end);

  auditTableBody.innerHTML = pageLogs.map(log => {
    const actionInfo = AUDIT_ACTIONS[log.action] || AUDIT_ACTIONS.updated;
    const originInfo = AUDIT_ORIGINS[log.origin] || AUDIT_ORIGINS.web;
    
    return `
      <div class="audit-row" onclick="openAuditDetail('${log.id}')">
        <div class="audit-timestamp">${log.timestamp}</div>
        <div>
          <div class="audit-user">
            <div class="audit-user__avatar">${log.user.initials}</div>
            <span class="audit-user__name">${log.user.name}</span>
          </div>
        </div>
        <div>
          <span class="audit-action-badge ${actionInfo.class}">${actionInfo.label}</span>
        </div>
        <div>
          <div class="audit-resource">
            <span class="audit-resource__type">${log.resourceType}</span>
            <span class="audit-resource__id">${log.resourceId}</span>
          </div>
        </div>
        <div class="audit-change">
          <i data-lucide="git-compare" class="audit-change__icon"></i>
          <span>${escapeHtml(log.changeSummary)}</span>
        </div>
        <div>
          <span class="audit-origin">
            <i data-lucide="${originInfo.icon}"></i>
          </span>
        </div>
        <div>
          <button type="button" class="audit-view-btn" onclick="event.stopPropagation(); openAuditDetail('${log.id}')">
            <i data-lucide="eye"></i>
            View
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Update showing info
  const showingStart = start + 1;
  const showingEnd = Math.min(end, filteredLogs.length);
  document.getElementById('auditShowing').textContent = `Menampilkan ${showingStart}-${showingEnd} dari ${filteredLogs.length} entries`;

  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderAuditTimeline(filteredLogs = mockAuditLogs) {
  const auditTimelineBody = document.getElementById('auditTimelineBody');
  
  if (!auditTimelineBody) return;

  const start = (auditPage - 1) * AUDIT_PER_PAGE;
  const end = start + AUDIT_PER_PAGE;
  const pageLogs = filteredLogs.slice(start, end);

  auditTimelineBody.innerHTML = pageLogs.map(log => {
    const actionInfo = AUDIT_ACTIONS[log.action] || AUDIT_ACTIONS.updated;
    
    return `
      <div class="audit-timeline-item" onclick="openAuditDetail('${log.id}')">
        <div class="audit-timeline-icon ${actionInfo.class.replace('audit-action-badge', 'audit-timeline-icon')}">
          <i data-lucide="${actionInfo.icon}"></i>
        </div>
        <div class="audit-timeline-content">
          <div class="audit-timeline-header">
            <span class="audit-timeline-title">${escapeHtml(log.changeSummary)}</span>
            <span class="audit-timeline-time">${log.timestamp}</span>
          </div>
          <div class="audit-timeline-meta">
            <div class="audit-timeline-user">
              <div class="audit-timeline-user__avatar">${log.user.initials}</div>
              <span>${log.user.name}</span>
              <span class="audit-action-badge ${actionInfo.class}">${actionInfo.label}</span>
            </div>
          </div>
          <div class="audit-timeline-change">
            ${log.resourceType}: ${log.resourceId}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function updateAuditStats() {
  const stats = {
    total: mockAuditLogs.length,
    opname: mockAuditLogs.filter(l => l.resourceType === 'opname_session').length,
    approval: mockAuditLogs.filter(l => l.resourceType === 'approval').length,
    adjustment: mockAuditLogs.filter(l => l.resourceType === 'adjustment').length,
    auth: mockAuditLogs.filter(l => l.action === 'login' || l.action === 'logout').length
  };
  
  document.getElementById('auditCountTotal').textContent = stats.total;
  document.getElementById('auditCountOpname').textContent = stats.opname;
  document.getElementById('auditCountApproval').textContent = stats.approval;
  document.getElementById('auditCountAdjustment').textContent = stats.adjustment;
  document.getElementById('auditCountAuth').textContent = stats.auth;
}

function setAuditView(view) {
  currentAuditView = view;
  
  const viewBtns = document.querySelectorAll('.audit-view-toggle .view-btn');
  viewBtns.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.audit-view-toggle .view-btn[onclick="setAuditView('${view}')"]`)?.classList.add('active');
  
  const tableView = document.getElementById('auditTableView');
  const timelineView = document.getElementById('auditTimelineView');
  
  if (view === 'table') {
    tableView.style.display = 'block';
    timelineView.style.display = 'none';
  } else {
    tableView.style.display = 'none';
    timelineView.style.display = 'block';
  }
}

function filterAudit() {
  const search = document.getElementById('auditSearch')?.value.toLowerCase() || '';
  const actionFilter = document.getElementById('auditActionFilter')?.value || '';
  const userFilter = document.getElementById('auditUserFilter')?.value || '';
  const resourceFilter = document.getElementById('auditResourceFilter')?.value || '';
  const dateFilter = document.getElementById('auditDateFilter')?.value || '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const filtered = mockAuditLogs.filter(log => {
    const matchesSearch = log.changeSummary.toLowerCase().includes(search) || 
                          log.resourceId.toLowerCase().includes(search) ||
                          log.id.toLowerCase().includes(search);
    
    const matchesAction = !actionFilter || log.action === actionFilter;
    const matchesUser = !userFilter || log.user.id === userFilter;
    const matchesResource = !resourceFilter || log.resourceType === resourceFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const logDate = new Date(log.timestamp);
      if (dateFilter === 'today') {
        matchesDate = logDate >= today;
      } else if (dateFilter === 'yesterday') {
        matchesDate = logDate >= yesterday && logDate < today;
      } else if (dateFilter === 'week') {
        matchesDate = logDate >= weekAgo;
      } else if (dateFilter === 'month') {
        matchesDate = logDate >= monthAgo;
      }
    }

    return matchesSearch && matchesAction && matchesUser && matchesResource && matchesDate;
  });

  auditPage = 1;
  renderAuditTable(filtered);
  renderAuditTimeline(filtered);
  renderAuditPagination(filtered.length);
}

function renderAuditPagination(totalItems = mockAuditLogs.length) {
  const pageNumbers = document.getElementById('auditPageNumbers');
  const totalPages = Math.ceil(totalItems / AUDIT_PER_PAGE);
  
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button type="button" onclick="goToAuditPage(${i})" class="${i === auditPage ? 'active' : ''}">${i}</button>`;
  }
  pageNumbers.innerHTML = html;
  
  // Update prev/next buttons
  document.getElementById('auditPrevBtn').disabled = auditPage === 1;
  document.getElementById('auditNextBtn').disabled = auditPage === totalPages;
}

function goToAuditPage(page) {
  auditPage = page;
  renderAuditTable();
  renderAuditTimeline();
  renderAuditPagination();
}

function prevAuditPage() {
  if (auditPage > 1) {
    auditPage--;
    renderAuditTable();
    renderAuditTimeline();
    renderAuditPagination();
  }
}

function nextAuditPage() {
  const totalPages = Math.ceil(mockAuditLogs.length / AUDIT_PER_PAGE);
  if (auditPage < totalPages) {
    auditPage++;
    renderAuditTable();
    renderAuditTimeline();
    renderAuditPagination();
  }
}

function openAuditDetail(auditId) {
  const log = mockAuditLogs.find(a => a.id === auditId);
  if (!log) return;
  
  const actionInfo = AUDIT_ACTIONS[log.action] || AUDIT_ACTIONS.updated;
  showToast(`Viewing audit: ${log.id} - ${log.changeSummary.substring(0, 50)}...`, true);
  // In a real app, this would open a detailed modal or drawer with before/after comparison
}

function exportAuditLog() {
  showToast('Memulai export audit log...', true);
  // In a real app, this would trigger a CSV/JSON/PDF export
  setTimeout(() => {
    showToast('Export selesai. File akan di-download.', true);
  }, 1500);
}

/* ============================================
   Reports Page Functions
   ============================================ */

// Mock report types
const REPORT_TYPES = {
  inventory: {
    label: 'Laporan Inventory',
    description: 'Stok gudang, movements, dan valuation report',
    templates: ['Stok Summary', 'Stock Movements', 'Valuation Report', 'Low Stock Alert']
  },
  sales: {
    label: 'Laporan Penjualan',
    description: 'Sales performance, outlet breakdown, dan trend',
    templates: ['Sales Summary', 'Outlet Breakdown', 'Trend Analysis', 'Top Products']
  },
  opname: {
    label: 'Laporan Stok Opname',
    description: 'Opname results, discrepancies, dan variance analysis',
    templates: ['Opname Summary', 'Variance Report', 'Discrepancy Analysis', 'Recount Results']
  },
  audit: {
    label: 'Laporan Audit',
    description: 'Audit trails, user activities, dan compliance reports',
    templates: ['Audit Trail', 'User Activity', 'Compliance Summary', 'Action History']
  }
};

// Mock recent reports
const recentReports = [
  { id: 'RPT-001', name: 'Laporan Stok Gudang Utama - Juni 2026', generatedAt: '2 jam lalu', generatedBy: 'Admin' },
  { id: 'RPT-002', name: 'Sales Performance Mei 2026', generatedAt: '1 hari lalu', generatedBy: 'Admin' },
  { id: 'RPT-003', name: 'Opname Variance Report - Mei 2026', generatedAt: '3 hari lalu', generatedBy: 'Admin' },
  { id: 'RPT-004', name: 'Audit Trail Summary - Mei 2026', generatedAt: '1 minggu lalu', generatedBy: 'Admin' }
];

function loadReportsPage() {
  // Initialize reports page
  if (window.lucide) {
    lucide.createIcons();
  }
}

function refreshReports() {
  showToast('Memuat ulang laporan...', true);
  loadReportsPage();
}

function openReportGenerator(type) {
  const reportInfo = REPORT_TYPES[type];
  if (!reportInfo) return;

  // Create modal
  let modal = document.querySelector('.report-generator-modal');
  if (modal) {
    modal.remove();
  }

  modal = document.createElement('div');
  modal.className = 'report-generator-modal open';
  modal.id = 'reportGeneratorModal';

  const templateOptions = reportInfo.templates.map(t => `<option value="${t.toLowerCase().replace(/\s+/g, '-')}">${t}</option>`).join('');

  modal.innerHTML = `
    <div class="report-generator-modal__dialog">
      <div class="report-generator-modal__header">
        <h3>${reportInfo.label}</h3>
        <button type="button" class="report-generator-modal__close" onclick="closeReportGenerator()">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="report-generator-modal__body">
        <form class="report-generator-form" id="reportGeneratorForm">
          <div class="report-generator-form__field">
            <label>Report Template</label>
            <select id="reportTemplate" required>
              <option value="">Pilih Template</option>
              ${templateOptions}
            </select>
          </div>
          <div class="report-generator-form__row">
            <div class="report-generator-form__field">
              <label>Tanggal Mulai</label>
              <input type="date" id="reportStartDate" required>
            </div>
            <div class="report-generator-form__field">
              <label>Tanggal Selesai</label>
              <input type="date" id="reportEndDate" required>
            </div>
          </div>
          <div class="report-generator-form__field">
            <label>Format Output</label>
            <select id="reportFormat">
              <option value="pdf">PDF</option>
              <option value="excel">Excel (XLSX)</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div class="report-generator-form__field report-generator-form__field--checkbox">
            <input type="checkbox" id="reportIncludeCharts">
            <label for="reportIncludeCharts">Include Charts & Visualizations</label>
          </div>
          <div class="report-generator-form__field">
            <label>Deskripsi (Optional)</label>
            <input type="text" id="reportDescription" placeholder="Tambahkan deskripsi untuk laporan ini...">
          </div>
        </form>
      </div>
      <div class="report-generator-modal__footer">
        <button type="button" class="btn-secondary" onclick="closeReportGenerator()">Batal</button>
        <button type="button" class="btn-primary" onclick="generateReport('${type}')">
          <i data-lucide="file-text"></i>
          Generate Report
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Set default dates
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  document.getElementById('reportStartDate').valueAsDate = monthAgo;
  document.getElementById('reportEndDate').valueAsDate = today;

  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeReportGenerator() {
  const modal = document.querySelector('.report-generator-modal');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
  }
}

function generateReport(type) {
  const template = document.getElementById('reportTemplate').value;
  const startDate = document.getElementById('reportStartDate').value;
  const endDate = document.getElementById('reportEndDate').value;
  const format = document.getElementById('reportFormat').value;
  const includeCharts = document.getElementById('reportIncludeCharts').checked;
  const description = document.getElementById('reportDescription').value;

  if (!template) {
    showToast('Harap pilih template laporan', false);
    return;
  }

  if (!startDate || !endDate) {
    showToast('Harap isi tanggal mulai dan selesai', false);
    return;
  }

  showToast(`Generating ${template.replace(/-/g, ' ')} report...`, true);

  // Simulate report generation
  setTimeout(() => {
    closeReportGenerator();
    showToast('Report berhasil di-generate! Download akan dimulai sebentar lagi.', true);
    
    // In a real app, this would trigger the actual download
    // For demo purposes, we just show a success message
  }, 2000);
}

function downloadReport(reportId) {
  showToast(`Memulai download laporan ${reportId}...`, true);
  // In a real app, this would trigger the file download
  setTimeout(() => {
    showToast('Download selesai', true);
  }, 1000);
}

function viewReport(reportId) {
  showToast(`Membuka preview laporan ${reportId}...`, true);
  // In a real app, this would open a report preview modal or page
}

/* ============================================
   Mobile Navigation Functions
   ============================================ */

// isMobileMenuOpen is declared at the top of the file

function toggleMobileMenu() {
  const overlay = document.getElementById('mobileMenuOverlay');
  isMobileMenuOpen = !isMobileMenuOpen;
  
  if (isMobileMenuOpen) {
    overlay.classList.add('open');
    document.body.classList.add('mobile-menu-open');
    document.body.style.overflow = 'hidden';
  } else {
    overlay.classList.remove('open');
    document.body.classList.remove('mobile-menu-open');
    document.body.style.overflow = '';
  }
  
  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function updateMobileNavHighlight() {
  const navItems = document.querySelectorAll('.mobile-nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
    const navType = item.getAttribute('data-nav');
    if (navType === currentMenu) {
      item.classList.add('active');
    }
  });
  
  // Also highlight in mobile menu panel
  const menuItems = document.querySelectorAll('.mobile-menu-item');
  menuItems.forEach(item => {
    item.classList.remove('active');
    const onclick = item.getAttribute('onclick');
    if (onclick && onclick.includes(`'${currentMenu}'`)) {
      item.classList.add('active');
    }
  });
}

// Handle window resize for responsive behavior
let resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    // Close mobile menu on resize to desktop
    if (window.innerWidth >= 768 && isMobileMenuOpen) {
      toggleMobileMenu();
    }
  }, 250);
});

// Handle escape key to close mobile menu
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && isMobileMenuOpen) {
    toggleMobileMenu();
  }
});

// Initialize mobile nav on page load
document.addEventListener('DOMContentLoaded', function() {
  updateMobileNavHighlight();
  
  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Initialize theme from localStorage
  initTheme();
});

/* ============================================
   Theme Toggle Functions
   ============================================ */

const THEME_STORAGE_KEY = 'inventoryTheme';

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Use saved theme or default to dark (existing behavior)
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  setTheme(theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  showToast(`Theme switched to ${newTheme} mode`, true);
}

function setTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  
  // Re-initialize Lucide icons to update icon visibility
  if (window.lucide) {
    lucide.createIcons();
  }
}

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
  // Only auto-switch if user hasn't set a preference
  if (!localStorage.getItem(THEME_STORAGE_KEY)) {
    setTheme(e.matches ? 'dark' : 'light');
  }
});

/* ============================================
   Settings Page Functions
   ============================================ */

// Load profile data
async function loadSettingsProfile() {
  const token = localStorage.getItem('access_token');
  if (!token) return;

  try {
    const response = await fetch('/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.success && data.data) {
      document.getElementById('profileName').value = data.data.nama_lengkap || '';
      document.getElementById('profileUsername').value = data.data.username || '';
      document.getElementById('profileEmail').value = data.data.email || '';
      document.getElementById('profileRole').value = data.data.role || '';
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

// Update profile
async function updateProfile() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    showToast('Silakan login terlebih dahulu', false);
    return;
  }

  const nama_lengkap = document.getElementById('profileName')?.value;
  const email = document.getElementById('profileEmail')?.value;

  if (!nama_lengkap && !email) {
    showToast('Tidak ada data yang diperbarui', false);
    return;
  }

  try {
    const response = await fetch('/api/v1/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nama_lengkap, email })
    });
    const data = await response.json();

    if (data.success) {
      showToast('Profil berhasil diperbarui', true);
      loadSettingsProfile();
    } else {
      showToast(data.message || 'Gagal memperbarui profil', false);
    }
  } catch (error) {
    console.error('Failed to update profile:', error);
    showToast('Terjadi kesalahan saat memperbarui profil', false);
  }
}

// Change password
async function changePassword() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    showToast('Silakan login terlebih dahulu', false);
    return;
  }

  const oldPassword = document.getElementById('oldPassword')?.value;
  const newPassword = document.getElementById('newPassword')?.value;
  const confirmPassword = document.getElementById('confirmPassword')?.value;

  if (!oldPassword || !newPassword) {
    showToast('Password lama dan baru wajib diisi', false);
    return;
  }

  if (newPassword.length < 8) {
    showToast('Password minimal 8 karakter', false);
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Password baru tidak cocok', false);
    return;
  }

  try {
    const response = await fetch('/api/v1/auth/change-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    });
    const data = await response.json();

    if (data.success) {
      showToast('Password berhasil diubah', true);
      document.getElementById('oldPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
    } else {
      showToast(data.message || 'Gagal mengubah password', false);
    }
  } catch (error) {
    console.error('Failed to change password:', error);
    showToast('Terjadi kesalahan saat mengubah password', false);
  }
}

// Load database status
async function loadDatabaseStatus() {
  const token = localStorage.getItem('access_token');
  if (!token) return;

  const container = document.getElementById('databaseStatusContent');
  if (!container) return;

  try {
    const response = await fetch('/api/v1/settings/database', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.success && data.data) {
      const counts = data.data.table_counts;
      container.innerHTML = `
        <div class="settings-status-item">
          <span class="settings-status-label">Status</span>
          <span class="settings-status-value settings-status-value--success">Connected</span>
        </div>
        <div class="settings-status-item">
          <span class="settings-status-label">Host</span>
          <span class="settings-status-value">${data.data.host}</span>
        </div>
        <div class="settings-status-item">
          <span class="settings-status-label">Users</span>
          <span class="settings-status-value">${counts?.users_count || 0} records</span>
        </div>
        <div class="settings-status-item">
          <span class="settings-status-label">Outlets</span>
          <span class="settings-status-value">${counts?.outlets_count || 0} records</span>
        </div>
        <div class="settings-status-item">
          <span class="settings-status-label">Products</span>
          <span class="settings-status-value">${counts?.produk_count || 0} records</span>
        </div>
        <div class="settings-status-item">
          <span class="settings-status-label">Sales</span>
          <span class="settings-status-value">${counts?.penjualan_count || 0} records</span>
        </div>
        <div class="settings-status-item">
          <span class="settings-status-label">Opname Commands</span>
          <span class="settings-status-value">${counts?.opname_count || 0} records</span>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load database status:', error);
    container.innerHTML = '<div class="settings-error">Gagal memuat status database</div>';
  }
}

// Initialize settings navigation
function initSettingsNav() {
  const navItems = document.querySelectorAll('.settings-nav__item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      
      // Update active state
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Show/hide sections
      document.querySelectorAll('.settings-section').forEach(s => {
        s.style.display = 'none';
      });
      
      const targetSection = document.getElementById(`settings${section.charAt(0).toUpperCase() + section.slice(1)}`);
      if (targetSection) {
        targetSection.style.display = 'block';
      }

      // Load database status when database tab is clicked
      if (section === 'database') {
        loadDatabaseStatus();
      }
    });
  });
}

// Initialize settings page
function initSettingsPage() {
  loadSettingsProfile();
  initSettingsNav();
}
