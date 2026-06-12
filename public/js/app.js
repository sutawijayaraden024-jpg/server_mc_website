let currentUser = null;
let currentPage = 'home';
let allPosts = [];
let filteredCategory = 'all';

const STORAGE_KEYS = {
  users: 'servermc_users',
  sessions: 'servermc_sessions',
  online: 'servermc_online',
  posts: 'servermc_posts',
  font: 'fontSettings',
  apiBase: 'servermc_api_base'
};

const ADMIN_ACCOUNTS = [
  {
    email: 'scarlettruiss@gmail.com',
    name: 'Ra172',
    xuid: '2535433223991124',
    minecraft_name: 'ruiss971',
    role: 'admin'
  },
  {
    email: 'khumairaputry3@gmail.com',
    name: 'people1975',
    xuid: '',
    minecraft_name: 'people1975',
    role: 'admin'
  }
];
initializeAccountStore();
migrateLegacyAccountData();
let registeredUsers = loadUsers();
let onlinePlayers = loadOnlinePlayers();
let sessions = loadSessions();
let verificationCodes = loadVerificationCodes();

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadFontSettings();
  loadPosts();
  renderPlayerDataSection();
  toggleScrollButton();
  window.addEventListener('scroll', toggleScrollButton);

  if (currentUser) {
    markOnline(currentUser);
    hideAuthOverlay();
    navigateTo('home');
  } else {
    navigateTo('home');
    showAuthOverlay();
  }
});

function initializeAccountStore() {
  if (!isRemoteAuthAvailable() && !localStorage.getItem(STORAGE_KEYS.users) && !localStorage.getItem('registeredUsers')) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([
      {
        id: 1,
        name: 'Ra172',
        email: 'scarlettruiss@gmail.com',
        role: 'admin',
        xuid: '2535433223991124',
        minecraft_name: 'ruiss971',
        joined_at: new Date().toISOString()
      },

      {
        id: 2,
        name: 'people1975',
        email: 'khumairaputry3@gmail.com',
        role: 'admin',
        xuid: '',
        minecraft_name: 'people1975',
        joined_at: new Date().toISOString()
      }
    ]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.sessions)) {
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.online)) {
    localStorage.setItem(STORAGE_KEYS.online, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.apiBase) && typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) {
    localStorage.setItem(STORAGE_KEYS.apiBase, window.location.origin);
  }
}

function migrateLegacyAccountData() {
  const legacyUsers = localStorage.getItem('registeredUsers');
  const legacyOnline = localStorage.getItem('activePlayers');
  const legacyToken = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('user');

  if (legacyUsers) {
    const currentUsers = loadUsers();
    const legacyList = safeParseArray(legacyUsers);
    const mergedUsers = mergeUsers(currentUsers, legacyList);
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(mergedUsers));
  }

  if (legacyOnline) {
    const currentOnline = loadOnlinePlayers();
    const legacyOnlineList = safeParseArray(legacyOnline);
    const mergedOnline = mergeUsers(currentOnline, legacyOnlineList);
    localStorage.setItem(STORAGE_KEYS.online, JSON.stringify(mergedOnline));
  }

  if (legacyToken && !localStorage.getItem('servermc_token')) {
    localStorage.setItem('servermc_token', legacyToken);
  }

  if (legacyUser && !localStorage.getItem('servermc_user')) {
    localStorage.setItem('servermc_user', legacyUser);
  }
}

function safeParseArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeUsers(primary, secondary) {
  const map = new Map();
  [...secondary, ...primary].forEach(user => {
    const normalized = normalizeUser(user);
    if (normalized.email) {
      map.set(normalized.email.toLowerCase(), normalized);
    }
  });
  return Array.from(map.values());
}

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]'); }
  catch { return []; }
}

function saveUsers() {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(registeredUsers));
}

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.sessions) || '[]'); }
  catch { return []; }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
}

function loadOnlinePlayers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.online) || '[]'); }
  catch { return []; }
}

function saveOnlinePlayers() {
  localStorage.setItem(STORAGE_KEYS.online, JSON.stringify(onlinePlayers));
}

function loadVerificationCodes() {
  try { return JSON.parse(localStorage.getItem('verificationCodes') || '{}'); }
  catch { return {}; }
}

