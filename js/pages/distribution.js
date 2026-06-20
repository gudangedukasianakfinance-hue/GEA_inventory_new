/***********************************************
 * CV EPIC Warehouse - Distribution Dashboard
 * Vanilla JS + Recharts + Custom Table
 * Data Source: Google Apps Script JSON Endpoint
 * 
 * Service: src/modules/shipment-dashboard/services/shipmentService.ts
 * Cache: 5 minutes
 ***********************************************/

// Google Apps Script URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxb3nDU0ul_XHAkkLWo8Gc5LbUDxNn5k3L34qOZIze2TVJxE4mZuMkq-mGdI36iZlLG/exec';

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
  CACHE_DURATION: CACHE_DURATION,

  isCacheValid() {
    const entry = this.cache.get(this.CACHE_KEY);
    if (!entry) return false;
    return Date.now() - entry.timestamp < this.CACHE_DURATION;
  },

  getCachedData() {
    if (this.isCacheValid()) {
      return this.cache.get(this.CACHE_KEY).data;
    }
    return null;
  },

  setCache(data) {
    this.cache.set(this.CACHE_KEY, {
      data,
      timestamp: Date.now()
    });
  },

  clearCache(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  },

  getCacheStatus() {
    const entry = this.cache.get(this.CACHE_KEY);
    if (!entry) return { isValid: false };
    const elapsed = Date.now() - entry.timestamp;
    const remaining = this.CACHE_DURATION - elapsed;
    return {
      isValid: remaining > 0,
      remainingTime: remaining > 0 ? Math.ceil(remaining / 1000) : 0
    };
  },

  async fetchShipmentData(forceRefresh = false) {
    if (!forceRefresh && this.isCacheValid()) {
      const cachedData = this.getCachedData();
      if (cachedData) {
        return { success: true, data: cachedData, fromCache: true };
      }
    }

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      const shipmentData = this.transformData(rawData);
      this.setCache(shipmentData);
      
      return { success: true, data: shipmentData, fromCache: false };
    } catch (error) {
      console.error('Error fetching shipment data:', error);
      return { success: false, error: error.message };
    }
  },

  transformData(rawData) {
    if (Array.isArray(rawData)) {
      return rawData;
    }

    if (rawData && typeof rawData === 'object') {
      const obj = rawData;
      
      if (Array.isArray(obj.data)) {
        return obj.data;
      }
      
      if (Array.isArray(obj.values)) {
        const values = obj.values;
        if (values.length > 1) {
          const headers = values[0].map(h => String(h).toLowerCase().replace(/\s+/g, '_'));
          return values.slice(1).map(row => {
            const record = {};
            headers.forEach((header, index) => {
              record[header] = row[index];
            });
            return record;
          });
        }
      }

      if (Array.isArray(obj.table)) {
        return obj.table;
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
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================
// DASHBOARD STATE
// ============================================

let dashboardData = [];
let currentPage = 1;
const pageSize = 10;

// ============================================
// UI COMPONENTS (Vanilla JS)
// ============================================

function renderKPISection(data) {
  const totalShipments = data.length;
  const totalOTR = data.reduce((sum, item) => sum + (item.total_otr || 0), 0);
  const totalQty = data.reduce((sum, item) => sum + (item.qty || 0), 0);
  const avgOTR = totalShipments > 0 ? totalOTR / totalShipments : 0;
  
  const statusCounts = data.reduce((acc, item) => {
    const status = item.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  const kpis = [
    { icon: 'package', label: 'Total Pengiriman', value: formatNumber(totalShipments), color: 'primary' },
    { icon: 'truck', label: 'Total Qty', value: formatNumber(totalQty), color: 'info' },
    { icon: 'wallet', label: 'Total OTR', value: formatCurrency(totalOTR), color: 'success' },
    { icon: 'calculator', label: 'Rata-rata OTR', value: formatCurrency(avgOTR), color: 'warning' },
    { icon: 'check-circle', label: 'Terkirim', value: formatNumber(statusCounts['Terkirim'] || 0), color: 'success' },
    { icon: 'clock', label: 'Proses', value: formatNumber(statusCounts['Proses'] || 0), color: 'warning' },
    { icon: 'alert-circle', label: 'Pending', value: formatNumber(statusCounts['Pending'] || 0), color: 'danger' },
    { icon: 'store', label: 'Jumlah Outlet', value: formatNumber(new Set(data.map(d => d.kode_outlet)).size), color: 'info' },
  ];
  
  const colorClasses = {
    primary: 'kpi-card__icon--primary',
    success: 'kpi-card__icon--success',
    warning: 'kpi-card__icon--warning',
    info: 'kpi-card__icon--info',
    danger: 'kpi-card__icon--danger'
  };
  
  return `
    <div class="kpi-grid">
      ${kpis.map(kpi => `
        <div class="kpi-card">
          <div class="kpi-card__icon ${colorClasses[kpi.color]}">
            <i data-lucide="${kpi.icon}"></i>
          </div>
          <div class="kpi-card__content">
            <div class="kpi-card__label">${kpi.label}</div>
            <div class="kpi-card__value">${kpi.value}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCharts(data) {
  return `
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-card__header">
          <h3 class="chart-card__title">
            <i data-lucide="trending-up"></i>
            Trend Pengiriman
          </h3>
        </div>
        <div class="chart-card__body">
          <div id="trendChart" style="width: 100%; height: 250px;"></div>
        </div>
      </div>
      
      <div class="chart-card">
        <div class="chart-card__header">
          <h3 class="chart-card__title">
            <i data-lucide="pie-chart"></i>
            Status Pengiriman
          </h3>
        </div>
        <div class="chart-card__body">
          <div id="statusChart" style="width: 100%; height: 250px;"></div>
        </div>
      </div>
      
      <div class="chart-card">
        <div class="chart-card__header">
          <h3 class="chart-card__title">
            <i data-lucide="store"></i>
            Pengiriman per Outlet
          </h3>
        </div>
        <div class="chart-card__body">
          <div id="outletChart" style="width: 100%; height: 250px;"></div>
        </div>
      </div>
      
      <div class="chart-card">
        <div class="chart-card__header">
          <h3 class="chart-card__title">
            <i data-lucide="truck"></i>
            Pengiriman per Ekspedisi
          </h3>
        </div>
        <div class="chart-card__body">
          <div id="ekspedisiChart" style="width: 100%; height: 250px;"></div>
        </div>
      </div>
    </div>
  `;
}

function renderOTRDashboard(data) {
  const outletOTR = data.reduce((acc, item) => {
    const outlet = item.nama_outlet || 'Unknown';
    if (!acc[outlet]) {
      acc[outlet] = { outlet, totalOTR: 0, count: 0 };
    }
    acc[outlet].totalOTR += item.total_otr || 0;
    acc[outlet].count += 1;
    return acc;
  }, {});
  
  const sortedOutlets = Object.values(outletOTR)
    .sort((a, b) => b.totalOTR - a.totalOTR)
    .slice(0, 5);
  
  const maxOTR = Math.max(...sortedOutlets.map(o => o.totalOTR), 1);
  
  return `
    <div class="chart-card otr-dashboard">
      <div class="chart-card__header">
        <h3 class="chart-card__title">
          <i data-lucide="wallet"></i>
          Top 5 Outlet by OTR
        </h3>
      </div>
      <div class="chart-card__body">
        ${sortedOutlets.map((item, idx) => `
          <div class="otr-item">
            <div class="otr-item__info">
              <span class="otr-item__rank">${idx + 1}</span>
              <span class="otr-item__name">${item.outlet}</span>
            </div>
            <div class="otr-item__bar-container">
              <div class="otr-item__bar" style="width: ${(item.totalOTR / maxOTR) * 100}%"></div>
            </div>
            <div class="otr-item__value">${formatCurrency(item.totalOTR)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderTable(data) {
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageData = data.slice(start, end);
  const totalPages = Math.ceil(data.length / pageSize);
  
  return `
    <div class="table-card distribution-table">
      <div class="table-card__header">
        <h3 class="table-card__title">
          <i data-lucide="table"></i>
          Monitoring Pengiriman
        </h3>
        <span class="table-card__count">${data.length} data</span>
      </div>
      <div class="table-card__body">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>No. Surat Jalan</th>
                <th>Outlet</th>
                <th>Ekspedisi</th>
                <th>No. Resi</th>
                <th>Produk</th>
                <th>Qty</th>
                <th>Harga OTR</th>
                <th>Total OTR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${pageData.map(item => `
                <tr>
                  <td>${item.no || '-'}</td>
                  <td>${formatDate(item.tanggal)}</td>
                  <td>${item.no_surat_jalan || '-'}</td>
                  <td>${item.nama_outlet || '-'}</td>
                  <td>${item.ekspedisi || '-'}</td>
                  <td>${item.no_resi || '-'}</td>
                  <td>${item.nama_produk || '-'}</td>
                  <td>${formatNumber(item.qty)}</td>
                  <td>${formatCurrency(item.harga_otr)}</td>
                  <td>${formatCurrency(item.total_otr)}</td>
                  <td><span class="status-badge status--${item.status === 'Terkirim' ? 'success' : item.status === 'Proses' ? 'warning' : 'danger'}">${item.status || '-'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="table-pagination">
        <div class="table-pagination__info">
          Showing ${start + 1} to ${Math.min(end, data.length)} of ${data.length} entries
        </div>
        <div class="table-pagination__controls">
          <select class="table-pagination__select" onchange="DistributionDashboard.changePageSize(this.value)">
            <option value="10" ${pageSize === 10 ? 'selected' : ''}>10 per page</option>
            <option value="25" ${pageSize === 25 ? 'selected' : ''}>25 per page</option>
            <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 per page</option>
            <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 per page</option>
          </select>
          <button class="pagination-btn" onclick="DistributionDashboard.goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>«</button>
          <button class="pagination-btn" onclick="DistributionDashboard.goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
          <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
          <button class="pagination-btn" onclick="DistributionDashboard.goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
          <button class="pagination-btn" onclick="DistributionDashboard.goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>»</button>
        </div>
      </div>
    </div>
  `;
}

function renderError(message) {
  return `
    <div class="distribution-error">
      <div class="error-icon">
        <i data-lucide="alert-circle"></i>
      </div>
      <p>${message}</p>
      <button class="btn btn--primary" onclick="DistributionDashboard.refreshData()">Coba Lagi</button>
    </div>
  `;
}

function renderEmpty() {
  return `
    <div class="distribution-error">
      <div class="error-icon">
        <i data-lucide="package"></i>
      </div>
      <p>Tidak ada data pengiriman</p>
    </div>
  `;
}

// ============================================
// DATA PROCESSING
// ============================================

function processTrendData(data) {
  const grouped = data.reduce((acc, item) => {
    const date = item.tanggal || 'Unknown';
    if (!acc[date]) {
      acc[date] = { date: formatDate(date), shipments: 0, qty: 0 };
    }
    acc[date].shipments += 1;
    acc[date].qty += item.qty || 0;
    return acc;
  }, {});
  
  return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function processOutletData(data) {
  const grouped = data.reduce((acc, item) => {
    const outlet = item.nama_outlet || 'Unknown';
    if (!acc[outlet]) {
      acc[outlet] = { outlet, shipments: 0, qty: 0 };
    }
    acc[outlet].shipments += 1;
    acc[outlet].qty += item.qty || 0;
    return acc;
  }, {});
  
  return Object.values(grouped).sort((a, b) => b.shipments - a.shipments);
}

function processEkspedisiData(data) {
  const grouped = data.reduce((acc, item) => {
    const ekspedisi = item.ekspedisi || 'Unknown';
    if (!acc[ekspedisi]) {
      acc[ekspedisi] = { ekspedisi, shipments: 0, qty: 0 };
    }
    acc[ekspedisi].shipments += 1;
    acc[ekspedisi].qty += item.qty || 0;
    return acc;
  }, {});
  
  return Object.values(grouped).sort((a, b) => b.shipments - a.shipments);
}

function processStatusData(data) {
  const grouped = data.reduce((acc, item) => {
    const status = item.status || 'Unknown';
    if (!acc[status]) {
      acc[status] = { status, count: 0, qty: 0 };
    }
    acc[status].count += 1;
    acc[status].qty += item.qty || 0;
    return acc;
  }, {});
  
  return Object.values(grouped);
}

// ============================================
// CHART RENDERING
// ============================================

function renderChartsWithData() {
  setTimeout(() => {
    renderTrendChart();
    renderStatusChart();
    renderOutletChart();
    renderEkspedisiChart();
  }, 200);
}

function renderTrendChart() {
  const chartEl = document.getElementById('trendChart');
  if (!chartEl || typeof Recharts === 'undefined') return;
  
  const trendData = processTrendData(dashboardData);
  if (trendData.length === 0) return;
  
  try {
    Recharts.unmount();
    Recharts.render(
      Recharts.createElement(Recharts.LineChart, { width: chartEl.offsetWidth, height: 250, data: trendData },
        Recharts.createElement(Recharts.CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }),
        Recharts.createElement(Recharts.XAxis, { dataKey: 'date', stroke: '#64748b', fontSize: 11 }),
        Recharts.createElement(Recharts.YAxis, { stroke: '#64748b', fontSize: 11 }),
        Recharts.createElement(Recharts.Tooltip, { contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' } }),
        Recharts.createElement(Recharts.Legend, { wrapperStyle: { fontSize: '12px' } }),
        Recharts.createElement(Recharts.Line, { type: 'monotone', dataKey: 'shipments', stroke: '#3b82f6', strokeWidth: 2, name: 'Pengiriman', dot: { fill: '#3b82f6' } }),
        Recharts.createElement(Recharts.Line, { type: 'monotone', dataKey: 'qty', stroke: '#10b981', strokeWidth: 2, name: 'Qty', dot: { fill: '#10b981' } })
      ),
      chartEl
    );
  } catch (e) {
    console.error('Error rendering trend chart:', e);
  }
}

function renderStatusChart() {
  const chartEl = document.getElementById('statusChart');
  if (!chartEl || typeof Recharts === 'undefined') return;
  
  const statusData = processStatusData(dashboardData);
  if (statusData.length === 0) return;
  
  const COLORS = {
    'Terkirim': '#10b981',
    'Proses': '#f59e0b',
    'Pending': '#ef4444'
  };
  
  try {
    Recharts.unmount();
    Recharts.render(
      Recharts.createElement(Recharts.PieChart, { width: chartEl.offsetWidth, height: 250 },
        Recharts.createElement(Recharts.Pie, { 
          data: statusData, 
          dataKey: 'count', 
          nameKey: 'status', 
          cx: '50%', 
          cy: '50%', 
          outerRadius: 80,
          label: ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`
        },
          statusData.map((entry, index) => 
            Recharts.createElement(Recharts.Cell, { key: `cell-${index}`, fill: COLORS[entry.status] || '#64748b' })
          )
        ),
        Recharts.createElement(Recharts.Tooltip, { contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' } }),
        Recharts.createElement(Recharts.Legend, { wrapperStyle: { fontSize: '12px' } })
      ),
      chartEl
    );
  } catch (e) {
    console.error('Error rendering status chart:', e);
  }
}

function renderOutletChart() {
  const chartEl = document.getElementById('outletChart');
  if (!chartEl || typeof Recharts === 'undefined') return;
  
  const outletData = processOutletData(dashboardData).slice(0, 10);
  if (outletData.length === 0) return;
  
  try {
    Recharts.unmount();
    Recharts.render(
      Recharts.createElement(Recharts.BarChart, { width: chartEl.offsetWidth, height: 250, data: outletData },
        Recharts.createElement(Recharts.CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }),
        Recharts.createElement(Recharts.XAxis, { dataKey: 'outlet', stroke: '#64748b', fontSize: 10, angle: -45, textAnchor: 'end', height: 80 }),
        Recharts.createElement(Recharts.YAxis, { stroke: '#64748b', fontSize: 11 }),
        Recharts.createElement(Recharts.Tooltip, { contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' } }),
        Recharts.createElement(Recharts.Bar, { dataKey: 'shipments', fill: '#3b82f6', name: 'Pengiriman', radius: [4, 4, 0, 0] }),
        Recharts.createElement(Recharts.Bar, { dataKey: 'qty', fill: '#10b981', name: 'Qty', radius: [4, 4, 0, 0] })
      ),
      chartEl
    );
  } catch (e) {
    console.error('Error rendering outlet chart:', e);
  }
}

function renderEkspedisiChart() {
  const chartEl = document.getElementById('ekspedisiChart');
  if (!chartEl || typeof Recharts === 'undefined') return;
  
  const ekspedisiData = processEkspedisiData(dashboardData);
  if (ekspedisiData.length === 0) return;
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  
  try {
    Recharts.unmount();
    Recharts.render(
      Recharts.createElement(Recharts.PieChart, { width: chartEl.offsetWidth, height: 250 },
        Recharts.createElement(Recharts.Pie, { 
          data: ekspedisiData, 
          dataKey: 'shipments', 
          nameKey: 'ekspedisi', 
          cx: '50%', 
          cy: '50%', 
          outerRadius: 80,
          label: ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`
        },
          ekspedisiData.map((entry, index) => 
            Recharts.createElement(Recharts.Cell, { key: `cell-${index}`, fill: COLORS[index % COLORS.length] })
          )
        ),
        Recharts.createElement(Recharts.Tooltip, { contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' } })
      ),
      chartEl
    );
  } catch (e) {
    console.error('Error rendering ekspedisi chart:', e);
  }
}

// ============================================
// MAIN RENDER FUNCTION
// ============================================

function render(data, error = null) {
  const root = document.getElementById('distribution-root');
  if (!root) return;
  
  if (error) {
    root.innerHTML = renderError(error);
    lucide.createIcons();
    return;
  }
  
  if (data.length === 0) {
    root.innerHTML = renderEmpty();
    lucide.createIcons();
    return;
  }
  
  root.innerHTML = `
    ${renderKPISection(data)}
    ${renderCharts(data)}
    ${renderOTRDashboard(data)}
    ${renderTable(data)}
  `;
  
  lucide.createIcons();
  renderChartsWithData();
}

// ============================================
// DATA LOADING
// ============================================

async function loadData(forceRefresh = false) {
  showLoading(true);
  
  try {
    const result = await ShipmentService.fetchShipmentData(forceRefresh);
    
    if (result.success) {
      dashboardData = result.data || [];
      render(dashboardData);
      updateCacheStatus();
    } else {
      // Fallback to sample data
      dashboardData = SAMPLE_DATA;
      render(dashboardData, result.error);
      if (window.showToast) showToast('Gagal mengambil data. Menggunakan data contoh.', 'error');
    }
  } catch (err) {
    console.error('Error loading data:', err);
    dashboardData = SAMPLE_DATA;
    render(dashboardData, err.message);
  } finally {
    showLoading(false);
  }
}

// ============================================
// UI HELPERS
// ============================================

function showLoading(show) {
  const overlay = document.getElementById('distributionLoadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

function updateCacheStatus() {
  const status = ShipmentService.getCacheStatus();
  const cacheStatusEl = document.getElementById('cacheStatus');
  const cacheRemainingEl = document.getElementById('cacheRemaining');
  
  if (status.isValid && status.remainingTime) {
    if (cacheStatusEl) cacheStatusEl.style.display = 'flex';
    if (cacheRemainingEl) {
      const minutes = Math.floor(status.remainingTime / 60);
      const seconds = status.remainingTime % 60;
      cacheRemainingEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  } else {
    if (cacheStatusEl) cacheStatusEl.style.display = 'none';
  }
}

// ============================================
// PAGINATION
// ============================================

function goToPage(page) {
  const totalPages = Math.ceil(dashboardData.length / pageSize);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  render(dashboardData);
}

function changePageSize(size) {
  window.pageSize = parseInt(size);
  currentPage = 1;
  render(dashboardData);
}

// ============================================
// EXPORT
// ============================================

function exportExcel() {
  if (dashboardData.length === 0) {
    if (window.showToast) showToast('Tidak ada data untuk di-export', 'error');
    return;
  }
  
  const headers = ['No', 'Tanggal', 'No. Surat Jalan', 'Kode Outlet', 'Nama Outlet', 'Ekspedisi', 'No. Resi', 'Nama Produk', 'Qty', 'Harga OTR', 'Total OTR', 'Status'];
  const rows = dashboardData.map(item => [
    item.no || '',
    item.tanggal || '',
    item.no_surat_jalan || '',
    item.kode_outlet || '',
    item.nama_outlet || '',
    item.ekspedisi || '',
    item.no_resi || '',
    item.nama_produk || '',
    item.qty || 0,
    item.harga_otr || 0,
    item.total_otr || 0,
    item.status || ''
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `distribution_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  if (window.showToast) showToast('Data berhasil di-export', 'success');
}

// ============================================
// GLOBAL API
// ============================================

window.DistributionDashboard = {
  refreshData: () => loadData(true),
  exportExcel: exportExcel,
  goToPage: goToPage,
  changePageSize: changePageSize,
  getCacheStatus: () => ShipmentService.getCacheStatus()
};

// ============================================
// DATETIME UPDATE
// ============================================

function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('distDate');
  const timeEl = document.getElementById('distTime');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID');
}

// ============================================
// INITIALIZATION
// ============================================

let cacheTimer = null;
let datetimeTimer = null;

function initDistributionDashboard() {
  // Clear existing timers
  if (cacheTimer) clearInterval(cacheTimer);
  if (datetimeTimer) clearInterval(datetimeTimer);
  
  // Update datetime
  updateDateTime();
  datetimeTimer = setInterval(updateDateTime, 1000);
  
  // Update cache status
  cacheTimer = setInterval(updateCacheStatus, 1000);
  
  // Attach button events
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadData(true));
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', exportExcel);
  }
  
  // Load initial data
  loadData();
  
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
}

// Wait for scripts to load before initializing
function waitForScripts(callback, attempts = 0) {
  if (typeof Recharts !== 'undefined' && typeof lucide !== 'undefined') {
    callback();
  } else if (attempts < 50) {
    setTimeout(() => waitForScripts(callback, attempts + 1), 100);
  } else {
    console.error('Scripts did not load in time');
  }
}

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  waitForScripts(initDistributionDashboard);
});

window.addEventListener('pageInit', (e) => {
  if (e.detail.page === 'distribution') {
    waitForScripts(initDistributionDashboard);
  }
});
