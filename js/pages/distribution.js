/***********************************************
 * CV EPIC Warehouse - Distribution Dashboard
 * React + Tailwind + Recharts + TanStack Table
 * Data Source: Google Apps Script JSON Endpoint
 * 
 * Service: src/modules/shipment-dashboard/services/shipmentService.ts
 * Cache: 5 minutes
 ***********************************************/

const { useState, useEffect, useMemo, useCallback } = React;
const { useTable, usePagination, useSortBy, useFilters, useGlobalFilter } = ReactTable;

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
// SHIPMENT SERVICE (Inline - mirrors TypeScript service)
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
    // Return cached data if valid
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
    // Handle direct array format
    if (Array.isArray(rawData)) {
      return rawData;
    }

    if (rawData && typeof rawData === 'object') {
      const obj = rawData;
      
      // Check for data property
      if (Array.isArray(obj.data)) {
        return obj.data;
      }
      
      // Check for values property (Google Sheets format)
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

      // Check for table property
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
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================
// REACT COMPONENTS
// ============================================

// 1. KPI Card Component
function KPICard({ icon, label, value, trend, trendDirection, color }) {
  const colorClasses = {
    primary: 'kpi-card__icon--primary',
    success: 'kpi-card__icon--success',
    warning: 'kpi-card__icon--warning',
    info: 'kpi-card__icon--info',
    danger: 'kpi-card__icon--danger'
  };
  
  return React.createElement('div', { className: 'kpi-card' },
    React.createElement('div', { className: `kpi-card__icon ${colorClasses[color]}` },
      React.createElement('i', { 'data-lucide': icon })
    ),
    React.createElement('div', { className: 'kpi-card__content' },
      React.createElement('div', { className: 'kpi-card__label' }, label),
      React.createElement('div', { className: 'kpi-card__value' }, value),
      trend && React.createElement('div', { className: `kpi-card__trend kpi-card__trend--${trendDirection}` },
        React.createElement('i', { 'data-lucide': trendDirection === 'up' ? 'trending-up' : 'trending-down' }),
        React.createElement('span', null, trend)
      )
    )
  );
}

// 2. KPI Dashboard Section
function KPISection({ data }) {
  const totalShipments = data.length;
  const totalOTR = data.reduce((sum, item) => sum + (item.total_otr || 0), 0);
  const totalQty = data.reduce((sum, item) => sum + (item.qty || 0), 0);
  const avgOTR = totalShipments > 0 ? totalOTR / totalShipments : 0;
  
  const statusCounts = data.reduce((acc, item) => {
    const status = item.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  return React.createElement('div', { className: 'kpi-grid' },
    React.createElement(KPICard, { icon: 'package', label: 'Total Pengiriman', value: formatNumber(totalShipments), color: 'primary' }),
    React.createElement(KPICard, { icon: 'truck', label: 'Total Qty', value: formatNumber(totalQty), color: 'info' }),
    React.createElement(KPICard, { icon: 'wallet', label: 'Total OTR', value: formatCurrency(totalOTR), color: 'success' }),
    React.createElement(KPICard, { icon: 'calculator', label: 'Rata-rata OTR', value: formatCurrency(avgOTR), color: 'warning' }),
    React.createElement(KPICard, { icon: 'check-circle', label: 'Terkirim', value: formatNumber(statusCounts['Terkirim'] || 0), color: 'success' }),
    React.createElement(KPICard, { icon: 'clock', label: 'Proses', value: formatNumber(statusCounts['Proses'] || 0), color: 'warning' }),
    React.createElement(KPICard, { icon: 'alert-circle', label: 'Pending', value: formatNumber(statusCounts['Pending'] || 0), color: 'danger' }),
    React.createElement(KPICard, { icon: 'store', label: 'Jumlah Outlet', value: formatNumber(new Set(data.map(d => d.kode_outlet)).size), color: 'info' })
  );
}

// 3. OTR Dashboard Section
function OTRDashboard({ data }) {
  const outletOTR = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const outlet = item.nama_outlet || 'Unknown';
      if (!acc[outlet]) {
        acc[outlet] = { outlet, totalOTR: 0, count: 0 };
      }
      acc[outlet].totalOTR += item.total_otr || 0;
      acc[outlet].count += 1;
      return acc;
    }, {});
    
    return Object.values(grouped)
      .sort((a, b) => b.totalOTR - a.totalOTR)
      .slice(0, 5);
  }, [data]);
  
  const maxOTR = Math.max(...outletOTR.map(o => o.totalOTR), 1);
  
  return React.createElement('div', { className: 'otr-dashboard' },
    React.createElement('div', { className: 'chart-card' },
      React.createElement('div', { className: 'chart-card__header' },
        React.createElement('h3', { className: 'chart-card__title' },
          React.createElement('i', { 'data-lucide': 'wallet' }),
          'Top 5 Outlet by OTR'
        )
      ),
      React.createElement('div', { className: 'chart-card__body' },
        outletOTR.map((item, idx) =>
          React.createElement('div', { className: 'otr-item', key: idx },
            React.createElement('div', { className: 'otr-item__info' },
              React.createElement('span', { className: 'otr-item__rank' }, idx + 1),
              React.createElement('span', { className: 'otr-item__name' }, item.outlet)
            ),
            React.createElement('div', { className: 'otr-item__bar-container' },
              React.createElement('div', { 
                className: 'otr-item__bar',
                style: { width: `${(item.totalOTR / maxOTR) * 100}%` }
              })
            ),
            React.createElement('div', { className: 'otr-item__value' }, formatCurrency(item.totalOTR))
          )
        )
      )
    )
  );
}