function saveVerificationCodes() {
  localStorage.setItem('verificationCodes', JSON.stringify(verificationCodes));
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function requestVerificationCode(email, mode) {
  const code = generateVerificationCode();
  verificationCodes[email] = { code, mode, expiresAt: Date.now() + 5 * 60 * 1000 };
  saveVerificationCodes();
  return code;
}

function isCodeValid(email, code, expectedMode) {
  const record = verificationCodes[email];
  if (!record || record.mode !== expectedMode) return false;
  if (Date.now() > record.expiresAt) {
    delete verificationCodes[email];
    saveVerificationCodes();
    return false;
  }
  return record.code === code;
}

function clearVerificationCode(email) {
  delete verificationCodes[email];
  saveVerificationCodes();
}

function createToken() {
  return 'smc_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getApiBaseUrl() {
  const stored = (localStorage.getItem(STORAGE_KEYS.apiBase) || '').trim().replace(/\/+$/, '');
  if (stored) return stored;
  if (typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol)) {
    return window.location.origin;
  }
  return '';
}

function hasApiBridge() {
  return Boolean(getApiBaseUrl());
}

async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('API bridge not configured');
  }

  const response = await fetch(baseUrl + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || 'API request failed: ' + response.status);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function syncAuthRegister(user) {
  if (!hasApiBridge()) return null;
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: user.name,
      email: user.email,
      password: user.password || '',
      role: user.role,
      xuid: user.xuid || '',
      minecraft_name: user.minecraft_name || ''
    })
  });
}

async function syncAuthLogin(user) {
  if (!hasApiBridge()) return null;
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      password: user.password || '',
      username: user.name,
      xuid: user.xuid || '',
      minecraft_name: user.minecraft_name || ''
    })
  });
}

async function syncServerJoin(user) {
  if (!hasApiBridge()) return null;
  return apiRequest('/api/server/join', {
    method: 'POST',
    body: JSON.stringify({
      username: user.name,
      email: user.email,
      role: user.role,
      xuid: user.xuid || '',
      minecraft_name: user.minecraft_name || '',
      server: 'server_lobby'
    })
  });
}

async function syncServerLeave(user) {
  if (!hasApiBridge()) return null;
  return apiRequest('/api/server/leave', {
    method: 'POST',
    body: JSON.stringify({
      username: user.name,
      email: user.email,
      role: user.role,
      xuid: user.xuid || '',
      minecraft_name: user.minecraft_name || '',
      server: 'server_lobby'
    })
  });
}

function normalizeUser(user) {
  const email = user.email || '';
  const name = user.name || user.username || email.split('@')[0] || 'Player';
  const role = user.role === 'admin' || user.role === 'operator' ? 'admin' : 'member';
  const adminAccount = getAdminAccount(email);
  const isAdmin = Boolean(adminAccount);
  return {
    id: user.id || Math.floor(Math.random() * 100000),
    name: adminAccount?.name || name,
    email,
    role: isAdmin ? 'admin' : role,
    password: isRemoteAuthAvailable() ? '' : (user.password || ''),
    xuid: user.xuid || adminAccount?.xuid || '',
    minecraft_name: user.minecraft_name || user.minecraftName || adminAccount?.minecraft_name || '',
    joined_at: user.joined_at || new Date().toISOString()
  };
}

function isRemoteAuthAvailable() {
  return Boolean(getApiBaseUrl());
}

function getAdminAccount(email) {
  if (isRemoteAuthAvailable()) return null;
  return ADMIN_ACCOUNTS.find(account => account.email === String(email || '').toLowerCase()) || null;
}

function persistCurrentUser(user, token = null) {
  currentUser = normalizeUser(user);
  const sessionToken = token || createToken();
  localStorage.setItem('servermc_token', sessionToken);
  localStorage.setItem('servermc_user', JSON.stringify(currentUser));
  sessions = sessions.filter(s => s.email !== currentUser.email);
  sessions.unshift({
    email: currentUser.email,
    token: sessionToken,
    role: currentUser.role,
    active: true,
    updated_at: new Date().toISOString()
  });
  saveSessions();
  updateAuthUI();
  return sessionToken;
}

