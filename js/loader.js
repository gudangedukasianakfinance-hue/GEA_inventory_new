/* ============================================
   CV EPIC Warehouse - Loading Manager
   V4 Modern Loading Experience
   ============================================ */

// V4 DESIGN SYSTEM VERIFICATION
console.log("%c🟠 V4 DESIGN SYSTEM LOADED", "color: #FF4D3A; font-weight: bold; font-size: 14px;");

const LoadingManager = {
  // App loader element
  appLoader: null,
  pageLoader: null,
  
  // Initialize loading system
  init() {
    this.createAppLoader();
    this.createPageLoader();
  },

  // Create global app loader
  createAppLoader() {
    if (this.appLoader) return;
    
    this.appLoader = document.createElement('div');
    this.appLoader.id = 'appLoader';
    this.appLoader.className = 'app-loader';
    this.appLoader.innerHTML = `
      <div class="app-loader__logo">
        <img src="/assets/logo.png" alt="CV EPIC Warehouse" onerror="this.parentElement.style.display='none'">
      </div>
      <div class="app-loader__brand">
        <h1 class="app-loader__title">CV EPIC Warehouse</h1>
        <p class="app-loader__subtitle">Sistem Kontrol Inventaris</p>
      </div>
      <div class="app-loader__progress">
        <div class="app-loader__progress-bar animating"></div>
      </div>
      <p class="app-loader__status" id="appLoaderStatus">Memuat aplikasi...</p>
    `;
    document.body.appendChild(this.appLoader);
  },

  // Create page loader (top bar)
  createPageLoader() {
    if (this.pageLoader) return;
    
    this.pageLoader = document.createElement('div');
    this.pageLoader.id = 'pageLoader';
    this.pageLoader.className = 'page-loader';
    this.pageLoader.innerHTML = '<div class="page-loader__bar"></div>';
    document.body.appendChild(this.pageLoader);
  },

  // Show app loader
  showAppLoader(status = 'Memuat aplikasi...') {
    if (!this.appLoader) this.createAppLoader();
    this.appLoader.classList.remove('hidden');
    this.setAppLoaderStatus(status);
  },

  // Hide app loader with animation
  hideAppLoader() {
    if (!this.appLoader) return;
    
    const loader = this.appLoader;
    loader.classList.add('hidden');
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (loader.parentElement) {
        loader.parentElement.removeChild(loader);
      }
      this.appLoader = null;
    }, 500);
  },

  // Update app loader status
  setAppLoaderStatus(status) {
    const statusEl = document.getElementById('appLoaderStatus');
    if (statusEl) statusEl.textContent = status;
  },

  // Show page loader
  showPageLoader() {
    if (!this.pageLoader) this.createPageLoader();
    this.pageLoader.classList.add('active');
  },

  // Hide page loader
  hidePageLoader() {
    if (this.pageLoader) {
      this.pageLoader.classList.remove('active');
    }
  },

  // Show skeleton for table
  showTableSkeleton(containerId, columns = 5, rows = 5) {
    const container = document.getElementById(containerId);
    if (!container) return '';

    const skeletonId = `skeleton-${containerId}`;
    const skeletonHtml = `
      <div id="${skeletonId}" class="table-skeleton">
        <div class="table-skeleton__header">
          ${Array(columns).fill('<div class="skeleton-table__header-cell"></div>').join('')}
        </div>
        ${Array(rows).fill(`
          <div class="table-skeleton__row">
            ${Array(columns).fill(`
              <div class="skeleton-table__cell">
                <div class="skeleton-table__cell-text" style="width: ${60 + Math.random() * 40}%"></div>
                <div class="skeleton-table__cell-text skeleton-text--sm" style="width: ${40 + Math.random() * 30}%"></div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;

    container.innerHTML = skeletonHtml;
    return skeletonId;
  },

  // Show skeleton for KPI cards
  showKPISkeleton(containerId, count = 4) {
    const container = document.getElementById(containerId);
    if (!container) return '';

    const skeletonHtml = `
      <div class="kpi-grid-skeleton">
        ${Array(count).fill(`
          <div class="skeleton-kpi">
            <div class="skeleton-kpi__icon skeleton"></div>
            <div class="skeleton-kpi__content">
              <div class="skeleton-kpi__value skeleton"></div>
              <div class="skeleton-kpi__label skeleton"></div>
              <div class="skeleton-kpi__change skeleton"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.innerHTML = skeletonHtml;
    return containerId;
  },

  // Show skeleton for chart
  showChartSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return '';

    const skeletonHtml = `
      <div class="skeleton-chart">
        <div class="skeleton-chart__header">
          <div class="skeleton-chart__title skeleton"></div>
          <div class="skeleton-chart__actions">
            <div class="skeleton-chart__action skeleton"></div>
            <div class="skeleton-chart__action skeleton"></div>
          </div>
        </div>
        <div class="skeleton-chart__area skeleton">
          ${Array(7).fill('<div class="skeleton-chart__bar skeleton"></div>').join('')}
        </div>
      </div>
    `;

    container.innerHTML = skeletonHtml;
    return containerId;
  },

  // Show skeleton for activity feed
  showActivitySkeleton(containerId, count = 4) {
    const container = document.getElementById(containerId);
    if (!container) return '';

    const skeletonHtml = `
      <div class="skeleton-activity">
        ${Array(count).fill(`
          <div class="skeleton-activity__item">
            <div class="skeleton-activity__icon skeleton"></div>
            <div class="skeleton-activity__content">
              <div class="skeleton-activity__title skeleton"></div>
              <div class="skeleton-activity__meta skeleton"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.innerHTML = skeletonHtml;
    return containerId;
  },

  // Remove skeleton
  removeSkeleton(skeletonId) {
    const skeleton = document.getElementById(skeletonId);
    if (skeleton) {
      skeleton.style.opacity = '0';
      skeleton.style.transition = 'opacity 0.3s ease';
      setTimeout(() => skeleton.remove(), 300);
    }
  },

  // Show error state
  showErrorState(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return '';

    const {
      title = 'Terjadi Kesalahan',
      message = 'Gagal memuat data. Silakan coba lagi.',
      showRetry = true,
      onRetry = null,
      connected = false
    } = options;

    const errorHtml = `
      <div class="error-state">
        <div class="error-state__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 class="error-state__title">${title}</h3>
        <p class="error-state__message">${message}</p>
        <div class="error-state__status">
          <span class="error-state__status-dot ${connected ? 'connected' : ''}"></span>
          <span>${connected ? 'Koneksi aktif' : 'Koneksi terputus'}</span>
        </div>
        ${showRetry ? `
          <div class="error-state__actions">
            <button class="btn btn--primary" onclick="LoadingManager.retryLoad('${containerId}', ${JSON.stringify(options).replace(/"/g, '&quot;')})">
              <i data-lucide="refresh-cw"></i>
              <span>Coba Lagi</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = errorHtml;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    return containerId;
  },

  // Retry loading
  retryLoad(containerId, options) {
    if (options.onRetry && typeof options.onRetry === 'function') {
      options.onRetry();
    } else {
      // Default: just hide error and show skeleton again
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '<div class="inline-loading"><div class="inline-loading__spinner"></div><span>Memuat...</span></div>';
      }
    }
  },

  // Show empty state
  showEmptyState(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return '';

    const {
      title = 'Belum Ada Data',
      description = 'Data akan muncul di sini ketika sudah tersedia.',
      icon = 'inbox',
      showAction = false,
      actionText = 'Tambah Baru',
      onAction = null
    } = options;

    const icons = {
      inbox: '<path d="M22 12h-6l-2 3H10l-2-3H2"></path><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>',
      product: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line>',
      outlet: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
      distribution: '<circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line>',
      opname: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
      user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>'
    };

    const iconPath = icons[icon] || icons.inbox;

    const emptyHtml = `
      <div class="empty-state">
        <div class="empty-state__illustration">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            ${iconPath}
          </svg>
        </div>
        <h3 class="empty-state__title">${title}</h3>
        <p class="empty-state__description">${description}</p>
        ${showAction ? `
          <div class="empty-state__actions">
            <button class="btn btn--primary" onclick="LoadingManager.handleEmptyAction(${onAction ? '() => {' + onAction.toString() + '}' : 'null'}, '${containerId}')">
              <i data-lucide="plus"></i>
              <span>${actionText}</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = emptyHtml;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    return containerId;
  },

  // Handle empty state action
  handleEmptyAction(callback, containerId) {
    if (callback && typeof callback === 'function') {
      callback();
    }
  },

  // Show empty card (for tables)
  showEmptyCard(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return '';

    const {
      title = 'Belum Ada Data',
      description = 'Klik tombol di bawah untuk menambahkan data baru.',
      icon = 'inbox',
      showAction = true,
      actionText = 'Tambah',
      onAction = null
    } = options;

    const icons = {
      inbox: '<path d="M22 12h-6l-2 3H10l-2-3H2"></path><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>',
      product: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line>',
      outlet: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
      distribution: '<circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line>',
      opname: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>'
    };

    const iconPath = icons[icon] || icons.inbox;

    const cardHtml = `
      <div class="empty-card">
        <div class="empty-card__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${iconPath}
          </svg>
        </div>
        <h3 class="empty-card__title">${title}</h3>
        <p class="empty-card__description">${description}</p>
        ${showAction ? `
          <button class="btn btn--primary" onclick="LoadingManager.handleEmptyAction(${onAction ? '() => {' + onAction.toString() + '}' : 'null'}, '${containerId}')">
            <i data-lucide="plus"></i>
            <span>${actionText}</span>
          </button>
        ` : ''}
      </div>
    `;

    container.innerHTML = cardHtml;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
    return containerId;
  },

  // Show inline loading
  showInlineLoading(containerId, text = 'Memuat...') {
    const container = document.getElementById(containerId);
    if (!container) return '';

    container.innerHTML = `
      <div class="inline-loading">
        <div class="inline-loading__spinner"></div>
        <span>${text}</span>
      </div>
    `;
    return containerId;
  },

  // Fade in content
  fadeIn(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.classList.add('fade-in');
    }
  },

  // Fade in content with stagger
  fadeInStagger(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.classList.add('fade-in-stagger');
    }
  }
};

// Export for use
window.LoadingManager = LoadingManager;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  LoadingManager.init();
});