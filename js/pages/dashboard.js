/* ============================================
   CV EPIC Warehouse - Dashboard Module
   Final Dashboard V1
   ============================================ */

// Dashboard State
const Dashboard = {
  data: {},
  charts: {},
  persediaan: {},
  updateInterval: null,
  isLoading: true,
  error: null,
  
  // Filter state - bulan dan tahun untuk chart
  selectedMonth: new Date().getMonth() + 1,
  selectedYear: new Date().getFullYear(),
  
  // Initialize Dashboard
  init() {
    this.showLoadingOverlay();
    this.loadDashboard();
    this.startAutoRefresh();
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
    this.initFilterDropdowns();
  },
  
  // Initialize filter dropdowns
  initFilterDropdowns() {
    const bulanSelect = document.getElementById('filterBulan');
    const tahunSelect = document.getElementById('filterTahun');
    
    if (bulanSelect && tahunSelect) {
      bulanSelect.value = this.selectedMonth;
      tahunSelect.value = this.selectedYear;
      
      bulanSelect.addEventListener('change', () => {
        this.selectedMonth = parseInt(bulanSelect.value);
        this.showLoadingOverlay();
        this.loadDashboard();
      });
      
      tahunSelect.addEventListener('change', () => {
        this.selectedYear = parseInt(tahunSelect.value);
        this.showLoadingOverlay();
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
  
  // Show/Hide Loading Overlay
  showLoadingOverlay() {
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if (overlay) overlay.style.display = 'flex';
  },
  
  hideLoadingOverlay() {
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },
  
  // Show error state
  showError(message) {
    this.error = message;
    this.isLoading = false;
    this.hideLoadingOverlay();
    
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
    
    try {
      await Promise.all([
        this.loadDashboardData(),
        this.loadChartData()
      ]);
      
      this.isLoading = false;
      this.hideLoadingOverlay();
      this.renderKPIs();
      this.renderCharts();
      this.renderSOProgress();
      this.renderModulLevelChart();
      this.renderRecentActivity();
      this.updateUserGreeting();
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.showError(error.message || 'Terjadi kesalahan saat memuat data');
    }
  },
  
  // Load main dashboard data from /api/v3-dashboard
  async loadDashboardData() {
    try {
      const { selectedMonth, selectedYear } = this;
      const response = await fetch(`/api/v3-dashboard?bulan=${selectedMonth}&tahun=${selectedYear}`);
      if (!response.ok) throw new Error('Gagal memuat data dashboard');
      
      this.data = await response.json();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.data = this.getEmptyData();
      throw error;
    }
  },
  
  // Load chart data from /api/v3-chart
  async loadChartData() {
    try {
      const { selectedMonth, selectedYear } = this;
      const params = `bulan=${selectedMonth}&tahun=${selectedYear}`;
      
      const [topProdukResponse, outletResponse] = await Promise.all([
        fetch('/api/v3-chart?type=top_produk&' + params),
        fetch('/api/v3-chart?type=outlet&' + params)
      ]);
      
      const topProdukData = topProdukResponse.ok ? await topProdukResponse.json() : { data: [] };
      const outletData = outletResponse.ok ? await outletResponse.json() : { data: [] };
      
      this.data.charts = {
        topProduk: topProdukData,
        outlet: outletData
      };
      
    } catch (error) {
      console.error('Error loading chart data:', error);
      this.data.charts = { topProduk: { data: [] }, outlet: { data: [] } };
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
      filter: { bulan: this.selectedMonth, tahun: this.selectedYear },
      periode: { distribusi: { qty: 0 }, penjualan: { qty: 0 }, profit: 0, total_siswa: 0 },
      produk: { aktif: 0, total: 0 },
      outlet: { aktif: 0, total: 0 },
      stok: { kritis: 0, gudang: { akhir: 0 } },
      opname: { berjalan: 0, selesai_bulan_ini: 0 },
      users: { total: 0 },
      charts: { topProduk: { data: [] }, outlet: { data: [] } }
    };
  },
  
  // Render all KPIs
  renderKPIs() {
    const data = this.data;
    
    // Row 1 - Static KPIs
    this.setKPIValue('kpi-total-produk', this.formatNumber(data.produk?.total || 0));
    this.setKPIValue('kpi-total-outlet', this.formatNumber(data.outlet?.total || 0));
    this.setKPIValue('kpi-stok-gudang', this.formatNumber(data.stok?.gudang?.akhir || 0));
    this.setKPIValue('kpi-stok-outlet', '-');
    
    // Row 2 - Period-based KPIs
    this.setKPIValue('kpi-distribusi', this.formatNumber(data.periode?.distribusi?.qty || 0));
    this.setKPIValue('kpi-penjualan', 'Rp ' + this.formatNumber(data.periode?.penjualan?.nominal || 0));
    this.setKPIValue('kpi-so-berjalan', this.formatNumber(data.opname?.berjalan || 0));
    this.setKPIValue('kpi-stok-kritis', this.formatNumber(data.stok?.kritis || 0));
    
    // Row 3 - More KPIs
    this.setKPIValue('kpi-user-aktif', this.formatNumber(data.users?.total || 0));
    this.setKPIValue('kpi-profit', 'Rp ' + this.formatNumber(data.periode?.profit || 0));
    this.setKPIValue('kpi-siswa-aktif', this.formatNumber(data.periode?.total_siswa || 0));
    this.setKPIValue('kpi-produk-aktif', this.formatNumber(data.produk?.aktif || 0));
  },
  
  // Helper to set KPI value
  setKPIValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },
  
  // Format number with thousand separator
  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  
  // Render charts
  renderCharts() {
    this.renderPenjualanChart();
    this.renderTopProdukChart();
    this.renderTopOutletChart();
  },
  
  // Penjualan Chart
  renderPenjualanChart() {
    const canvas = document.getElementById('chartPenjualan');
    const emptyEl = document.getElementById('chartPenjualanEmpty');
    
    if (!canvas) return;
    
    // Data sudah ada di v3-chart endpoint
    const ctx = canvas.getContext('2d');
    
    if (this.charts.penjualan) {
      this.charts.penjualan.destroy();
      this.charts.penjualan = null;
    }
    
    // Generate labels for current month
    const lastDay = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    const labels = [];
    for (let i = 1; i <= lastDay; i++) labels.push(i.toString());
    
    // Generate random data for now (akan diganti dengan real API)
    const values = labels.map(() => Math.floor(Math.random() * 100));
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    this.charts.penjualan = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Penjualan',
          data: values,
          backgroundColor: 'rgba(255, 77, 58, 0.8)',
          borderColor: '#ff4d3a',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
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
      this.charts.topProduk = null;
    }
    
    const topProdukData = this.data.charts?.topProduk?.data || [];
    const filteredData = topProdukData.filter(d => d.value > 0).slice(0, 10);
    
    if (!filteredData.length) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    const labels = filteredData.map(p => {
      const name = p.nama_produk || p.label || 'Unknown';
      return name.length > 15 ? name.substring(0, 15) + '...' : name;
    });
    
    this.charts.topProduk = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: filteredData.map(p => p.value),
          backgroundColor: [
            'rgba(255, 77, 58, 0.8)', 'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)', 'rgba(236, 72, 153, 0.8)',
            'rgba(6, 182, 212, 0.8)', 'rgba(249, 115, 22, 0.8)',
            'rgba(34, 197, 94, 0.8)', 'rgba(168, 85, 247, 0.8)'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#94a3b8', padding: 10, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (item) => {
                const p = filteredData[item.dataIndex];
                return [p.nama_produk || p.label, 'Qty: ' + this.formatNumber(p.value)];
              }
            }
          }
        },
        cutout: '60%'
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
      this.charts.topOutlet = null;
    }
    
    const outletData = this.data.charts?.outlet?.data || [];
    const filteredData = outletData.filter(d => d.value > 0);
    
    if (!filteredData.length) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    const labels = filteredData.slice(0, 10).map(o => {
      const name = o.label || 'Unknown';
      return name.length > 12 ? name.substring(0, 12) + '..' : name;
    });
    
    this.charts.topOutlet = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Transaksi',
          data: filteredData.slice(0, 10).map(o => o.value),
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
          x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } }
        }
      }
    });
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
  
  // Render Recent Activity
  renderRecentActivity() {
    const container = document.getElementById('aktivitasList');
    if (!container) return;
    
    const data = this.data;
    const activities = [];
    
    if (data.periode?.penjualan?.qty > 0) {
      activities.push({ text: 'Penjualan periode ini: ' + this.formatNumber(data.periode.penjualan.qty) + ' unit', time: 'Periode ini', type: 'success', icon: 'shopping-cart' });
    }
    
    if (data.periode?.profit > 0) {
      activities.push({ text: 'Profit periode ini: Rp ' + this.formatNumber(data.periode.profit), time: 'Periode ini', type: 'info', icon: 'wallet' });
    }
    
    if (data.produk?.aktif > 0) {
      activities.push({ text: data.produk.aktif + ' produk aktif terjual', time: 'Periode ini', type: 'info', icon: 'package' });
    }
    
    if (data.opname?.berjalan > 0) {
      activities.push({ text: data.opname.berjalan + ' SO sedang berjalan', time: 'Aktif', type: 'warning', icon: 'clipboard' });
    }
    
    if (activities.length === 0) {
      activities.push({ text: 'Sistem berjalan normal', time: 'Online', type: 'success', icon: 'check' });
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
  
  // Render Modul Terjual Per Level (Table)
  renderModulLevelChart() {
    const container = document.getElementById('modulLevelTable');
    if (!container) return;
    
    // Ambil data dari API modul_level
    const { selectedMonth, selectedYear } = this;
    
    fetch(`/api/v3-chart?type=modul_level&bulan=${selectedMonth}&tahun=${selectedYear}`)
      .then(res => res.ok ? res.json() : { data: [] })
      .then(response => {
        const modulData = response.data || [];
        
        if (!modulData.length || !modulData.some(d => d.value > 0)) {
          container.innerHTML = '<div class="table-card__empty"><i data-lucide="package"></i><p class="table-card__empty-text">Tidak ada data modul terjual</p></div>';
          if (window.lucide) lucide.createIcons({ nodes: [container] });
          return;
        }
        
        // Table responsive dark theme
        const tableHtml = `
          <div class="modul-level-table-wrapper">
            <table class="modul-level-table">
              <thead>
                <tr>
                  <th>Jenis Modul</th>
                  <th>Level</th>
                  <th class="text-right">Qty Terjual</th>
                </tr>
              </thead>
              <tbody>
                ${modulData.filter(d => d.value > 0).map(item => {
                  const parts = item.full_label ? item.full_label.split(' Level ') : item.label.split(' Level ');
                  const jenis = parts[0] || item.label || '-';
                  const level = parts[1] || '-';
                  return `
                    <tr>
                      <td class="modul-jenis">${jenis}</td>
                      <td class="modul-level">${level}</td>
                      <td class="modul-qty text-right">${this.formatNumber(item.value)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" class="text-right"><strong>Total:</strong></td>
                  <td class="text-right"><strong>${this.formatNumber(modulData.reduce((sum, d) => sum + (d.value || 0), 0))}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
        
        container.innerHTML = tableHtml;
      })
      .catch(err => {
        console.error('Error loading modul level:', err);
        container.innerHTML = '<div class="table-card__empty"><i data-lucide="alert-circle"></i><p class="table-card__empty-text">Gagal memuat data</p></div>';
      });
  },
  
  // Start auto refresh (every 5 minutes)
  startAutoRefresh() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.showLoadingOverlay();
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
    console.log('=== DEBUG: renderCharts called ===');
    this.renderPenjualanChart();
    this.renderDistribusiChart();
    this.renderTopProdukChart();
    this.renderTopOutletChart();
    this.renderModulLevelChart();
  },
  
  // Penjualan Chart (from penjualan data - daily)
  renderPenjualanChart() {
    const canvas = document.getElementById('chartPenjualan');
    const emptyEl = document.getElementById('chartPenjualanEmpty');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const penjualanData = this.data.charts?.penjualan?.data || [];
    
    if (this.charts.penjualan) {
      this.charts.penjualan.destroy();
      this.charts.penjualan = null;
    }
    
    // Check if no data
    if (!penjualanData.length || !penjualanData.some(d => d.value > 0)) {
      if (emptyEl) {
        emptyEl.style.display = 'flex';
        emptyEl.querySelector('.chart-card__empty-text').textContent = 'Tidak ada data pada periode ini';
      }
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    // Generate full month labels (1 to 28/29/30/31)
    const lastDay = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    const salesByDay = {};
    penjualanData.forEach(d => {
      salesByDay[d.label] = d.value;
    });
    
    const labels = [];
    const data = [];
    for (let i = 1; i <= lastDay; i++) {
      labels.push(i.toString());
      data.push(salesByDay[i] || 0);
    }
    
    this.charts.penjualan = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Penjualan Harian',
          data: data,
          backgroundColor: 'rgba(255, 77, 58, 0.8)',
          borderColor: '#ff4d3a',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        ...this.getChartOptions('bar'),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => 'Tanggal ' + items[0].label,
              label: (item) => 'Qty: ' + this.formatNumber(item.raw)
            }
          }
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
  
  // Top Produk Chart (from v3-chart type=top_produk)
  renderTopProdukChart() {
    console.log('=== DEBUG: renderTopProdukChart called ===');
    const canvas = document.getElementById('chartTopProduk');
    const emptyEl = document.getElementById('chartTopProdukEmpty');
    
    console.log('Canvas element:', canvas);
    console.log('Empty element:', emptyEl);
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (this.charts.topProduk) {
      this.charts.topProduk.destroy();
      this.charts.topProduk = null;
    }
    
    const topProdukData = this.data.charts?.topProduk?.data || [];
    console.log('Top Produk Data:', topProdukData);
    const filteredData = topProdukData.filter(d => d.value > 0).slice(0, 10);
    console.log('Filtered Data:', filteredData);
    
    if (!filteredData.length) {
      if (emptyEl) {
        emptyEl.style.display = 'flex';
        emptyEl.querySelector('.chart-card__empty-text').textContent = 'Tidak ada data pada periode ini';
      }
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    const labels = filteredData.map(p => {
      const name = p.nama_produk || p.label || 'Unknown';
      return name.length > 15 ? name.substring(0, 15) + '...' : name;
    });
    
    this.charts.topProduk = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: filteredData.map(p => p.value),
          backgroundColor: [
            'rgba(255, 77, 58, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(6, 182, 212, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(168, 85, 247, 0.8)'
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
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                const p = filteredData[item.dataIndex];
                return [p.nama_produk || p.label, 'Qty: ' + this.formatNumber(p.value)];
              }
            }
          }
        },
        cutout: '60%'
      }
    });
  },
  
  // Top Outlet Chart (from outlet chart data)
  renderTopOutletChart() {
    console.log('=== DEBUG: renderTopOutletChart called ===');
    const canvas = document.getElementById('chartTopOutlet');
    const emptyEl = document.getElementById('chartTopOutletEmpty');
    
    console.log('Canvas element:', canvas);
    console.log('Empty element:', emptyEl);
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const outletData = this.data.charts?.outlet?.data || [];
    console.log('Outlet Data:', outletData);
    const filteredData = outletData.filter(d => d.value > 0);
    console.log('Filtered Data:', filteredData);
    
    if (this.charts.topOutlet) {
      this.charts.topOutlet.destroy();
      this.charts.topOutlet = null;
    }
    
    if (!filteredData.length) {
      if (emptyEl) {
        emptyEl.style.display = 'flex';
        emptyEl.querySelector('.chart-card__empty-text').textContent = 'Tidak ada data pada periode ini';
      }
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    const labels = filteredData.slice(0, 10).map(o => {
      const name = o.label || 'Unknown';
      return name.length > 12 ? name.substring(0, 12) + '..' : name;
    });
    
    this.charts.topOutlet = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Transaksi',
          data: filteredData.slice(0, 10).map(o => o.value),
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
  
  // Modul Terjual Per Level Chart
  renderModulLevelChart() {
    console.log('=== DEBUG: renderModulLevelChart called ===');
    const container = document.getElementById('modulLevelTable');
    if (!container) return;
    
    const modulData = this.data.charts?.modulLevel?.data || [];
    console.log('Modul Level Data:', modulData);
    
    if (!modulData.length || !modulData.some(d => d.value > 0)) {
      container.innerHTML = '<div class="table-card__empty"><i data-lucide="package"></i><p class="table-card__empty-text">Tidak ada data modul terjual</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }
    
    // Create table with columns: Jenis | Level | Qty Terjual
    const tableHtml = '<table class="data-table">' +
      '<thead><tr><th>Jenis</th><th>Level</th><th>Qty Terjual</th></tr></thead>' +
      '<tbody>' +
      modulData.filter(d => d.value > 0).map(item => {
        // Parse label to extract Jenis and Level
        const parts = item.label.split(' Level ');
        const jenis = parts[0] || item.label;
        const level = parts[1] || '-';
        return '<tr><td>' + jenis + '</td><td>' + level + '</td><td>' + this.formatNumber(item.value) + '</td></tr>';
      }).join('') +
      '</tbody></table>';
    
    container.innerHTML = tableHtml;
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