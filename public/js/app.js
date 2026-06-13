let currentUser = null;
let communityUser = null;
let currentPage = 'home';
let allPosts = [];
let communityChats = [];
let communityMessages = [];
let activeChatId = null;
let chatPollTimer = null;
let chatSearchQuery = '';
let profileViewEmail = null;
let communityOverlayOpen = false;

const STORAGE_KEYS = {
  users: 'servermc_users',
  sessions: 'servermc_sessions',
  online: 'servermc_online',
  posts: 'servermc_posts',
  community: 'servermc_community',
  communityProfiles: 'servermc_community_profiles',
  font: 'fontSettings',
  apiBase: 'servermc_api_base'
};

const COMMUNITY_STORAGE_KEYS = {
  user: 'servermc_community_user',
  token: 'servermc_community_token'
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
    name: 'Al170',
    xuid: '',
    minecraft_name: 'Al170',
    role: 'admin'
  }
];
initializeAccountStore();
migrateLegacyAccountData();
reconcileStoredUsers();
let registeredUsers = loadUsers();
let onlinePlayers = loadOnlinePlayers();
let sessions = loadSessions();
let verificationCodes = loadVerificationCodes();

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  checkCommunityAuth();
  clearSensitiveFormState();
  loadFontSettings();
  syncBackendState().finally(() => {
    loadPosts();
    renderPlayerDataSection();
    if (document.getElementById('settings-content')) {
      initCommunitySettingsPage();
    }
  });
  toggleScrollButton();
  updateCommunityFabVisibility();
  window.addEventListener('scroll', toggleScrollButton);

  if (document.getElementById('settings-content')) {
    return;
  }

  if (currentUser) {
    markOnline(currentUser);
    hideAuthOverlay();
    navigateTo('home');
  } else {
    navigateTo('home');
    showAuthOverlay();
  }

  if (window.location.hash === '#community') {
    openCommunityOverlay();
  }
});

function getCommunityActor() {
  return communityUser;
}

function checkCommunityAuth() {
  const userData = localStorage.getItem(COMMUNITY_STORAGE_KEYS.user);
  const token = localStorage.getItem(COMMUNITY_STORAGE_KEYS.token);
  if (!userData || !token) {
    communityUser = null;
    updateCommunityAuthUI();
    return;
  }
  try {
    communityUser = normalizeUser(JSON.parse(userData));
    updateCommunityAuthUI();
  } catch {
    communityUser = null;
    localStorage.removeItem(COMMUNITY_STORAGE_KEYS.user);
    localStorage.removeItem(COMMUNITY_STORAGE_KEYS.token);
    updateCommunityAuthUI();
  }
}

function persistCommunityUser(user, token = null) {
  communityUser = normalizeUser(user);
  const sessionToken = token || createToken();
  localStorage.setItem(COMMUNITY_STORAGE_KEYS.user, JSON.stringify(communityUser));
  localStorage.setItem(COMMUNITY_STORAGE_KEYS.token, sessionToken);
  updateCommunityAuthUI();
  return sessionToken;
}

function updateCommunityAuthUI() {
  const label = document.getElementById('community-user-label');
  if (label) {
    label.textContent = communityUser?.name || 'Guest';
  }
  updateCommunityFabVisibility();
}

function updateCommunityFabVisibility() {
  const fabWrap = document.getElementById('community-fab-wrap');
  if (!fabWrap) return;
  fabWrap.style.display = communityOverlayOpen ? 'none' : '';
}

