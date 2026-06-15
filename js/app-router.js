/***********************************************
 * CV EPIC Warehouse - Client-Side Router
 * SPA Page Navigation
 ***********************************************/

const AppRouter = {
  // Route configuration
  routes: {
    'dashboard': 'pages/dashboard.html',
    'penjualan': 'pages/penjualan.html',
    'pembelian': 'pages/pembelian.html',
    'persediaan': 'pages/persediaan.html',
    'forecasting': 'pages/forecasting.html',
    'dashboard-so': 'pages/dashboard-so.html',
    'perintah-so': 'pages/perintah-so.html',
    'pelaksanaan-so': 'pages/pelaksanaan-so.html',
    'riwayat-so': 'pages/riwayat-so.html',
    'distribusi-outlet': 'pages/distribusi-outlet.html',
    'monitoring-outlet': 'pages/monitoring-outlet.html',
    'laporan': 'pages/laporan.html',
    'user': 'pages/user.html',
    'pengaturan': 'pages/pengaturan.html',
    'stok-gudang': 'pages/stok-gudang.html'
  },
  
  currentPage: 'dashboard',
  loadedPages: {},
  
  init() {
    this.handleRoute();
    window.addEventListener('popstate', () => this.handleRoute());
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-page]');
      if (link) {
        e.preventDefault();
        this.navigateTo(link.dataset.page);
      }
    });
    console.log('AppRouter initialized');
  },
  
  navigateTo(page, replace = false) {
    if (!this.routes[page]) {
      console.warn('Route not found:', page);
      page = 'dashboard';
    }
    this.currentPage = page;
    const url = window.location.pathname + '?page=' + page;
    if (replace) {
      history.replaceState({ page }, '', url);
    } else {
      history.pushState({ page }, '', url);
    }
    this.updateActiveMenu(page);
    this.loadPage(page);
  },
  
  handleRoute() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page') || 'dashboard';
    this.currentPage = page;
    this.updateActiveMenu(page);
    this.loadPage(page);
  },
  
  updateActiveMenu(page) {
    document.querySelectorAll('.sidebar__link').forEach(item => {
      item.classList.remove('active');
    });
    const menuItem = document.querySelector('.sidebar__link[data-page="' + page + '"]');
    if (menuItem) menuItem.classList.add('active');
    this.updatePageTitle(page);
  },
  
  updatePageTitle(page) {
    const titles = {
      'dashboard': 'Dashboard',
      'penjualan': 'Penjualan',
      'pembelian': 'Pembelian',
      'persediaan': 'Persediaan',
      'forecasting': 'Forecasting',
      'dashboard-so': 'Dashboard SO',
      'perintah-so': 'Perintah SO',
      'pelaksanaan-so': 'Pelaksanaan SO',
      'riwayat-so': 'Riwayat SO',
      'distribusi-outlet': 'Distribusi Outlet',
      'monitoring-outlet': 'Monitoring Outlet',
      'laporan': 'Laporan',
      'user': 'Manajemen User',
      'pengaturan': 'Pengaturan',
      'stok-gudang': 'Stok Gudang'
    };
    document.title = 'CV EPIC Warehouse - ' + (titles[page] || 'Dashboard');
  },
  
  async loadPage(page) {
    const container = document.getElementById('pageContainer');
    if (!container) {
      console.error('Page container not found');
      return;
    }
    
    if (this.loadedPages[page]) {
      container.innerHTML = this.loadedPages[page];
      this.executeScripts(container);
      this.initPage(page);
      return;
    }
    
    container.innerHTML = '<div class="page-loading"><div class="page-loading__spinner"></div><p>Memuat halaman...</p></div>';
    
    try {
      const response = await fetch(this.routes[page]);
      if (!response.ok) throw new Error('Failed to load page: ' + response.status);
      
      const html = await response.text();
      this.loadedPages[page] = html;
      container.innerHTML = html;
      this.executeScripts(container);
      this.initPage(page);
      console.log('Page loaded:', page);
    } catch (error) {
      console.error('Error loading page', page, error);
      container.innerHTML = '<div class="page-error"><i data-lucide="alert-circle"></i><h2>Gagal memuat halaman</h2><p>' + error.message + '</p><button class="btn btn--primary" onclick="AppRouter.loadPage(\'' + page + '\')"><i data-lucide="refresh-cw"></i><span>Coba Lagi</span></button></div>';
      if (window.lucide) lucide.createIcons();
    }
  },
  
  executeScripts(container) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
      // Skip if script already executed (has data-executed attribute)
      if (oldScript.dataset && oldScript.dataset.executed === 'true') return;
      
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      // Mark as executed to prevent double execution on cached page load
      if (newScript.dataset) {
        newScript.dataset.executed = 'true';
      } else {
        newScript.setAttribute('data-executed', 'true');
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  },
  
  initPage(page) {
    if (window.lucide) lucide.createIcons();
    
    // Dispatch page-specific event for clean re-initialization
    window.dispatchEvent(new CustomEvent('pageInit', { detail: { page } }));
    
    // Call page-specific init functions - each handles its own cleanup
    if (page === 'dashboard' && typeof initDashboard === 'function') initDashboard();
    if (page === 'user' && typeof initUserManagement === 'function') initUserManagement();
    if (page === 'persediaan' && typeof initPersediaanPage === 'function') initPersediaanPage();
    if (page === 'penjualan' && typeof initPenjualanPage === 'function') initPenjualanPage();
    if (page === 'pembelian' && typeof initPembelianPage === 'function') initPembelianPage();
    
    window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { page } }));
  },
  
  getCurrentPage() { return this.currentPage; },
  isPageLoaded(page) { return !!this.loadedPages[page]; },
  reloadCurrentPage() { delete this.loadedPages[this.currentPage]; this.loadPage(this.currentPage); },
  clearCache() { this.loadedPages = {}; }
};

window.AppRouter = AppRouter;
document.addEventListener('DOMContentLoaded', () => AppRouter.init());