// 4. Shipment Trend Chart
function ShipmentTrendChart({ data }) {
  const trendData = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const date = item.tanggal || 'Unknown';
      if (!acc[date]) {
        acc[date] = { date: formatDate(date), shipments: 0, qty: 0, otr: 0 };
      }
      acc[date].shipments += 1;
      acc[date].qty += item.qty || 0;
      acc[date].otr += item.total_otr || 0;
      return acc;
    }, {});
    
    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data]);
  
  if (trendData.length === 0) {
    return React.createElement('div', { className: 'chart-card' },
      React.createElement('div', { className: 'chart-card__header' },
        React.createElement('h3', { className: 'chart-card__title' },
          React.createElement('i', { 'data-lucide': 'trending-up' }),
          'Trend Pengiriman'
        )
      ),
      React.createElement('div', { className: 'chart-card__body chart-card__empty' },
        React.createElement('i', { 'data-lucide': 'trending-up' }),
        React.createElement('p', { className: 'chart-card__empty-text' }, 'Tidak ada data')
      )
    );
  }
  
  return React.createElement('div', { className: 'chart-card' },
    React.createElement('div', { className: 'chart-card__header' },
      React.createElement('h3', { className: 'chart-card__title' },
        React.createElement('i', { 'data-lucide': 'trending-up' }),
        'Trend Pengiriman'
      )
    ),
    React.createElement('div', { className: 'chart-card__body' },
      React.createElement(Recharts.LineChart, { width: '100%', height: 250, data: trendData },
        React.createElement(Recharts.CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }),
        React.createElement(Recharts.XAxis, { dataKey: 'date', stroke: '#64748b', fontSize: 11 }),
        React.createElement(Recharts.YAxis, { stroke: '#64748b', fontSize: 11 }),
        React.createElement(Recharts.Tooltip, { 
          contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' },
          labelStyle: { color: '#e2e8f0' }
        }),
        React.createElement(Recharts.Legend, { wrapperStyle: { fontSize: '12px' } }),
        React.createElement(Recharts.Line, { type: 'monotone', dataKey: 'shipments', stroke: '#3b82f6', strokeWidth: 2, name: 'Pengiriman', dot: { fill: '#3b82f6' } }),
        React.createElement(Recharts.Line, { type: 'monotone', dataKey: 'qty', stroke: '#10b981', strokeWidth: 2, name: 'Qty', dot: { fill: '#10b981' } })
      )
    )
  );
}