function showCommunityLoginOverlay() {
  const overlay = document.getElementById('community-login-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  const emailInput = document.getElementById('community-login-email');
  if (emailInput && currentUser?.email && !emailInput.value) {
    emailInput.value = currentUser.email;
  }
}

function hideCommunityLoginOverlay() {
  document.getElementById('community-login-overlay')?.classList.add('hidden');
  document.getElementById('community-login-error')?.classList.add('hidden');
}

async function handleCommunityLogin(event) {
  event.preventDefault();
  const email = document.getElementById('community-login-email')?.value.trim().toLowerCase();
  const password = document.getElementById('community-login-password')?.value || '';
  const errorDiv = document.getElementById('community-login-error');
  errorDiv?.classList.add('hidden');

  if (!email || !password) {
    if (errorDiv) {
      errorDiv.textContent = 'Email dan password harus diisi.';
      errorDiv.classList.remove('hidden');
    }
    return;
  }

  try {
    if (isRemoteAuthAvailable()) {
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      const localUser = saveRegisteredUser({
        name: result.username || email.split('@')[0],
        email,
        role: resolveRole(email),
        password: '',
        xuid: result.xuid || '',
        minecraft_name: result.username || ''
      });
      persistCommunityUser(localUser, result.token || null);
    } else {
      const user = registeredUsers.find(u => (u.email || '').toLowerCase() === email);
      if (!user) {
        throw new Error('Akun tidak ditemukan. Daftar di website terlebih dahulu.');
      }
      const adminAccount = getAdminAccount(email);
      if (adminAccount) {
        persistCommunityUser({ ...user, ...adminAccount });
      } else if (user.password && user.password !== password) {
        throw new Error('Password salah.');
      } else {
        persistCommunityUser(user);
      }
    }

    hideCommunityLoginOverlay();
    showToast('Login komunitas berhasil.');
    if (typeof initCommunitySettingsPage === 'function' && document.getElementById('settings-content')) {
      initCommunitySettingsPage();
    }
    if (communityOverlayOpen || window.location.hash === '#community') {
      openCommunityOverlay(true);
    }
  } catch (error) {
    if (errorDiv) {
      errorDiv.textContent = error.message || 'Login komunitas gagal.';
      errorDiv.classList.remove('hidden');
    }
  }
}

function logoutCommunity(redirectHome = false) {
  localStorage.removeItem(COMMUNITY_STORAGE_KEYS.user);
  localStorage.removeItem(COMMUNITY_STORAGE_KEYS.token);
  communityUser = null;
  stopChatPolling();
  closeCommunityOverlay();
  updateCommunityAuthUI();
  showToast('Logout komunitas berhasil.');
  if (redirectHome) {
    window.location.href = 'index.html';
  } else if (typeof initCommunitySettingsPage === 'function') {
    initCommunitySettingsPage();
  }
}

function openCommunityOverlay(skipLoginCheck = false) {
  if (!skipLoginCheck && !communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  const overlay = document.getElementById('community-overlay');
  if (!overlay) {
    navigateTo('komunitas');
    return;
  }
  overlay.classList.remove('hidden');
  communityOverlayOpen = true;
  document.body.classList.add('community-overlay-open');
  toggleCommunityFabMenu(false);
  updateCommunityFabVisibility();
  loadCommunityChat();
  startChatPolling();
  updateCommunityAuthUI();
}

function closeCommunityOverlay() {
  document.getElementById('community-overlay')?.classList.add('hidden');
  communityOverlayOpen = false;
  document.body.classList.remove('community-overlay-open');
  stopChatPolling();
  updateCommunityFabVisibility();
}

function openCommunitySettings() {
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  window.location.href = 'community-settings.html';
}

function toggleCommunityFabMenu(forceState) {
  const menu = document.getElementById('community-fab-menu');
  if (!menu) return;
  const shouldShow = typeof forceState === 'boolean' ? forceState : menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !shouldShow);
}

function loadCommunityProfiles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.communityProfiles) || '{}');
  } catch {
    return {};
  }
}

function saveCommunityProfiles(profiles) {
  localStorage.setItem(STORAGE_KEYS.communityProfiles, JSON.stringify(profiles));
}

function getCommunityProfile(email) {
  const profiles = loadCommunityProfiles();
  return profiles[String(email || '').toLowerCase()] || {};
}

function getCommunityDisplayName(user) {
  if (!user) return 'Member';
  const profile = getCommunityProfile(user.email);
  return profile.displayName || user.name;
}

function saveCommunitySettings() {
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  const profiles = loadCommunityProfiles();
  const email = communityUser.email.toLowerCase();
  profiles[email] = {
    displayName: document.getElementById('settings-display-name')?.value.trim().slice(0, 40) || communityUser.name,
    bio: document.getElementById('settings-bio')?.value.trim().slice(0, 160) || ''
  };
  saveCommunityProfiles(profiles);
  showToast('Pengaturan komunitas disimpan.');
}

