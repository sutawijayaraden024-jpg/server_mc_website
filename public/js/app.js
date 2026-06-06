// Global variables
let currentUser = null;
let currentPage = 'home';
let allPosts = [];
let filteredCategory = 'all';

initializeStoredAccountData();
let registeredUsers = loadRegisteredUsers();
let activePlayers = loadActivePlayers();
let verificationCodes = loadVerificationCodes();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadFontSettings();
  renderPlayerDataSection();
  toggleScrollButton();
  window.addEventListener('scroll', toggleScrollButton);
  
  // If user is logged in, restore to home; if not, show auth overlay on restricted pages
  if (currentUser) {
    // User is logged in - go to home and add to active players
    addActivePlayer(currentUser);
    navigateTo('home');
    hideAuthOverlay();
  } else {
    // User is not logged in - show auth overlay
    navigateTo('home');
    showAuthOverlay();
  }
});

function initializeStoredAccountData() {
  const hasRegisteredUsers = localStorage.getItem('registeredUsers');
  const hasAdminPassword = localStorage.getItem('adminPassword');

  if (!hasRegisteredUsers) {
    const adminUser = {
      id: 1,
      name: 'Ra172',
      email: 'scarlettruiss@gmail.com',
      role: 'admin',
      joined_at: new Date().toISOString()
    };
    localStorage.setItem('registeredUsers', JSON.stringify([adminUser]));
  }

  if (!hasAdminPassword) {
    localStorage.setItem('adminPassword', JSON.stringify({
      'scarlettruiss@gmail.com': 'Ridho0715'
    }));
  }
}

function loadRegisteredUsers() {
  const raw = localStorage.getItem('registeredUsers');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error('Error loading registered users:', error);
    }
  }
  return [];
}

function saveRegisteredUsers() {
  localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
}

function addRegisteredUser(user) {
  if (!registeredUsers.some(u => u.email === user.email)) {
    registeredUsers.unshift({
      id: user.id,
      name: user.name,
      email: user.email,
      joined_at: new Date().toISOString()
    });
    saveRegisteredUsers();
  }
}

function loadActivePlayers() {
  const raw = localStorage.getItem('activePlayers');
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error loading active players:', error);
    return [];
  }
}

function saveActivePlayers() {
  localStorage.setItem('activePlayers', JSON.stringify(activePlayers));
}

function addActivePlayer(user) {
  if (!user || !user.email) return;
  if (!activePlayers.some(u => u.email === user.email)) {
    activePlayers.unshift({ id: user.id, name: user.name, email: user.email, joined_at: new Date().toISOString() });
    saveActivePlayers();
    renderPlayerDataSection();
  }
}

function removeActivePlayer(email) {
  activePlayers = activePlayers.filter(u => u.email !== email);
  saveActivePlayers();
  renderPlayerDataSection();
}

function loadVerificationCodes() {
  const raw = localStorage.getItem('verificationCodes');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('Error loading verification codes:', error);
    return {};
  }
}

