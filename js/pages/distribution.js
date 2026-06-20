/***********************************************
 * CV EPIC Warehouse - Distribution Dashboard
 * Vanilla JS + CSS Charts (No external charting lib)
 * Data Source: Google Apps Script JSON Endpoint
 * 
 * Cache: 5 minutes
 ***********************************************/

(function() {
  'use strict';

  // Prevent multiple declarations
  if (window.DistributionDashboardInitialized) return;
  window.DistributionDashboardInitialized = true;

  // Google Apps Script URL - Replace with your deployed Google Apps Script URL
  // To create your own:
  // 1. Go to script.google.com
  // 2. Create new project
  // 3. Deploy as Web App
  // 4. Set "Who has access" to "Anyone"
  // 5. Copy the deployment URL here
  // 
  // Example URL format:
  // const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
  
  // For now, we use sample data only since the provided URL returns CORS/404 errors
  const GOOGLE_SCRIPT_URL = null;

  // Cache configuration
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Sample data structure from Google Sheets
  const SAMPLE_DATA = [
    { no: 1, tanggal: '2024-01-15', no_surat_jalan: 'SJ-001', kode_outlet: 'OTL-001', nama_outlet: 'Outlet Jakarta', ekspedisi: 'JNE', no_resi: 'JNE123456', nama_produk: 'Modul Starter Kit', qty: 50, harga_otr: 150000, total_otr: 7500000, status: 'Terkirim' },
    { no: 2, tanggal: '2024-01-16', no_surat_jalan: 'SJ-002', kode_outlet: 'OTL-002', nama_outlet: 'Outlet Bandung', ekspedisi: 'SiCepat', no_resi: 'SC789012', nama_produk: 'Modul Level 1', qty: 30, harga_otr: 120000, total_otr: 3600000, status: 'Proses' },
    { no: 3, tanggal: '2024-01-17', no_surat_jalan: 'SJ-003', kode_outlet: 'OTL-003', nama_outlet: 'Outlet Surabaya', ekspedisi: 'J&T', no_resi: 'JT345678', nama_produk: 'Modul Level 2', qty: 25, harga_otr: 180000, total_otr: 4500000, status: 'Terkirim' },
    { no: 4, tanggal: '2024-01-18', no_surat_jalan: 'SJ-004', kode_outlet: 'OTL-001', nama_outlet: 'Outlet Jakarta', ekspedisi: 'JNE', no_resi: 'JNE901234', nama_produk: 'Modul Level 3', qty: 40, harga_otr: 200000, total_otr: 8000000, status: 'Proses' },
    { no: 5, tanggal: '2024-01-19', no_surat_jalan: 'SJ-005', kode_outlet: 'OTL-004', nama_outlet: 'Outlet Yogyakarta', ekspedisi: 'Pos Indonesia', no_resi: 'POS567890', nama_produk: 'Modul Starter Kit', qty: 60, harga_otr: 150000, total_otr: 9000000, status: 'Terkirim' },
    { no: 6, tanggal: '2024-01-20', no_surat_jalan: 'SJ-006', kode_outlet: 'OTL-002', nama_outlet: 'Outlet Bandung', ekspedisi: 'SiCepat', no_resi: 'SC234567', nama_produk: 'Modul Level 1', qty: 35, harga_otr: 120000, total_otr: 4200000, status: 'Pending' },
    { no: 7, tanggal: '2024-01-21', no_surat_jalan: 'SJ-007', kode_outlet: 'OTL-005', nama_outlet: 'Outlet Semarang', ekspedisi: 'JNE', no_resi: 'JNE678901', nama_produk: 'Modul Level 2', qty: 45, harga_otr: 180000, total_otr: 8100000, status: 'Terkirim' },
    { no: 8, tanggal: '2024-01-22', no_surat_jalan: 'SJ-008', kode_outlet: 'OTL-003', nama_outlet: 'Outlet Surabaya', ekspedisi: 'GrabExpress', no_resi: 'GRB123456', nama_produk: 'Modul Level 3', qty: 20, harga_otr: 200000, total_otr: 4000000, status: 'Proses' },
    { no: 9, tanggal: '2024-01-23', no_surat_jalan: 'SJ-009', kode_outlet: 'OTL-006', nama_outlet: 'Outlet Medan', ekspedisi: 'J&T', no_resi: 'JT890123', nama_produk: 'Modul Starter Kit', qty: 55, harga_otr: 150000, total_otr: 8250000, status: 'Terkirim' },
    { no: 10, tanggal: '2024-01-24', no_surat_jalan: 'SJ-010', kode_outlet: 'OTL-001', nama_outlet: 'Outlet Jakarta', ekspedisi: 'SiCepat', no_resi: 'SC456789', nama_produk: 'Modul Level 1', qty: 28, harga_otr: 120000, total_otr: 3360000, status: 'Pending' },
    { no: 11, tanggal: '2024-01-25', no_surat_jalan: 'SJ-011', kode_outlet: 'OTL-007', nama_outlet: 'Outlet Makassar', ekspedisi: 'JNE', no_resi: 'JNE234567', nama_produk: 'Modul Level 2', qty: 38, harga_otr: 180000, total_otr: 6840000, status: 'Terkirim' },
    { no: 12, tanggal: '2024-01-26', no_surat_jalan: 'SJ-012', kode_outlet: 'OTL-004', nama_outlet: 'Outlet Yogyakarta', ekspedisi: 'Pos Indonesia', no_resi: 'POS901234', nama_produk: 'Modul Level 3', qty: 42, harga_otr: 200000, total_otr: 8400000, status: 'Proses' },
    { no: 13, tanggal: '2024-01-27', no_surat_jalan: 'SJ-013', kode_outlet: 'OTL-002', nama_outlet: 'Outlet Bandung', ekspedisi: 'J&T', no_resi: 'JT567890', nama_produk: 'Modul Starter Kit', qty: 50, harga_otr: 150000, total_otr: 7500000, status: 'Terkirim' },
    { no: 14, tanggal: '2024-01-28', no_surat_jalan: 'SJ-014', kode_outlet: 'OTL-008', nama_outlet: 'Outlet Bali', ekspedisi: 'JNE', no_resi: 'JNE890123', nama_produk: 'Modul Level 1', qty: 33, harga_otr: 120000, total_otr: 3960000, status: 'Pending' },
    { no: 15, tanggal: '2024-01-29', no_surat_jalan: 'SJ-015', kode_outlet: 'OTL-005', nama_outlet: 'Outlet Semarang', ekspedisi: 'GrabExpress', no_resi: 'GRB789012', nama_produk: 'Modul Level 2', qty: 27, harga_otr: 180000, total_otr: 4860000, status: 'Proses' },
  ];

  // ============================================
  // SHIPMENT SERVICE
  // ============================================

  const ShipmentService = {
    cache: new Map(),
    CACHE_KEY: 'shipment_data',

    isCacheValid: function() {
      const entry = this.cache.get(this.CACHE_KEY);
      if (!entry) return false;
      return Date.now() - entry.timestamp < CACHE_DURATION;
    },

    getCachedData: function() {
      if (this.isCacheValid()) {
        return this.cache.get(this.CACHE_KEY).data;
      }
      return null;
    },

    setCache: function(data) {
      this.cache.set(this.CACHE_KEY, { data: data, timestamp: Date.now() });
    },

    getCacheStatus: function() {
      const entry = this.cache.get(this.CACHE_KEY);
      if (!entry) return { isValid: false };
      const remaining = CACHE_DURATION - (Date.now() - entry.timestamp);
      return { isValid: remaining > 0, remainingTime: remaining > 0 ? Math.ceil(remaining / 1000) : 0 };
    },

    fetchShipmentData: async function(forceRefresh) {
      const self = this;
      if (!forceRefresh && self.isCacheValid()) {
        const cached = self.getCachedData();
        if (cached) return { success: true, data: cached, fromCache: true };
      }

      // If no URL configured, use sample data
      if (!GOOGLE_SCRIPT_URL) {
        return { success: false, error: 'Google Apps Script URL not configured', useSample: true };
      }

      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'GET', mode: 'cors' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        
        const rawData = await response.json();
        const data = self.transformData(rawData);
        self.setCache(data);
        return { success: true, data: data, fromCache: false };
      } catch (error) {
        console.warn('API fetch failed, using sample data:', error.message);
        return { success: false, error: error.message, useSample: true };
      }
    },

    transformData: function(rawData) {
      if (Array.isArray(rawData)) return rawData;
      if (rawData && rawData.data) return rawData.data;
      if (rawData && rawData.values) {
        const values = rawData.values;
        if (values.length > 1) {
          const headers = values[0].map(function(h) { return String(h).toLowerCase().replace(/\s+/g, '_'); });
          return values.slice(1).map(function(row) {
            const record = {};
            headers.forEach(function(h, i) { record[h] = row[i]; });
            return record;
          });
        }
      }
      return [];
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function formatCurrency(num) {
    if (!num) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  }

  function formatNumber(num) {
    if (!num) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ============================================
  // DASHBOARD STATE
  // ============================================

  var dashboardData = [];
  var currentPage = 1;
  var pageSize = 10;
  var cacheTimer = null;
  var datetimeTimer = null;

  // ============================================
  // DATA PROCESSING
  // ============================================

  function processTrendData(data) {
    var grouped = {};
    data.forEach(function(item) {
      var date = item.tanggal || 'Unknown';
      if (!grouped[date]) grouped[date] = { date: date, shipments: 0, qty: 0 };
      grouped[date].shipments++;
      grouped[date].qty += item.qty || 0;
    });
    return Object.values(grouped).sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
  }

  function processOutletData(data) {
    var grouped = {};
    data.forEach(function(item) {
      var outlet = item.nama_outlet || 'Unknown';
      if (!grouped[outlet]) grouped[outlet] = { outlet: outlet, shipments: 0, qty: 0 };
      grouped[outlet].shipments++;
      grouped[outlet].qty += item.qty || 0;
    });
    return Object.values(grouped).sort(function(a, b) { return b.shipments - a.shipments; });
  }

  function processEkspedisiData(data) {
    var grouped = {};
    data.forEach(function(item) {
      var ekspedisi = item.ekspedisi || 'Unknown';
      if (!grouped[ekspedisi]) grouped[ekspedisi] = { ekspedisi: ekspedisi, shipments: 0, qty: 0 };
      grouped[ekspedisi].shipments++;
      grouped[ekspedisi].qty += item.qty || 0;
    });
    return Object.values(grouped).sort(function(a, b) { return b.shipments - a.shipments; });
  }

  function processStatusData(data) {
    var grouped = {};
    data.forEach(function(item) {
      var status = item.status || 'Unknown';
      if (!grouped[status]) grouped[status] = { status: status, count: 0, qty: 0 };
      grouped[status].count++;
      grouped[status].qty += item.qty || 0;
    });
    return Object.values(grouped);
  }

  // ============================================
  // CSS BAR CHART (Pure CSS)
  // ============================================

  function renderBarChart(data, key, containerId, options) {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var max = Math.max.apply(null, data.map(function(d) { return d[key] || 0; }).concat([1]));
    var colors = options && options.colors || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    var limit = options && options.limit || 10;
    
    var html = '';
    data.slice(0, limit).forEach(function(item, i) {
      var label = item[key.replace ? key.replace(/_/g, ' ') : key] || item.nama_outlet || item.ekspedisi || '-';
      html += '<div class="css-chart-item">';
      html += '<div class="css-chart-label">' + label + '</div>';
      html += '<div class="css-chart-bar-container">';
      html += '<div class="css-chart-bar" style="width:' + ((item[key] / max) * 100) + '%;background:' + colors[i % colors.length] + '"></div>';
      html += '</div>';
      html += '<div class="css-chart-value">' + formatNumber(item[key]) + '</div>';
      html += '</div>';
    });
    
    container.innerHTML = html;
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  function renderKPISection(data) {
    var totalShipments = data.length;
    var totalOTR = 0, totalQty = 0;
    var outletCount = {};
    
    data.forEach(function(item) {
      totalOTR += item.total_otr || 0;
      totalQty += item.qty || 0;
      if (item.kode_outlet) outletCount[item.kode_outlet] = true;
    });
    
    var avgOTR = totalShipments > 0 ? totalOTR / totalShipments : 0;
    var statusCounts = {};
    data.forEach(function(item) {
      var status = item.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    var kpis = [
      { icon: 'package', label: 'Total Pengiriman', value: formatNumber(totalShipments), color: 'primary' },
      { icon: 'truck', label: 'Total Qty', value: formatNumber(totalQty), color: 'info' },
      { icon: 'wallet', label: 'Total OTR', value: formatCurrency(totalOTR), color: 'success' },
      { icon: 'calculator', label: 'Rata-rata OTR', value: formatCurrency(avgOTR), color: 'warning' },
      { icon: 'check-circle', label: 'Terkirim', value: formatNumber(statusCounts['Terkirim'] || 0), color: 'success' },
      { icon: 'clock', label: 'Proses', value: formatNumber(statusCounts['Proses'] || 0), color: 'warning' },
      { icon: 'alert-circle', label: 'Pending', value: formatNumber(statusCounts['Pending'] || 0), color: 'danger' },
      { icon: 'store', label: 'Jumlah Outlet', value: formatNumber(Object.keys(outletCount).length), color: 'info' }
    ];
    
    var colorClasses = { 
      primary: 'kpi-card__icon--primary', 
      success: 'kpi-card__icon--success', 
      warning: 'kpi-card__icon--warning', 
      info: 'kpi-card__icon--info', 
      danger: 'kpi-card__icon--danger' 
    };
    
    var html = '<div class="kpi-grid">';
    kpis.forEach(function(kpi) {
      html += '<div class="kpi-card">';
      html += '<div class="kpi-card__icon ' + colorClasses[kpi.color] + '"><i data-lucide="' + kpi.icon + '"></i></div>';
      html += '<div class="kpi-card__content">';
      html += '<div class="kpi-card__label">' + kpi.label + '</div>';
      html += '<div class="kpi-card__value">' + kpi.value + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
    
    return html;
  }

  function renderChartsSection(data) {
    var trendData = processTrendData(data);
    var outletData = processOutletData(data);
    var ekspedisiData = processEkspedisiData(data);
    var statusData = processStatusData(data);
    
    var html = '<div class="charts-grid">';
    
    // Trend chart
    html += '<div class="chart-card">';
    html += '<div class="chart-card__header"><h3 class="chart-card__title"><i data-lucide="trending-up"></i> Trend Pengiriman</h3></div>';
    html += '<div class="chart-card__body"><div class="trend-summary">';
    trendData.forEach(function(t) {
      html += '<div class="trend-item"><span class="trend-date">' + formatDate(t.date) + '</span><span class="trend-value">' + t.shipments + ' kirim</span></div>';
    });
    html += '</div></div></div>';
    
    // Status chart
    html += '<div class="chart-card">';
    html += '<div class="chart-card__header"><h3 class="chart-card__title"><i data-lucide="pie-chart"></i> Status Pengiriman</h3></div>';
    html += '<div class="chart-card__body"><div class="status-summary">';
    statusData.forEach(function(s) {
      var statusClass = s.status === 'Terkirim' ? 'success' : s.status === 'Proses' ? 'warning' : 'danger';
      html += '<div class="status-item status-item--' + statusClass + '">';
      html += '<span class="status-item__label">' + s.status + '</span>';
      html += '<span class="status-item__value">' + s.count + '</span>';
      html += '</div>';
    });
    html += '</div></div></div>';
    
    // Outlet chart
    html += '<div class="chart-card">';
    html += '<div class="chart-card__header"><h3 class="chart-card__title"><i data-lucide="store"></i> Pengiriman per Outlet</h3></div>';
    html += '<div class="chart-card__body"><div id="outletChart" class="css-chart"></div></div></div>';
    
    // Ekspedisi chart
    html += '<div class="chart-card">';
    html += '<div class="chart-card__header"><h3 class="chart-card__title"><i data-lucide="truck"></i> Pengiriman per Ekspedisi</h3></div>';
    html += '<div class="chart-card__body"><div id="ekspedisiChart" class="css-chart"></div></div></div>';
    
    html += '</div>';
    
    return html;
  }

  function renderOTRDashboard(data) {
    var outletOTR = {};
    data.forEach(function(item) {
      var outlet = item.nama_outlet || 'Unknown';
      if (!outletOTR[outlet]) outletOTR[outlet] = { outlet: outlet, totalOTR: 0 };
      outletOTR[outlet].totalOTR += item.total_otr || 0;
    });
    
    var sorted = Object.values(outletOTR).sort(function(a, b) { return b.totalOTR - a.totalOTR; }).slice(0, 5);
    var maxOTR = Math.max.apply(null, sorted.map(function(o) { return o.totalOTR; }).concat([1]));
    
    var html = '<div class="chart-card otr-dashboard">';
    html += '<div class="chart-card__header"><h3 class="chart-card__title"><i data-lucide="wallet"></i> Top 5 Outlet by OTR</h3></div>';
    html += '<div class="chart-card__body">';
    
    sorted.forEach(function(item, idx) {
      html += '<div class="otr-item">';
      html += '<div class="otr-item__info"><span class="otr-item__rank">' + (idx + 1) + '</span><span class="otr-item__name">' + item.outlet + '</span></div>';
      html += '<div class="otr-item__bar-container"><div class="otr-item__bar" style="width:' + ((item.totalOTR / maxOTR) * 100) + '%"></div></div>';
      html += '<div class="otr-item__value">' + formatCurrency(item.totalOTR) + '</div>';
      html += '</div>';
    });
    
    html += '</div></div>';
    
    return html;
  }

  function renderTable(data) {
    var start = (currentPage - 1) * pageSize;
    var end = start + pageSize;
    var pageData = data.slice(start, end);
    var totalPages = Math.ceil(data.length / pageSize);
    
    var html = '<div class="table-card distribution-table">';
    html += '<div class="table-card__header"><h3 class="table-card__title"><i data-lucide="table"></i> Monitoring Pengiriman</h3><span class="table-card__count">' + data.length + ' data</span></div>';
    html += '<div class="table-card__body"><div class="table-responsive"><table class="data-table">';
    html += '<thead><tr><th>No</th><th>Tanggal</th><th>No. SJ</th><th>Outlet</th><th>Ekspedisi</th><th>No. Resi</th><th>Produk</th><th>Qty</th><th>OTR</th><th>Status</th></tr></thead>';
    html += '<tbody>';
    
    pageData.forEach(function(item) {
      var statusClass = item.status === 'Terkirim' ? 'success' : item.status === 'Proses' ? 'warning' : 'danger';
      html += '<tr>';
      html += '<td>' + (item.no || '-') + '</td>';
      html += '<td>' + formatDate(item.tanggal) + '</td>';
      html += '<td>' + (item.no_surat_jalan || '-') + '</td>';
      html += '<td>' + (item.nama_outlet || '-') + '</td>';
      html += '<td>' + (item.ekspedisi || '-') + '</td>';
      html += '<td>' + (item.no_resi || '-') + '</td>';
      html += '<td>' + (item.nama_produk || '-') + '</td>';
      html += '<td>' + formatNumber(item.qty) + '</td>';
      html += '<td>' + formatCurrency(item.total_otr) + '</td>';
      html += '<td><span class="status-badge status--' + statusClass + '">' + (item.status || '-') + '</span></td>';
      html += '</tr>';
    });
    
    html += '</tbody></table></div></div>';
    html += '<div class="table-pagination">';
    html += '<div class="table-pagination__info">Showing ' + (start + 1) + ' to ' + Math.min(end, data.length) + ' of ' + data.length + '</div>';
    html += '<div class="table-pagination__controls">';
    html += '<select class="table-pagination__select" onchange="DistributionDashboard.changePageSize(this.value)">';
    [10, 25, 50, 100].forEach(function(s) {
      html += '<option value="' + s + '"' + (pageSize === s ? ' selected' : '') + '>' + s + '/page</option>';
    });
    html += '</select>';
    html += '<button class="pagination-btn" onclick="DistributionDashboard.goToPage(1)"' + (currentPage === 1 ? ' disabled' : '') + '>«</button>';
    html += '<button class="pagination-btn" onclick="DistributionDashboard.goToPage(' + (currentPage - 1) + ')"' + (currentPage === 1 ? ' disabled' : '') + '>‹</button>';
    html += '<span class="pagination-info">' + currentPage + ' / ' + totalPages + '</span>';
    html += '<button class="pagination-btn" onclick="DistributionDashboard.goToPage(' + (currentPage + 1) + ')"' + (currentPage === totalPages ? ' disabled' : '') + '>›</button>';
    html += '<button class="pagination-btn" onclick="DistributionDashboard.goToPage(' + totalPages + ')"' + (currentPage === totalPages ? ' disabled' : '') + '>»</button>';
    html += '</div></div></div>';
    
    return html;
  }

  function render(data, error) {
    var root = document.getElementById('distribution-root');
    if (!root) return;
    
    if (error) {
      root.innerHTML = '<div class="distribution-error"><div class="error-icon"><i data-lucide="alert-circle"></i></div><p>Error: ' + error + '</p><p class="text-muted">Menggunakan data contoh...</p></div>';
    } else if (data.length === 0) {
      root.innerHTML = '<div class="distribution-error"><div class="error-icon"><i data-lucide="package"></i></div><p>Tidak ada data pengiriman</p></div>';
    } else {
      root.innerHTML = renderKPISection(data) + renderChartsSection(data) + renderOTRDashboard(data) + renderTable(data);
      
      // Render CSS charts
      renderBarChart(processOutletData(data), 'shipments', 'outletChart', { colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] });
      renderBarChart(processEkspedisiData(data), 'shipments', 'ekspedisiChart', { colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'] });
    }
    
    if (window.lucide) lucide.createIcons();
  }

  // ============================================
  // DATA LOADING
  // ============================================

  async function loadData(forceRefresh) {
    showLoading(true);
    
    try {
      var result = await ShipmentService.fetchShipmentData(forceRefresh);
      
      if (result.success) {
        dashboardData = result.data;
        render(dashboardData);
      } else {
        dashboardData = SAMPLE_DATA;
        render(dashboardData, result.error);
      }
    } catch (err) {
      dashboardData = SAMPLE_DATA;
      render(dashboardData, err.message);
    } finally {
      showLoading(false);
      updateCacheStatus();
    }
  }

  function showLoading(show) {
    var overlay = document.getElementById('distributionLoadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
  }

  function updateCacheStatus() {
    var status = ShipmentService.getCacheStatus();
    var cacheStatusEl = document.getElementById('cacheStatus');
    var cacheRemainingEl = document.getElementById('cacheRemaining');
    
    if (status.isValid && status.remainingTime) {
      if (cacheStatusEl) cacheStatusEl.style.display = 'flex';
      if (cacheRemainingEl) {
        var m = Math.floor(status.remainingTime / 60);
        var s = status.remainingTime % 60;
        cacheRemainingEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      }
    } else {
      if (cacheStatusEl) cacheStatusEl.style.display = 'none';
    }
  }

  function goToPage(page) {
    var totalPages = Math.ceil(dashboardData.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    render(dashboardData);
  }

  function changePageSize(size) {
    pageSize = parseInt(size, 10);
    currentPage = 1;
    render(dashboardData);
  }

  function exportExcel() {
    if (dashboardData.length === 0) {
      if (window.showToast) window.showToast('Tidak ada data untuk di-export', 'error');
      return;
    }
    
    var headers = ['No', 'Tanggal', 'No. SJ', 'Kode Outlet', 'Nama Outlet', 'Ekspedisi', 'No. Resi', 'Produk', 'Qty', 'Harga OTR', 'Total OTR', 'Status'];
    var rows = dashboardData.map(function(item) {
      return [
        item.no || '', item.tanggal || '', item.no_surat_jalan || '', item.kode_outlet || '',
        item.nama_outlet || '', item.ekspedisi || '', item.no_resi || '', item.nama_produk || '',
        item.qty || 0, item.harga_otr || 0, item.total_otr || 0, item.status || ''
      ];
    });
    
    var csv = [headers].concat(rows).map(function(r) { return r.join(','); }).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'distribution_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (window.showToast) window.showToast('Data berhasil di-export', 'success');
  }

  // ============================================
  // GLOBAL API
  // ============================================

  window.DistributionDashboard = {
    refreshData: function() { loadData(true); },
    exportExcel: exportExcel,
    goToPage: goToPage,
    changePageSize: changePageSize,
    getCacheStatus: function() { return ShipmentService.getCacheStatus(); }
  };

  // ============================================
  // INITIALIZATION
  // ============================================

  function updateDateTime() {
    var now = new Date();
    var dateEl = document.getElementById('distDate');
    var timeEl = document.getElementById('distTime');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID');
  }

  function initDistributionDashboard() {
    // Clear existing timers
    if (cacheTimer) clearInterval(cacheTimer);
    if (datetimeTimer) clearInterval(datetimeTimer);
    
    updateDateTime();
    datetimeTimer = setInterval(updateDateTime, 1000);
    cacheTimer = setInterval(updateCacheStatus, 1000);
    
    // Attach button events
    var refreshBtn = document.getElementById('refreshBtn');
    var exportBtn = document.getElementById('exportBtn');
    
    if (refreshBtn) refreshBtn.onclick = function() { loadData(true); };
    if (exportBtn) exportBtn.onclick = exportExcel;
    
    // Load initial data
    loadData(false);
    if (window.lucide) lucide.createIcons();
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDistributionDashboard);
  } else {
    initDistributionDashboard();
  }

})();
