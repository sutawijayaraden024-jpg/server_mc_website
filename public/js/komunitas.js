// ============================================================
// SERVER_MC CHAT - Community System v2
// Discord Style + Japanese Luxury Gold & Black
// Fixes: Chat, Channel Sync, Member Count, Presence, DM, Music, Permissions
// ============================================================

// ============================================================
// CHAT SYSTEM - Fixed
// Maps channel names to actual chat conversations
// ============================================================
const CHANNEL_MAP = {
  umum: { id: 'group_umum', name: 'Grup Umum' },
  pengumuman: { id: 'group_umum', name: 'Grup Umum' },
  diskusi: { id: 'group_umum', name: 'Grup Umum' },
  media: { id: 'group_umum', name: 'Grup Umum' },
  minecraft: { id: 'group_umum', name: 'Grup Umum' },
  bantuan: { id: 'group_umum', name: 'Grup Umum' }
};

let activeChannel = 'umum';
let activeChatType = 'channel'; // 'channel' | 'dm' | 'group'

function getActiveChatId() {
  if (activeChatType === 'channel') {
    const map = CHANNEL_MAP[activeChannel];
    return map ? map.id : 'group_umum';
  }
  return activeChatId; // For DM/Group from app.js
}

// ============================================================
// MUSIC ENGINE - Added file upload support
// ============================================================
const MusicEngine = {
  audio: null,
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.7,
  shuffle: false,
  repeat: 'none',

  init() {
    this.audio = new Audio();
    this.audio.volume = this.volume;
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.onTrackEnd());
    this.audio.addEventListener('loadedmetadata', () => {
      const totalStr = this.formatTime(this.audio.duration);
      const nanoTotal = document.getElementById('nano-total-time');
      if (nanoTotal) nanoTotal.textContent = totalStr;
      const bubbleTotal = document.getElementById('bubble-total-time');
      if (bubbleTotal) bubbleTotal.textContent = totalStr;
    });
    this.audio.addEventListener('error', (e) => showToast('Gagal memutar: ' + (e.target?.error?.message || 'format tidak didukung')));
    this.loadState();
  },

  loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem('servermc_music_state') || '{}');
      this.volume = saved.volume || 0.7;
      this.shuffle = saved.shuffle || false;
      this.repeat = saved.repeat || 'none';
      this.queue = saved.queue || [];
      this.queueIndex = saved.queueIndex || -1;
      if (this.queue.length > 0 && this.queueIndex >= 0) this.loadTrack(this.queue[this.queueIndex]);
      const volSlider = document.querySelector('.music-volume-slider');
      if (volSlider) volSlider.value = this.volume * 100;
    } catch (e) {}
  },

  saveState() {
    localStorage.setItem('servermc_music_state', JSON.stringify({
      volume: this.volume, shuffle: this.shuffle, repeat: this.repeat,
      queue: this.queue, queueIndex: this.queueIndex
    }));
  },

  loadTrack(track) {
    if (!track) return;
    this.currentTrack = track;
    this.audio.src = track.track_url || '';
    this.audio.load();
    // Update Nano Player
    document.getElementById('nano-title').textContent = track.track_name || 'No Track';
    // Update Bubble Player
    document.getElementById('bubble-title').textContent = track.track_name || 'No Track';
    document.getElementById('bubble-artist').textContent = track.artist || '-';
    if (this.isPlaying) this.audio.play().catch(() => {});
    this.updatePlayBtn();
    this.showPlayer();
    renderBubblePlaylist();
  },

  play() {
    if (!this.audio.src && this.queue.length > 0 && this.queueIndex >= 0) this.loadTrack(this.queue[this.queueIndex]);
    if (this.audio.src) this.audio.play().then(() => { this.isPlaying = true; this.updatePlayBtn(); }).catch(e => showToast('Gagal play: ' + e.message));
  },

  pause() { this.audio.pause(); this.isPlaying = false; this.updatePlayBtn(); },
  togglePlay() { this.isPlaying ? this.pause() : this.play(); },

  next() {
    if (this.queue.length === 0) return;
    this.queueIndex = this.shuffle ? Math.floor(Math.random() * this.queue.length) : (this.queueIndex + 1) % this.queue.length;
    this.loadTrack(this.queue[this.queueIndex]);
    if (this.isPlaying) this.play();
    this.saveState();
  },

  previous() {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    this.queueIndex = this.shuffle ? Math.floor(Math.random() * this.queue.length) : (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    this.loadTrack(this.queue[this.queueIndex]);
    if (this.isPlaying) this.play();
    this.saveState();
  },

  onTrackEnd() {
    if (this.repeat === 'one') { this.audio.currentTime = 0; this.play(); }
    else if (this.repeat === 'all' || this.queueIndex < this.queue.length - 1) this.next();
    else { this.isPlaying = false; this.updatePlayBtn(); }
  },

  setVolume(val) { this.volume = val / 100; if (this.audio) this.audio.volume = this.volume; this.saveState(); },

  seek(position) { if (this.audio && this.audio.duration) this.audio.currentTime = (position / 100) * this.audio.duration; },

  showPlayer() {
    document.getElementById('nano-player')?.classList.remove('hidden');
    document.getElementById('bubble-toggle')?.classList.remove('hidden');
  },

  updateProgress() {
    if (!this.audio || !this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    const pctStr = pct + '%';
    // Nano
    const nanoFill = document.getElementById('nano-progress-fill');
    if (nanoFill) nanoFill.style.width = pctStr;
    const nanoTime = document.getElementById('nano-current-time');
    if (nanoTime) nanoTime.textContent = this.formatTime(this.audio.currentTime);
    // Bubble
    const bubbleFill = document.getElementById('bubble-progress-fill');
    if (bubbleFill) bubbleFill.style.width = pctStr;
    const bubbleTime = document.getElementById('bubble-current-time');
    if (bubbleTime) bubbleTime.textContent = this.formatTime(this.audio.currentTime);
    // Total time (both)
    const totalStr = this.formatTime(this.audio.duration);
    const nanoTotal = document.getElementById('nano-total-time');
    if (nanoTotal) nanoTotal.textContent = totalStr;
    const bubbleTotal = document.getElementById('bubble-total-time');
    if (bubbleTotal) bubbleTotal.textContent = totalStr;
  },

  formatTime(s) { if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return m + ':' + (sec < 10 ? '0' : '') + sec; },

  updatePlayBtn() {
    const sym = this.isPlaying ? '⏸' : '▶';
    const nanoBtn = document.getElementById('nano-play-btn');
    if (nanoBtn) nanoBtn.textContent = sym;
    const bubbleBtn = document.getElementById('bubble-play-btn');
    if (bubbleBtn) bubbleBtn.textContent = sym;
  },

  toggleShuffle() { this.shuffle = !this.shuffle; this.saveState(); showToast(this.shuffle ? '🔀 Shuffle ON' : '🔀 Shuffle OFF'); },
  toggleRepeat() { const modes = ['none', 'one', 'all']; const i = modes.indexOf(this.repeat); this.repeat = modes[(i + 1) % 3]; this.saveState(); showToast('🔁 Repeat: ' + this.repeat); },

  // Upload music file from device
  async uploadFile(file) {
    if (!file) return;
    const validTypes = ['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/flac', 'audio/x-m4a'];
    if (!validTypes.includes(file.type)) {
      showToast('Format tidak didukung. Gunakan MP3, OGG, M4A, WAV, atau FLAC.');
      return null;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast('File terlalu besar. Maksimal 50MB.');
      return null;
    }
    
    const url = URL.createObjectURL(file);
    const track = {
      id: 'track_' + Date.now(),
      track_name: file.name.replace(/\.[^/.]+$/, '') || 'Unknown Track',
      track_url: url,
      artist: 'Local File',
      duration: 0,
      file_size: file.size,
      file_type: file.type
    };
    
    this.queue.push(track);
    if (this.queue.length === 1) { this.queueIndex = 0; this.loadTrack(track); }
    this.saveState();
    renderPlaylistTracks();
    showToast('✅ ' + track.track_name + ' ditambahkan');
    return track;
  }
};

// ============================================================
// NOTIFICATION SYSTEM - Fixed realtime badge
// ============================================================
const NotificationSystem = {
  notifications: [],
  unreadCount: 0,

  async load() {
    try {
      if (hasApiBridge()) {
        const data = await apiRequest('/api/community/notifications', { method: 'GET' });
        if (Array.isArray(data?.notifications)) this.notifications = data.notifications;
      }
    } catch (e) {}
    try {
      const local = JSON.parse(localStorage.getItem('servermc_notifications') || '[]');
      this.notifications = this.notifications.concat(local);
      // Deduplicate
      const seen = new Set();
      this.notifications = this.notifications.filter(n => { const k = n.id || n.title + n.created_at; if (seen.has(k)) return false; seen.add(k); return true; });
    } catch (e) {}
    this.unreadCount = this.notifications.filter(n => !n.is_read).length;
    this.updateBadge();
  },

  add(notif) {
    this.notifications.unshift({ id: 'notif_' + Date.now(), ...notif, is_read: false, created_at: new Date().toISOString() });
    this.unreadCount++;
    this.updateBadge();
    this.save();
  },

  markRead(id) {
    const n = this.notifications.find(x => x.id === id);
    if (n && !n.is_read) { n.is_read = true; this.unreadCount--; this.updateBadge(); this.save(); }
  },

  markAllRead() { this.notifications.forEach(n => n.is_read = true); this.unreadCount = 0; this.updateBadge(); this.save(); },
  save() { localStorage.setItem('servermc_notifications', JSON.stringify(this.notifications)); },

  updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) { badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount || ''; badge.classList.toggle('hidden', this.unreadCount === 0); }
  }
};