function markOnline(user) {
  const normalized = normalizeUser(user);
  if (!onlinePlayers.some(u => u.email === normalized.email)) {
    onlinePlayers.unshift({
      id: normalized.id,
      name: normalized.name,
      email: normalized.email,
      role: normalized.role,
      xuid: normalized.xuid || '',
      minecraft_name: normalized.minecraft_name || '',
      joined_at: new Date().toISOString()
    });
    saveOnlinePlayers();
  }
  renderPlayerDataSection();
}

function markOffline(email) {
  onlinePlayers = onlinePlayers.filter(u => u.email !== email);
  sessions = sessions.map(s => s.email === email ? { ...s, active: false, updated_at: new Date().toISOString() } : s);
  saveOnlinePlayers();
  saveSessions();
  renderPlayerDataSection();
}

function saveRegisteredUser(user) {
  const normalized = normalizeUser(user);
  if (isRemoteAuthAvailable()) {
    normalized.password = '';
  }
  const existingIndex = registeredUsers.findIndex(u => u.email === normalized.email);
  if (existingIndex >= 0) {
    registeredUsers[existingIndex] = { ...registeredUsers[existingIndex], ...normalized };
  } else {
    registeredUsers.unshift(normalized);
  }
  saveUsers();
  return normalized;
}

function showToast(message) {
  const toast = document.getElementById('toast-message');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('visible');
  setTimeout(() => {
    toast.classList.remove('visible');
    toast.classList.add('hidden');
  }, 3000);
}

function showAuthOverlay() {
  document.getElementById('auth-overlay')?.classList.remove('hidden');
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay')?.classList.add('hidden');
}

function setCurrentUser(user) {
  persistCurrentUser(user);
}

function checkAuth() {
  const userData = localStorage.getItem('servermc_user') || localStorage.getItem('user');
  const token = localStorage.getItem('servermc_token') || localStorage.getItem('token');
  if (!userData || !token) return;
  try {
    currentUser = normalizeUser(JSON.parse(userData));
    if (!localStorage.getItem('servermc_user')) {
      localStorage.setItem('servermc_user', JSON.stringify(currentUser));
    }
    if (!localStorage.getItem('servermc_token')) {
      localStorage.setItem('servermc_token', token);
    }
    if (hasApiBridge()) {
      validateSession(token).then(result => {
        if (result?.authenticated) {
          currentUser = normalizeUser({
            ...currentUser,
            email: result.email || currentUser.email,
            name: result.username || currentUser.name,
            role: result.role || currentUser.role,
            xuid: result.xuid || currentUser.xuid
          });
          updateAuthUI();
          return;
        }
        logoutSilently();
      }).catch(() => {
        updateAuthUI();
      });
    } else {
      updateAuthUI();
    }
  } catch {
    localStorage.removeItem('servermc_user');
    localStorage.removeItem('servermc_token');
    currentUser = null;
  }
}