function saveVerificationCodes() {
  localStorage.setItem('verificationCodes', JSON.stringify(verificationCodes));
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function requestVerificationCode(email, mode) {
  const code = generateVerificationCode();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  verificationCodes[email] = { code, expiresAt, mode };
  saveVerificationCodes();
  return code;
}

function isCodeValid(email, code, expectedMode) {
  const record = verificationCodes[email];
  if (!record || record.mode !== expectedMode) {
    return false;
  }
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

function showVerificationInfo(id, message) {
  const info = document.getElementById(id);
  if (info) {
    info.textContent = message;
    info.classList.remove('hidden');
  }
}

function clearVerificationInfo(id) {
  const info = document.getElementById(id);
  if (info) {
    info.textContent = '';
    info.classList.add('hidden');
  }
}

function createDemoToken() {
  return 'demo-token-' + Math.random().toString(36).substr(2, 9);
}

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem('token', createDemoToken());
  localStorage.setItem('user', JSON.stringify(user));
  updateAuthUI();
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
  }, 3200);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleScrollButton() {
  const button = document.getElementById('scrollToTopButton');
  if (!button) return;
  if (window.scrollY > 220) {
    button.classList.remove('hidden');
  } else {
    button.classList.add('hidden');
  }
}

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderPlayerDataSection() {
  const totalRegistered = registeredUsers.length;
  const totalOnline = activePlayers.length;
  const registeredCount = document.getElementById('player-count-registered');
  const onlineCount = document.getElementById('player-count-online');
  const totalActiveMembers = document.getElementById('total-active-members');
  const totalMembersStat = document.getElementById('total-members');
  const heroPlayerCount = document.getElementById('hero-player-count');
  const cardsContainer = document.getElementById('player-cards');

  if (registeredCount) {
    registeredCount.textContent = totalRegistered;
  }
  if (onlineCount) {
    onlineCount.textContent = totalOnline;
  }
  if (totalActiveMembers) {
    totalActiveMembers.textContent = totalOnline;
  }
  if (totalMembersStat) {
    totalMembersStat.textContent = totalRegistered;
  }
  if (heroPlayerCount) {
    heroPlayerCount.textContent = totalRegistered;
  }

  const registeredList = document.getElementById('registered-player-list');
  if (registeredList) {
    registeredList.innerHTML = registeredUsers.length > 0
      ? registeredUsers.map(user => `<li>${user.name} (${user.email})</li>`).join('')
      : '<li>Tidak ada akun terdaftar. Silakan register terlebih dahulu.</li>';
  }

  if (!cardsContainer) {
    return;
  }

  if (activePlayers.length === 0) {
    cardsContainer.innerHTML = '<p class="text-center" style="color: var(--gray-muted); padding: 30px;">Tidak ada pemain aktif saat ini. Login untuk terlihat di daftar pemain.</p>';
    return;
  }

  cardsContainer.innerHTML = activePlayers.map(player => `
    <div class="player-card">
      <h3>${player.name}</h3>
      <p><strong>Email:</strong> ${player.email}</p>
      <p><strong>Terdaftar:</strong> ${new Date(player.joined_at).toLocaleDateString('id-ID')}</p>
      <p class="player-status">Status: Aktif</p>
    </div>
  `).join('');
  
  // Update admin statistics
  const adminTotalPlayers = document.getElementById('admin-total-players');
  const adminActivePlayers = document.getElementById('admin-active-players');
  const adminTotalPosts = document.getElementById('admin-total-posts');
  
  if (adminTotalPlayers) {
    adminTotalPlayers.textContent = totalRegistered;
  }
  if (adminActivePlayers) {
    adminActivePlayers.textContent = totalOnline;
  }
  if (adminTotalPosts) {
    adminTotalPosts.textContent = allPosts.length;
  }
}

function simulateOAuthLogin(provider) {
  const user = {
    id: Math.floor(Math.random() * 10000),
    email: provider.toLowerCase() + '@servermc.net',
    name: provider + ' User',
    role: 'user'
  };
  addRegisteredUser(user);
  setCurrentUser(user);
  addActivePlayer(user);
  navigateTo('home');
  showToast(provider + ' login berhasil! Anda sekarang masuk sebagai ' + user.name + '.');
}



function handleSendLoginCode() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');

  errorDiv.classList.add('hidden');
  clearVerificationInfo('login-verification-info');

  if (!email || !password) {
    errorDiv.textContent = 'Masukkan email dan password terlebih dahulu untuk mengirim kode verifikasi.';
    errorDiv.classList.remove('hidden');
    return;
  }

  const code = requestVerificationCode(email, 'login');
  showVerificationInfo('login-verification-info', 'Kode verifikasi telah dikirim. Gunakan kode: ' + code + ' untuk login. Kode berlaku 5 menit.');
}

function handleSendRegisterCode() {
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const errorDiv = document.getElementById('register-error');

  errorDiv.classList.add('hidden');
  clearVerificationInfo('register-verification-info');

  if (!email || !password) {
    errorDiv.textContent = 'Masukkan email dan password terlebih dahulu untuk mengirim kode verifikasi.';
    errorDiv.classList.remove('hidden');
    return;
  }

  const code = requestVerificationCode(email, 'register');
  showVerificationInfo('register-verification-info', 'Kode verifikasi telah dikirim. Gunakan kode: ' + code + ' untuk menyelesaikan pendaftaran. Kode berlaku 5 menit.');
}