// ============================================================
// FRIEND SYSTEM - Fixed with user IDs
// ============================================================
const FriendSystem = {
  friends: [],

  async load() {
    try {
      if (hasApiBridge()) {
        const data = await apiRequest('/api/community/friends?status=all', { method: 'GET' });
        if (Array.isArray(data?.friends)) this.friends = data.friends;
      }
    } catch (e) {}
    try {
      const local = JSON.parse(localStorage.getItem('servermc_friends') || '[]');
      this.friends = this.friends.concat(local);
      const seen = new Set();
      this.friends = this.friends.filter(f => { const k = f.email || f.id; if (seen.has(k)) return false; seen.add(k); return true; });
    } catch (e) {}
  },

  async sendRequest(friendEmail) {
    const actor = getCommunityActor();
    if (!actor) return;
    const friendUser = registeredUsers.find(u => u.email.toLowerCase() === friendEmail.toLowerCase());
    if (!friendUser) { showToast('User tidak ditemukan.'); return; }
    if (hasApiBridge()) {
      try { await apiRequest('/api/community/friends', { method: 'POST', body: JSON.stringify({ action: 'send_request', friendId: friendUser.id }) }); showToast('✅ Permintaan teman terkirim ke ' + friendUser.name); return; }
      catch (e) { showToast(e.message); return; }
    }
    let list = JSON.parse(localStorage.getItem('servermc_friends') || '[]');
    if (list.some(f => f.email === friendEmail)) { showToast(friendUser.name + ' sudah menjadi teman.'); return; }
    list.push({ id: friendUser.id, email: friendEmail, name: friendUser.name, status: 'pending', created_at: new Date().toISOString() });
    localStorage.setItem('servermc_friends', JSON.stringify(list));
    showToast('✅ Permintaan teman terkirim');
  },

  renderFriendList(containerId = 'friend-list') {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (this.friends.length === 0) { container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px;">👥 Belum ada teman. Cari berdasarkan email untuk memulai.</p>'; return; }
    container.innerHTML = this.friends.filter(f => f.status === 'accepted' || !f.status).map(f => {
      const user = registeredUsers.find(u => u.id === f.friend_id || u.id === f.user_id || u.email === f.email);
      const name = user?.name || f.display_name || f.username || f.email?.split('@')[0] || 'User';
      const online = user ? isUserOnline(user.email) : false;
      return `
      <div class="friend-item">
        <div class="friend-avatar">${user?.role === 'admin' ? '⭐' : '👤'}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(name)}</div>
          <div class="friend-status ${online ? 'online' : ''}">${online ? '🟢 Online' : '⚫ Offline'}</div>
        </div>
        <div class="friend-actions">
          <button class="btn btn-secondary" style="padding:4px 8px;font-size:12px;" onclick="startDirectChat('${(user?.email || f.email)}', '${escapeHtml(name)}'); return false;">💬</button>
        </div>
      </div>`;
    }).join('') || '<p style="text-align:center;color:var(--text-muted);padding:30px;">Belum ada teman.</p>';
  }
};

// ============================================================
// CHANNEL SYSTEM - Fixed: proper channel-to-chat mapping
// ============================================================
function selectChannel(channelName) {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }

  activeChannel = channelName;
  activeChatType = 'channel';
  activeChatId = getActiveChatId();

  // Update UI
  document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`.channel-item[data-channel="${channelName}"]`);
  if (target) target.classList.add('active');

  // Update header
  document.getElementById('chat-header-name').textContent = channelName;
  const input = document.getElementById('chat-message-input');
  if (input) input.placeholder = 'Ketik pesan ke #' + channelName;

  // Update member count for this channel
  updateMemberCount();

  // Load messages
  loadChannelMessages();
}

