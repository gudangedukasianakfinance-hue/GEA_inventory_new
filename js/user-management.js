/**
 * User Management Module
 * Handles user CRUD operations for CV EPIC Warehouse
 */

// User Management State
let currentEditingUserId = null;

/**
 * Load users list with filters
 */
async function loadUsersList() {
  const searchTerm = document.getElementById('userSearch')?.value || '';
  const roleFilter = document.getElementById('roleFilter')?.value || '';
  const statusFilter = document.getElementById('statusFilter')?.value || '';
  
  const tableBody = document.getElementById('usersTableBody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Memuat...</td></tr>';
  
  try {
    // Build query params
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (roleFilter) params.append('role', roleFilter);
    if (statusFilter) params.append('is_active', statusFilter);
    
    const queryString = params.toString();
    const url = queryString ? `/v1/users?${queryString}` : '/v1/users';
    
    const response = await fetchJson(url, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    // Handle API response format: { success: true, data: [...], pagination: {...} }
    let users = [];
    if (response && response.success && response.data) {
      users = response.data;
    } else if (Array.isArray(response)) {
      users = response;
    }
    
    // Update count
    const userCount = document.getElementById('userCount');
    if (userCount) {
      userCount.textContent = `${users.length} pengguna`;
    }
    
    // Render table
    renderUsersTable(users);
    
  } catch (error) {
    console.error('Error loading users:', error);
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error); padding: 20px;">Gagal memuat data pengguna</td></tr>';
  }
}

/**
 * Render users table
 */
function renderUsersTable(users) {
  const tableBody = document.getElementById('usersTableBody');
  if (!tableBody) return;
  
  if (!users || users.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada pengguna yang ditemukan</td></tr>';
    return;
  }
  
  tableBody.innerHTML = users.map(user => `
    <tr>
      <td>
        <div class="user-name-cell">
          <div class="user-avatar">${(user.name || user.username || 'U').charAt(0).toUpperCase()}</div>
          <div class="user-info">
            <span class="user-fullname">${user.name || '-'}</span>
          </div>
        </div>
      </td>
      <td>${user.username || '-'}</td>
      <td>${user.email || '-'}</td>
      <td><span class="role-badge role-${user.role || 'unknown'}">${formatRole(user.role)}</span></td>
      <td>
        <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">
          ${user.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="editUser(${user.id})" title="Edit">
            <i data-lucide="pencil"></i>
          </button>
          <button class="btn-icon btn-danger" onclick="deleteUser(${user.id})" title="Hapus">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  
  // Re-initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

/**
 * Format role display name
 */
function formatRole(role) {
  const roleMap = {
    'admin': 'Admin',
    'staff_gudang': 'Staff Gudang',
    'checker_opname': 'Checker Opname'
  };
  return roleMap[role] || role || 'Unknown';
}

/**
 * Open add user modal
 */
function openAddUserModal() {
  currentEditingUserId = null;
  const modal = document.getElementById('userModal');
  const title = document.getElementById('userModalTitle');
  const form = document.getElementById('userForm');
  
  if (title) title.textContent = 'Tambah User Baru';
  if (form) form.reset();
  
  // Reset role selection to default
  const roleSelect = document.getElementById('userRole');
  if (roleSelect) roleSelect.value = 'staff_gudang';
  
  if (modal) {
    modal.style.display = 'flex';
    lucide.createIcons();
  }
}

/**
 * Edit user
 */
async function editUser(userId) {
  currentEditingUserId = userId;
  
  try {
    const response = await fetchJson(`/v1/users/${userId}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    // Handle API response format: { success: true, data: {...} }
    const user = response?.data || response;
    
    if (!user || !user.id) {
      showToast('User tidak ditemukan', false);
      return;
    }
    
    // Populate form - use 'name' field from API (mapped from nama_lengkap)
    document.getElementById('userUsername').value = user.username || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userNamaLengkap').value = user.name || user.nama_lengkap || '';
    document.getElementById('userRole').value = user.role || 'staff_gudang';
    document.getElementById('userStatus').checked = user.is_active !== false;
    
    // Update modal title
    const title = document.getElementById('userModalTitle');
    if (title) title.textContent = 'Edit User';
    
    // Show modal
    const modal = document.getElementById('userModal');
    if (modal) {
      modal.style.display = 'flex';
      lucide.createIcons();
    }
    
  } catch (error) {
    console.error('Error loading user:', error);
    showToast('Gagal memuat data user', false);
  }
}

/**
 * Save user (create or update)
 */
async function saveUser() {
  const username = document.getElementById('userUsername')?.value?.trim();
  const email = document.getElementById('userEmail')?.value?.trim();
  const name = document.getElementById('userNamaLengkap')?.value?.trim();
  const role = document.getElementById('userRole')?.value;
  const password = document.getElementById('userPassword')?.value;
  const is_active = document.getElementById('userStatus')?.checked ?? true;
  
  // Validation
  if (!username) {
    showToast('Username wajib diisi', false);
    return;
  }
  
  if (!name) {
    showToast('Nama lengkap wajib diisi', false);
    return;
  }
  
  if (!currentEditingUserId && !password) {
    showToast('Password wajib diisi untuk user baru', false);
    return;
  }
  
  if (password && password.length < 6) {
    showToast('Password minimal 6 karakter', false);
    return;
  }
  
  // Build payload - use 'name' field as expected by backend
  const payload = {
    username,
    email,
    name,
    role,
    is_active
  };
  
  if (password) {
    payload.password = password;
  }
  
  try {
    const method = currentEditingUserId ? 'PUT' : 'POST';
    const url = currentEditingUserId ? `/v1/users/${currentEditingUserId}` : '/v1/users';
    
    const response = await fetchJson(url, {
      method,
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    showToast(currentEditingUserId ? 'User berhasil diupdate' : 'User berhasil dibuat', true);
    closeUserModal();
    loadUsersList();
    
  } catch (error) {
    console.error('Error saving user:', error);
    showToast(error.message || 'Gagal menyimpan user', false);
  }
}

/**
 * Delete user
 */
async function deleteUser(userId) {
  if (!confirm('Yakin ingin menghapus user ini?')) {
    return;
  }
  
  try {
    await fetchJson(`/v1/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    showToast('User berhasil dihapus', true);
    loadUsersList();
    
  } catch (error) {
    console.error('Error deleting user:', error);
    showToast(error.message || 'Gagal menghapus user', false);
  }
}

/**
 * Close user modal
 */
function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentEditingUserId = null;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Add modal close handlers
  const closeBtn = document.querySelector('#userModal .modal__close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeUserModal);
  }
  
  const cancelBtn = document.querySelector('#userModal .btn-secondary');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeUserModal);
  }
  
  // Add save handler
  const saveBtn = document.querySelector('#userModal .btn-primary');
  if (saveBtn && !saveBtn.onclick) {
    saveBtn.addEventListener('click', saveUser);
  }
});