const authRestrictedPages = ['server', 'update', 'event', 'komunitas'];

function showAuthOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

function hideAuthOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// ============ NAVIGATION ============

function navigateTo(page) {
  // Check if user is trying to access restricted page without login
  if (authRestrictedPages.includes(page) && !currentUser) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const homePage = document.getElementById('home');
    if (homePage) {
      homePage.classList.add('active');
      currentPage = 'home';
    }
    showAuthOverlay();
    window.scrollTo(0, 0);
    return;
  }

  // If user is logged in and navigating to a page, add active player
  if (currentUser && !activePlayers.find(p => p.email === currentUser.email)) {
    addActivePlayer(currentUser);
  }

  hideAuthOverlay();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  const pageElement = document.getElementById(page);
  if (pageElement) {
    pageElement.classList.add('active');
    currentPage = page;
    
    // Load page-specific data
    if (page === 'komunitas') {
      loadPosts();
    } else if (page === 'members') {
      loadMembers();
    }
  }
  
  document.getElementById('user-dropdown').classList.remove('active');
  window.scrollTo(0, 0);
}

// ============ AUTHENTICATION ============

function checkAuth() {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  
  if (token && userData) {
    try {
      currentUser = JSON.parse(userData);
      updateAuthUI();
      // Don't add active player here - will be added on navigateTo if needed
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      currentUser = null;
    }
  }
}

function updateAuthUI() {
  const authButtons = document.getElementById('auth-buttons');
  const userMenuContainer = document.getElementById('user-menu-container');
  const adminPanelLink = document.getElementById('admin-panel-link');
  const fontEditorToggle = document.getElementById('font-editor-toggle');
  
  const emailDisplay = document.getElementById('user-email-display');
  const roleDisplay = document.getElementById('user-role-display');

  if (currentUser) {
    authButtons.classList.add('hidden');
    userMenuContainer.classList.remove('hidden');
    document.getElementById('user-display-name').textContent = currentUser.name || currentUser.email;
    if (emailDisplay) {
      emailDisplay.textContent = currentUser.email;
    }
    if (roleDisplay) {
      roleDisplay.textContent = currentUser.role === 'admin' ? 'Admin' : 'Pemain';
    }
    
    if (currentUser.role === 'admin') {
      adminPanelLink.classList.remove('hidden');
      fontEditorToggle.classList.remove('hidden');
    } else {
      adminPanelLink.classList.add('hidden');
      fontEditorToggle.classList.add('hidden');
    }
  } else {
    authButtons.classList.remove('hidden');
    userMenuContainer.classList.add('hidden');
    document.getElementById('font-editor-toggle').classList.add('hidden');
  }
}

function toggleUserMenu() {
  document.getElementById('user-dropdown').classList.toggle('active');
}

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const code = document.getElementById('login-code').value.trim();
  const errorDiv = document.getElementById('login-error');
  
  clearVerificationInfo('login-verification-info');
  errorDiv.classList.add('hidden');

  if (!email || !password) {
    errorDiv.textContent = 'Email dan password harus diisi';
    errorDiv.classList.remove('hidden');
    return;
  }

  // Check if this is admin account
  if (email === 'scarlettruiss@gmail.com') {
    if (password !== 'Ridho0715') {
      errorDiv.textContent = 'Password admin tidak sesuai';
      errorDiv.classList.remove('hidden');
      return;
    }
    
    const adminUser = registeredUsers.find(u => u.email === email);
    if (adminUser) {
      setCurrentUser({ id: adminUser.id, email: adminUser.email, name: adminUser.name, role: 'admin' });
      addActivePlayer(adminUser);
      navigateTo('admin');
      showToast('Selamat datang kembali, Admin Ra172!');
      return;
    }
  }

  // Regular user - needs verification code
  if (!code) {
    errorDiv.textContent = 'Silakan kirim kode verifikasi lalu masukkan kode yang dikirimkan.';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!isCodeValid(email, code, 'login')) {
    errorDiv.textContent = 'Kode verifikasi tidak valid atau telah kedaluwarsa. Kirim ulang kode.';
    errorDiv.classList.remove('hidden');
    return;
  }

  clearVerificationCode(email);

  const existingUser = registeredUsers.find(u => u.email === email);
  const user = existingUser
    ? { id: existingUser.id, email: existingUser.email, name: existingUser.name, role: existingUser.email === 'scarlettruiss@gmail.com' ? 'admin' : 'user' }
    : { id: Math.floor(Math.random() * 10000), email: email, name: email.split('@')[0], role: email === 'scarlettruiss@gmail.com' ? 'admin' : 'user' };

  addRegisteredUser(user);
  setCurrentUser(user);
  addActivePlayer(user);
  navigateTo('home');
}

