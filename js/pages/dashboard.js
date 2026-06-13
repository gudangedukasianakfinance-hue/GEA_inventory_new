/* ============================================
   CV EPIC Warehouse - Dashboard Module
   Dashboard with Month/Year Filter Support
   ============================================ */

// Dashboard State
const Dashboard = {
  data: {},
  charts: {},
  persediaan: {},
  filter: {
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear()
  },
  updateInterval: null,
  isLoading: true,
  
  // Initialize Dashboard
  init() {
    this.initFilters();
    this.showLoading();
    this.loadDashboard();
    this.startAutoRefresh();
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
    console.log('Dashboard initialized');
  },
  
  // Initialize filter dropdowns
  initFilters() {
    const bulanSelect = document.getElementById('filterBulan');
    const tahunSelect = document.getElementById('filterTahun');
    
    if (bulanSelect) {
      bulanSelect.value = this.filter.bulan;
      bulanSelect.addEventListener('change', (e) => {
        this.filter.bulan = parseInt(e.target.value);
        this.loadDashboard();
      });
    }
    
    if (tahunSelect) {
      // Populate years (current year - 2 to current year + 1)
      const currentYear = new Date().getFullYear();
      for (let year = currentYear - 2; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        tahunSelect.appendChild(option);
      }
      tahunSelect.value = this.filter.tahun;
      tahunSelect.addEventListener('change', (e) => {
        this.filter.tahun = parseInt(e.target.value);
        this.loadDashboard();
      });
    }
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
  
  // Show loading skeleton (min 300ms)
  async showLoading() {
    this.isLoading = true;
    const startTime = Date.now();
    
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
    
    // Ensure minimum 300ms loading time
    const elapsed = Date.now() - startTime;
    if (elapsed < 300) {
      await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
    }
  },
  
  // Load all dashboard data
  async loadDashboard() {
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
      // Don't show error, just render with empty data
      this.data = this.getEmptyData();
      this.persediaan = { stok_kritis: [], forecast: [] };
      this.renderKPIs();
      this.renderCharts();
      this.renderCriticalStock();
      this.renderRecentDistribution();
      this.renderRecentActivity();
      this.renderSOProgress();
      this.renderForecast();
      this.isLoading = false;
    }
  },
  
  // Load main dashboard data from /api/v3-dashboard
  async loadDashboardData() {
    const { bulan, tahun } = this.filter;
    
    try {
      const response = await fetch(`/api/v3-dashboard?bulan=${bulan}&tahun=${tahun}`);
      if (!response.ok) {
        // If API fails, use empty data - don't throw
        this.data = this.getEmptyData();
        return;
      }
      
      const json = await response.json();
      if (json.error) {
        // API returned error, use empty data
        this.data = this.getEmptyData();
        return;
      }
      
      this.data = json;
      console.log('Dashboard data loaded:', this.data);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.data = this.getEmptyData();
    }
  },
  
  // Load chart data from /api/v3-chart
  async loadChartData() {
    const { bulan, tahun } = this.filter;
    
    try {
      const [outletRes, trenRes, levelRes, produkRes] = await Promise.all([
        fetch(`/api/v3-chart?type=outlet&bulan=${bulan}&tahun=${tahun}`).catch(() => null),
        fetch(`/api/v3-chart?type=tren&tahun=${tahun}`).catch(() => null),
        fetch(`/api/v3-chart?type=level&bulan=${bulan}&tahun=${tahun}`).catch(() => null),
        fetch(`/api/v3-chart?type=kategori&bulan=${bulan}&tahun=${tahun}`).catch(() => null)
      ]);
      
      this.data.charts = {
        outlet: outletRes?.ok ? await outletRes.json() : { data: [] },
        tren: trenRes?.ok ? await trenRes.json() : { data: [] },
        level: levelRes?.ok ? await levelRes.json() : { data: [] },
        kategori: produkRes?.ok ? await produkRes.json() : { data: [] }
      };
      
      console.log('Chart data loaded:', this.data.charts);
      
    } catch (error) {
      console.error('Error loading chart data:', error);
      this.data.charts = { outlet: { data: [] }, tren: { data: [] }, level: { data: [] }, kategori: { data: [] } };
    }
  },
  
  // Load persediaan data from /api/v3-persediaan
  async loadPersediaanData() {
    const { bulan, tahun } = this.filter;
    
    try {
      const response = await fetch(`/api/v3-persediaan?bulan=${bulan}&tahun=${tahun}`);
      if (!response.ok) {
        this.persediaan = { stok_kritis: [], forecast: [] };
        return;
      }
      
      const json = await response.json();
      if (json.error) {
        this.persediaan = { stok_kritis: [], forecast: [] };
        return;
      }
      
      this.persediaan = json;
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
      distribusi: { periode: { qty: 0, count: 0 } },
      opname: { berjalan: 0, selesai_bulan_ini: 0, pending_approval: 0 },
      users: { total: 0 },
      profit: 0,
      forecast: 0,
      siswa_aktif: 0,
      charts: { outlet: { data: [] }, tren: { data: [] }, level: { data: [] }, kategori: { data: [] } }
    };
  },
  
  // Render all KPIs
  renderKPIs() {
    const d = this.data;
    
    this.setKPIValue('kpi-total-produk', d.produk?.total || 0);
    this.setKPIValue('kpi-total-outlet', d.outlet?.total || 0);
    this.setKPIValue('kpi-stok-gudang', d.stok?.gudang?.akhir || 0);
    this.setKPIValue('kpi-stok-outlet', d.outlet?.aktif || 0);
    
    // KPIs following filter period
    this.setKPIValue('kpi-distribusi', d.distribusi?.periode?.qty || d.distribusi?.hari_ini?.qty || 0);
    this.setKPIValue('kpi-penjualan', d.periode?.penjualan || d.today?.penjualan || 0);
    this.setKPIValue('kpi-so-berjalan', d.opname?.berjalan || 0);
    this.setKPIValue('kpi-stok-kritis', d.stok?.kritis || 0);
    
    this.setKPIValue('kpi-user-aktif', d.users?.total || 0);
    this.setKPIValue('kpi-profit', d.profit || 0);
    
    // Forecast - sum of forecast data or use direct forecast KPI
    const forecastTotal = this.persediaan.forecast?.reduce((sum, f) => sum + (f.forecast || 0), 0) || d.forecast || 0;
    this.setKPIValue('kpi-forecast', forecastTotal);
    
    // Total Siswa Aktif (can be from outlet data or direct)
    this.setKPIValue('kpi-siswa-aktif', d.siswa_aktif || d.outlet?.siswa_aktif || 0);
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
    if (num === null || num === undefined || isNaN(num)) return '0';
    return num.toLocaleString('id-ID');
  },
  
  // Render all charts
  renderCharts() {
    this.renderPenjualanChart();
    this.renderModulLevelChart();
    this.renderTopProdukChart();
    this.renderTopOutletChart();
  },
  
  // Render Penjualan Bulanan Chart (yearly trend)
  renderPenjualanChart() {
    const canvas = document.getElementById('chartPenjualan');
    const emptyEl = document.getElementById('chartPenjualanEmpty');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const trenData = this.data.charts?.tren?.data || [];
    
    // Destroy existing chart
    if (this.charts.penjualan) {
      this.charts.penjualan.destroy();
    }
    
    if (!trenData || trenData.length === 0) {
      canvas.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    
    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    
    this.charts.penjualan = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trenData.map(d => d.label),
        datasets: [{
          label: 'Penjualan',
          data: trenData.map(d => d.value),
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderRadius: 6
        }]
      },
      options: this.getChartOptions('bar')
    });
  },
  
  // Render Modul Terjual Per Level Chart
  renderModulLevelChart() {
    const canvas = document.getElementById('chartModulLevel');
    const emptyEl = document.getElementById('chartModulLevelEmpty');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const levelData = this.data.charts?.level?.data || [];
    
    // Destroy existing chart
    if (this.charts.modulLevel) {
      this.charts.modulLevel.destroy();
    }
    
    if (!levelData || levelData.length === 0) {
      canvas.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    
    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    
    this.charts.modulLevel = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: levelData.map(d => d.label),
        datasets: [{
          label: 'Qty Terjual',
          data: levelData.map(d => d.value),
          backgroundColor: [
            'rgba(99, 102, 241, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(234, 179, 8, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(14, 165, 233, 0.8)'
          ],
          borderRadius: 6
        }]
      },
      options: this.getChartOptions('bar')
    });
  },
  
  // Render Top Produk Chart
  renderTopProdukChart() {
    const canvas = document.getElementById('chartTopProduk');
    const emptyEl = document.getElementById('chartTopProdukEmpty');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const kategoriData = this.data.charts?.kategori?.data || [];
    
    // Destroy existing chart
    if (this.charts.topProduk) {
      this.charts.topProduk.destroy();
    }
    
    if (!kategoriData || kategoriData.length === 0) {
      canvas.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    
    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    
    this.charts.topProduk = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: kategoriData.map(d => d.label),
        datasets: [{
          data: kategoriData.map(d => d.value),
          backgroundColor: [
            'rgba(99, 102, 241, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(234, 179, 8, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(168, 85, 247, 0.8)'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', padding: 10 }
          }
        }
      }
    });
  },
  
  // Render Top Outlet Chart
  renderTopOutletChart() {
    const canvas = document.getElementById('chartTopOutlet');
    const emptyEl = document.getElementById('chartTopOutletEmpty');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const outletData = this.data.charts?.outlet?.data || [];
    
    // Destroy existing chart
    if (this.charts.topOutlet) {
      this.charts.topOutlet.destroy();
    }
    
    if (!outletData || outletData.length === 0) {
      canvas.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    
    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    
    this.charts.topOutlet = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: outletData.map(d => d.label.substring(0, 15) + (d.label.length > 15 ? '...' : '')),
        datasets: [{
          label: 'Qty',
          data: outletData.map(d => d.value),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderRadius: 4
        }]
      },
      options: this.getChartOptions('bar')
    });
  },
  
  // Get common chart options
  getChartOptions(type) {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      }
    };
    
    if (type === 'bar') {
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
      container.innerHTML = '<div class="table-card__empty"><i data-lucide="check-circle"></i><p class="table-card__empty-text">Tidak ada data pada periode ini</p></div>';
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
    
    const dist = this.data.distribusi?.periode || this.data.distribusi?.hari_ini;
    
    if (!dist || dist.count === 0 || dist.qty === 0) {
      container.innerHTML = '<div class="table-card__empty"><i data-lucide="inbox"></i><p class="table-card__empty-text">Tidak ada data pada periode ini</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }
    
    container.innerHTML = '<div class="table-card__empty"><i data-lucide="send"></i><p class="table-card__empty-text">' + dist.qty + ' unit didistribusikan periode ini</p></div>';
    
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },
  
  // Render Recent Activity
  renderRecentActivity() {
    const container = document.getElementById('aktivitasList');
    if (!container) return;
    
    const activities = [];
    const d = this.data;
    
    if (d.periode?.penjualan > 0) {
      activities.push({ text: 'Penjualan dicatat - ' + d.periode.penjualan + ' unit', time: 'Periode ini', type: 'success', icon: 'shopping-cart' });
    } else if (d.today?.penjualan > 0) {
      activities.push({ text: 'Penjualan dicatat - ' + d.today.penjualan + ' unit', time: 'Hari ini', type: 'success', icon: 'shopping-cart' });
    }
    
    if (d.opname?.berjalan > 0) {
      activities.push({ text: d.opname.berjalan + ' SO sedang berjalan', time: 'Aktif', type: 'info', icon: 'clipboard' });
    }
    
    if (d.stok?.kritis > 0) {
      activities.push({ text: d.stok.kritis + ' produk stok kritis', time: 'Perlu perhatian', type: 'danger', icon: 'alert-triangle' });
    }
    
    if (activities.length === 0) {
      activities.push({ text: 'Tidak ada aktivitas pada periode ini', time: '-', type: 'info', icon: 'inbox' });
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
      container.innerHTML = '<div class="empty-state"><i data-lucide="trending-up"></i><div class="empty-state__title">Tidak ada data pada periode ini</div><div class="empty-state__desc">Data forecast akan muncul di sini</div></div>';
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