function initCommunitySettingsPage() {
  checkCommunityAuth();
  const guest = document.getElementById('settings-guest');
  const content = document.getElementById('settings-content');
  if (!guest || !content) return;

  if (!communityUser) {
    guest.classList.remove('hidden');
    content.classList.add('hidden');
    showCommunityLoginOverlay();
    return;
  }

  guest.classList.add('hidden');
  content.classList.remove('hidden');
  hideCommunityLoginOverlay();

  const profile = getCommunityProfile(communityUser.email);
  const isOnline = onlinePlayers.some(p => p.email === communityUser.email);

  document.getElementById('settings-name')?.replaceChildren(document.createTextNode(communityUser.name));
  document.getElementById('settings-email')?.replaceChildren(document.createTextNode(communityUser.email));
  document.getElementById('settings-role')?.replaceChildren(document.createTextNode(communityUser.role === 'admin' ? 'Admin' : 'Member'));
  document.getElementById('settings-status')?.replaceChildren(document.createTextNode(isOnline ? 'Online' : 'Offline'));

  const displayNameInput = document.getElementById('settings-display-name');
  const bioInput = document.getElementById('settings-bio');
  if (displayNameInput) displayNameInput.value = profile.displayName || communityUser.name;
  if (bioInput) bioInput.value = profile.bio || '';
}

function isUserOnline(email) {
  return onlinePlayers.some(player => player.email.toLowerCase() === String(email || '').toLowerCase());
}

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
        name: 'Al170',
        email: 'khumairaputry3@gmail.com',
        role: 'admin',
        xuid: '',
        minecraft_name: 'Al170',
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

async function syncBackendState() {
  if (!hasApiBridge()) return null;
  try {
    const data = await apiRequest('/api/public/state', { method: 'GET' });
    if (Array.isArray(data?.users)) {
      registeredUsers = data.users.map(user => normalizeUser(user));
      saveUsers();
    }
    if (Array.isArray(data?.online)) {
      onlinePlayers = data.online.map(user => normalizeUser(user));
      saveOnlinePlayers();
    }
    reconcileStoredUsers();
    registeredUsers = loadUsers();
    onlinePlayers = loadOnlinePlayers();
    if (currentUser) {
      currentUser = normalizeUser(currentUser);
      localStorage.setItem('servermc_user', JSON.stringify(currentUser));
      updateAuthUI();
    }
    renderPlayerDataSection();
    return data;
  } catch {
    return null;
  }
}

async function syncAuthRegister(user) {
  if (!hasApiBridge()) return null;
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: user.name,
      email: user.email,
      password: user.password || '',
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

function resolveRole(email) {
  return getAdminAccount(email) ? 'admin' : 'member';
}

function reconcileStoredUsers() {
  const users = loadUsers().map(normalizeUser);
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));

  const online = loadOnlinePlayers().map(normalizeUser);
  localStorage.setItem(STORAGE_KEYS.online, JSON.stringify(online));

  const storedUser = localStorage.getItem('servermc_user');
  if (storedUser) {
    try {
      localStorage.setItem('servermc_user', JSON.stringify(normalizeUser(JSON.parse(storedUser))));
    } catch {}
  }
}

function normalizeUser(user) {
  const email = (user.email || '').toLowerCase();
  const name = user.name || user.username || email.split('@')[0] || 'Player';
  const adminAccount = getAdminAccount(email);
  return {
    id: user.id || Math.floor(Math.random() * 100000),
    name: adminAccount?.name || name,
    email,
    role: resolveRole(email),
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
  const normalized = String(email || '').toLowerCase();
  return ADMIN_ACCOUNTS.find(account => String(account.email || '').toLowerCase() === normalized) || null;
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

const authRestrictedPages = ['server', 'update', 'event', 'members', 'admin'];

function navigateTo(page) {
  if (page === 'komunitas') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('komunitas')?.classList.add('active');
    currentPage = 'komunitas';
    hideAuthOverlay();
    openCommunityOverlay();
    window.scrollTo(0, 0);
    return;
  }

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
  if (page === 'login' || page === 'register') {
    clearSensitiveFormState(page);
  }

  stopChatPolling();
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

function clearSensitiveFormState(page = '') {
  const fields = [
    'login-email',
    'login-password',
    'login-code',
    'register-name',
    'register-email',
    'register-password',
    'register-code'
  ];

  for (const id of fields) {
    const input = document.getElementById(id);
    if (input) input.value = '';
  }

  clearVerificationInfo('login-verification-info');
  clearVerificationInfo('register-verification-info');

  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  loginError?.classList.add('hidden');
  registerError?.classList.add('hidden');
  if (loginError) loginError.textContent = '';
  if (registerError) registerError.textContent = '';

  if (page === 'login' || page === 'register') {
    // Prevent browser autofill from keeping old credentials visible.
    window.setTimeout(() => {
      const focused = document.getElementById(page === 'login' ? 'login-email' : 'register-name');
      focused?.focus?.();
    }, 0);
  }
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
  const user = {
    name,
    email,
    role: resolveRole(email),
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
        xuid: user.xuid,
        minecraft_name: user.minecraft_name
      })
    }).then(result => {
      const savedUser = saveRegisteredUser({
        ...user,
        role: resolveRole(email),
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
        role: resolveRole(email),
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
  const email = currentUser.email;
  // Prevent deleting allowlist admins locally
  const adminAccount = getAdminAccount(email);
  if (adminAccount) {
    showToast('Akun admin tidak dapat dihapus.');
    return;
  }

  if (isRemoteAuthAvailable()) {
    // Call backend to delete account from KV
    apiRequest('/api/auth/delete', {
      method: 'POST',
      body: JSON.stringify({ email })
    }).then(result => {
      if (result?.ok) {
        registeredUsers = registeredUsers.filter(u => u.email !== email);
        saveUsers();
        markOffline(email);
        logout();
        renderPlayerDataSection();
        showToast('Akun berhasil dihapus.');
      } else {
        showToast(result?.message || 'Gagal menghapus akun.');
      }
    }).catch(() => {
      showToast('Gagal menghapus akun (server error).');
    });
    return;
  }

  // Local-only site: remove from localStorage
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
  document.getElementById('total-chats')?.replaceChildren(document.createTextNode(communityChats.length));

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
}

const DEFAULT_GROUP_ID = 'group_umum';

function loadLocalCommunityState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.community) || '{}');
    return {
      chats: Array.isArray(saved.chats) ? saved.chats : [],
      messages: Array.isArray(saved.messages) ? saved.messages : []
    };
  } catch {
    return { chats: [], messages: [] };
  }
}