async function validateSession(token) {
  return apiRequest('/api/auth/session', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

function logoutSilently() {
  localStorage.removeItem('servermc_user');
  localStorage.removeItem('servermc_token');
  currentUser = null;
  updateAuthUI();
  showAuthOverlay();
}

function updateAuthUI() {
  const authButtons = document.getElementById('auth-buttons');
  const userMenuContainer = document.getElementById('user-menu-container');
  const adminPanelLink = document.getElementById('admin-panel-link');
  const fontEditorToggle = document.getElementById('font-editor-toggle');
  const emailDisplay = document.getElementById('user-email-display');
  const roleDisplay = document.getElementById('user-role-display');

  if (!authButtons || !userMenuContainer) return;

  if (currentUser) {
    authButtons.classList.add('hidden');
    userMenuContainer.classList.remove('hidden');
    document.getElementById('user-display-name').textContent = currentUser.name;
    if (emailDisplay) emailDisplay.textContent = currentUser.email;
    if (roleDisplay) roleDisplay.textContent = currentUser.role === 'admin' ? 'Admin' : 'Member';
    if (adminPanelLink) adminPanelLink.classList.toggle('hidden', currentUser.role !== 'admin');
    if (fontEditorToggle) fontEditorToggle.classList.toggle('hidden', currentUser.role !== 'admin');
    setBridgeStatus('Login aktif: ' + (hasApiBridge() ? 'backend bridge' : 'mode lokal'));
  } else {
    authButtons.classList.remove('hidden');
    userMenuContainer.classList.add('hidden');
    if (fontEditorToggle) fontEditorToggle.classList.add('hidden');
    setBridgeStatus('Mode tamu: silakan login atau register');
  }
}

function setBridgeStatus(message) {
  document.getElementById('auth-bridge-status')?.replaceChildren(document.createTextNode(message));
  document.getElementById('register-bridge-status')?.replaceChildren(document.createTextNode(message));
}

function toggleUserMenu() {
  document.getElementById('user-dropdown')?.classList.toggle('active');
}

const authRestrictedPages = ['server', 'update', 'event', 'komunitas', 'members', 'admin'];

function navigateTo(page) {
  if (authRestrictedPages.includes(page) && !currentUser) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('home')?.classList.add('active');
    currentPage = 'home';
    showAuthOverlay();
    window.scrollTo(0, 0);
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(page)?.classList.add('active');
  currentPage = page;
  hideAuthOverlay();

  if (page === 'komunitas') loadPosts();
  if (page === 'members') loadMembers();
  document.getElementById('user-dropdown')?.classList.remove('active');
  window.scrollTo(0, 0);
  setBridgeStatus(hasApiBridge() ? 'Backend bridge aktif' : 'Mode lokal aktif');
}

function handleSendRegisterCode() {
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const errorDiv = document.getElementById('register-error');
  errorDiv?.classList.add('hidden');
  clearVerificationInfo('register-verification-info');
  if (!email || !password) {
    errorDiv.textContent = 'Masukkan email dan password terlebih dahulu.';
    errorDiv.classList.remove('hidden');
    return;
  }
  const code = requestVerificationCode(email, 'register');
  showVerificationInfo('register-verification-info', 'Kode verifikasi: ' + code + ' (berlaku 5 menit).');
}

function handleSendLoginCode() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv?.classList.add('hidden');
  clearVerificationInfo('login-verification-info');
  if (!email || !password) {
    errorDiv.textContent = 'Masukkan email dan password terlebih dahulu.';
    errorDiv.classList.remove('hidden');
    return;
  }
  const code = requestVerificationCode(email, 'login');
  showVerificationInfo('login-verification-info', 'Kode verifikasi: ' + code + ' (berlaku 5 menit).');
}

function showVerificationInfo(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearVerificationInfo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim().toLowerCase();
  const password = document.getElementById('register-password').value;
  const code = document.getElementById('register-code').value.trim();
  const errorDiv = document.getElementById('register-error');
  clearVerificationInfo('register-verification-info');
  errorDiv.classList.add('hidden');

  if (!name || !email || !password) {
    errorDiv.textContent = 'Nama, email, dan password harus diisi.';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!isCodeValid(email, code, 'register')) {
    errorDiv.textContent = 'Kode verifikasi tidak valid atau kedaluwarsa.';
    errorDiv.classList.remove('hidden');
    return;
  }

  clearVerificationCode(email);
  const adminAccount = getAdminAccount(email);
  const role = adminAccount ? 'admin' : 'member';
  const user = {
    name,
    email,
    role,
    password,
    xuid: adminAccount?.xuid || '',
    minecraft_name: adminAccount?.minecraft_name || ''
  };

  if (isRemoteAuthAvailable()) {
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        xuid: user.xuid,
        minecraft_name: user.minecraft_name
      })
    }).then(result => {
      const savedUser = saveRegisteredUser({
        ...user,
        role: result?.role || user.role,
        xuid: result?.xuid || user.xuid,
        minecraft_name: result?.username || user.name || user.minecraft_name
      });
      persistCurrentUser(savedUser, result?.token || null);
      markOnline(savedUser);
      syncServerJoin(savedUser).catch(() => {});
      navigateTo('home');
      showToast('Akun berhasil dibuat dan login.');
    }).catch(error => {
      errorDiv.textContent = error.message || 'Register gagal.';
      errorDiv.classList.remove('hidden');
    });
    return;
  }

  const savedUser = saveRegisteredUser(user);
  persistCurrentUser(savedUser);
  markOnline(savedUser);
  syncAuthRegister(savedUser).catch(() => {});
  syncServerJoin(savedUser).catch(() => {});
  navigateTo('home');
  showToast('Akun berhasil dibuat dan login.');
}

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const code = document.getElementById('login-code').value.trim();
  const errorDiv = document.getElementById('login-error');
  clearVerificationInfo('login-verification-info');
  errorDiv.classList.add('hidden');

  const submitLogin = async () => {
    if (isRemoteAuthAvailable()) {
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      const localUser = saveRegisteredUser({
        name: result.username || email.split('@')[0],
        email,
        role: result.role || 'member',
        password,
        xuid: result.xuid || '',
        minecraft_name: result.username || ''
      });
      persistCurrentUser(localUser, result.token || null);
      markOnline(localUser);
      syncServerJoin(localUser).catch(() => {});
      if (localUser.role === 'admin') {
        navigateTo('admin');
      } else {
        navigateTo('home');
      }
      showToast('Login berhasil.');
      return;
    }

    const user = registeredUsers.find(u => (u.email || '').toLowerCase() === email);
    if (!user) {
      errorDiv.textContent = 'Akun tidak ditemukan. Silakan register terlebih dahulu.';
      errorDiv.classList.remove('hidden');
      return;
    }

    const adminAccount = getAdminAccount(email);
    if (adminAccount) {
      const adminUser = { ...user, ...adminAccount };
      persistCurrentUser(adminUser);
      markOnline(adminUser);
      syncAuthLogin(adminUser).catch(() => {});
      syncServerJoin(adminUser).catch(() => {});
      navigateTo('admin');
      showToast('Login admin berhasil.');
      return;
    }

    if (!isCodeValid(email, code, 'login')) {
      errorDiv.textContent = 'Kode verifikasi tidak valid atau kedaluwarsa.';
      errorDiv.classList.remove('hidden');
      return;
    }

    if (user.password && user.password !== password) {
      errorDiv.textContent = 'Password salah.';
      errorDiv.classList.remove('hidden');
      return;
    }

    clearVerificationCode(email);
    persistCurrentUser(user);
    markOnline(user);
    syncAuthLogin(user).catch(() => {});
    syncServerJoin(user).catch(() => {});
    navigateTo('home');
    showToast('Login berhasil.');
  };

  submitLogin().catch(error => {
    errorDiv.textContent = error.message || 'Login gagal.';
    errorDiv.classList.remove('hidden');
  });
}