function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const code = document.getElementById('register-code').value.trim();
  const errorDiv = document.getElementById('register-error');

  clearVerificationInfo('register-verification-info');
  errorDiv.classList.add('hidden');

  if (!email || !password) {
    errorDiv.textContent = 'Email dan password harus diisi';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!code) {
    errorDiv.textContent = 'Silakan kirim kode verifikasi lalu masukkan kode yang dikirimkan.';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!isCodeValid(email, code, 'register')) {
    errorDiv.textContent = 'Kode verifikasi tidak valid atau telah kedaluwarsa. Kirim ulang kode.';
    errorDiv.classList.remove('hidden');
    return;
  }

  clearVerificationCode(email);

  const user = {
    id: Math.floor(Math.random() * 10000),
    email: email,
    name: name || email.split('@')[0],
    role: email === 'scarlettruiss@gmail.com' ? 'admin' : 'user'
  };

  addRegisteredUser(user);
  setCurrentUser(user);
  addActivePlayer(user);
  navigateTo('home');
  errorDiv.classList.add('hidden');
}

function logout() {
  // Remove from active players
  if (currentUser && currentUser.email) {
    removeActivePlayer(currentUser.email);
  }
  
  // Clear all session data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  
  // Update UI
  updateAuthUI();
  renderPlayerDataSection();
  
  // Redirect to home and show overlay
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const homePage = document.getElementById('home');
  if (homePage) {
    homePage.classList.add('active');
    currentPage = 'home';
  }
  showAuthOverlay();
  
  showToast('Logout berhasil. Anda tidak lagi terlihat di data pemain aktif.');
  window.scrollTo(0, 0);
}

function removeRegisteredUser(email) {
  registeredUsers = registeredUsers.filter(u => u.email !== email);
  saveRegisteredUsers();
}

function deleteAccount() {
  if (!currentUser || !currentUser.email) {
    showToast('Tidak ada akun yang sedang aktif.');
    return;
  }

  const confirmDelete = confirm('Anda yakin ingin menghapus akun ini? Akun akan dihapus permanen, jumlah pemain turun, dan Anda harus register kembali.');
  if (!confirmDelete) {
    return;
  }

  removeRegisteredUser(currentUser.email);
  removeActivePlayer(currentUser.email);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  
  updateAuthUI();
  renderPlayerDataSection();
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const homePage = document.getElementById('home');
  if (homePage) {
    homePage.classList.add('active');
    currentPage = 'home';
  }
  showAuthOverlay();
  
  showToast('Akun Anda telah dihapus. Silakan register kembali untuk membuat akun baru.');
  window.scrollTo(0, 0);
}

// ============ COMMUNITY POSTS ============

function loadPosts() {
  // Demo data for posts
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
    },
    {
      id: 2,
      title: 'Diskusi: Strategi Farming Terbaik di Server',
      category: 'Diskusi',
      content: 'Apa strategi farming yang paling efisien menurut kalian? Saya sedang mencari cara terbaik untuk mendapatkan resources...',
      tags: ['farming', 'strategy', 'economy'],
      author_name: 'SurvivalPro',
      author_email: 'survival@example.com',
      likes: 0,
      replies: 0,
      views: 0,
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000),
      avatar: '⛏️'
    },
    {
      id: 3,
      title: 'Showcase: Kastil Megah Saya Sudah Selesai!',
      category: 'Showcase',
      content: 'Setelah 2 bulan bekerja, akhirnya kastil impian saya selesai! Silahkan kunjungi dan berikan feedback...',
      tags: ['building', 'showcase', 'castle'],
      author_name: 'ArtisticBuilder',
      author_email: 'artist@example.com',
      likes: 0,
      replies: 0,
      views: 0,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      avatar: '🎨'
    }
  ];
  
  // Update stats
  document.getElementById('total-posts').textContent = allPosts.length;
  
  displayPosts();
}