function saveLocalCommunityState(state) {
  localStorage.setItem(STORAGE_KEYS.community, JSON.stringify(state));
}

function ensureLocalDefaultGroup(state) {
  let defaultGroup = state.chats.find(chat => chat.id === DEFAULT_GROUP_ID);
  if (!defaultGroup) {
    defaultGroup = {
      id: DEFAULT_GROUP_ID,
      type: 'group',
      name: 'Grup Umum',
      members: [],
      created_by: 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      avatar: '🏯',
      last_message: null
    };
    state.chats.unshift(defaultGroup);
  }
  return defaultGroup;
}

function buildDirectChatId(emailA, emailB) {
  return `dm_${[emailA.toLowerCase(), emailB.toLowerCase()].sort().join('_')}`;
}

function getChatDisplayName(chat) {
  const actor = getCommunityActor();
  if (!chat || !actor) return 'Chat';
  if (chat.type === 'direct') {
    const otherEmail = (chat.members || []).find(email => email !== actor.email.toLowerCase());
    const otherUser = registeredUsers.find(u => u.email.toLowerCase() === otherEmail);
    return getCommunityDisplayName(otherUser || { name: chat.member_names?.[otherEmail] || otherEmail?.split('@')[0], email: otherEmail });
  }
  return chat.name || 'Grup';
}

function getChatAvatar(chat) {
  if (chat?.avatar) return chat.avatar;
  return chat?.type === 'direct' ? '💬' : '👥';
}

function getUserCommunityChats(state, email) {
  const normalizedEmail = email.toLowerCase();
  ensureLocalDefaultGroup(state);
  const defaultGroup = state.chats.find(chat => chat.id === DEFAULT_GROUP_ID);
  if (defaultGroup && !defaultGroup.members.includes(normalizedEmail)) {
    defaultGroup.members.push(normalizedEmail);
  }
  return state.chats
    .filter(chat => Array.isArray(chat.members) && chat.members.includes(normalizedEmail))
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
}

async function fetchCommunityFromApi() {
  const actor = getCommunityActor();
  if (!hasApiBridge() || !actor) return null;
  const email = encodeURIComponent(actor.email);
  const data = await apiRequest(`/api/community/chats?email=${email}`, { method: 'GET' });
  if (Array.isArray(data?.chats)) communityChats = data.chats;
  if (Array.isArray(data?.messages)) communityMessages = data.messages;
  return data;
}