function syncSessionStatus() {
  if (!currentUser) return;
  syncServerJoin(currentUser).catch(() => {});
}

function logout() {
  if (currentUser?.email) {
    markOffline(currentUser.email);
    syncServerLeave(currentUser).catch(() => {});
  }
  localStorage.removeItem('servermc_user');
  localStorage.removeItem('servermc_token');
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  currentUser = null;
  updateAuthUI();
  navigateTo('home');
  showAuthOverlay();
  showToast('Logout berhasil.');
}

function deleteAccount() {
  if (!currentUser?.email) {
    showToast('Tidak ada akun aktif.');
    return;
  }
  if (!confirm('Hapus akun ini?')) return;
  registeredUsers = registeredUsers.filter(u => u.email !== currentUser.email);
  saveUsers();
  markOffline(currentUser.email);
  syncServerLeave(currentUser).catch(() => {});
  logout();
  renderPlayerDataSection();
  showToast('Akun berhasil dihapus.');
}

function renderPlayerDataSection() {
  registeredUsers = loadUsers();
  onlinePlayers = loadOnlinePlayers();
  sessions = loadSessions();

  const totalRegistered = registeredUsers.length;
  const totalOnline = onlinePlayers.length;
  document.getElementById('player-count-registered')?.replaceChildren(document.createTextNode(totalRegistered));
  document.getElementById('player-count-online')?.replaceChildren(document.createTextNode(totalOnline));
  document.getElementById('total-members')?.replaceChildren(document.createTextNode(totalRegistered));
  document.getElementById('total-active-members')?.replaceChildren(document.createTextNode(totalOnline));
  document.getElementById('hero-player-count')?.replaceChildren(document.createTextNode(totalOnline));
  document.getElementById('admin-total-players')?.replaceChildren(document.createTextNode(totalRegistered));
  document.getElementById('admin-active-players')?.replaceChildren(document.createTextNode(totalOnline));
  document.getElementById('admin-total-posts')?.replaceChildren(document.createTextNode(allPosts.length));

  const registeredList = document.getElementById('registered-player-list');
  if (registeredList) {
    registeredList.innerHTML = registeredUsers.length
      ? registeredUsers.map(user => `<li>${escapeHtml(user.name)} (${escapeHtml(user.email)}) - ${user.role === 'admin' ? 'Admin' : 'Member'}</li>`).join('')
      : '<li>Belum ada akun terdaftar.</li>';
  }

  const cardsContainer = document.getElementById('player-cards');
  if (cardsContainer) {
    cardsContainer.innerHTML = onlinePlayers.length
      ? onlinePlayers.map(player => `
          <div class="player-card">
            <h3>${escapeHtml(player.name)}</h3>
            <p><strong>Email:</strong> ${escapeHtml(player.email)}</p>
            <p><strong>Role:</strong> ${player.role === 'admin' ? 'Admin' : 'Member'}</p>
            <p><strong>Masuk:</strong> ${new Date(player.joined_at).toLocaleDateString('id-ID')}</p>
            <p class="player-status">Status: Online</p>
          </div>
        `).join('')
      : '<p class="text-center" style="color: var(--gray-muted); padding: 30px;">Tidak ada pemain online.</p>';
  }
}