function loadChannelMessages(channelName) {
  if (!channelName) channelName = activeChannel;
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const actor = getCommunityActor();
  const chatId = getActiveChatId();

  // Get messages for this channel from the chat system
  let msgs = [];
  if (activeChatType === 'channel') {
    msgs = (communityMessages || []).filter(m => m.chat_id === chatId);
  } else if (activeChatId) {
    msgs = (communityMessages || []).filter(m => m.chat_id === activeChatId);
    const chat = communityChats?.find(c => c.id === activeChatId);
    if (chat) document.getElementById('chat-header-name').textContent = chat.name || 'Chat';
  }

  if (msgs.length === 0) {
    container.innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome-icon">#</div>
        <h2>Selamat datang di #${escapeHtml(channelName || 'umum')}</h2>
        <p>Mulai percakapan bersama komunitas Server_MC. Kirim pesan pertama!</p>
      </div>
    `;
    return;
  }

  let lastDate = '';
  container.innerHTML = msgs
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(msg => {
      const dateLabel = formatDate(msg.created_at);
      let divider = '';
      if (dateLabel !== lastDate) { lastDate = dateLabel; divider = `<div class="chat-date-divider"><span>${escapeHtml(dateLabel)}</span></div>`; }
      const isOwn = actor && msg.sender_email === actor.email.toLowerCase();
      const user = registeredUsers.find(u => u.email?.toLowerCase() === msg.sender_email);
      const role = user?.role === 'admin' ? 'admin' : 'member';
      return `
      ${divider}
      <div class="chat-msg ${isOwn ? 'own' : ''}">
        <div class="chat-msg-avatar" onclick="viewProfile('${msg.sender_email}')">${user?.role === 'admin' ? '⭐' : '👤'}</div>
        <div class="chat-msg-body">
          <div class="chat-msg-header">
            <span class="chat-msg-author" onclick="viewProfile('${msg.sender_email}')">${escapeHtml(msg.sender_name)}</span>
            <span class="chat-msg-role ${role}">${role === 'admin' ? 'Admin' : 'Member'}</span>
            <span class="chat-msg-time">${formatChatTime(msg.created_at)}</span>
          </div>
          <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
        </div>
      </div>`;
    }).join('');

  container.scrollTop = container.scrollHeight;
}

// ============================================================
// SEND MESSAGE - Fixed to use proper chat ID
// ============================================================
function sendCommunityMessage(event) {
  event.preventDefault();
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }

  const input = document.getElementById('chat-message-input');
  const text = input?.value.trim();
  if (!text) return;

  const chatId = getActiveChatId();
  const channelName = activeChannel || 'umum';

  // Save locally first for instant feedback
  const localMsg = {
    id: 'msg_' + Date.now(),
    chat_id: chatId,
    sender_email: actor.email.toLowerCase(),
    sender_name: getCommunityDisplayName(actor) || actor.name,
    text: text.slice(0, 2000),
    created_at: new Date().toISOString()
  };
  communityMessages.push(localMsg);
  input.value = '';
  loadChannelMessages(channelName);

  // Send to backend
  if (hasApiBridge()) {
    apiRequest('/api/community/messages', {
      method: 'POST',
      body: JSON.stringify({ email: actor.email, chat_id: chatId, sender_name: localMsg.sender_name, text })
    }).then(data => {
      if (data?.message) {
        // Replace local msg with server msg
        const idx = communityMessages.findIndex(m => m.id === localMsg.id);
        if (idx >= 0) communityMessages[idx] = data.message;
      }
      if (Array.isArray(data?.chats)) communityChats = data.chats;
    }).catch(e => {
      showToast('Pesan terkirim (offline mode)');
    });
  } else {
    // Local-only save
    try {
      const state = loadLocalCommunityState();
      state.messages.push(localMsg);
      saveLocalCommunityState(state);
    } catch (e) {}
  }
}

function filterChatList() {
  const query = document.getElementById('chat-search-input')?.value.trim().toLowerCase() || '';
  document.querySelectorAll('.channel-item').forEach(el => {
    const name = el.textContent.toLowerCase();
    el.style.display = name.includes(query) || !query ? '' : 'none';
  });
}

// ============================================================
// MEMBER LIST - Fixed count & realtime updates
// ============================================================
function updateMemberCount() {
  const online = onlinePlayers || [];
  const registered = registeredUsers || [];
  const total = registered.length;
  const onlineCount = online.length;
  
  document.getElementById('member-count-header').textContent = 'Anggota — ' + total;
  document.getElementById('chat-header-members').textContent = onlineCount + ' online · ' + total + ' anggota';
}

function renderMemberList() {
  const ownerEl = document.getElementById('member-owner');
  const adminEl = document.getElementById('member-admin');
  const onlineEl = document.getElementById('member-online');
  const offlineEl = document.getElementById('member-offline');

  if (!ownerEl) return;

  const admins = (registeredUsers || []).filter(u => u.role === 'admin');
  const members = (registeredUsers || []).filter(u => u.role !== 'admin');
  const online = onlinePlayers || [];

  updateMemberCount();
  document.getElementById('member-owner-count').textContent = admins.length > 0 ? 1 : 0;
  document.getElementById('member-admin-count').textContent = Math.max(0, admins.length - 1);
  document.getElementById('member-online-count').textContent = online.filter(u => u.role !== 'admin').length;
  document.getElementById('member-offline-count').textContent = members.filter(m => !online.some(u => u.email === m.email)).length;

  const owner = admins[0];
  ownerEl.innerHTML = owner ? `
    <div class="member-item" onclick="viewProfile('${owner.email}')">
      <span class="member-status ${online.some(u => u.email === owner.email) ? 'online' : 'offline'}"></span>
      <span class="member-name">${escapeHtml(owner.name)}</span>
      <span class="member-badge owner">OWNER</span>
    </div>
  ` : '';

  adminEl.innerHTML = admins.slice(1).map(a => `
    <div class="member-item" onclick="viewProfile('${a.email}')">
      <span class="member-status ${online.some(u => u.email === a.email) ? 'online' : 'offline'}"></span>
      <span class="member-name">${escapeHtml(a.name)}</span>
      <span class="member-badge admin">ADMIN</span>
    </div>
  `).join('');

  onlineEl.innerHTML = online.filter(u => u.role !== 'admin').map(u => `
    <div class="member-item" onclick="viewProfile('${u.email}')">
      <span class="member-status online"></span>
      <span class="member-name">${escapeHtml(u.name)}</span>
    </div>
  `).join('') || '<p style="font-size:12px;color:var(--text-muted);padding:4px 8px;">Tidak ada</p>';

  const offlineMembers = members.filter(m => !online.some(u => u.email === m.email));
  offlineEl.innerHTML = offlineMembers.map(m => `
    <div class="member-item" onclick="viewProfile('${m.email}')">
      <span class="member-status offline"></span>
      <span class="member-name">${escapeHtml(m.name)}</span>
    </div>
  `).join('') || '<p style="font-size:12px;color:var(--text-muted);padding:4px 8px;">Tidak ada</p>';
}

// ============================================================
// PANEL FUNCTIONS
// ============================================================
function showNotifications() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }

  NotificationSystem.load().then(() => {
    const modal = document.getElementById('notification-modal');
    const list = document.getElementById('notification-list');
    const footer = document.getElementById('notification-footer');
    if (!modal || !list) return;

    if (NotificationSystem.notifications.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px;">🔔 Belum ada notifikasi.</p>';
      if (footer) footer.style.display = 'none';
    } else {
      list.innerHTML = NotificationSystem.notifications.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="NotificationSystem.markRead('${n.id}'); this.classList.remove('unread');">
          <div class="notif-title">${escapeHtml(n.title)}</div>
          <div class="notif-content">${escapeHtml(n.content || '')}</div>
          <div class="notif-time">${formatChatTime(n.created_at)}</div>
        </div>
      `).join('');
      if (footer) footer.style.display = 'block';
    }
    modal.classList.remove('hidden');
  });
}