async function loadCommunityChat() {
  const actor = getCommunityActor();
  if (!actor) return;

  try {
    if (hasApiBridge()) {
      await fetchCommunityFromApi();
    } else {
      const state = loadLocalCommunityState();
      communityChats = getUserCommunityChats(state, actor.email);
      const allowedIds = new Set(communityChats.map(chat => chat.id));
      communityMessages = state.messages.filter(message => allowedIds.has(message.chat_id));
      saveLocalCommunityState(state);
    }
  } catch {
    const state = loadLocalCommunityState();
    communityChats = getUserCommunityChats(state, actor.email);
    communityMessages = state.messages;
  }

  document.getElementById('total-chats')?.replaceChildren(document.createTextNode(communityChats.length));
  renderChatList();
  renderChatSearchResults();

  if (activeChatId && communityChats.some(chat => chat.id === activeChatId)) {
    renderActiveChat();
  } else {
    closeActiveChat();
  }
}

function startChatPolling() {
  stopChatPolling();
  chatPollTimer = setInterval(() => {
    if ((communityOverlayOpen || currentPage === 'komunitas') && getCommunityActor()) {
      loadCommunityChat();
    }
  }, 2000);
}

function stopChatPolling() {
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
}

function filterChatList() {
  chatSearchQuery = document.getElementById('chat-search')?.value.trim().toLowerCase() || '';
  renderChatList();
  renderChatSearchResults();
}

