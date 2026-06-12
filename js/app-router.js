/* ============================================
   CV EPIC Warehouse - Client-Side Router
   PHASE 3: Modular Architecture
   ============================================ */

const AppRouter = {
  // Current route state
  currentPage: 'dashboard',
  routes: {},
  loadedPages: {},

  // Initialize router
  init() {
    // Register all routes
    this.registerRoutes();
    
    // Handle initial route
    this.handleRoute();
    
    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => this.handleRoute());
    
    // Listen for link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-page]');
      if (link) {
        e.preventDefault();
        const page = link.dataset.page;
        this.navigateTo(page);
      }
    });
    
    console.log('🟠 AppRouter initialized');
  },

  // Register all available routes
  registerRoutes() {
    this.routes = {
      'dashboard': 'pages/dashboard.html',
      'produk': 'pages/produk.html',
      'stok-gudang': 'pages/stok-gudang.html',
      'pembelian': 'pages/pembelian.html',
      'distribusi-outlet': 'pages/distribusi-outlet.html',
      'monitoring-outlet': 'pages/monitoring-outlet.html',
      'perintah-so': 'pages/perintah-so.html',
      'pelaksanaan-so': 'pages/pelaksanaan-so.html',
      'riwayat-so': 'pages/riwayat-so.html',
      'laporan': 'pages/laporan.html',
      'user': 'pages/user.html',
      'pengaturan': 'pages/pengaturan.html'
    };
  },

  // Navigate to a page
  navigateTo(page, replace = false) {
    if (!this.routes[page]) {
      console.warn(`Route not found: ${page}`);
      page = 'dashboard'; // fallback to dashboard
    }

    this.currentPage = page;
    
    // Update URL
    const url = `${window.location.pathname}?page=${page}`;
    
    if (replace) {
      history.replaceState({ page }, '', url);
    } else {
      history.pushState({ page }, '', url);
    }

    // Update active menu
    this.updateActiveMenu(page);
    
    // Load page content
    this.loadPage(page);
  },

  // Handle route from URL
  handleRoute() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page') || 'dashboard';
    this.currentPage = page;
    this.updateActiveMenu(page);
    this.loadPage(page);
  },

  // Update active menu item
  updateActiveMenu(page) {
    // Remove active from all menu items
    document.querySelectorAll('.sidebar-section li, .sidebar-menu-dashboard').forEach(item => {
      item.classList.remove('active');
    });

    // Find and activate the current page menu item
    const menuItem = document.querySelector(`[data-menu="${page}"]`);
    if (menuItem) {
      menuItem.classList.add('active');
      
      // If it's a submenu item, also open the parent submenu
      const submenu = menuItem.closest('.sidebar-submenu');
      if (submenu) {
        submenu.classList.add('open');
        // Also activate the parent menu item
        const parentItem = document.querySelector(`[data-submenu="${submenu.id}"]`);
        if (parentItem) {
          parentItem.classList.add('active');
        }
      }
    }
  },

  // Load page content
  async loadPage(page) {
    const container = document.getElementById('page-container');
    if (!container) {
      console.error('Page container not found');
      return;
    }

    // Check if page is already loaded
    if (this.loadedPages[page]) {
      // Just show the page, don't reload
      this.showPage(page);
      return;
    }

    // Show loading state
    container.innerHTML = `
      <div class="page-loading">
        <div class="page-loading__spinner"></div>
        <p>Memuat halaman...</p>
      </div>
    `;

    try {
      const response = await fetch(this.routes[page]);
      if (!response.ok) {
        throw new Error(`Failed to load page: ${response.status}`);
      }
      
      const html = await response.text();
      
      // Cache the page
      this.loadedPages[page] = html;
      
      // Render the page
      container.innerHTML = html;
      
      // Execute inline scripts
      this.executeScripts(container);
      
      // Initialize page-specific functionality
      this.initPage(page);
      
      // Hide app loader if still visible
      this.hideAppLoader();
      
      console.log(`✅ Page loaded: ${page}`);
      
    } catch (error) {
      console.error(`❌ Error loading page ${page}:`, error);
      container.innerHTML = `
        <div class="page-error">
          <h2>Gagal memuat halaman</h2>
          <p>${error.message}</p>
          <button class="btn btn--primary" onclick="AppRouter.loadPage('${page}')">
            <i data-lucide="refresh-cw"></i>
            <span>Coba Lagi</span>
          </button>
        </div>
      `;
    }
  },

  // Show cached page
  showPage(page) {
    const container = document.getElementById('page-container');
    if (this.loadedPages[page]) {
      container.innerHTML = this.loadedPages[page];
      this.initPage(page);
    }
  },

  // Execute scripts in loaded content
  executeScripts(container) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  },

  // Initialize page-specific functionality
  initPage(page) {
    // Initialize Lucide icons if available
    if (window.lucide) {
      lucide.createIcons();
    }
    
    // Page-specific initialization
    switch (page) {
      case 'dashboard':
        this.initDashboard();
        break;
      case 'user':
        this.initUserManagement();
        break;
      case 'perintah-so':
      case 'pelaksanaan-so':
        this.initOpname();
        break;
      // Add more page-specific init as needed
    }
    
    // Dispatch custom event for page-specific listeners
    window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { page } }));
  },

  // Dashboard initialization
  initDashboard() {
    if (typeof initDashboard === 'function') {
      initDashboard();
    }
  },

  // User management initialization
  initUserManagement() {
    if (typeof initUserManagement === 'function') {
      initUserManagement();
    }
  },

  // Opname initialization
  initOpname() {
    // Initialize opname tabs if they exist
    if (typeof showOpnameTab === 'function') {
      showOpnameTab(null, 'opnameKPI');
    }
  },

  // Hide app loader
  hideAppLoader() {
    const loader = document.getElementById('appLoader');
    if (loader && !loader.classList.contains('hidden')) {
      loader.classList.add('hidden');
      setTimeout(() => {
        if (loader.parentElement) {
          loader.parentElement.removeChild(loader);
        }
      }, 500);
    }
  },

  // Get current page
  getCurrentPage() {
    return this.currentPage;
  },

  // Check if page is loaded
  isPageLoaded(page) {
    return !!this.loadedPages[page];
  },

  // Reload current page
  reloadCurrentPage() {
    const page = this.currentPage;
    delete this.loadedPages[page];
    this.loadPage(page);
  }
};

// Make globally available
window.AppRouter = AppRouter;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  AppRouter.init();
});