// 5. Shipment by Outlet Chart
function ShipmentByOutletChart({ data }) {
  const outletData = useMemo(() => {
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
  }, [data]);
  
  if (outletData.length === 0) {
    return React.createElement('div', { className: 'chart-card' },
      React.createElement('div', { className: 'chart-card__header' },
        React.createElement('h3', { className: 'chart-card__title' },
          React.createElement('i', { 'data-lucide': 'store' }),
          'Pengiriman per Outlet'
        )
      ),
      React.createElement('div', { className: 'chart-card__body chart-card__empty' },
        React.createElement('i', { 'data-lucide': 'store' }),
        React.createElement('p', { className: 'chart-card__empty-text' }, 'Tidak ada data')
      )
    );
  }
  
  return React.createElement('div', { className: 'chart-card' },
    React.createElement('div', { className: 'chart-card__header' },
      React.createElement('h3', { className: 'chart-card__title' },
        React.createElement('i', { 'data-lucide': 'store' }),
        'Pengiriman per Outlet'
      )
    ),
    React.createElement('div', { className: 'chart-card__body' },
      React.createElement(Recharts.BarChart, { width: '100%', height: 250, data: outletData.slice(0, 10) },
        React.createElement(Recharts.CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }),
        React.createElement(Recharts.XAxis, { dataKey: 'outlet', stroke: '#64748b', fontSize: 10, angle: -45, textAnchor: 'end', height: 80 }),
        React.createElement(Recharts.YAxis, { stroke: '#64748b', fontSize: 11 }),
        React.createElement(Recharts.Tooltip, { 
          contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' },
          labelStyle: { color: '#e2e8f0' }
        }),
        React.createElement(Recharts.Bar, { dataKey: 'shipments', fill: '#3b82f6', name: 'Pengiriman', radius: [4, 4, 0, 0] }),
        React.createElement(Recharts.Bar, { dataKey: 'qty', fill: '#10b981', name: 'Qty', radius: [4, 4, 0, 0] })
      )
    )
  );
}