function renderChatSearchResults() {
  const container = document.getElementById('chat-search-results');
  const actor = getCommunityActor();
  if (!container) return;

  if (!chatSearchQuery || !actor) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  const matchingMembers = registeredUsers.filter(user => {
    if (user.email.toLowerCase() === actor.email.toLowerCase()) return false;
    const name = user.name.toLowerCase();
    const email = user.email.toLowerCase();
    const displayName = getCommunityDisplayName(user).toLowerCase();
    return name.includes(chatSearchQuery) || email.includes(chatSearchQuery) || displayName.includes(chatSearchQuery);
  }).slice(0, 8);

  if (!matchingMembers.length) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="chat-search-results-label">Member ditemukan</div>
    ${matchingMembers.map(user => `
      <button type="button" class="chat-search-result-item" onclick="handleSearchMemberSelect(${JSON.stringify(user.email)}, ${JSON.stringify(user.name)}); return false;">
        <div class="chat-avatar" style="width:36px;height:36px;font-size:16px;">👤</div>
        <div>
          <div class="chat-search-result-name">${escapeHtml(getCommunityDisplayName(user))}</div>
          <div class="chat-search-result-email">${escapeHtml(user.email)}${isUserOnline(user.email) ? ' <span class="online-dot"></span>' : ''}</div>
        </div>
      </button>
    `).join('')}
  `;
}

function handleSearchMemberSelect(email, name) {
  document.getElementById('chat-search').value = '';
  chatSearchQuery = '';
  renderChatSearchResults();
  renderChatList();
  startDirectChat(email, name);
}

function renderChatList() {
  const chatList = document.getElementById('chat-list');
  const actor = getCommunityActor();
  if (!chatList || !actor) return;

  const filtered = communityChats.filter(chat => {
    if (!chatSearchQuery) return true;
    const name = getChatDisplayName(chat).toLowerCase();
    const preview = (chat.last_message?.text || '').toLowerCase();
    return name.includes(chatSearchQuery) || preview.includes(chatSearchQuery);
  });

  chatList.innerHTML = filtered.length
    ? filtered.map(chat => {
        const isActive = chat.id === activeChatId;
        const preview = chat.last_message
          ? `${chat.last_message.sender_name === actor.name ? 'Anda: ' : ''}${chat.last_message.text}`
          : 'Belum ada pesan';
        const time = chat.last_message?.created_at
          ? formatChatTime(chat.last_message.created_at)
          : formatChatTime(chat.created_at);
        return `
          <div class="chat-list-item${isActive ? ' active' : ''}" onclick="openChat(${JSON.stringify(chat.id)}); return false;">
            <div class="chat-avatar">${getChatAvatar(chat)}</div>
            <div class="chat-list-body">
              <div class="chat-list-name">
                ${escapeHtml(getChatDisplayName(chat))}
                ${chat.type === 'group' && chat.id !== DEFAULT_GROUP_ID ? '<span class="chat-type-badge">Grup</span>' : ''}
              </div>
              <div class="chat-list-preview">${escapeHtml(preview)}</div>
            </div>
            <div class="chat-list-time">${escapeHtml(time)}</div>
          </div>
        `;
      }).join('')
    : '<p class="text-center" style="color: var(--gray-muted); padding: 30px 12px;">Belum ada chat. Buat grup atau mulai chat pribadi.</p>';
}

function openChat(chatId) {
  activeChatId = chatId;
  document.getElementById('chat-empty-state')?.classList.add('hidden');
  document.getElementById('chat-active-panel')?.classList.remove('hidden');
  document.getElementById('chat-sidebar')?.classList.add('mobile-hidden');
  document.getElementById('chat-main')?.classList.remove('mobile-hidden');
  renderChatList();
  renderActiveChat();
  setTimeout(() => document.getElementById('chat-message-input')?.focus(), 100);
}

function closeActiveChat() {
  activeChatId = null;
  document.getElementById('chat-empty-state')?.classList.remove('hidden');
  document.getElementById('chat-active-panel')?.classList.add('hidden');
  document.getElementById('chat-sidebar')?.classList.remove('mobile-hidden');
  document.getElementById('chat-main')?.classList.add('mobile-hidden');
  renderChatList();
}

function renderActiveChat() {
  const chat = communityChats.find(item => item.id === activeChatId);
  const actor = getCommunityActor();
  if (!chat || !actor) return;

  document.getElementById('chat-active-avatar')?.replaceChildren(document.createTextNode(getChatAvatar(chat)));
  document.getElementById('chat-active-name')?.replaceChildren(document.createTextNode(getChatDisplayName(chat)));

  let meta = chat.type === 'direct' ? 'Chat pribadi' : `${(chat.members || []).length} anggota`;
  if (chat.type === 'direct') {
    const otherEmail = (chat.members || []).find(email => email !== actor.email.toLowerCase());
    meta = isUserOnline(otherEmail) ? 'Online' : 'Offline';
  }
  document.getElementById('chat-active-meta')?.replaceChildren(document.createTextNode(meta));

  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  const messages = communityMessages
    .filter(message => message.chat_id === activeChatId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let lastDateLabel = '';
  messagesEl.innerHTML = messages.length
    ? messages.map(message => {
        const dateLabel = formatDate(message.created_at);
        let divider = '';
        if (dateLabel !== lastDateLabel) {
          lastDateLabel = dateLabel;
          divider = `<div class="chat-date-divider">${escapeHtml(dateLabel)}</div>`;
        }
        const isOwn = message.sender_email === actor.email.toLowerCase();
        const senderLabel = !isOwn && chat.type === 'group'
          ? `<button type="button" class="chat-bubble-sender" onclick="showUserProfile(${JSON.stringify(message.sender_email)}); return false;">${escapeHtml(message.sender_name)}</button>`
          : '';
        return `
          ${divider}
          <div class="chat-bubble-row ${isOwn ? 'own' : 'other'}">
            <div class="chat-bubble">
              ${senderLabel}
              <div>${escapeHtml(message.text)}</div>
              <div class="chat-bubble-time">${escapeHtml(formatChatTime(message.created_at))}</div>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="text-center" style="color: var(--gray-muted); margin: auto;">Belum ada pesan. Mulai percakapan!</p>';

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function openActiveChatProfile() {
  const chat = communityChats.find(item => item.id === activeChatId);
  const actor = getCommunityActor();
  if (!chat || !actor) return;

  if (chat.type === 'direct') {
    const otherEmail = (chat.members || []).find(email => email !== actor.email.toLowerCase());
    if (otherEmail) showUserProfile(otherEmail);
    return;
  }

  showUserProfile(actor.email);
}

function showUserProfile(email) {
  const user = registeredUsers.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user) {
    showToast('Profil tidak ditemukan.');
    return;
  }

  profileViewEmail = user.email;
  const profile = getCommunityProfile(user.email);
  const online = isUserOnline(user.email);
  const actor = getCommunityActor();

  document.getElementById('profile-avatar')?.replaceChildren(document.createTextNode(user.role === 'admin' ? '⭐' : '👤'));
  document.getElementById('profile-name')?.replaceChildren(document.createTextNode(getCommunityDisplayName(user)));
  document.getElementById('profile-role')?.replaceChildren(document.createTextNode(user.role === 'admin' ? 'Admin' : 'Member'));

  const details = document.getElementById('profile-details');
  if (details) {
    details.innerHTML = `
      <div class="profile-detail-row"><span>Email</span><span>${escapeHtml(user.email)}</span></div>
      <div class="profile-detail-row"><span>Status</span><span>${online ? 'Online <span class="online-dot"></span>' : 'Offline <span class="online-dot offline"></span>'}</span></div>
      <div class="profile-detail-row"><span>Minecraft</span><span>${escapeHtml(user.minecraft_name || '-')}</span></div>
      <div class="profile-detail-row"><span>Bergabung</span><span>${escapeHtml(formatDate(user.joined_at))}</span></div>
      ${profile.bio ? `<div class="profile-detail-row"><span>Bio</span><span>${escapeHtml(profile.bio)}</span></div>` : ''}
    `;
  }

  const chatBtn = document.getElementById('profile-chat-btn');
  if (chatBtn) {
    const isSelf = actor && actor.email.toLowerCase() === user.email.toLowerCase();
    chatBtn.classList.toggle('hidden', isSelf);
    chatBtn.onclick = () => {
      hideProfileModal();
      startDirectChat(user.email, user.name);
    };
  }

  document.getElementById('profile-modal')?.classList.remove('hidden');
}

