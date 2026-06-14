/* ============================================
   CV EPIC Warehouse - Dashboard Module
   Final Dashboard V1 - Fixed
   ============================================ */

const Dashboard = {
  data: {},
  charts: {},
  updateInterval: null,
  isLoading: true,
  error: null,
  
  selectedMonth: new Date().getMonth() + 1,
  selectedYear: new Date().getFullYear(),
  
  init() {
    this.showLoadingOverlay();
    this.loadDashboard();
    this.startAutoRefresh();
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
    this.initFilterDropdowns();
  },
  
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
  
  updateDateTime() {
    const now = new Date();
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    
    const dateEl = document.getElementById('currentDate');
    const timeEl = document.getElementById('currentTime');
    
    if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', dateOptions);
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID', timeOptions);
  },
  
  showLoadingOverlay() {
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if (overlay) overlay.style.display = 'flex';
  },
  
  hideLoadingOverlay() {
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
  },
  
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
  
  hideError() {
    const errorEl = document.querySelector('.dashboard-error');
    if (errorEl) errorEl.remove();
  },
  
  async loadDashboard() {
    this.hideError();
    
    try {
      // Run sequentially to avoid race condition
      // loadDashboardData sets this.data first
      // then loadChartData adds this.data.charts
      await this.loadDashboardData();
      await this.loadChartData();
      
      console.log('=== DATA LOADED ===');
      console.log('this.data:', JSON.stringify(this.data, null, 2));
      console.log('this.data.charts:', JSON.stringify(this.data.charts, null, 2));
      
      this.isLoading = false;
      this.hideLoadingOverlay();
      this.renderKPIs();
      this.renderCharts();
      this.renderSOProgress();
      this.renderModulLevelTable();
      this.renderRecentActivity();
      this.updateUserGreeting();
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.showError(error.message || 'Terjadi kesalahan saat memuat data');
    }
  },
  
  async loadDashboardData() {
    try {
      const { selectedMonth, selectedYear } = this;
      const response = await fetch(`/api/v3-dashboard?bulan=${selectedMonth}&tahun=${selectedYear}`);
      if (!response.ok) throw new Error('Gagal memuat data dashboard');
      
      this.data = await response.json();
      console.log('Dashboard data loaded:', this.data);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.data = this.getEmptyData();
      throw error;
    }
  },
  
  async loadChartData() {
    try {
      const { selectedMonth, selectedYear } = this;
      const params = `bulan=${selectedMonth}&tahun=${selectedYear}`;
      
      const [trenResponse, topProdukResponse, outletResponse, modulLevelResponse] = await Promise.all([
        fetch('/api/v3-chart?type=tren_penjualan&' + params),
        fetch('/api/v3-chart?type=top_produk&' + params),
        fetch('/api/v3-chart?type=outlet&' + params),
        fetch('/api/v3-chart?type=modul_level&' + params)
      ]);
      
      const trenData = trenResponse.ok ? await trenResponse.json() : { data: [] };
      const topProdukData = topProdukResponse.ok ? await topProdukResponse.json() : { data: [] };
      const outletData = outletResponse.ok ? await outletResponse.json() : { data: [] };
      const modulLevelData = modulLevelResponse.ok ? await modulLevelResponse.json() : { data: [] };
      
      console.log('🔍 API Response Debug:');
      console.log('1. trenData:', JSON.stringify(trenData, null, 2));
      console.log('2. topProdukData:', JSON.stringify(topProdukData, null, 2));
      console.log('3. outletData:', JSON.stringify(outletData, null, 2));
      console.log('4. modulLevelData:', JSON.stringify(modulLevelData, null, 2));
      
      // API returns { type, periode, data: [...] }, store directly
      this.data.charts = {
        trenPenjualan: trenData,
        topProduk: topProdukData,
        outlet: outletData,
        modulLevel: modulLevelData
      };
      
      console.log('Chart data stored:', this.data.charts);
      console.log('this.data.charts.trenPenjualan.data:', this.data.charts.trenPenjualan?.data);
      console.log('this.data.charts.topProduk.data:', this.data.charts.topProduk?.data);
      console.log('this.data.charts.outlet.data:', this.data.charts.outlet?.data);
      console.log('this.data.charts.modulLevel.data:', this.data.charts.modulLevel?.data);
      
    } catch (error) {
      console.error('Error loading chart data:', error);
      this.data.charts = { trenPenjualan: { data: [] }, topProduk: { data: [] }, outlet: { data: [] }, modulLevel: { data: [] } };
    }
  },
  
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
    if (titleEl) titleEl.textContent = 'Selamat Datang, ' + userName;
  },
  
  getEmptyData() {
    return {
      filter: { bulan: this.selectedMonth, tahun: this.selectedYear },
      periode: { distribusi: { qty: 0 }, penjualan: { qty: 0, nominal: 0 }, profit: 0, total_siswa: 0 },
      produk: { aktif: 0, total: 0 },
      outlet: { aktif: 0, total: 0 },
      stok: { kritis: 0, gudang: { akhir: 0 } },
      opname: { berjalan: 0, selesai_bulan_ini: 0 },
      users: { total: 0 },
      charts: { trenPenjualan: { data: [] }, topProduk: { data: [] }, outlet: { data: [] }, modulLevel: { data: [] } }
    };
  },
  
  renderKPIs() {
    const data = this.data;
    
    this.setKPIValue('kpi-total-produk', this.formatNumber(data.produk?.total || 0));
    this.setKPIValue('kpi-total-outlet', this.formatNumber(data.outlet?.total || 0));
    this.setKPIValue('kpi-stok-gudang', this.formatNumber(data.stok?.gudang?.akhir || 0));
    this.setKPIValue('kpi-stok-outlet', '-');
    
    this.setKPIValue('kpi-distribusi', this.formatNumber(data.periode?.distribusi?.qty || 0));
    this.setKPIValue('kpi-penjualan', 'Rp ' + this.formatNumber(data.periode?.penjualan?.nominal || 0));
    this.setKPIValue('kpi-so-berjalan', this.formatNumber(data.opname?.berjalan || 0));
    this.setKPIValue('kpi-stok-kritis', this.formatNumber(data.stok?.kritis || 0));
    
    this.setKPIValue('kpi-user-aktif', this.formatNumber(data.users?.total || 0));
    this.setKPIValue('kpi-profit', 'Rp ' + this.formatNumber(data.periode?.profit || 0));
    this.setKPIValue('kpi-siswa-aktif', this.formatNumber(data.periode?.total_siswa || 0));
    this.setKPIValue('kpi-produk-aktif', this.formatNumber(data.produk?.aktif || 0));
  },
  
  setKPIValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },
  
  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  
  renderCharts() {
    console.log('=== RENDER CHARTS ===');
    console.log('Tren Penjualan Data:', this.data.charts?.trenPenjualan);
    console.log('Top Produk Data:', this.data.charts?.topProduk);
    this.renderTrenPenjualanChart();
    this.renderTopProdukChart();
    this.renderTopOutletChart();
  },
  
  renderTrenPenjualanChart() {
    const canvas = document.getElementById('chartPenjualan');
    const emptyEl = document.getElementById('chartPenjualanEmpty');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (this.charts.penjualan) {
      this.charts.penjualan.destroy();
      this.charts.penjualan = null;
    }
    
    // API returns { type, periode, data: [...] }
    const trenData = this.data.charts?.trenPenjualan?.data || [];
    console.log('Tren Penjualan Data Array:', trenData);
    
    // Nama bulan Indonesia
    const bulanIndonesia = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    
    // Buat array 12 bulan dengan nilai default 0
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      bulan: i + 1,
      value: 0
    }));
    
    // Isi data dari API
    trenData.forEach(item => {
      if (item.bulan && item.bulan >= 1 && item.bulan <= 12) {
        monthlyData[item.bulan - 1].value = item.value;
      }
    });
    
    const labels = bulanIndonesia;
    const dataValues = monthlyData.map(d => d.value);
    
    // Hitung total untuk判断是否有数据
    const hasData = dataValues.some(v => v > 0);
    
    if (!hasData) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }
    
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
    
    this.charts.penjualan = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Penjualan',
          data: dataValues,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                return 'Rp ' + this.formatRupiah(item.raw);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              callback: (value) => 'Rp ' + this.formatRupiah(value)
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  },
  
  formatRupiah(num) {
    if (num === null || num === undefined || num === 0) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  
  renderTopProdukChart() {
    const canvas = document.getElementById('chartTopProduk');
    const emptyEl = document.getElementById('chartTopProdukEmpty');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (this.charts.topProduk) {
      this.charts.topProduk.destroy();
      this.charts.topProduk = null;
    }
    
    // API returns { type, periode, data: [...] }
    const topProdukData = this.data.charts?.topProduk?.data || [];
    console.log('Top Produk Data Array:', topProdukData);
    
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
  
  renderTopOutletChart() {
    const canvas = document.getElementById('chartTopOutlet');
    const emptyEl = document.getElementById('chartTopOutletEmpty');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (this.charts.topOutlet) {
      this.charts.topOutlet.destroy();
      this.charts.topOutlet = null;
    }
    
    // API returns { type, periode, data: [...] }
    const outletData = this.data.charts?.outlet?.data || [];
    console.log('Outlet Data Array:', outletData);
    
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
  
  renderRecentActivity() {
    const container = document.getElementById('aktivitasList');
    if (!container) return;
    
    const data = this.data;
    const activities = [];
    
    if (data.periode?.penjualan?.nominal > 0) {
      activities.push({ text: 'Penjualan: Rp ' + this.formatNumber(data.periode.penjualan.nominal), time: 'Periode ini', type: 'success', icon: 'shopping-cart' });
    }
    
    if (data.periode?.profit > 0) {
      activities.push({ text: 'Profit: Rp ' + this.formatNumber(data.periode.profit), time: 'Periode ini', type: 'info', icon: 'wallet' });
    }
    
    if (data.produk?.aktif > 0) {
      activities.push({ text: data.produk.aktif + ' produk aktif terjual', time: 'Periode ini', type: 'info', icon: 'package' });
    }
    
    if (data.opname?.berjalan > 0) {
      activities.push({ text: data.opname.berjalan + ' SO berjalan', time: 'Aktif', type: 'warning', icon: 'clipboard' });
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
  
  renderModulLevelTable() {
    const container = document.getElementById('modulLevelTable');
    if (!container) return;
    
    // Data from API
    const modulData = this.data.charts?.modulLevel?.data || [];
    console.log('Modul Level Data:', modulData);
    
    if (!modulData.length || !modulData.some(d => d.value > 0)) {
      container.innerHTML = '<div class="table-card__empty"><i data-lucide="package"></i><p class="table-card__empty-text">Tidak ada data modul terjual</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }
    
    const total = modulData.reduce((sum, d) => sum + (d.value || 0), 0);
    
    const tableHtml = '<div class="modul-level-table-wrapper">' +
      '<table class="modul-level-table">' +
      '<thead><tr><th>Jenis Modul</th><th>Level</th><th class="text-right">Qty Terjual</th></tr></thead>' +
      '<tbody>' +
      modulData.filter(d => d.value > 0).map(item => {
        const parts = (item.full_label || item.label || '').split(' Level ');
        const jenis = parts[0] || '-';
        const level = parts[1] || '-';
        return '<tr><td class="modul-jenis">' + jenis + '</td><td class="modul-level">' + level + '</td><td class="modul-qty text-right">' + this.formatNumber(item.value) + '</td></tr>';
      }).join('') +
      '</tbody>' +
      '<tfoot><tr><td colspan="2" class="text-right"><strong>Total:</strong></td><td class="text-right"><strong>' + this.formatNumber(total) + '</strong></td></tr></tfoot>' +
      '</table></div>';
    
    container.innerHTML = tableHtml;
  },
  
  startAutoRefresh() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = setInterval(() => {
      this.showLoadingOverlay();
      this.loadDashboard();
    }, 5 * 60 * 1000);
  },
  
  stopAutoRefresh() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  },
  
  destroy() {
    this.stopAutoRefresh();
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    this.charts = {};
  }
};

function initDashboard() {
  Dashboard.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  if (document.getElementById('kpi-total-produk')) initDashboard();
}