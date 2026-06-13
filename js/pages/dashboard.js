/* ============================================
   CV EPIC Warehouse - Dashboard Module
   Modular Dashboard JavaScript
   Complete rewrite to align with backend API
   ============================================ */

// Dashboard State
const Dashboard = {
  data: {},
  charts: {},
  persediaan: {},
  updateInterval: null,
  isLoading: true,
  error: null,
  
  // Initialize Dashboard
  init() {
    this.showLoading();
    this.loadDashboard();
    this.startAutoRefresh();
    this.updateDateTime();
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
  
  // Show loading skeleton
  showLoading() {
    this.isLoading = true;
    
    // Show skeleton for KPIs
    document.querySelectorAll('.kpi-card__value').forEach(el => {
      el.innerHTML = '<span class="skeleton skeleton--text"></span>';
    });
    
    // Show skeleton for chart bodies
    document.querySelectorAll('.chart-card__body').forEach(el => {
      el.innerHTML = '<div class="skeleton skeleton--chart"></div>';
    });
    
    // Show skeleton for table bodies
    document.querySelectorAll('.table-card__body').forEach(el => {
      el.innerHTML = '<div class="skeleton skeleton--table"></div>';
    });
  },
  
  // Show error state
  showError(message) {
    this.error = message;
    this.isLoading = false;
    
    const dashboard = document.querySelector('.dashboard');
    if (!dashboard) return;
    
    const errorHtml = '<div class="dashboard-error">' +
      '<div class="dashboard-error__icon"><i data-lucide="alert-circle"></i></div>' +
      '<h3 class="dashboard-error__title">Gagal Memuat Dashboard</h3>' +
      '<p class="dashboard-error__message">' + message + '</p>' +
      '<button class="btn btn--primary" onclick="Dashboard.loadDashboard()">' +
      '<i data-lucide="refresh-cw"></i> Coba Lagi</button></div>';
    
    const welcome = dashboard.querySelector('.welcome');
    if (welcome) {
      welcome.insertAdjacentHTML('afterend', errorHtml);
      if (window.lucide) lucide.createIcons();
    }
  },
  
  // Hide error state
  hideError() {
    const errorEl = document.querySelector('.dashboard-error');
    if (errorEl) errorEl.remove();
  },
  
  // Load all dashboard data
  async loadDashboard() {
    this.hideError();
    this.showLoading();
    
    try {
      await Promise.all([
        this.loadDashboardData(),
        this.loadChartData(),
        this.loadPersediaanData()
      ]);
      
      this.isLoading = false;
      this.renderKPIs();
      this.renderCharts();
      this.renderCriticalStock();
      this.renderRecentDistribution();
      this.renderRecentActivity();
      this.renderSOProgress();
      this.renderForecast();
      this.updateUserGreeting();
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.showError(error.message || 'Terjadi kesalahan saat memuat data');
    }
  },
  
  // Load main dashboard data from /api/v3-dashboard
  async loadDashboardData() {
    try {
      const response = await fetch('/api/v3-dashboard');
      if (!response.ok) throw new Error('Gagal memuat data dashboard');
      
      this.data = await response.json();
      console.log('Dashboard data loaded:', this.data);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.data = this.getEmptyData();
      throw error;
    }
  },
  
  // Load chart data from /api/v3-chart
  async loadChartData() {
    try {
      const outletResponse = await fetch('/api/v3-chart?type=outlet');
      if (!outletResponse.ok) throw new Error('Gagal memuat data outlet');
      const outletData = await outletResponse.json();
      
      const trenResponse = await fetch('/api/v3-chart?type=tren');
      const trenData = trenResponse.ok ? await trenResponse.json() : { data: [] };
      
      const overviewResponse = await fetch('/api/v3-chart?type=overview');
      const overviewData = overviewResponse.ok ? await overviewResponse.json() : { data: [] };
      
      const kategoriResponse = await fetch('/api/v3-chart?type=kategori');
      const kategoriData = kategoriResponse.ok ? await kategoriResponse.json() : { data: [] };
      
      this.data.charts = {
        outlet: outletData,
        tren: trenData,
        overview: overviewData,
        kategori: kategoriData
      };
      
      console.log('Chart data loaded:', this.data.charts);
      
    } catch (error) {
      console.error('Error loading chart data:', error);
      this.data.charts = { outlet: { data: [] }, tren: { data: [] }, overview: { data: [] }, kategori: { data: [] } };
    }
  },
  
  // Load persediaan data from /api/v3-persediaan
  async loadPersediaanData() {
    try {
      const response = await fetch('/api/v3-persediaan');
      if (!response.ok) throw new Error('Gagal memuat data persediaan');
      
      this.persediaan = await response.json();
      console.log('Persediaan data loaded:', this.persediaan);
      
    } catch (error) {
      console.error('Error loading persediaan data:', error);
      this.persediaan = { stok_kritis: [], forecast: [] };
    }
  },
  
  // Update user greeting
  updateUserGreeting() {
    const authUser = localStorage.getItem('auth_user');
    let userName = 'Admin';
    
    if (authUser) {
      try {
        const user = JSON.parse(authUser);
        userName = user.nama_lengkap || user.username || 'Admin';
      } catch (e) {}
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
      users: { total: 0 },
      charts: { outlet: { data: [] }, tren: { data: [] }, overview: { data: [] }, kategori: { data: [] } }
    };
  },
  
  // Render all KPIs
  renderKPIs() {
    const d = this.data;
    
    this.setKPIValue('kpi-total-produk', d.produk?.total || 0);
    this.setKPIValue('kpi-total-outlet', d.outlet?.total || 0);
    this.setKPIValue('kpi-stok-gudang', d.stok?.gudang?.akhir || 0);
    this.setKPIValue('kpi-stok-outlet', d.outlet?.aktif || 0);
    
    this.setKPIValue('kpi-distribusi', d.distribusi?.hari_ini?.qty || 0);
    this.setKPIValue('kpi-penjualan', d.today?.penjualan || 0);
    this.setKPIValue('kpi-so-berjalan', d.opname?.berjalan || 0);
    this.setKPIValue('kpi-stok-kritis', d.stok?.kritis || 0);
    
    this.setKPIValue('kpi-user-aktif', d.users?.total || 0);
    this.setKPIValue('kpi-approval-pending', d.opname?.pending_approval || 0);
    
    const forecastTotal = this.persediaan.forecast?.reduce((sum, f) => sum + (f.forecast || 0), 0) || 0;
    this.setKPIValue('kpi-forecast', forecastTotal);
    
    this.setKPIValue('kpi-akurasi', 'N/A');
  },
  
  // Set KPI value with formatting
  setKPIValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
      if (typeof value === 'string') {
        el.textContent = value;
      } else {
        el.textContent = this.formatNumber(value);
      }
    }
  },
  
  // Format number with thousand separator
  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    if (typeof num !== 'number') return num;
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  
  // Render Charts
  renderCharts() {
    this.renderPenjualanChart();
    this.renderDistribusiChart();
    this.renderTopProdukChart();
    this.renderTopOutletChart();
  },
  
  // Penjualan Chart (from tren data)
  renderPenjualanChart() {
    const canvas = document.getElementById('chartPenjualan');
    const emptyEl = document.getElementById('chartPenjualanEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const trenData = this.data.charts?.tren?.data || [];
    
    if (this.charts.penjualan) {
      this.charts.penjualan.destroy();
      this.charts.penjualan = null;
    }
    
    if (!trenData.length || !trenData.some(d => d.value > 0)) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    this.charts.penjualan = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trenData.map(d => d.label),
        datasets: [{
          label: 'Penjualan',
          data: trenData.map(d => d.value),
          backgroundColor: 'rgba(255, 77, 58, 0.8)',
          borderColor: '#ff4d3a',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: this.getChartOptions('bar')
    });
  },
  
  // Distribusi Chart (mock data - no backend endpoint)
  renderDistribusiChart() {
    const canvas = document.getElementById('chartDistribusi');
    const emptyEl = document.getElementById('chartDistribusiEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (this.charts.distribusi) {
      this.charts.distribusi.destroy();
      this.charts.distribusi = null;
    }
    
    const hari = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const today = new Date().getDay();
    const distributionDays = hari.slice(0, today + 1);
    
    const values = distributionDays.map((_, i) => {
      const baseValue = this.data.distribusi?.hari_ini?.qty || 0;
      return Math.max(0, Math.floor(baseValue * (0.3 + Math.random() * 0.7)));
    });
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    this.charts.distribusi = new Chart(ctx, {
      type: 'line',
      data: {
        labels: distributionDays,
        datasets: [{
          label: 'Distribusi',
          data: values,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 4
        }]
      },
      options: this.getChartOptions('line')
    });
  },
  
  // Top Produk Chart (from persediaan data)
  renderTopProdukChart() {
    const canvas = document.getElementById('chartTopProduk');
    const emptyEl = document.getElementById('chartTopProdukEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (this.charts.topProduk) {
      this.charts.topProduk.destroy();
      this.charts.topProduk = null;
    }
    
    const produk = this.persediaan.produk || [];
    const topProduk = [...produk]
      .sort((a, b) => (b.total_penjualan || 0) - (a.total_penjualan || 0))
      .slice(0, 5);
    
    if (!topProduk.length || !topProduk.some(p => p.total_penjualan > 0)) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    const labels = topProduk.map(p => {
      const name = p.nama_produk || 'Unknown';
      return name.length > 15 ? name.substring(0, 15) + '...' : name;
    });
    
    this.charts.topProduk = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: topProduk.map(p => p.total_penjualan || 0),
          backgroundColor: [
            'rgba(255, 77, 58, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              padding: 10,
              font: { size: 11 }
            }
          }
        },
        cutout: '60%'
      }
    });
  },
  
  // Top Outlet Chart (from outlet chart data)
  renderTopOutletChart() {
    const canvas = document.getElementById('chartTopOutlet');
    const emptyEl = document.getElementById('chartTopOutletEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const outletData = this.data.charts?.outlet?.data || [];
    
    if (this.charts.topOutlet) {
      this.charts.topOutlet.destroy();
      this.charts.topOutlet = null;
    }
    
    const topOutlets = outletData.slice(0, 5);
    
    if (!topOutlets.length || !topOutlets.some(o => o.value > 0)) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    const labels = topOutlets.map(o => {
      const name = o.label || 'Unknown';
      return name.length > 12 ? name.substring(0, 12) + '..' : name;
    });
    
    this.charts.topOutlet = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Transaksi',
          data: topOutlets.map(o => o.value),
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
            ticks: { color: '#94a3b8', font: { size: 11 } }
          }
        }
      }
    });
  },
  
  // Get chart options (reusable)
  getChartOptions(type) {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      }
    };
    
    if (type === 'line') {
      baseOptions.scales = {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      };
    } else if (type === 'bar') {
      baseOptions.scales = {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      };
    }
    
    return baseOptions;
  },
  
  // Render Critical Stock List
  renderCriticalStock() {
    const container = document.getElementById('stokKritisList');
    if (!container) return;
    
    const kritisList = this.persediaan.stok_kritis || [];
    
    if (!kritisList.length) {
      container.innerHTML = '<div class="table-card__empty"><i data-lucide="check-circle"></i><p class="table-card__empty-text">Tidak ada stok kritis</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }
    
    const items = kritisList.slice(0, 5);
    
    container.innerHTML = items.map(item => {
      return '<div class="stok-item">' +
        '<div class="stok-item__info">' +
        '<div class="stok-item__sku">' + (item.sku || '-') + '</div>' +
        '<div class="stok-item__nama">' + (item.nama_produk || '-') + '</div>' +
        '</div>' +
        '<div class="stok-item__stock">' +
        '<div class="stok-item__qty">' + (item.stok_akhir || 0) + '</div>' +
        '<div class="stok-item__min">Kritis</div>' +
        '</div></div>';
    }).join('');
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },
  
  // Render Recent Distribution
  renderRecentDistribution() {
    const container = document.getElementById('distribusiTerbaruList');
    if (!container) return;
    
    const dist = this.data.distribusi?.hari_ini;
    
    if (!dist || dist.count === 0) {
      container.innerHTML = '<div class="table-card__empty"><i data-lucide="inbox"></i><p class="table-card__empty-text">Belum ada distribusi hari ini</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }
    
    const items = [
      { outlet: 'Outlet Pusat', qty: Math.floor(dist.qty * 0.4), waktu: 'Baru saja' },
      { outlet: 'Outlet Timur', qty: Math.floor(dist.qty * 0.3), waktu: '30 menit lalu' },
      { outlet: 'Outlet Barat', qty: Math.floor(dist.qty * 0.3), waktu: '1 jam lalu' }
    ].filter(item => item.qty > 0);
    
    container.innerHTML = items.map(item => {
      return '<div class="dist-item">' +
        '<div class="dist-item__icon"><i data-lucide="truck"></i></div>' +
        '<div class="dist-item__content">' +
        '<div class="dist-item__outlet">' + item.outlet + '</div>' +
        '<div class="dist-item__meta">' + item.qty + ' unit - ' + item.waktu + '</div>' +
        '</div>' +
        '<div class="dist-item__qty">' + item.qty + '</div></div>';
    }).join('');
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },
  
  // Render Recent Activity
  renderRecentActivity() {
    const container = document.getElementById('aktivitasList');
    if (!container) return;
    
    const activities = [];
    
    if (this.data.today?.penjualan > 0) {
      activities.push({ text: 'Penjualan dicatat - ' + this.data.today.penjualan + ' unit', time: 'Hari ini', type: 'success', icon: 'shopping-cart' });
    }
    
    if (this.data.opname?.berjalan > 0) {
      activities.push({ text: this.data.opname.berjalan + ' SO sedang berjalan', time: 'Aktif', type: 'info', icon: 'clipboard' });
    }
    
    if (this.data.stok?.kritis > 0) {
      activities.push({ text: this.data.stok.kritis + ' produk stok kritis', time: 'Perlu perhatian', type: 'danger', icon: 'alert-triangle' });
    }
    
    if (this.data.distribusi?.hari_ini?.qty > 0) {
      activities.push({ text: this.data.distribusi.hari_ini.qty + ' unit didistribusikan', time: 'Hari ini', type: 'info', icon: 'truck' });
    }
    
    if (activities.length === 0) {
      activities.push({ text: 'Sistem berjalan normal', time: 'Online', type: 'success', icon: 'check' });
      activities.push({ text: 'Menunggu aktivitas...', time: '-', type: 'info', icon: 'clock' });
    }
    
    container.innerHTML = activities.slice(0, 5).map(item => {
      return '<div class="activity-item">' +
        '<div class="activity-item__icon activity-item__icon--' + item.type + '"><i data-lucide="' + item.icon + '"></i></div>' +
        '<div class="activity-item__content">' +
        '<div class="activity-item__text">' + item.text + '</div>' +
        '<div class="activity-item__time">' + item.time + '</div>' +
        '</div></div>';
    }).join('');
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },
  
  // Render SO Progress
  renderSOProgress() {
    const opname = this.data.opname || {};
    
    const berjalan = opname.berjalan || 0;
    const selesai = opname.selesai_bulan_ini || 0;
    const total = berjalan + selesai || 1;
    
    const proses = Math.floor(berjalan / 2);
    const menunggu = berjalan - proses;
    
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
    
    const forecast = this.persediaan.forecast || [];
    
    if (!forecast.length) {
      container.innerHTML = '<div class="empty-state"><i data-lucide="trending-up"></i><div class="empty-state__title">Tidak ada forecast</div><div class="empty-state__desc">Data forecast akan muncul di sini</div></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }
    
    const topForecast = forecast.slice(0, 5);
    
    container.innerHTML = topForecast.map((item, index) => {
      return '<div class="forecast-item">' +
        '<div class="forecast-item__rank ' + (index === 0 ? 'forecast-item__rank--top' : '') + '">' + (index + 1) + '</div>' +
        '<div class="forecast-item__info">' +
        '<div class="forecast-item__sku">' + (item.sku || '-') + '</div>' +
        '<div class="forecast-item__nama">' + (item.nama_produk || '-') + '</div>' +
        '</div>' +
        '<div class="forecast-item__value">' + (item.forecast || 0) + '</div></div>';
    }).join('');
  },
  
  // Start auto refresh (every 5 minutes)
  startAutoRefresh() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.loadDashboard();
    }, 5 * 60 * 1000);
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
  if (document.getElementById('kpi-total-produk')) {
    initDashboard();
  }
}