function hideProfileModal() {
  document.getElementById('profile-modal')?.classList.add('hidden');
  profileViewEmail = null;
}

function profileStartChat() {
  if (!profileViewEmail) return;
  const user = registeredUsers.find(u => u.email.toLowerCase() === profileViewEmail.toLowerCase());
  if (!user) return;
  hideProfileModal();
  startDirectChat(user.email, user.name);
}

async function sendCommunityMessage(event) {
  event.preventDefault();
  const actor = getCommunityActor();
  if (!actor || !activeChatId) return;

  const input = document.getElementById('chat-message-input');
  const text = input?.value.trim();
  if (!text) return;

  try {
    if (hasApiBridge()) {
      const data = await apiRequest('/api/community/messages', {
        method: 'POST',
        body: JSON.stringify({
          email: actor.email,
          chat_id: activeChatId,
          sender_name: getCommunityDisplayName(actor),
          text
        })
      });
      if (data?.message) communityMessages.push(data.message);
      if (Array.isArray(data?.chats)) communityChats = data.chats;
    } else {
      const state = loadLocalCommunityState();
      const chat = state.chats.find(item => item.id === activeChatId);
      if (!chat || !chat.members.includes(actor.email.toLowerCase())) return;

      const message = {
        id: `msg_${Date.now()}`,
        chat_id: activeChatId,
        sender_email: actor.email.toLowerCase(),
        sender_name: getCommunityDisplayName(actor),
        text: text.slice(0, 2000),
        created_at: new Date().toISOString()
      };
      state.messages.push(message);
      chat.last_message = {
        text: message.text,
        sender_name: message.sender_name,
        sender_email: message.sender_email,
        created_at: message.created_at
      };
      chat.updated_at = message.created_at;
      saveLocalCommunityState(state);
      communityMessages.push(message);
      communityChats = getUserCommunityChats(state, actor.email);
    }

    input.value = '';
    renderChatList();
    renderActiveChat();
    document.getElementById('total-chats')?.replaceChildren(document.createTextNode(communityChats.length));
  } catch (error) {
    showToast(error.message || 'Gagal mengirim pesan.');
  }
}

function showNewGroupModal() {
  const actor = getCommunityActor();
  if (!actor) return showCommunityLoginOverlay();
  const picker = document.getElementById('group-member-picker');
  if (picker) {
    const others = registeredUsers.filter(user => user.email.toLowerCase() !== actor.email.toLowerCase());
    picker.innerHTML = others.length
      ? others.map(user => `
          <label class="member-picker-item">
            <input type="checkbox" name="group-member" value="${escapeHtml(user.email)}">
            <span>${escapeHtml(user.name)} · ${escapeHtml(user.email)}</span>
          </label>
        `).join('')
      : '<p style="padding: 10px; color: var(--gray-muted);">Belum ada member lain.</p>';
  }
  document.getElementById('group-name').value = '';
  document.getElementById('new-group-modal')?.classList.remove('hidden');
}

function hideNewGroupModal() {
  document.getElementById('new-group-modal')?.classList.add('hidden');
}

function showNewDmModal() {
  const actor = getCommunityActor();
  if (!actor) return showCommunityLoginOverlay();
  renderDmMemberList();
  document.getElementById('dm-member-search').value = '';
  document.getElementById('new-dm-modal')?.classList.remove('hidden');
}

function hideNewDmModal() {
  document.getElementById('new-dm-modal')?.classList.add('hidden');
}

function filterDmMemberList() {
  renderDmMemberList();
}