function loadPosts() {
  const saved = localStorage.getItem(STORAGE_KEYS.posts);
  if (saved) {
    try { allPosts = JSON.parse(saved); }
    catch { allPosts = []; }
  }

  if (allPosts.length === 0) {
    allPosts = [
      {
        id: 1,
        title: 'Tutorial: Cara Membuat Rumah Minimalis Modern',
        category: 'Tips & Trik',
        content: 'Saya akan membagikan step-by-step cara membuat rumah minimalis modern yang terlihat elegan dan nyaman...',
        tags: ['building', 'tutorial', 'design'],
        author_name: 'BuilderMaster',
        author_email: 'builder@example.com',
        likes: 0,
        replies: 0,
        views: 0,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
        avatar: '👷'
      }
    ];
  }

  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(allPosts));
  document.getElementById('total-posts')?.replaceChildren(document.createTextNode(allPosts.length));
  displayPosts();
}

function displayPosts() {
  const postsList = document.getElementById('posts-list');
  if (!postsList) return;
  const filteredPosts = filteredCategory === 'all' ? allPosts : allPosts.filter(p => p.category === filteredCategory);
  postsList.innerHTML = filteredPosts.length
    ? filteredPosts.map(post => `
      <div class="post-card">
        <div class="post-header">
          <div class="post-avatar">${post.avatar}</div>
          <div class="post-meta">
            <div class="post-author">${escapeHtml(post.author_name)}</div>
            <div class="post-date">${formatDate(post.created_at)}</div>
          </div>
        </div>
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="post-content">${escapeHtml(post.content)}</div>
        <div class="post-tags">
          <span class="tag">${escapeHtml(post.category)}</span>
          ${(post.tags || []).map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="post-stats">
          <div class="post-stat"><button onclick="likePost(${post.id}); return false;">❤️</button><span>${post.likes} Suka</span></div>
          <div class="post-stat"><button onclick="replyPost(${post.id}); return false;">💬</button><span>${post.replies} Balasan</span></div>
          <div class="post-stat"><button onclick="viewPost(${post.id}); return false;">👁️</button><span>${post.views} Dilihat</span></div>
        </div>
      </div>
    `).join('')
    : '<p class="text-center" style="color: var(--gray-muted); padding: 40px;">Tidak ada post ditemukan</p>';
}

function navigateToCommunityCategory(category) {
  filteredCategory = category;
  navigateTo('komunitas');
  displayPosts();
}

function likePost(postId) {
  if (!currentUser) return navigateTo('login');
  const post = allPosts.find(p => p.id === postId);
  if (post) {
    post.likes += 1;
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(allPosts));
    displayPosts();
  }
}

function replyPost(postId) {
  if (!currentUser) return navigateTo('login');
  const post = allPosts.find(p => p.id === postId);
  if (post) {
    post.replies += 1;
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(allPosts));
    displayPosts();
    showToast('Balasan tercatat.');
  }
}

function viewPost(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (post) {
    post.views += 1;
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(allPosts));
    displayPosts();
  }
}

function showCreatePostForm() {
  if (!currentUser) return navigateTo('login');
  if (currentUser.role !== 'admin') return alert('Hanya admin yang dapat membuat post');
  navigateTo('admin');
}