// 6. Shipment by Ekspedisi Chart
function ShipmentByEkspedisiChart({ data }) {
  const ekspedisiData = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const ekspedisi = item.ekspedisi || 'Unknown';
      if (!acc[ekspedisi]) {
        acc[ekspedisi] = { ekspedisi, shipments: 0, qty: 0, totalOTR: 0 };
      }
      acc[ekspedisi].shipments += 1;
      acc[ekspedisi].qty += item.qty || 0;
      acc[ekspedisi].totalOTR += item.total_otr || 0;
      return acc;
    }, {});
    
    return Object.values(grouped).sort((a, b) => b.shipments - a.shipments);
  }, [data]);
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  
  if (ekspedisiData.length === 0) {
    return React.createElement('div', { className: 'chart-card' },
      React.createElement('div', { className: 'chart-card__header' },
        React.createElement('h3', { className: 'chart-card__title' },
          React.createElement('i', { 'data-lucide': 'truck' }),
          'Pengiriman per Ekspedisi'
        )
      ),
      React.createElement('div', { className: 'chart-card__body chart-card__empty' },
        React.createElement('i', { 'data-lucide': 'truck' }),
        React.createElement('p', { className: 'chart-card__empty-text' }, 'Tidak ada data')
      )
    );
  }
  
  return React.createElement('div', { className: 'chart-card' },
    React.createElement('div', { className: 'chart-card__header' },
      React.createElement('h3', { className: 'chart-card__title' },
        React.createElement('i', { 'data-lucide': 'truck' }),
        'Pengiriman per Ekspedisi'
      )
    ),
    React.createElement('div', { className: 'chart-card__body ekspedisi-chart-body' },
      React.createElement(Recharts.PieChart, { width: '50%', height: 250 },
        React.createElement(Recharts.Pie, { 
          data: ekspedisiData, 
          dataKey: 'shipments', 
          nameKey: 'ekspedisi', 
          cx: '50%', 
          cy: '50%', 
          outerRadius: 80,
          label: ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`,
          labelLine: false
        },
          ekspedisiData.map((entry, index) => 
            React.createElement(Recharts.Cell, { key: `cell-${index}`, fill: COLORS[index % COLORS.length] })
          )
        ),
        React.createElement(Recharts.Tooltip, { 
          contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' },
          labelStyle: { color: '#e2e8f0' }
        })
      ),
      React.createElement('div', { className: 'ekspedisi-legend' },
        ekspedisiData.map((item, idx) =>
          React.createElement('div', { className: 'ekspedisi-legend-item', key: idx },
            React.createElement('span', { className: 'ekspedisi-legend-color', style: { background: COLORS[idx % COLORS.length] } }),
            React.createElement('span', { className: 'ekspedisi-legend-name' }, item.ekspedisi),
            React.createElement('span', { className: 'ekspedisi-legend-value' }, `${item.shipments} shipments`)
          )
        )
      )
    )
  );
}

// 7. Status Pie Chart
function StatusPieChart({ data }) {
  const statusData = useMemo(() => {
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
  }, [data]);
  
  const COLORS = {
    'Terkirim': '#10b981',
    'Proses': '#f59e0b',
    'Pending': '#ef4444'
  };
  
  if (statusData.length === 0) {
    return React.createElement('div', { className: 'chart-card' },
      React.createElement('div', { className: 'chart-card__header' },
        React.createElement('h3', { className: 'chart-card__title' },
          React.createElement('i', { 'data-lucide': 'pie-chart' }),
          'Status Pengiriman'
        )
      ),
      React.createElement('div', { className: 'chart-card__body chart-card__empty' },
        React.createElement('i', { 'data-lucide': 'pie-chart' }),
        React.createElement('p', { className: 'chart-card__empty-text' }, 'Tidak ada data')
      )
    );
  }
  
  return React.createElement('div', { className: 'chart-card' },
    React.createElement('div', { className: 'chart-card__header' },
      React.createElement('h3', { className: 'chart-card__title' },
        React.createElement('i', { 'data-lucide': 'pie-chart' }),
        'Status Pengiriman'
      )
    ),
    React.createElement('div', { className: 'chart-card__body' },
      React.createElement(Recharts.PieChart, { width: '100%', height: 250 },
        React.createElement(Recharts.Pie, { 
          data: statusData, 
          dataKey: 'count', 
          nameKey: 'status', 
          cx: '50%', 
          cy: '50%', 
          outerRadius: 80,
          label: ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`
        },
          statusData.map((entry, index) => 
            React.createElement(Recharts.Cell, { key: `cell-${index}`, fill: COLORS[entry.status] || '#64748b' })
          )
        ),
        React.createElement(Recharts.Tooltip, { 
          contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' },
          labelStyle: { color: '#e2e8f0' }
        }),
        React.createElement(Recharts.Legend, { wrapperStyle: { fontSize: '12px' } })
      )
    )
  );
}