function renderNotifications() {
  const list = document.getElementById('notification-list');
  if (!list) return;
  if (NotificationSystem.notifications.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px;">🔔 Belum ada notifikasi.</p>';
  } else {
    list.innerHTML = NotificationSystem.notifications.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}">
        <div class="notif-title">${escapeHtml(n.title)}</div>
        <div class="notif-content">${escapeHtml(n.content || '')}</div>
        <div class="notif-time">${formatChatTime(n.created_at)}</div>
      </div>
    `).join('');
  }
}

function showFriends() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  FriendSystem.load().then(() => {
    document.getElementById('friends-modal')?.classList.remove('hidden');
    FriendSystem.renderFriendList();
  });
}

function addFriendFromSearch() {
  const input = document.getElementById('friend-search-input');
  const email = input?.value.trim();
  if (!email) { showToast('Masukkan email teman.'); return; }
  FriendSystem.sendRequest(email);
  input.value = '';
}

// ============================================================
// MUSIC PLAYLIST - Fixed with file upload
// ============================================================
function showMusicPlaylist() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  document.getElementById('playlist-modal')?.classList.remove('hidden');
  renderPlaylistTracks();
}

function renderPlaylistTracks() {
  const container = document.getElementById('playlist-tracks');
  if (!container) return;
  if (MusicEngine.queue.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">🎵 Belum ada lagu. Upload file atau tambah URL.</p>';
    return;
  }
  container.innerHTML = MusicEngine.queue.map((t, i) => `
    <div class="playlist-track ${i === MusicEngine.queueIndex ? 'active' : ''}" onclick="MusicEngine.queueIndex=${i};MusicEngine.loadTrack(MusicEngine.queue[${i}]);MusicEngine.play();renderPlaylistTracks();">
      <span style="font-size:18px;">${i === MusicEngine.queueIndex ? '▶️' : '🎵'}</span>
      <div class="track-info">
        <div class="track-name">${escapeHtml(t.track_name)}</div>
        <div class="track-artist">${escapeHtml(t.artist || 'Unknown')}</div>
      </div>
      <button class="btn btn-secondary" style="padding:2px 6px;font-size:11px;" onclick="event.stopPropagation();MusicEngine.queue.splice(${i},1);if(${i}<=MusicEngine.queueIndex)MusicEngine.queueIndex--;MusicEngine.saveState();renderPlaylistTracks();">✕</button>
    </div>
  `).join('');
}

function addTrackFromUrl() {
  const input = document.getElementById('playlist-url-input');
  const url = input?.value.trim();
  if (!url) { showToast('Masukkan URL lagu.'); return; }
  const track = { id: 'track_' + Date.now(), track_name: url.split('/').pop().split('?')[0] || 'Unknown Track', track_url: url, artist: 'Online', duration: 0 };
  MusicEngine.queue.push(track);
  if (MusicEngine.queue.length === 1) { MusicEngine.queueIndex = 0; MusicEngine.loadTrack(track); }
  MusicEngine.saveState();
  input.value = '';
  renderPlaylistTracks();
  showToast('✅ Lagu ditambahkan');
}

function handleMusicUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  MusicEngine.uploadFile(file);
  event.target.value = '';
}

function toggleBubblePanel(force) {
  const panel = document.getElementById('bubble-panel');
  if (!panel) return;
  const show = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !show);
}

function renderBubblePlaylist() {
  const container = document.getElementById('bubble-playlist');
  if (!container) return;
  if (MusicEngine.queue.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center;">Kosong</p>';
    return;
  }
  container.innerHTML = MusicEngine.queue.map((t, i) => `
    <div class="playlist-track ${i === MusicEngine.queueIndex ? 'active' : ''}" style="padding:5px 8px;" onclick="MusicEngine.queueIndex=${i};MusicEngine.loadTrack(MusicEngine.queue[${i}]);MusicEngine.play();renderBubblePlaylist();">
      <span style="font-size:14px;">${i === MusicEngine.queueIndex ? '▶' : '♪'}</span>
      <div class="track-info">
        <div class="track-name" style="font-size:12px;">${escapeHtml(t.track_name)}</div>
      </div>
    </div>
  `).join('');
}

function joinMusicRoom() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  showMusicPlaylist();
}

// ============================================================
// PROFILE - Fixed with real account data
// ============================================================
function viewProfile(email) {
  if (!email) { const actor = getCommunityActor(); if (!actor) { showCommunityLoginOverlay(); return; } email = actor.email; }
  const user = registeredUsers.find(u => u.email?.toLowerCase() === String(email || '').toLowerCase());
  if (!user) { showToast('Profil tidak ditemukan.'); return; }
  const profile = getCommunityProfile(user.email);
  const isOnline = isUserOnline(user.email);

  document.getElementById('profile-avatar').textContent = user.role === 'admin' ? '⭐' : '👤';
  document.getElementById('profile-name').textContent = getCommunityDisplayName(user);
  document.getElementById('profile-username').textContent = '@' + (user.name || user.email?.split('@')[0] || 'unknown');
  document.getElementById('profile-role').textContent = user.role === 'admin' ? 'Admin' : 'Member';
  document.getElementById('profile-bio').textContent = profile.bio || 'Tentang saya...';
  document.getElementById('stat-join-date').textContent = formatDate(user.joined_at);
  document.getElementById('stat-messages').textContent = (communityMessages || []).filter(m => m.sender_email === user.email.toLowerCase()).length;
  document.getElementById('stat-friends').textContent = FriendSystem.friends.filter(f => f.friend_id === user.id || f.user_id === user.id).length;

  const details = document.getElementById('profile-details');
  if (details) {
    details.innerHTML = `
      <div class="profile-detail-row"><span>Email</span><span>${escapeHtml(user.email)}</span></div>
      <div class="profile-detail-row"><span>Status</span><span>${isOnline ? 'Online 🟢' : 'Offline ⚫'}</span></div>
      <div class="profile-detail-row"><span>Minecraft</span><span>${escapeHtml(user.minecraft_name || '-')}</span></div>
      <div class="profile-detail-row"><span>XUID</span><span>${escapeHtml(user.xuid || '-')}</span></div>
    `;
  }

  const chatBtn = document.getElementById('profile-chat-btn');
  if (chatBtn) {
    const isSelf = getCommunityActor()?.email?.toLowerCase() === user.email.toLowerCase();
    chatBtn.classList.toggle('hidden', isSelf);
    chatBtn.onclick = () => { hideProfileModal(); startDirectChat(user.email, user.name); };
  }

  document.getElementById('profile-modal')?.classList.remove('hidden');
}

function hideProfileModal() { document.getElementById('profile-modal')?.classList.add('hidden'); }

function profileStartChat() {
  const name = document.getElementById('profile-name')?.textContent;
  const actor = getCommunityActor();
  if (!actor || !name) return;
  const user = registeredUsers.find(u => getCommunityDisplayName(u) === name);
  if (user) { hideProfileModal(); startDirectChat(user.email, user.name); }
}

// ============================================================
// SETTINGS - Fixed persistence
// ============================================================
function showSettingsModal() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  document.getElementById('settings-modal')?.classList.remove('hidden');
  loadSettings();
}

function hideSettingsModal() { document.getElementById('settings-modal')?.classList.add('hidden'); }

function switchSettings(cat) {
  document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.settings-pane').forEach(el => el.classList.remove('active'));
  document.querySelector(`.settings-nav-item[data-cat="${cat}"]`)?.classList.add('active');
  document.getElementById('sett-' + cat)?.classList.add('active');
}

function loadSettings() {
  const s = JSON.parse(localStorage.getItem('servermc_settings') || '{}');
  const selects = document.querySelectorAll('#sett-personalization select');
  if (selects[0]) selects[0].value = s.theme || 'dark';
  if (selects[1]) selects[1].value = s.accent || 'gold';
  if (selects[2]) selects[2].value = s.font_size || 'medium';
  const cbs = document.querySelectorAll('#sett-community input[type="checkbox"]');
  if (cbs[0]) cbs[0].checked = s.notif_message !== false;
  if (cbs[1]) cbs[1].checked = s.notif_mention !== false;
  if (cbs[2]) cbs[2].checked = s.show_status !== false;
  applySettings(s);
}

function saveSettings() {
  const s = {};
  const selects = document.querySelectorAll('#sett-personalization select');
  if (selects[0]) s.theme = selects[0].value;
  if (selects[1]) s.accent = selects[1].value;
  if (selects[2]) s.font_size = selects[2].value;
  const cbs = document.querySelectorAll('#sett-community input[type="checkbox"]');
  if (cbs[0]) s.notif_message = cbs[0].checked;
  if (cbs[1]) s.notif_mention = cbs[1].checked;
  if (cbs[2]) s.show_status = cbs[2].checked;
  localStorage.setItem('servermc_settings', JSON.stringify(s));
  applySettings(s);
  showToast('✅ Pengaturan disimpan');
}

function applySettings(s) {
  if (s.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  const accentColors = { gold: '#d4af37', blue: '#3498db', purple: '#9b59b6' };
  document.documentElement.style.setProperty('--gold-primary', accentColors[s.accent] || '#d4af37');
}

function saveAllSettings() {
  const s = {};
  // Theme
  s.theme = document.getElementById('sett-theme-mode')?.value || 'dark';
  s.accent = document.getElementById('sett-accent')?.value || 'gold';
  s.font_size = document.getElementById('sett-font-size')?.value || 'medium';
  s.font = document.getElementById('sett-font')?.value || 'inter';
  // Notifications
  s.notif_msg = document.getElementById('sett-notif-msg')?.checked ?? true;
  s.notif_mention = document.getElementById('sett-notif-mention')?.checked ?? true;
  s.notif_online = document.getElementById('sett-notif-online')?.checked ?? false;
  s.notif_group = document.getElementById('sett-notif-group')?.checked ?? true;
  s.notif_sound = document.getElementById('sett-notif-sound')?.checked ?? true;
  s.notif_preview = document.getElementById('sett-notif-preview')?.checked ?? true;
  // Privacy
  s.dm_all = document.getElementById('sett-dm-all')?.checked ?? true;
  s.show_status = document.getElementById('sett-show-status')?.checked ?? true;
  s.block_strangers = document.getElementById('sett-block-strangers')?.checked ?? false;
  s.filter = document.getElementById('sett-filter')?.checked ?? true;
  // Chat
  s.compact = document.getElementById('sett-compact')?.checked ?? false;
  s.timestamp = document.getElementById('sett-timestamp')?.checked ?? true;
  s.enter_send = document.getElementById('sett-enter-send')?.checked ?? true;
  s.emoji = document.getElementById('sett-emoji')?.checked ?? true;
  s.img_preview = document.getElementById('sett-img-preview')?.checked ?? true;
  // Community
  s.auto_join = document.getElementById('sett-auto-join')?.checked ?? true;
  s.show_online = document.getElementById('sett-show-online')?.checked ?? true;
  s.event_notif = document.getElementById('sett-event-notif')?.checked ?? false;
  // Security
  s.twofa = document.getElementById('sett-2fa')?.checked ?? false;
  s.login_notif = document.getElementById('sett-login-notif')?.checked ?? true;
  // Accessibility
  s.high_contrast = document.getElementById('sett-high-contrast')?.checked ?? false;
  s.reduced_anim = document.getElementById('sett-reduced-anim')?.checked ?? false;
  s.colorblind = document.getElementById('sett-colorblind')?.value || 'none';
  s.cursor = document.getElementById('sett-cursor')?.value || 'normal';
  // Music
  s.music_auto = document.getElementById('sett-music-auto')?.checked ?? false;
  s.music_bg = document.getElementById('sett-music-bg')?.checked ?? true;
  s.crossfade = document.getElementById('sett-crossfade')?.checked ?? false;
  s.quality = document.getElementById('sett-quality')?.value || 'medium';
  // Developer
  s.devmode = document.getElementById('sett-devmode')?.checked ?? false;
  s.console = document.getElementById('sett-console')?.checked ?? false;
  // Save all
  localStorage.setItem('servermc_settings', JSON.stringify(s));
  applySettings(s);
  showToast('✅ Semua pengaturan disimpan');
}

function resetTheme() {
  document.getElementById('sett-theme-mode').value = 'dark';
  document.getElementById('sett-accent').value = 'gold';
  document.getElementById('sett-font-size').value = 'medium';
  document.getElementById('sett-font').value = 'inter';
  saveAllSettings();
}

function saveProfile() {
  const actor = getCommunityActor();
  if (!actor) return;
  const bio = document.getElementById('sett-bio')?.value?.trim().slice(0, 160) || '';
  const profiles = loadCommunityProfiles();
  profiles[actor.email.toLowerCase()] = { ...(profiles[actor.email.toLowerCase()] || {}), bio };
  saveCommunityProfiles(profiles);
  showToast('✅ Profil disimpan');
  if (hasApiBridge()) apiRequest('/api/community/auth', { method: 'POST', body: JSON.stringify({ bio }) }).catch(() => {});
}

function clearLocalCache() {
  localStorage.removeItem('servermc_community');
  localStorage.removeItem('servermc_messages');
  showToast('🗑 Cache lokal dibersihkan');
}

function exportData() {
  const data = {
    settings: JSON.parse(localStorage.getItem('servermc_settings') || '{}'),
    friends: JSON.parse(localStorage.getItem('servermc_friends') || '[]'),
    notifications: JSON.parse(localStorage.getItem('servermc_notifications') || '[]'),
    profiles: JSON.parse(localStorage.getItem('servermc_community_profiles') || '{}')
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'servermc-export.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 Data diekspor!');
}

function readAloud() {
  if (!('speechSynthesis' in window)) { showToast('Text-to-speech tidak didukung browser ini'); return; }
  const msg = new SpeechSynthesisUtterance('Selamat datang di Server MC Chat. Nikmati pengalaman chatting premium.');
  msg.lang = 'id-ID';
  speechSynthesis.speak(msg);
  showToast('🔊 Membacakan...');
}

function editProfile() {
  const actor = getCommunityActor();
  if (!actor) return;
  const currentBio = getCommunityProfile(actor.email).bio || '';
  const bio = prompt('Edit Bio:', currentBio);
  if (bio === null) return;
  const profiles = loadCommunityProfiles();
  profiles[actor.email.toLowerCase()] = { ...(profiles[actor.email.toLowerCase()] || {}), bio: bio.trim().slice(0, 160) };
  saveCommunityProfiles(profiles);
  showToast('✅ Bio diperbarui');
  if (hasApiBridge()) apiRequest('/api/community/auth', { method: 'POST', body: JSON.stringify({ bio: bio.trim().slice(0, 160) }) }).catch(() => {});
}

function changeAvatar() { showToast('📸 Klik avatar di profil untuk upload foto'); }
function changeBanner() { showToast('🖼 Fitur banner akan segera hadir!'); }

// ============================================================
// DM & GROUP - Fixed with user IDs
// ============================================================
function showNewDmModal() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  renderDmMemberList();
  document.getElementById('dm-member-search').value = '';
  document.getElementById('new-dm-modal')?.classList.remove('hidden');
}

function hideNewDmModal() { document.getElementById('new-dm-modal')?.classList.add('hidden'); }

function filterDmMemberList() { renderDmMemberList(); }

function renderDmMemberList() {
  const list = document.getElementById('dm-member-list');
  const actor = getCommunityActor();
  if (!list || !actor) return;
  const query = document.getElementById('dm-member-search')?.value.trim().toLowerCase() || '';
  const others = (registeredUsers || []).filter(u => {
    if (u.email?.toLowerCase() === actor.email?.toLowerCase()) return false;
    if (!query) return true;
    return (u.name || '').toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query);
  });
  list.innerHTML = others.length ? others.map(u => `
    <button type="button" class="member-picker-item clickable-dm" onclick="startDirectChat('${u.email}', '${escapeHtml(u.name)}');">
      <span>${u.role === 'admin' ? '⭐' : '👤'}</span>
      <span style="flex:1;">${escapeHtml(u.name)}</span>
      <span style="font-size:11px;color:var(--text-muted);">${escapeHtml(u.email)}</span>
      ${isUserOnline(u.email) ? '<span style="font-size:10px;color:var(--status-online);">🟢</span>' : ''}
    </button>
  `).join('') : '<p style="padding:10px;color:var(--text-muted);font-size:13px;">Member tidak ditemukan.</p>';
}

function showNewGroupModal() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  const picker = document.getElementById('group-member-picker');
  if (picker) {
    const others = (registeredUsers || []).filter(u => u.email?.toLowerCase() !== actor.email?.toLowerCase());
    picker.innerHTML = others.length ? others.map(u => `
      <label class="member-picker-item">
        <input type="checkbox" name="group-member" value="${escapeHtml(u.email)}" style="accent-color:var(--gold-primary);">
        <span>${escapeHtml(u.name)} · ${escapeHtml(u.email)}</span>
      </label>
    `).join('') : '<p style="padding:10px;color:var(--text-muted);">Belum ada member.</p>';
  }
  document.getElementById('group-name').value = '';
  document.getElementById('new-group-modal')?.classList.remove('hidden');
}

function hideNewGroupModal() { document.getElementById('new-group-modal')?.classList.add('hidden'); }

async function handleCreateGroup(event) {
  event.preventDefault();
  const actor = getCommunityActor();
  if (!actor) return;
  const groupName = document.getElementById('group-name')?.value.trim();
  const selected = Array.from(document.querySelectorAll('input[name="group-member"]:checked')).map(el => el.value);
  if (!groupName) { showToast('Nama grup harus diisi.'); return; }
  try {
    if (hasApiBridge()) {
      const data = await apiRequest('/api/community/chats', { method: 'POST', body: JSON.stringify({ email: actor.email, name: getCommunityDisplayName(actor), type: 'group', group_name: groupName, members: selected }) });
      if (Array.isArray(data?.chats)) communityChats = data.chats;
      if (data?.chat) activeChatId = data.chat.id;
    } else {
      const state = loadLocalCommunityState();
      const members = new Set([actor.email.toLowerCase(), ...selected.map(e => e.toLowerCase())]);
      const chat = { id: 'group_' + Date.now(), type: 'group', name: groupName, members: Array.from(members), created_by: actor.email.toLowerCase(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), avatar: '👥', last_message: null, roles: { owner: [actor.email.toLowerCase()], admins: [], moderators: [] }, channels: [{ name: 'pengumuman', type: 'text' }, { name: 'umum', type: 'text' }, { name: 'media', type: 'text' }, { name: 'musik', type: 'music' }, { name: 'bantuan', type: 'text' }] };
      state.chats.unshift(chat);
      saveLocalCommunityState(state);
      communityChats = getUserCommunityChats(state, actor.email);
      activeChatId = chat.id;
    }
    hideNewGroupModal();
    renderChatList();
    selectChannel(activeChannel);
    showToast('✅ Grup "' + groupName + '" berhasil dibuat!');
  } catch (e) { showToast(e.message || 'Gagal membuat grup.'); }
}

async function startDirectChat(targetEmail, targetName) {
  const actor = getCommunityActor();
  if (!actor) return showCommunityLoginOverlay();
  try {
    if (hasApiBridge()) {
      const data = await apiRequest('/api/community/chats', { method: 'POST', body: JSON.stringify({ email: actor.email, name: getCommunityDisplayName(actor), type: 'direct', target_email: targetEmail, target_name: targetName }) });
      if (Array.isArray(data?.chats)) communityChats = data.chats;
      if (data?.chat) activeChatId = data.chat.id;
    } else {
      const chatId = buildDirectChatId(actor.email, targetEmail);
      const state = loadLocalCommunityState();
      let chat = state.chats.find(item => item.id === chatId);
      if (!chat) { chat = { id: chatId, type: 'direct', name: targetName || targetEmail?.split('@')[0], members: [actor.email.toLowerCase(), targetEmail.toLowerCase()], member_names: { [actor.email.toLowerCase()]: getCommunityDisplayName(actor), [targetEmail.toLowerCase()]: targetName }, created_by: actor.email.toLowerCase(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), avatar: '💬', last_message: null }; state.chats.unshift(chat); saveLocalCommunityState(state); }
      communityChats = getUserCommunityChats(state, actor.email);
      activeChatId = chat.id;
    }
    activeChatType = 'dm';
    hideNewDmModal();
    loadChannelMessages(targetName || targetEmail);
    renderChatList();
    showToast('💬 Chat dengan ' + (targetName || targetEmail) + ' dibuka');
  } catch (e) { showToast(e.message || 'Gagal memulai chat.'); }
}

function renderChatList() {
  const actor = getCommunityActor();
  if (!actor) return;
  const dmList = document.getElementById('dm-channel-list');
  const groupList = document.getElementById('group-channel-list');
  if (dmList) {
    const dms = (communityChats || []).filter(c => c.type === 'direct' && c.members?.includes(actor.email.toLowerCase()));
    dmList.innerHTML = dms.length ? dms.map(c => {
      const otherEmail = c.members.find(e => e !== actor.email.toLowerCase());
      const otherName = c.member_names?.[otherEmail] || otherEmail?.split('@')[0] || 'User';
      return `<div class="channel-item ${c.id === activeChatId && activeChatType === 'dm' ? 'active' : ''}" onclick="openDirectChat('${c.id}')"><span class="channel-hash">💬</span><span>${escapeHtml(otherName)}</span></div>`;
    }).join('') : '<p style="font-size:12px;color:var(--text-muted);padding:4px 8px;">Belum ada chat</p>';
  }
  if (groupList) {
    const groups = (communityChats || []).filter(c => c.type === 'group' && c.members?.includes(actor.email.toLowerCase()) && c.id !== 'group_umum');
    groupList.innerHTML = groups.length ? groups.map(c => `<div class="channel-item ${c.id === activeChatId && activeChatType === 'group' ? 'active' : ''}" onclick="openGroupChat('${c.id}')"><span class="channel-hash">👥</span><span>${escapeHtml(c.name)}</span></div>`).join('') : '<p style="font-size:12px;color:var(--text-muted);padding:4px 8px;">Belum ada grup</p>';
  }
}

function openDirectChat(chatId) {
  activeChatId = chatId;
  activeChatType = 'dm';
  const chat = (communityChats || []).find(c => c.id === chatId);
  if (chat) document.getElementById('chat-header-name').textContent = chat.name || 'Chat';
  loadChannelMessages();
  renderChatList();
}

function openGroupChat(chatId) {
  activeChatId = chatId;
  activeChatType = 'group';
  const chat = (communityChats || []).find(c => c.id === chatId);
  if (chat) document.getElementById('chat-header-name').textContent = chat.name || 'Group';
  loadChannelMessages();
  renderChatList();
}

// ============================================================
// UTILITY HELPERS
// ============================================================
function toggleMute() {
  if (MusicEngine.audio) { MusicEngine.audio.muted = !MusicEngine.audio.muted; showToast(MusicEngine.audio.muted ? '🔇 Muted' : '🔊 Unmuted'); }
}

function toggleDeafen() {
  if (MusicEngine.audio) { MusicEngine.audio.muted = !MusicEngine.audio.muted; showToast(MusicEngine.audio.muted ? '🔇 Deafened' : '🔊 Undeafened'); }
}

function inviteMember() { showFriends(); }
function toggleMemberList() { document.getElementById('member-sidebar')?.classList.toggle('hidden'); }
function openChatSettings() { showToast('ℹ️ Info grup akan segera hadir!'); }
function showBookmarks() { showToast('🔖 Fitur bookmark akan segera hadir!'); }
function showMusicRoomSettings() { showToast('Pengaturan Music Room akan segera hadir!'); }
function musicShuffle() { MusicEngine.toggleShuffle(); }
function musicPrevious() { MusicEngine.previous(); }
function musicPlayPause() { MusicEngine.togglePlay(); }
function musicNext() { MusicEngine.next(); }
function musicRepeat() { MusicEngine.toggleRepeat(); }
function setVolume(val) { MusicEngine.setVolume(val); }

function loadCommunityChat() {
  renderChatList();
  renderMemberList();
  if (activeChatType === 'channel') loadChannelMessages(activeChannel);
}

function setStatus(status) {
  const actor = getCommunityActor();
  if (!actor) return;
  const states = { online: '🟢 Online', idle: '🟡 Idle', dnd: '🔴 Do Not Disturb', invisible: '⚫ Invisible' };
  localStorage.setItem('servermc_status', status);
  const el = document.getElementById('channel-user-status');
  if (el) el.textContent = states[status] || '⚫ Offline';
  const el2 = document.getElementById('user-panel-id');
  if (el2) el2.textContent = states[status] || '⚫ Offline';
  document.getElementById('status-modal')?.classList.add('hidden');
  showToast('Status: ' + states[status]);
}

function showLanguageModal() {
  const container = document.getElementById('language-list');
  if (!container) return;
  const langs = [
    { code: 'id', name: 'Indonesia' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'ru', name: 'Русский' },
    { code: 'ar', name: 'العربية' },
    { code: 'pt', name: 'Português' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'th', name: 'ไทย' },
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'hi', name: 'हिन्दी' }
  ];
  const current = localStorage.getItem('servermc_lang') || 'id';
  container.innerHTML = langs.map(l =>
    `<button class="settings-btn" onclick="setLanguage('${l.code}')">${current === l.code ? '✓ ' : ''}${l.name} (${l.code})</button>`
  ).join('');
  document.getElementById('language-modal')?.classList.remove('hidden');
}

function setLanguage(code) {
  localStorage.setItem('servermc_lang', code);
  document.getElementById('language-modal')?.classList.add('hidden');
  showToast('🌐 Language set to ' + code);
}

function openCommunitySettings() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  showSettingsModal();
}

function showCommunityLoginOverlay() { document.getElementById('community-login-overlay')?.classList.remove('hidden'); }
function hideCommunityLoginOverlay() { document.getElementById('community-login-overlay')?.classList.add('hidden'); }

// ============================================================
// PRESENCE SYSTEM - Realtime status updates
// ============================================================
function updatePresence() {
  const actor = getCommunityActor();
  if (!actor) return;
  
  const displayName = getCommunityDisplayName(actor);
  const isOnline = (onlinePlayers || []).some(u => u.email === actor.email);
  
  // Always update all identity elements from real account
  const chName = document.getElementById('channel-user-name');
  if (chName) chName.textContent = displayName;
  const panelName = document.getElementById('user-panel-name');
  if (panelName) panelName.textContent = displayName;
  const status = document.getElementById('channel-user-status');
  if (status) status.textContent = isOnline ? '🟢 Online' : '⚫ Offline';
  
  renderMemberList();
}

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  MusicEngine.init();
  NotificationSystem.load();
  FriendSystem.load();
  
  // Initial render — fix "Guest" bug: always use real logged-in account
  const actor = getCommunityActor();
  if (actor) {
    const displayName = getCommunityDisplayName(actor);
    document.getElementById('channel-user-name').textContent = displayName;
    document.getElementById('user-panel-name').textContent = displayName;
    document.getElementById('user-panel-id').textContent = '#' + (actor.id || '0000');
    document.getElementById('channel-user-avatar').textContent = actor.role === 'admin' ? '⭐' : '👤';
    document.getElementById('user-panel-avatar').textContent = actor.role === 'admin' ? '⭐' : '👤';
    updatePresence();
  }

  renderMemberList();
  renderChatList();
  selectChannel('umum');
  loadSettings();

  // Nano progress bar seek
  document.querySelector('.nano-progress-track')?.addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    MusicEngine.seek(((e.clientX - rect.left) / rect.width) * 100);
  });

  // Bubble progress bar seek
  document.querySelector('.bubble-progress-track')?.addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    MusicEngine.seek(((e.clientX - rect.left) / rect.width) * 100);
  });

  // Music file upload handler (legacy modal)
  const fileInput = document.getElementById('music-file-input');
  if (fileInput) fileInput.addEventListener('change', handleMusicUpload);

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.code) {
      case 'Space': e.preventDefault(); MusicEngine.togglePlay(); break;
      case 'ArrowRight': MusicEngine.next(); break;
      case 'ArrowLeft': MusicEngine.previous(); break;
      case 'KeyM': toggleMute(); break;
    }
  });

  // Realtime refresh (using shared polling from app.js, add member/presence only)
  setInterval(() => {
    updateMemberCount();
    renderMemberList();
    updatePresence();
  }, 5000);

});