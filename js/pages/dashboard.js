/* ============================================
   CV EPIC Warehouse - Dashboard Module
   Modular Dashboard JavaScript
   ============================================ */

// Dashboard State
const Dashboard = {
  data: {},
  charts: {},
  updateInterval: null,
  
  // Initialize Dashboard
  init() {
    this.loadDashboard();
    this.startAutoRefresh();
    this.updateDateTime();
    
    // Update time every second
    setInterval(() => this.updateDateTime(), 1000);
    
    console.log('Dashboard initialized');
  },
  
  // Update Date/Time Display
  updateDateTime() {
    const now = new Date();
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    
    const dateEl = document.getElementById('currentDate');
    const timeEl = document.getElementById('currentTime');
    
    if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', dateOptions);
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID', timeOptions);
  },
  
  // Load all dashboard data
  async loadDashboard() {
    try {
      await Promise.all([
        this.loadDashboardData(),
        this.loadChartData()
      ]);
      
      this.renderKPIs();
      this.renderCharts();
      this.renderCriticalStock();
      this.renderRecentDistribution();
      this.renderRecentActivity();
      this.renderSOProgress();
      this.renderForecast();
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  },
  
  // Load main dashboard data from /api/v3-dashboard
  async loadDashboardData() {
    try {
      const response = await fetch('/api/v3-dashboard');
      if (!response.ok) throw new Error('Failed to load dashboard data');
      
      this.data = await response.json();
      this.updateUserGreeting();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.data = this.getEmptyData();
    }
  },
  
  // Load chart data from /api/v3-chart
  async loadChartData() {
    try {
      const response = await fetch('/api/v3-chart');
      if (!response.ok) throw new Error('Failed to load chart data');
      
      this.data.charts = await response.json();
      
    } catch (error) {
      console.error('Error loading chart data:', error);
      this.data.charts = null;
    }
  },
  
  // Update user greeting
  updateUserGreeting() {
    const authUser = localStorage.getItem('auth_user');
    let userName = 'Admin';
    
    if (authUser) {
      const user = JSON.parse(authUser);
      userName = user.nama_lengkap || user.username || 'Admin';
    }
    
    const titleEl = document.getElementById('welcomeTitle');
    if (titleEl) {
      titleEl.textContent = 'Selamat Datang, ' + userName;
    }
  },
  
  // Get empty data structure
  getEmptyData() {
    return {
      today: { penjualan: 0, customer_count: 0, pembelian: 0 },
      produk: { aktif: 0, total: 0 },
      outlet: { aktif: 0, total: 0 },
      stok: { kritis: 0, gudang: { awal: 0, pembelian: 0, penjualan: 0, penyesuaian: 0, akhir: 0 } },
      distribusi: { hari_ini: { count: 0, qty: 0, outlet_count: 0 } },
      opname: { berjalan: 0, selesai_bulan_ini: 0, pending_approval: 0 },
      users: { total: 0 }
    };
  },
  
  // Render all KPIs
  renderKPIs() {
    const d = this.data;
    
    // Row 1
    this.setKPIValue('kpi-total-produk', d.produk?.total || 0);
    this.setKPIValue('kpi-total-outlet', d.outlet?.total || 0);
    this.setKPIValue('kpi-stok-gudang', d.stok?.gudang?.akhir || 0);
    this.setKPIValue('kpi-stok-outlet', d.outlet?.aktif || 0);
    
    // Row 2
    this.setKPIValue('kpi-distribusi', d.distribusi?.hari_ini?.qty || 0);
    this.setKPIValue('kpi-penjualan', d.today?.penjualan || 0);
    this.setKPIValue('kpi-so-berjalan', d.opname?.berjalan || 0);
    this.setKPIValue('kpi-stok-kritis', d.stok?.kritis || 0);
    
    // Row 3
    this.setKPIValue('kpi-user-aktif', d.users?.total || 0);
    this.setKPIValue('kpi-approval-pending', d.opname?.pending_approval || 0);
    this.setKPIValue('kpi-forecast', d.produk?.aktif || 0);
    this.setKPIValue('kpi-akurasi', this.calculateAkurasi());
  },
  
  // Set KPI value with formatting
  setKPIValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = this.formatNumber(value);
    }
  },
  
  // Format number with thousand separator
  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  
  // Calculate stock accuracy (placeholder)
  calculateAkurasi() {
    // Placeholder - would need actual calculation
    return '95%';
  },
  
  // Render Charts
  renderCharts() {
    this.renderPenjualanChart();
    this.renderDistribusiChart();
    this.renderTopProdukChart();
    this.renderTopOutletChart();
  },
  
  // Penjualan Chart
  renderPenjualanChart() {
    const canvas = document.getElementById('chartPenjualan');
    const emptyEl = document.getElementById('chartPenjualanEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const chartData = this.data.charts || {};
    
    // Destroy existing chart
    if (this.charts.penjualan) {
      this.charts.penjualan.destroy();
    }
    
    // Check if we have data
    if (!chartData.data || chartData.data.length === 0 || !chartData.data[0]?.value) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    // Create chart
    this.charts.penjualan = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.data.map(d => d.label),
        datasets: [{
          label: 'Penjualan',
          data: chartData.data.map(d => d.value),
          backgroundColor: 'rgba(255, 77, 58, 0.8)',
          borderColor: '#ff4d3a',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  },
  
  // Distribusi Chart
  renderDistribusiChart() {
    const canvas = document.getElementById('chartDistribusi');
    const emptyEl = document.getElementById('chartDistribusiEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (this.charts.distribusi) {
      this.charts.distribusi.destroy();
    }
    
    // Sample distribution data
    const labels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const values = [45, 62, 38, 75, 52, 28, 41];
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    this.charts.distribusi = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Distribusi',
          data: values,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  },
  
  // Top Produk Chart
  renderTopProdukChart() {
    const canvas = document.getElementById('chartTopProduk');
    const emptyEl = document.getElementById('chartTopProdukEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (this.charts.topProduk) {
      this.charts.topProduk.destroy();
    }
    
    const labels = ['SKU001', 'SKU002', 'SKU003', 'SKU004', 'SKU005'];
    const values = [120, 95, 78, 65, 52];
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    this.charts.topProduk = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: [
            '#ff4d3a',
            '#3b82f6',
            '#10b981',
            '#f59e0b',
            '#8b5cf6'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', padding: 12 }
          }
        }
      }
    });
  },
  
  // Top Outlet Chart
  renderTopOutletChart() {
    const canvas = document.getElementById('chartTopOutlet');
    const emptyEl = document.getElementById('chartTopOutletEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (this.charts.topOutlet) {
      this.charts.topOutlet.destroy();
    }
    
    const labels = ['Outlet A', 'Outlet B', 'Outlet C', 'Outlet D', 'Outlet E'];
    const values = [85, 72, 58, 45, 38];
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    this.charts.topOutlet = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Transaksi',
          data: values,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  },
  
  // Render Critical Stock List
  renderCriticalStock() {
    const container = document.getElementById('stokKritisList');
    if (!container) return;
    
    const kritis = this.data.stok?.kritis || 0;
    
    if (kritis === 0) {
      container.innerHTML = '<div class="table-card__empty"><i data-lucide="check-circle"></i><p class="table-card__empty-text">Tidak ada stok kritis</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }
    
    // Generate sample items for demo
    const items = [
      { sku: 'SKU001', nama: 'Produk A', stok: 5, min: 10 },
      { sku: 'SKU002', nama: 'Produk B', stok: 3, min: 10 },
      { sku: 'SKU003', nama: 'Produk C', stok: 8, min: 15 }
    ];
    
    container.innerHTML = items.map(item => '
      <div class="stok-item">
        <div class="stok-item__info">
          <div class="stok-item__sku">' + item.sku + '</div>
          <div class="stok-item__nama">' + item.nama + '</div>
        </div>
        <div class="stok-item__stock">
          <div class="stok-item__qty">' + item.stok + '</div>
          <div class="stok-item__min">Min: ' + item.min + '</div>
        </div>
        <div class="stok-item__status">
          <span class="badge badge--danger">Kritis</span>
        </div>
      </div>
    ').join('');
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },
  
  // Render Recent Distribution
  renderRecentDistribution() {
    const container = document.getElementById('distribusiTerbaruList');
    if (!container) return;
    
    const dist = this.data.distribusi?.recent || [];
    
    if (dist.length === 0) {
      container.innerHTML = '<div class="table-card__empty"><i data-lucide="inbox"></i><p class="table-card__empty-text">Belum ada distribusi</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }
    
    container.innerHTML = dist.map(item => '
      <div class="dist-item">
        <div class="dist-item__icon"><i data-lucide="truck"></i></div>
        <div class="dist-item__content">
          <div class="dist-item__outlet">' + (item.outlet || 'Outlet') + '</div>
          <div class="dist-item__meta">' + (item.qty || 0) + ' unit - ' + (item.waktu || 'Baru') + '</div>
        </div>
        <div class="dist-item__qty">' + (item.qty || 0) + '</div>
      </div>
    ').join('');
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },
  
  // Render Recent Activity
  renderRecentActivity() {
    const container = document.getElementById('aktivitasList');
    if (!container) return;
    
    const activities = this.data.aktivitas || [];
    
    if (activities.length === 0) {
      // Show sample activities
      const samples = [
        { text: 'Penjualan dicatat - 15 unit', time: '10 menit lalu', type: 'success' },
        { text: 'Stok opname dimulai', time: '30 menit lalu', type: 'info' },
        { text: 'Produk baru ditambahkan', time: '1 jam lalu', type: 'info' }
      ];
      
      container.innerHTML = samples.map(item => '
        <div class="activity-item">
          <div class="activity-item__icon activity-item__icon--' + item.type + '"><i data-lucide="check"></i></div>
          <div class="activity-item__content">
            <div class="activity-item__text">' + item.text + '</div>
            <div class="activity-item__time">' + item.time + '</div>
          </div>
        </div>
      ').join('');
    } else {
      container.innerHTML = activities.map(item => '
        <div class="activity-item">
          <div class="activity-item__icon activity-item__icon--' + (item.type || 'info') + '"><i data-lucide="' + (item.icon || 'activity') + '"></i></div>
          <div class="activity-item__content">
            <div class="activity-item__text">' + (item.text || '') + '</div>
            <div class="activity-item__time">' + (item.waktu || '') + '</div>
          </div>
        </div>
      ').join('');
    }
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },
  
  // Render SO Progress
  renderSOProgress() {
    const opname = this.data.opname || {};
    
    const menunggu = opname.berjalan || 0;
    const proses = Math.floor(menunggu / 2);
    const selesai = opname.selesai_bulan_ini || 0;
    const total = menunggu + proses + selesai || 1;
    
    this.setKPIValue('so-menunggu', menunggu);
    this.setKPIValue('so-proses', proses);
    this.setKPIValue('so-selesai', selesai);
    
    const menungguBar = document.getElementById('so-menunggu-bar');
    const prosesBar = document.getElementById('so-proses-bar');
    const selesaiBar = document.getElementById('so-selesai-bar');
    
    if (menungguBar) menungguBar.style.width = (menunggu / total * 100) + '%';
    if (prosesBar) prosesBar.style.width = (proses / total * 100) + '%';
    if (selesaiBar) selesaiBar.style.width = (selesai / total * 100) + '%';
  },
  
  // Render Forecast
  renderForecast() {
    const container = document.getElementById('forecastList');
    if (!container) return;
    
    // Sample forecast data
    const forecast = [
      { sku: 'SKU001', nama: 'Produk A', value: 150 },
      { sku: 'SKU002', nama: 'Produk B', value: 120 },
      { sku: 'SKU003', nama: 'Produk C', value: 95 },
      { sku: 'SKU004', nama: 'Produk D', value: 78 },
      { sku: 'SKU005', nama: 'Produk E', value: 65 }
    ];
    
    container.innerHTML = forecast.map((item, index) => '
      <div class="forecast-item">
        <div class="forecast-item__rank ' + (index === 0 ? 'forecast-item__rank--top' : '') + '">' + (index + 1) + '</div>
        <div class="forecast-item__info">
          <div class="forecast-item__sku">' + item.sku + '</div>
          <div class="forecast-item__nama">' + item.nama + '</div>
        </div>
        <div class="forecast-item__value">' + item.value + '</div>
      </div>
    ').join('');
  },
  
  // Start auto refresh (every 5 minutes)
  startAutoRefresh() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.loadDashboard();
    }, 5 * 60 * 1000); // 5 minutes
  },
  
  // Stop auto refresh
  stopAutoRefresh() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  },
  
  // Cleanup on page unload
  destroy() {
    this.stopAutoRefresh();
    
    // Destroy charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    
    this.charts = {};
  }
};

// Global init function for AppRouter
function initDashboard() {
  Dashboard.init();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  // Check if dashboard elements exist (we're on dashboard page)
  if (document.getElementById('kpi-total-produk')) {
    initDashboard();
  }
}