function handleCreatePost(event) {
  event.preventDefault();
  if (!currentUser || currentUser.role !== 'admin') return;

  const title = document.getElementById('post-title').value.trim();
  const category = document.getElementById('post-category').value;
  const content = document.getElementById('post-content').value.trim();
  const tags = document.getElementById('post-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const errorDiv = document.getElementById('admin-error');
  const successDiv = document.getElementById('admin-success');

  if (!title || !content) {
    errorDiv.textContent = 'Judul dan konten harus diisi.';
    errorDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
    return;
  }

  allPosts.unshift({
    id: Date.now(),
    title,
    category,
    content,
    tags,
    author_name: currentUser.name,
    author_email: currentUser.email,
    likes: 0,
    replies: 0,
    views: 0,
    created_at: new Date().toISOString(),
    avatar: '🎮'
  });

  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(allPosts));
  errorDiv.classList.add('hidden');
  successDiv.textContent = 'Post berhasil dibuat.';
  successDiv.classList.remove('hidden');
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  document.getElementById('post-tags').value = '';
  renderPlayerDataSection();
  displayPosts();
  setTimeout(() => navigateTo('komunitas'), 900);
}

function loadMembers() {
  displayMembers(registeredUsers);
}

function displayMembers(users) {
  const membersList = document.getElementById('members-list');
  if (!membersList) return;
  membersList.innerHTML = users.length
    ? users.map(user => `
      <div class="member-card">
        <div class="member-avatar">👤</div>
        <div class="member-name">${escapeHtml(user.name)}</div>
        <div class="member-email">${escapeHtml(user.email)}</div>
        <div class="member-role">${user.role === 'admin' ? 'Admin' : 'Member'}</div>
        <div class="member-joined">Bergabung: ${formatDate(user.joined_at)}</div>
      </div>
    `).join('')
    : '<p class="text-center" style="color: var(--gray-muted); padding: 40px; grid-column: 1/-1;">Tidak ada member ditemukan</p>';
}

function toggleFontEditor() {
  document.getElementById('font-editor')?.classList.toggle('hidden');
}

function updateFontSettings() {
  const headingFont = document.getElementById('heading-font').value;
  const bodyFont = document.getElementById('body-font').value;
  const headingSize = document.getElementById('heading-size').value;
  const bodySize = document.getElementById('body-size').value;
  const headingWeight = document.getElementById('heading-weight').value;

  document.documentElement.style.setProperty('--font-heading', headingFont);
  document.documentElement.style.setProperty('--font-body', bodyFont);
  document.documentElement.style.setProperty('--font-size-h1', headingSize + 'px');
  document.documentElement.style.setProperty('--font-size-body', bodySize + 'px');
  document.documentElement.style.setProperty('--font-weight-h1', headingWeight);
  document.getElementById('heading-size-value').textContent = headingSize;
  document.getElementById('body-size-value').textContent = bodySize;

  localStorage.setItem(STORAGE_KEYS.font, JSON.stringify({
    headingFont, bodyFont, headingSize, bodySize, headingWeight
  }));
}

function loadFontSettings() {
  const saved = localStorage.getItem(STORAGE_KEYS.font);
  if (!saved) return;
  try {
    const settings = JSON.parse(saved);
    document.getElementById('heading-font').value = settings.headingFont || 'Playfair Display';
    document.getElementById('body-font').value = settings.bodyFont || 'Poppins';
    document.getElementById('heading-size').value = settings.headingSize || '48';
    document.getElementById('body-size').value = settings.bodySize || '16';
    document.getElementById('heading-weight').value = settings.headingWeight || '700';
    updateFontSettings();
  } catch {}
}

function resetFontSettings() {
  document.getElementById('heading-font').value = 'Playfair Display';
  document.getElementById('body-font').value = 'Poppins';
  document.getElementById('heading-size').value = '48';
  document.getElementById('body-size').value = '16';
  document.getElementById('heading-weight').value = '700';
  updateFontSettings();
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleScrollButton() {
  const button = document.getElementById('scrollToTopButton');
  if (!button) return;
  button.classList.toggle('hidden', window.scrollY <= 220);
}

function scrollToSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleUserMenu() {
  document.getElementById('user-dropdown')?.classList.toggle('active');
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  if (dateOnly.getTime() === todayOnly.getTime()) return 'Hari ini';
  if (dateOnly.getTime() === yesterdayOnly.getTime()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}