// 8. Monitoring Table
function MonitoringTable({ data }) {
  const columns = useMemo(() => [
    { Header: 'No', accessor: 'no', width: 50 },
    { Header: 'Tanggal', accessor: 'tanggal', Cell: ({ value }) => formatDate(value), width: 100 },
    { Header: 'No. Surat Jalan', accessor: 'no_surat_jalan', width: 130 },
    { Header: 'Outlet', accessor: 'nama_outlet', width: 150 },
    { Header: 'Ekspedisi', accessor: 'ekspedisi', width: 100 },
    { Header: 'No. Resi', accessor: 'no_resi', width: 130 },
    { Header: 'Produk', accessor: 'nama_produk', width: 150 },
    { Header: 'Qty', accessor: 'qty', Cell: ({ value }) => formatNumber(value), width: 80 },
    { Header: 'Harga OTR', accessor: 'harga_otr', Cell: ({ value }) => formatCurrency(value), width: 120 },
    { Header: 'Total OTR', accessor: 'total_otr', Cell: ({ value }) => formatCurrency(value), width: 130 },
    { 
      Header: 'Status', 
      accessor: 'status',
      width: 100,
      Cell: ({ value }) => {
        const statusClass = value === 'Terkirim' ? 'status--success' : value === 'Proses' ? 'status--warning' : 'status--danger';
        return React.createElement('span', { className: `status-badge ${statusClass}` }, value);
      }
    }
  ], []);
  
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    page,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize }
  } = useTable(
    { columns, data, initialState: { pageIndex: 0, pageSize: 10 } },
    usePagination
  );
  
  return React.createElement('div', { className: 'table-card distribution-table' },
    React.createElement('div', { className: 'table-card__header' },
      React.createElement('h3', { className: 'table-card__title' },
        React.createElement('i', { 'data-lucide': 'table' }),
        'Monitoring Pengiriman'
      ),
      React.createElement('span', { className: 'table-card__count' }, `${data.length} data`)
    ),
    React.createElement('div', { className: 'table-card__body' },
      React.createElement('div', { className: 'table-responsive' },
        React.createElement('table', { ...getTableProps(), className: 'data-table' },
          React.createElement('thead', null,
            headerGroups.map(headerGroup => 
              React.createElement('tr', { ...headerGroup.getHeaderGroupProps(), key: headerGroup.id },
                headerGroup.headers.map(column => 
                  React.createElement('th', { ...column.getHeaderProps(), key: column.id, style: { width: column.width } },
                    column.render('Header')
                  )
                )
              )
            )
          ),
          React.createElement('tbody', { ...getTableBodyProps() },
            page.map(row => {
              prepareRow(row);
              return React.createElement('tr', { ...row.getRowProps(), key: row.id },
                row.cells.map(cell => 
                  React.createElement('td', { ...cell.getCellProps(), key: cell.column.id },
                    cell.render('Cell')
                  )
                )
              );
            })
          )
        )
      )
    ),
    React.createElement('div', { className: 'table-pagination' },
      React.createElement('div', { className: 'table-pagination__info' },
        `Showing ${pageIndex * pageSize + 1} to ${Math.min((pageIndex + 1) * pageSize, data.length)} of ${data.length} entries`
      ),
      React.createElement('div', { className: 'table-pagination__controls' },
        React.createElement('select', { 
          value: pageSize, 
          onChange: e => setPageSize(Number(e.target.value)), 
          className: 'table-pagination__select'
        },
          [10, 25, 50, 100].map(size => 
            React.createElement('option', { key: size, value: size }, `${size} per page`)
          )
        ),
        React.createElement('button', { 
          onClick: () => gotoPage(0), 
          disabled: !canPreviousPage,
          className: 'pagination-btn'
        }, '«'),
        React.createElement('button', { 
          onClick: () => previousPage(), 
          disabled: !canPreviousPage,
          className: 'pagination-btn'
        }, '‹'),
        React.createElement('span', { className: 'pagination-info' },
          `Page ${pageIndex + 1} of ${pageOptions.length}`
        ),
        React.createElement('button', { 
          onClick: () => nextPage(), 
          disabled: !canNextPage,
          className: 'pagination-btn'
        }, '›'),
        React.createElement('button', { 
          onClick: () => gotoPage(pageCount - 1), 
          disabled: !canNextPage,
          className: 'pagination-btn'
        }, '»')
      )
    )
  );
}