function displayPosts() {
  const postsList = document.getElementById('posts-list');
  let filteredPosts = allPosts;
  
  if (filteredCategory !== 'all') {
    filteredPosts = allPosts.filter(p => p.category === filteredCategory);
  }
  
  if (filteredPosts.length === 0) {
    postsList.innerHTML = '<p class="text-center" style="color: var(--gray-muted); padding: 40px;">Tidak ada post ditemukan</p>';
    return;
  }
  
  postsList.innerHTML = filteredPosts.map(post => `
    <div class="post-card">
      <div class="post-header">
        <div class="post-avatar">${post.avatar}</div>
        <div class="post-meta">
          <div class="post-author">${post.author_name}</div>
          <div class="post-date">${formatDate(post.created_at)}</div>
        </div>
      </div>
      <div class="post-title">${post.title}</div>
      <div class="post-content">${post.content}</div>
      <div class="post-tags">
        <span class="tag">${post.category}</span>
        ${(post.tags || []).map(tag => `<span class="tag">#${tag}</span>`).join('')}
      </div>
      <div class="post-stats">
        <div class="post-stat">
          <button onclick="likePost(${post.id}); return false;">❤️</button>
          <span>${post.likes} Suka</span>
        </div>
        <div class="post-stat">
          <button onclick="replyPost(${post.id}); return false;">💬</button>
          <span>${post.replies} Balasan</span>
        </div>
        <div class="post-stat">
          <button onclick="viewPost(${post.id}); return false;">👁️</button>
          <span>${post.views} Dilihat</span>
        </div>
      </div>
    </div>
  `).join('');
}

function navigateToCommunityCategory(category) {
  navigateTo('komunitas');
  filteredCategory = category;
  displayPosts();
  scrollToCommunityLinks();
}

function scrollToCommunityLinks() {
  const communitySection = document.getElementById('footer-community-links');
  if (communitySection) {
    communitySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function filterPosts(category) {
  filteredCategory = category;
  displayPosts();
}

function likePost(postId) {
  if (!currentUser) {
    navigateTo('login');
    return;
  }
  
  const post = allPosts.find(p => p.id === postId);
  if (post) {
    post.likes += 1;
    displayPosts();
  }
}

function replyPost(postId) {
  if (!currentUser) {
    navigateTo('login');
    return;
  }

  const post = allPosts.find(p => p.id === postId);
  if (post) {
    post.replies += 1;
    showToast('Balasan tercatat pada postingan ini.');
    displayPosts();
  }
}

function viewPost(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (post) {
    post.views += 1;
    showToast('Hitungan dilihat bertambah.');
    displayPosts();
  }
}

function showCreatePostForm() {
  if (!currentUser) {
    navigateTo('login');
    return;
  }
  
  if (currentUser.role !== 'admin') {
    alert('Hanya admin yang dapat membuat post');
    return;
  }
  
  navigateTo('admin');
}

function handleCreatePost(event) {
  event.preventDefault();
  
  const title = document.getElementById('post-title').value;
  const category = document.getElementById('post-category').value;
  const content = document.getElementById('post-content').value;
  const tagsInput = document.getElementById('post-tags').value;
  const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
  
  const errorDiv = document.getElementById('admin-error');
  const successDiv = document.getElementById('admin-success');
  
  if (!title || !content) {
    errorDiv.textContent = 'Judul dan konten harus diisi';
    errorDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
    return;
  }
  
  // Create new post
  const newPost = {
    id: allPosts.length + 1,
    title: title,
    category: category,
    content: content,
    tags: tags,
    author_name: currentUser.name,
    author_email: currentUser.email,
    likes: 0,
    replies: 0,
    views: 0,
    created_at: new Date(),
    avatar: '🎮'
  };
  
  allPosts.unshift(newPost);
  
  successDiv.textContent = 'Post berhasil dibuat!';
  successDiv.classList.remove('hidden');
  errorDiv.classList.add('hidden');
  
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  document.getElementById('post-tags').value = '';
  
  setTimeout(() => {
    navigateTo('komunitas');
  }, 1500);
}

// ============ MEMBERS ============

function loadMembers() {
  const members = registeredUsers.map(user => ({
    ...user,
    created_at: new Date(user.joined_at)
  }));
  displayMembers(members);
}

function displayMembers(users) {
  const membersList = document.getElementById('members-list');
  
  if (users.length === 0) {
    membersList.innerHTML = '<p class="text-center" style="color: var(--gray-muted); padding: 40px; grid-column: 1/-1;">Tidak ada member ditemukan</p>';
    return;
  }
  
  membersList.innerHTML = users.map(user => `
    <div class="member-card">
      <div class="member-avatar">👤</div>
      <div class="member-name">${user.name}</div>
      <div class="member-email">${user.email}</div>
      <div class="member-joined">Bergabung: ${formatDate(user.created_at)}</div>
    </div>
  `).join('');
  
  // Update total members
  document.getElementById('total-members').textContent = users.length;
}

// ============ FONT EDITOR ============

function toggleFontEditor() {
  const editor = document.getElementById('font-editor');
  editor.classList.toggle('hidden');
}

function updateFontSettings() {
  const headingFont = document.getElementById('heading-font').value;
  const bodyFont = document.getElementById('body-font').value;
  const headingSize = document.getElementById('heading-size').value;
  const bodySize = document.getElementById('body-size').value;
  const headingWeight = document.getElementById('heading-weight').value;
  
  // Update CSS variables
  document.documentElement.style.setProperty('--font-heading', headingFont);
  document.documentElement.style.setProperty('--font-body', bodyFont);
  document.documentElement.style.setProperty('--font-size-h1', headingSize + 'px');
  document.documentElement.style.setProperty('--font-size-body', bodySize + 'px');
  document.documentElement.style.setProperty('--font-weight-h1', headingWeight);
  
  // Update display values
  document.getElementById('heading-size-value').textContent = headingSize;
  document.getElementById('body-size-value').textContent = bodySize;
  
  // Save to localStorage
  const settings = {
    headingFont,
    bodyFont,
    headingSize,
    bodySize,
    headingWeight
  };
  
  localStorage.setItem('fontSettings', JSON.stringify(settings));
}

function loadFontSettings() {
  const savedSettings = localStorage.getItem('fontSettings');
  
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      
      document.getElementById('heading-font').value = settings.headingFont || 'Playfair Display';
      document.getElementById('body-font').value = settings.bodyFont || 'Poppins';
      document.getElementById('heading-size').value = settings.headingSize || '48';
      document.getElementById('body-size').value = settings.bodySize || '16';
      document.getElementById('heading-weight').value = settings.headingWeight || '700';
      
      // Apply settings
      document.documentElement.style.setProperty('--font-heading', settings.headingFont || 'Playfair Display');
      document.documentElement.style.setProperty('--font-body', settings.bodyFont || 'Poppins');
      document.documentElement.style.setProperty('--font-size-h1', (settings.headingSize || '48') + 'px');
      document.documentElement.style.setProperty('--font-size-body', (settings.bodySize || '16') + 'px');
      document.documentElement.style.setProperty('--font-weight-h1', settings.headingWeight || '700');
      
      document.getElementById('heading-size-value').textContent = settings.headingSize || '48';
      document.getElementById('body-size-value').textContent = settings.bodySize || '16';
    } catch (error) {
      console.error('Error loading font settings:', error);
    }
  }
}

function resetFontSettings() {
  document.getElementById('heading-font').value = 'Playfair Display';
  document.getElementById('body-font').value = 'Poppins';
  document.getElementById('heading-size').value = '48';
  document.getElementById('body-size').value = '16';
  document.getElementById('heading-weight').value = '700';
  
  updateFontSettings();
}

// ============ UTILITY FUNCTIONS ============

function formatDate(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Hari ini';
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Kemarin';
  } else {
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