function renderDmMemberList() {
  const list = document.getElementById('dm-member-list');
  const actor = getCommunityActor();
  if (!list || !actor) return;

  const query = document.getElementById('dm-member-search')?.value.trim().toLowerCase() || '';
  const others = registeredUsers.filter(user => {
    if (user.email.toLowerCase() === actor.email.toLowerCase()) return false;
    if (!query) return true;
    const displayName = getCommunityDisplayName(user).toLowerCase();
    return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || displayName.includes(query);
  });

  list.innerHTML = others.length
    ? others.map(user => `
        <button type="button" class="member-picker-item clickable-dm" onclick="startDirectChat(${JSON.stringify(user.email)}, ${JSON.stringify(user.name)}); return false;">
          <div class="chat-avatar" style="width:36px;height:36px;font-size:16px;">👤</div>
          <div>
            <div style="font-weight:600;">${escapeHtml(getCommunityDisplayName(user))}</div>
            <div style="font-size:12px;color:var(--gray-muted);">${escapeHtml(user.email)}${isUserOnline(user.email) ? ' · Online' : ''}</div>
          </div>
        </button>
      `).join('')
    : '<p style="padding: 10px; color: var(--gray-muted);">Member tidak ditemukan.</p>';
}

async function handleCreateGroup(event) {
  event.preventDefault();
  const actor = getCommunityActor();
  if (!actor) return;

  const groupName = document.getElementById('group-name')?.value.trim();
  const selected = Array.from(document.querySelectorAll('input[name="group-member"]:checked')).map(el => el.value);
  if (!groupName) return;

  try {
    if (hasApiBridge()) {
      const data = await apiRequest('/api/community/chats', {
        method: 'POST',
        body: JSON.stringify({
          email: actor.email,
          name: getCommunityDisplayName(actor),
          type: 'group',
          group_name: groupName,
          members: selected
        })
      });
      if (Array.isArray(data?.chats)) communityChats = data.chats;
      if (data?.chat) openChat(data.chat.id);
    } else {
      const state = loadLocalCommunityState();
      const members = new Set([actor.email.toLowerCase(), ...selected.map(email => email.toLowerCase())]);
      const chat = {
        id: `group_${Date.now()}`,
        type: 'group',
        name: groupName,
        members: Array.from(members),
        created_by: actor.email.toLowerCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        avatar: '👥',
        last_message: null
      };
      state.chats.unshift(chat);
      saveLocalCommunityState(state);
      communityChats = getUserCommunityChats(state, actor.email);
      openChat(chat.id);
    }

    hideNewGroupModal();
    renderChatList();
    showToast('Grup berhasil dibuat.');
  } catch (error) {
    showToast(error.message || 'Gagal membuat grup.');
  }
}

async function startDirectChat(targetEmail, targetName) {
  const actor = getCommunityActor();
  if (!actor) return showCommunityLoginOverlay();

  try {
    if (hasApiBridge()) {
      const data = await apiRequest('/api/community/chats', {
        method: 'POST',
        body: JSON.stringify({
          email: actor.email,
          name: getCommunityDisplayName(actor),
          type: 'direct',
          target_email: targetEmail,
          target_name: targetName
        })
      });
      if (Array.isArray(data?.chats)) communityChats = data.chats;
      await fetchCommunityFromApi();
      openChat(data.chat.id);
    } else {
      const state = loadLocalCommunityState();
      const chatId = buildDirectChatId(actor.email, targetEmail);
      let chat = state.chats.find(item => item.id === chatId);
      if (!chat) {
        chat = {
          id: chatId,
          type: 'direct',
          name: targetName,
          members: [actor.email.toLowerCase(), targetEmail.toLowerCase()],
          member_names: {
            [actor.email.toLowerCase()]: getCommunityDisplayName(actor),
            [targetEmail.toLowerCase()]: targetName
          },
          created_by: actor.email.toLowerCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          avatar: '💬',
          last_message: null
        };
        state.chats.unshift(chat);
        saveLocalCommunityState(state);
      }
      communityChats = getUserCommunityChats(state, actor.email);
      openChat(chat.id);
    }

    hideNewDmModal();
    showToast('Chat pribadi dibuka.');
  } catch (error) {
    showToast(error.message || 'Gagal memulai chat.');
  }
}

function formatChatTime(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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
  setTimeout(() => openCommunityOverlay(), 900);
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
  const editor = document.getElementById('font-editor');
  const toggle = document.getElementById('font-editor-toggle');
  editor?.classList.toggle('hidden');
  const isOpen = editor && !editor.classList.contains('hidden');
  document.body.classList.toggle('font-editor-open', Boolean(isOpen));
  if (toggle) {
    toggle.textContent = isOpen ? '✕' : '✏️';
    toggle.setAttribute('aria-label', isOpen ? 'Tutup Font Editor' : 'Buka Font Editor');
  }
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