// 9. Main Dashboard Component
function DistributionDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  useEffect(() => {
    // Update datetime
    const updateDateTime = () => {
      const now = new Date();
      const dateEl = document.getElementById('distDate');
      const timeEl = document.getElementById('distTime');
      if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID');
    };
    
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    
    // Load initial data
    loadData();
    
    // Initialize Lucide icons
    if (window.lucide) lucide.createIcons();
    
    return () => clearInterval(interval);
  }, []);
  
  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      // Use ShipmentService with caching
      const result = await ShipmentService.fetchShipmentData(forceRefresh);
      
      if (result.success) {
        setData(result.data || []);
        setFromCache(result.fromCache || false);
        setLastUpdated(new Date().toLocaleTimeString('id-ID'));
        updateCacheStatus();
      } else {
        setError(result.error || 'Gagal memuat data');
        // Fallback to sample data
        setData(SAMPLE_DATA);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
      // Fallback to sample data
      setData(SAMPLE_DATA);
    } finally {
      setLoading(false);
      if (window.lucide) setTimeout(() => lucide.createIcons(), 100);
    }
  }, []);
  
  // Update cache status display
  const updateCacheStatus = useCallback(() => {
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
  }, []);
  
  // Start cache timer
  useEffect(() => {
    const timer = setInterval(updateCacheStatus, 1000);
    return () => clearInterval(timer);
  }, [updateCacheStatus]);
  
  window.DistributionDashboard = {
    refreshData: () => loadData(true), // Force refresh to bypass cache
    getCacheStatus: () => ShipmentService.getCacheStatus(),
    exportExcel: () => {
      if (data.length === 0) {
        if (window.showToast) showToast('Tidak ada data untuk di-export', 'error');
        return;
      }
      
      // Create CSV content
      const headers = ['No', 'Tanggal', 'No. Surat Jalan', 'Kode Outlet', 'Nama Outlet', 'Ekspedisi', 'No. Resi', 'Nama Produk', 'Qty', 'Harga OTR', 'Total OTR', 'Status'];
      const rows = data.map(item => [
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
  };
  
  // Show/hide loading overlay
  useEffect(() => {
    const overlay = document.getElementById('distributionLoadingOverlay');
    if (overlay) {
      overlay.style.display = loading ? 'flex' : 'none';
    }
  }, [loading]);
  
  if (error) {
    return React.createElement('div', { className: 'distribution-error' },
      React.createElement('div', { className: 'error-icon' },
        React.createElement('i', { 'data-lucide': 'alert-circle' })
      ),
      React.createElement('p', null, error),
      React.createElement('button', { className: 'btn btn--primary', onClick: loadData }, 'Coba Lagi')
    );
  }
  
  return React.createElement(React.Fragment, null,
    React.createElement(KPISection, { data }),
    React.createElement('div', { className: 'charts-grid' },
      React.createElement(ShipmentTrendChart, { data }),
      React.createElement(StatusPieChart, { data })
    ),
    React.createElement('div', { className: 'charts-grid' },
      React.createElement(ShipmentByOutletChart, { data }),
      React.createElement(ShipmentByEkspedisiChart, { data })
    ),
    React.createElement(OTRDashboard, { data }),
    React.createElement(MonitoringTable, { data })
  );
}

// ============================================
// INITIALIZATION
// ============================================

function initDistributionDashboard() {
  const root = document.getElementById('distribution-root');
  if (root) {
    ReactDOM.createRoot(root).render(React.createElement(DistributionDashboard));
    // Initialize Lucide icons after React renders
    setTimeout(() => {
      if (window.lucide) lucide.createIcons();
    }, 100);
  }
}

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', initDistributionDashboard);
window.addEventListener('pageInit', (e) => {
  if (e.detail.page === 'distribution') {
    initDistributionDashboard();
  }
});
