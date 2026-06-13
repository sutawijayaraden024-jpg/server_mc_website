// ============================================================
// KOMUNITAS.JS - Server_MC Community System
// Integrasi penuh: Frontend → API → Database → Realtime → UI
// ============================================================

// ============================================================
// 1. MUSIC PLAYER ENGINE (Web Audio API - Real, not mock)
// ============================================================
const MusicEngine = {
  audio: null,
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.7,
  shuffle: false,
  repeat: 'none', // 'none' | 'one' | 'all'
  
  init() {
    this.audio = new Audio();
    this.audio.volume = this.volume;
    
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.onTrackEnd());
    this.audio.addEventListener('loadedmetadata', () => {
      document.getElementById('music-total-time').textContent = this.formatTime(this.audio.duration);
    });
    this.audio.addEventListener('error', (e) => {
      showToast('Gagal memutar lagu: ' + (e.message || 'unknown error'));
    });
    
    // Load queue from storage
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
      if (this.queue.length > 0 && this.queueIndex >= 0) {
        this.loadTrack(this.queue[this.queueIndex]);
      }
      document.getElementById('music-volume').value = this.volume * 100;
    } catch (e) {}
  },
  
  saveState() {
    localStorage.setItem('servermc_music_state', JSON.stringify({
      volume: this.volume,
      shuffle: this.shuffle,
      repeat: this.repeat,
      queue: this.queue,
      queueIndex: this.queueIndex
    }));
  },
  
  async loadTracks(playlistId) {
    const actor = getCommunityActor();
    if (!actor) return;
    
    try {
      if (hasApiBridge()) {
        const data = await apiRequest(`/api/community/music?playlist_id=${playlistId}`, { method: 'GET' });
        if (data?.tracks) {
          this.queue = data.tracks;
          this.queueIndex = this.queue.length > 0 ? 0 : -1;
          this.saveState();
          if (this.queue.length > 0) this.loadTrack(this.queue[0]);
        }
      }
    } catch (e) {
      showToast('Gagal memuat playlist: ' + e.message);
    }
  },
  
  loadTrack(track) {
    if (!track) return;
    this.currentTrack = track;
    this.audio.src = track.track_url || '';
    this.audio.load();
    
    document.getElementById('music-title').textContent = track.track_name || 'No Track Playing';
    document.getElementById('music-artist').textContent = track.artist || '-';
    
    if (this.isPlaying) {
      this.audio.play().catch(() => {});
    }
    this.updatePlayButton();
  },
  
  play() {
    if (!this.audio.src && this.queue.length > 0 && this.queueIndex >= 0) {
      this.loadTrack(this.queue[this.queueIndex]);
    }
    if (this.audio.src) {
      this.audio.play().then(() => {
        this.isPlaying = true;
        this.updatePlayButton();
      }).catch(e => showToast('Gagal play: ' + e.message));
    }
  },
  
  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.updatePlayButton();
  },
  
  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  },
  
  next() {
    if (this.queue.length === 0) return;
    if (this.shuffle) {
      this.queueIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.queueIndex = (this.queueIndex + 1) % this.queue.length;
    }
    this.loadTrack(this.queue[this.queueIndex]);
    if (this.isPlaying) this.play();
    this.saveState();
  },
  
  previous() {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (this.shuffle) {
      this.queueIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    }
    this.loadTrack(this.queue[this.queueIndex]);
    if (this.isPlaying) this.play();
    this.saveState();
  },
  
  onTrackEnd() {
    if (this.repeat === 'one') {
      this.audio.currentTime = 0;
      this.play();
    } else if (this.repeat === 'all' || this.queueIndex < this.queue.length - 1) {
      this.next();
    } else {
      this.isPlaying = false;
      this.updatePlayButton();
    }
  },
  
  setVolume(val) {
    this.volume = val / 100;
    if (this.audio) this.audio.volume = this.volume;
    this.saveState();
  },
  
  seek(position) {
    if (this.audio && this.audio.duration) {
      this.audio.currentTime = (position / 100) * this.audio.duration;
    }
  },
  
  updateProgress() {
    if (!this.audio || !this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    document.getElementById('music-progress-fill').style.width = pct + '%';
    document.getElementById('music-current-time').textContent = this.formatTime(this.audio.currentTime);
  },
  
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  },
  
  updatePlayButton() {
    const btn = document.querySelector('.music-play-btn');
    if (btn) btn.textContent = this.isPlaying ? '⏸️' : '▶️';
  },
  
  toggleShuffle() {
    this.shuffle = !this.shuffle;
    this.saveState();
    showToast(this.shuffle ? 'Shuffle ON' : 'Shuffle OFF');
  },
  
  toggleRepeat() {
    const modes = ['none', 'one', 'all'];
    const idx = modes.indexOf(this.repeat);
    this.repeat = modes[(idx + 1) % modes.length];
    this.saveState();
    showToast('Repeat: ' + this.repeat);
  }
};

// ============================================================
// 2. NOTIFICATION SYSTEM
// ============================================================
const NotificationSystem = {
  notifications: [],
  unreadCount: 0,
  
  async load() {
    const actor = getCommunityActor();
    if (!actor) return;
    
    try {
      if (hasApiBridge()) {
        const data = await apiRequest('/api/community/notifications', { method: 'GET' });
        if (Array.isArray(data?.notifications)) {
          this.notifications = data.notifications;
          this.unreadCount = this.notifications.filter(n => !n.is_read).length;
          this.updateBadge();
        }
      }
    } catch (e) {}
    
    // Local fallback
    try {
      const local = JSON.parse(localStorage.getItem('servermc_notifications') || '[]');
      this.notifications = this.notifications.concat(local);
      this.unreadCount = this.notifications.filter(n => !n.is_read).length;
      this.updateBadge();
    } catch (e) {}
  },
  
  add(notification) {
    this.notifications.unshift({
      id: 'notif_' + Date.now(),
      ...notification,
      is_read: false,
      created_at: new Date().toISOString()
    });
    this.unreadCount++;
    this.updateBadge();
    this.save();
  },
  
  markRead(id) {
    const n = this.notifications.find(n => n.id === id);
    if (n && !n.is_read) {
      n.is_read = true;
      this.unreadCount--;
      this.updateBadge();
      this.save();
    }
  },
  
  markAllRead() {
    this.notifications.forEach(n => { n.is_read = true; });
    this.unreadCount = 0;
    this.updateBadge();
    this.save();
  },
  
  save() {
    localStorage.setItem('servermc_notifications', JSON.stringify(this.notifications));
  },
  
  updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount || '';
      badge.classList.toggle('hidden', this.unreadCount === 0);
    }
  }
};

// ============================================================
// 3. FRIEND SYSTEM (Frontend)
// ============================================================
const FriendSystem = {
  friends: [],
  pendingRequests: [],
  
  async load() {
    const actor = getCommunityActor();
    if (!actor) return;
    
    try {
      if (hasApiBridge()) {
        const data = await apiRequest('/api/community/friends?status=all', { method: 'GET' });
        if (Array.isArray(data?.friends)) {
          this.friends = data.friends;
        }
        const pending = await apiRequest('/api/community/friends?status=pending', { method: 'GET' });
        if (Array.isArray(pending?.friends)) {
          this.pendingRequests = pending.friends;
        }
      }
    } catch (e) {}
    
    // Local fallback
    try {
      const local = JSON.parse(localStorage.getItem('servermc_friends') || '[]');
      this.friends = this.friends.concat(local);
    } catch (e) {}
  },
  
  async sendRequest(friendEmail) {
    const actor = getCommunityActor();
    if (!actor) return;
    
    const friendUser = registeredUsers.find(u => u.email.toLowerCase() === friendEmail.toLowerCase());
    if (!friendUser) {
      showToast('User tidak ditemukan.');
      return;
    }
    
    if (hasApiBridge()) {
      try {
        await apiRequest('/api/community/friends', {
          method: 'POST',
          body: JSON.stringify({ action: 'send_request', friendId: friendUser.id })
        });
        showToast('Permintaan teman terkirim.');
        NotificationSystem.add({
          type: 'friend_request_sent',
          title: 'Permintaan Teman',
          content: 'Permintaan teman ke ' + friendUser.name + ' terkirim.'
        });
        return;
      } catch (e) {
        showToast(e.message);
        return;
      }
    }
    
    // Local fallback
    let friends = JSON.parse(localStorage.getItem('servermc_friends') || '[]');
    if (friends.some(f => f.email === friendEmail)) {
      showToast('Sudah menjadi teman.');
      return;
    }
    friends.push({ email: friendEmail, name: friendUser.name, status: 'pending', created_at: new Date().toISOString() });
    localStorage.setItem('servermc_friends', JSON.stringify(friends));
    showToast('Permintaan teman terkirim.');
  },
  
  async acceptRequest(friendId) {
    if (hasApiBridge()) {
      try {
        await apiRequest('/api/community/friends', {
          method: 'POST',
          body: JSON.stringify({ action: 'accept_request', friendId })
        });
        showToast('Permintaan teman diterima.');
        this.load();
        return;
      } catch (e) { showToast(e.message); }
    }
  },
  
  async rejectRequest(friendId) {
    if (hasApiBridge()) {
      try {
        await apiRequest('/api/community/friends', {
          method: 'POST',
          body: JSON.stringify({ action: 'reject_request', friendId })
        });
        showToast('Permintaan teman ditolak.');
        this.load();
        return;
      } catch (e) { showToast(e.message); }
    }
  },
  
  async blockUser(friendId) {
    if (hasApiBridge()) {
      try {
        await apiRequest('/api/community/friends', {
          method: 'POST',
          body: JSON.stringify({ action: 'block', friendId })
        });
        showToast('User diblokir.');
        this.load();
        return;
      } catch (e) { showToast(e.message); }
    }
  },
  
  async unfriend(friendId) {
    if (hasApiBridge()) {
      try {
        await apiRequest('/api/community/friends', {
          method: 'POST',
          body: JSON.stringify({ action: 'unfriend', friendId })
        });
        showToast('Berhenti berteman.');
        this.load();
        return;
      } catch (e) { showToast(e.message); }
    }
  },
  
  renderFriendList(containerId = 'friend-list') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (this.friends.length === 0) {
      container.innerHTML = '<div class="profile-empty-state"><span>👥</span><p>Belum ada teman. Cari teman untuk memulai!</p></div>';
      return;
    }
    
    container.innerHTML = this.friends.map(f => `
      <div class="friend-item">
        <div class="friend-avatar">👤</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(f.display_name || f.username || f.email)}</div>
          <div class="friend-status ${f.online_status === 'online' ? 'online' : 'offline'}">${f.online_status === 'online' ? '🟢 Online' : '⚫ Offline'}</div>
        </div>
        <div class="friend-actions">
          <button class="btn btn-sm" onclick="startDirectChat('${f.email}', '${escapeHtml(f.display_name || f.username)}'); return false;">💬</button>
          <button class="btn btn-sm" onclick="FriendSystem.unfriend('${f.id}'); return false;">❌</button>
        </div>
      </div>
    `).join('');
  }
};

// ============================================================
// 4. CHANNEL SYSTEM
// ============================================================
function selectChannel(channelName) {
  const actor = getCommunityActor();
  if (!actor) {
    showCommunityLoginOverlay();
    return;
  }
  
  // Update channel UI
  document.querySelectorAll('.discord-text-channel, .discord-voice-channel').forEach(el => {
    el.classList.remove('active');
  });
  
  const channelEl = Array.from(document.querySelectorAll('.discord-text-channel, .discord-voice-channel'))
    .find(el => el.textContent.trim().includes(channelName));
  if (channelEl) channelEl.classList.add('active');
  
  // Update chat header
  document.getElementById('discord-chat-name').textContent = channelName;
  
  // Load messages for this channel
  loadChannelMessages(channelName);
}

function loadChannelMessages(channelName) {
  const messagesContainer = document.getElementById('discord-messages');
  if (!messagesContainer) return;
  
  const actor = getCommunityActor();
  if (!actor) return;
  
  // For now, use existing chat system and filter by channel name
  const channelMessages = communityMessages.filter(m => m.chat_id === channelName);
  
  if (channelMessages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="discord-welcome">
        <div class="discord-welcome-icon">#</div>
        <h2>Selamat datang di #${escapeHtml(channelName)}!</h2>
        <p>Ini adalah awal dari channel #${escapeHtml(channelName)}.</p>
      </div>
    `;
    return;
  }
  
  let lastDateLabel = '';
  messagesContainer.innerHTML = channelMessages
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(msg => {
      const dateLabel = formatDate(msg.created_at);
      let divider = '';
      if (dateLabel !== lastDateLabel) {
        lastDateLabel = dateLabel;
        divider = `<div class="chat-date-divider">${escapeHtml(dateLabel)}</div>`;
      }
      const isOwn = msg.sender_email === actor.email.toLowerCase();
      return `
        ${divider}
        <div class="discord-message">
          <div class="discord-message-avatar">👤</div>
          <div class="discord-message-content">
            <div class="discord-message-header">
              <span class="discord-message-author">${escapeHtml(msg.sender_name)}</span>
              <span class="discord-message-time">${escapeHtml(formatChatTime(msg.created_at))}</span>
            </div>
            <div class="discord-message-text">${escapeHtml(msg.text)}</div>
          </div>
        </div>
      `;
    }).join('');
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================================
// 5. MEMBER LIST
// ============================================================
function renderMemberList() {
  const ownerContainer = document.getElementById('member-owner');
  const adminContainer = document.getElementById('member-admin');
  const modContainer = document.getElementById('member-moderator');
  const onlineContainer = document.getElementById('member-online');
  const offlineContainer = document.getElementById('member-offline');
  const countDisplay = document.getElementById('discord-member-count');
  
  if (!ownerContainer) return;
  
  const admins = registeredUsers.filter(u => u.role === 'admin');
  const members = registeredUsers.filter(u => u.role !== 'admin');
  const onlineUsers = onlinePlayers || [];
  
  if (countDisplay) {
    countDisplay.textContent = 'Member — ' + registeredUsers.length;
  }
  
  // Owner (first admin)
  const owner = admins[0];
  ownerContainer.innerHTML = owner ? `
    <div class="discord-member-item" onclick="viewProfile('${owner.email}'); return false;">
      <span class="discord-member-status online"></span>
      <span class="discord-member-name">${escapeHtml(owner.name)}</span>
      <span class="discord-member-badge owner">OWNER</span>
    </div>
  ` : '';
  
  // Other admins
  adminContainer.innerHTML = admins.slice(1).map(a => `
    <div class="discord-member-item" onclick="viewProfile('${a.email}'); return false;">
      <span class="discord-member-status ${onlineUsers.some(u => u.email === a.email) ? 'online' : 'offline'}"></span>
      <span class="discord-member-name">${escapeHtml(a.name)}</span>
      <span class="discord-member-badge admin">ADMIN</span>
    </div>
  `).join('');
  
  // Moderators (not implemented yet - show as regular)
  modContainer.innerHTML = '';
  
  // Online members
  onlineContainer.innerHTML = onlineUsers.filter(u => u.role !== 'admin').map(u => `
    <div class="discord-member-item" onclick="viewProfile('${u.email}'); return false;">
      <span class="discord-member-status online"></span>
      <span class="discord-member-name">${escapeHtml(u.name)}</span>
    </div>
  `).join('');
  
  // Offline members
  const offlineMembers = members.filter(m => !onlineUsers.some(u => u.email === m.email));
  offlineContainer.innerHTML = offlineMembers.map(m => `
    <div class="discord-member-item" onclick="viewProfile('${m.email}'); return false;">
      <span class="discord-member-status offline"></span>
      <span class="discord-member-name">${escapeHtml(m.name)}</span>
    </div>
  `).join('');
}

// ============================================================
// 6. PANEL FUNCTIONS (Messages, Music, Notifications, Friends)
// ============================================================
function showMessagesPanel() {
  const main = document.getElementById('discord-chat-main');
  if (!main) return;
  
  // Hide music player, show messages
  document.getElementById('music-player')?.classList.add('hidden');
  document.querySelector('.discord-messages')?.classList.remove('hidden');
  document.querySelector('.discord-chat-input')?.classList.remove('hidden');
  
  selectChannel('chat-umum');
}

function showMusicPlaylist() {
  const main = document.getElementById('discord-chat-main');
  if (!main) return;
  
  // Show music player prominently
  document.getElementById('music-player')?.classList.remove('hidden');
  document.querySelector('.discord-messages')?.classList.add('hidden');
  document.querySelector('.discord-chat-input')?.classList.add('hidden');
  
  // Load playlist from backend
  MusicEngine.loadTracks();
  
  // Show playlist modal
  showPlaylistModal();
}

function showPlaylistModal() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  
  // Create and show playlist browser
  const modal = document.createElement('div');
  modal.className = 'chat-modal';
  modal.id = 'playlist-modal';
  modal.onclick = function(e) { if (e.target === this) this.remove(); };
  
  modal.innerHTML = `
    <div class="chat-modal-card" style="max-width: 500px;">
      <div class="chat-modal-header">
        <h3>🎵 Playlist Musik</h3>
        <button type="button" class="chat-modal-close" onclick="this.closest('.chat-modal').remove(); return false;">×</button>
      </div>
      <div style="padding: 16px;">
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input type="text" id="playlist-url-input" placeholder="URL lagu (YouTube, SoundCloud, direct MP3...)" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);">
          <button class="btn btn-primary" onclick="addTrackFromUrl()">Tambah</button>
        </div>
        <div id="playlist-tracks" style="max-height:300px;overflow-y:auto;"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  renderPlaylistTracks();
}

function addTrackFromUrl() {
  const input = document.getElementById('playlist-url-input');
  const url = input?.value.trim();
  if (!url) { showToast('Masukkan URL lagu.'); return; }
  
  const track = {
    id: 'track_' + Date.now(),
    track_name: url.split('/').pop().split('?')[0] || 'Unknown Track',
    track_url: url,
    artist: 'Unknown',
    duration: 0
  };
  
  MusicEngine.queue.push(track);
  if (MusicEngine.queue.length === 1) {
    MusicEngine.queueIndex = 0;
    MusicEngine.loadTrack(track);
  }
  MusicEngine.saveState();
  input.value = '';
  renderPlaylistTracks();
  showToast('Lagu ditambahkan ke playlist.');
}

function renderPlaylistTracks() {
  const container = document.getElementById('playlist-tracks');
  if (!container) return;
  
  if (MusicEngine.queue.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-muted);text-align:center;padding:20px;">Belum ada lagu. Tambahkan URL untuk memulai.</p>';
    return;
  }
  
  container.innerHTML = MusicEngine.queue.map((track, i) => `
    <div class="playlist-track ${i === MusicEngine.queueIndex ? 'active' : ''}" 
         onclick="MusicEngine.queueIndex=${i};MusicEngine.loadTrack(MusicEngine.queue[${i}]);MusicEngine.play();renderPlaylistTracks();"
         style="display:flex;align-items:center;padding:8px;border-radius:8px;cursor:pointer;${i === MusicEngine.queueIndex ? 'background:var(--gold-primary);color:#000;' : ''}">
      <span style="margin-right:12px;">${i === MusicEngine.queueIndex ? '▶️' : '🎵'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(track.track_name)}</div>
        <div style="font-size:12px;color:${i === MusicEngine.queueIndex ? '#000' : 'var(--gray-muted)'};">${escapeHtml(track.artist || 'Unknown')}</div>
      </div>
      <button class="btn btn-sm" onclick="event.stopPropagation();MusicEngine.queue.splice(${i},1);if(${i}<=MusicEngine.queueIndex)MusicEngine.queueIndex--;MusicEngine.saveState();renderPlaylistTracks();showToast('Lagu dihapus.');" style="font-size:12px;">❌</button>
    </div>
  `).join('');
}

function showNotifications() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  
  NotificationSystem.load().then(() => {
    const modal = document.createElement('div');
    modal.className = 'chat-modal';
    modal.id = 'notification-modal';
    modal.onclick = function(e) { if (e.target === this) this.remove(); };
    
    modal.innerHTML = `
      <div class="chat-modal-card" style="max-width: 450px;">
        <div class="chat-modal-header">
          <h3>🔔 Notifikasi</h3>
          <button type="button" class="chat-modal-close" onclick="this.closest('.chat-modal').remove(); return false;">×</button>
        </div>
        <div style="padding: 16px; max-height: 400px; overflow-y: auto;">
          ${NotificationSystem.notifications.length === 0 
            ? '<p style="color:var(--gray-muted);text-align:center;padding:20px;">Belum ada notifikasi.</p>'
            : NotificationSystem.notifications.map(n => `
              <div class="notification-item ${n.is_read ? '' : 'unread'}" 
                   onclick="NotificationSystem.markRead('${n.id}');this.classList.remove('unread');"
                   style="padding:12px;border-radius:8px;margin-bottom:8px;${n.is_read ? 'opacity:0.6;' : 'background:rgba(212,175,55,0.1);border-left:3px solid var(--gold-primary);'}">
                <div style="font-weight:600;">${escapeHtml(n.title)}</div>
                <div style="font-size:13px;color:var(--gray-muted);">${escapeHtml(n.content || '')}</div>
                <div style="font-size:11px;color:var(--gray-muted);margin-top:4px;">${formatChatTime(n.created_at)}</div>
              </div>
            `).join('')
          }
        </div>
        ${NotificationSystem.notifications.length > 0 ? '<button class="btn btn-secondary" style="width:100%;border-radius:0 0 12px 12px;" onclick="NotificationSystem.markAllRead();document.querySelectorAll(\'.notification-item\').forEach(e=>e.classList.remove(\'unread\'));showToast(\'Semua notifikasi ditandai sudah dibaca.\');">Tandai Sudah Dibaca</button>' : ''}
      </div>
    `;
    
    document.body.appendChild(modal);
  });
}

function showFriends() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  
  FriendSystem.load().then(() => {
    const modal = document.createElement('div');
    modal.className = 'chat-modal';
    modal.id = 'friends-modal';
    modal.onclick = function(e) { if (e.target === this) this.remove(); };
    
    modal.innerHTML = `
      <div class="chat-modal-card" style="max-width: 450px;">
        <div class="chat-modal-header">
          <h3>👥 Teman</h3>
          <button type="button" class="chat-modal-close" onclick="this.closest('.chat-modal').remove(); return false;">×</button>
        </div>
        <div style="padding: 16px;">
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            <input type="text" id="friend-search-input" placeholder="Cari atau tambah teman (email)..." style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);">
            <button class="btn btn-primary" onclick="addFriendFromSearch()">Tambah</button>
          </div>
          <div id="friend-list" style="max-height: 350px; overflow-y: auto;"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    FriendSystem.renderFriendList();
    
    document.getElementById('friend-search-input')?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addFriendFromSearch();
    });
  });
}

function addFriendFromSearch() {
  const input = document.getElementById('friend-search-input');
  const email = input?.value.trim();
  if (!email) { showToast('Masukkan email teman.'); return; }
  
  FriendSystem.sendRequest(email);
  input.value = '';
}

function showBookmarks() {
  showToast('Fitur bookmark akan segera hadir!');
}

// ============================================================
// 7. MUSIC ROOM FUNCTIONS
// ============================================================
function joinMusicRoom() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  
  document.getElementById('music-player')?.classList.remove('hidden');
  document.querySelector('.discord-messages')?.classList.add('hidden');
  document.querySelector('.discord-chat-input')?.classList.add('hidden');
  
  showMusicPlaylist();
}

function showMusicRoomSettings() {
  showToast('Pengaturan Music Room akan segera hadir!');
}

function musicShuffle() { MusicEngine.toggleShuffle(); }
function musicPrevious() { MusicEngine.previous(); }
function musicPlayPause() { MusicEngine.togglePlay(); }
function musicNext() { MusicEngine.next(); }
function musicRepeat() { MusicEngine.toggleRepeat(); }
function setVolume(val) { MusicEngine.setVolume(val); }

// ============================================================
// 8. CHAT FUNCTIONS (Override untuk komunitas.html)
// ============================================================
function sendCommunityMessage(event) {
  event.preventDefault();
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  
  const input = document.getElementById('discord-message-input');
  const text = input?.value.trim();
  if (!text) return;
  
  const channelName = document.getElementById('discord-chat-name')?.textContent || 'chat-umum';
  const chatId = channelName; // Use channel name as chat_id for simplicity
  
  // Send to backend
  if (hasApiBridge()) {
    apiRequest('/api/community/messages', {
      method: 'POST',
      body: JSON.stringify({
        email: actor.email,
        chat_id: chatId,
        sender_name: getCommunityDisplayName(actor),
        text
      })
    }).then(data => {
      if (data?.message) communityMessages.push(data.message);
      input.value = '';
      loadChannelMessages(channelName);
    }).catch(e => showToast(e.message));
  } else {
    // Local fallback
    const message = {
      id: 'msg_' + Date.now(),
      chat_id: chatId,
      sender_email: actor.email.toLowerCase(),
      sender_name: getCommunityDisplayName(actor),
      text: text.slice(0, 2000),
      created_at: new Date().toISOString()
    };
    communityMessages.push(message);
    input.value = '';
    loadChannelMessages(channelName);
    
    // Save locally
    try {
      const state = loadLocalCommunityState();
      state.messages.push(message);
      saveLocalCommunityState(state);
    } catch (e) {}
  }
}

// ============================================================
// 9. PROFILE FUNCTIONS
// ============================================================
function viewProfile(email) {
  if (!email) {
    const actor = getCommunityActor();
    if (!actor) { showCommunityLoginOverlay(); return; }
    email = actor.email;
  }
  
  const user = registeredUsers.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user) {
    showToast('Profil tidak ditemukan.');
    return;
  }
  
  const profile = getCommunityProfile(user.email);
  const isOnline = isUserOnline(user.email);
  
  // Update profile modal in komunitas.html
  document.getElementById('profile-avatar').textContent = user.role === 'admin' ? '⭐' : '👤';
  document.getElementById('profile-name').textContent = getCommunityDisplayName(user);
  document.getElementById('profile-username').textContent = '@' + (user.name || user.email.split('@')[0]);
  document.getElementById('profile-role').textContent = user.role === 'admin' ? 'Admin' : 'Member';
  document.getElementById('profile-bio').textContent = profile.bio || 'Tentang saya...';
  
  // Stats
  document.getElementById('stat-join-date').textContent = formatDate(user.joined_at);
  document.getElementById('stat-messages').textContent = communityMessages.filter(m => m.sender_email === user.email.toLowerCase()).length;
  document.getElementById('stat-friends').textContent = FriendSystem.friends.filter(f => f.friend_id === user.id).length;
  
  // Details
  const details = document.getElementById('profile-details');
  if (details) {
    details.innerHTML = `
      <div class="profile-detail-row"><span>Email</span><span>${escapeHtml(user.email)}</span></div>
      <div class="profile-detail-row"><span>Status</span><span>${isOnline ? 'Online 🟢' : 'Offline ⚫'}</span></div>
      <div class="profile-detail-row"><span>Minecraft</span><span>${escapeHtml(user.minecraft_name || '-')}</span></div>
      <div class="profile-detail-row"><span>XUID</span><span>${escapeHtml(user.xuid || '-')}</span></div>
    `;
  }
  
  // Chat button
  const chatBtn = document.getElementById('profile-chat-btn');
  if (chatBtn) {
    const isSelf = getCommunityActor()?.email.toLowerCase() === user.email.toLowerCase();
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
}

function profileStartChat() {
  const name = document.getElementById('profile-name')?.textContent;
  const actor = getCommunityActor();
  if (!actor || !name) return;
  
  // Find user by display name
  const user = registeredUsers.find(u => getCommunityDisplayName(u) === name);
  if (user) {
    hideProfileModal();
    startDirectChat(user.email, user.name);
  }
}

function switchProfileTab(tab) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.profile-tab-pane').forEach(p => p.classList.remove('active'));
  
  document.querySelector(`.profile-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById('tab-' + tab)?.classList.add('active');
}

// ============================================================
// 10. SETTINGS FUNCTIONS
// ============================================================
function showSettingsModal() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  
  document.getElementById('settings-modal')?.classList.remove('hidden');
  loadSettingsState();
}

function hideSettingsModal() {
  document.getElementById('settings-modal')?.classList.add('hidden');
}

function switchSettingsCategory(category) {
  document.querySelectorAll('.settings-category').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
  
  document.querySelector(`.settings-category[data-category="${category}"]`)?.classList.add('active');
  document.getElementById('settings-' + category)?.classList.add('active');
}

function loadSettingsState() {
  const settings = JSON.parse(localStorage.getItem('servermc_settings') || '{}');
  
  // Theme
  const themeSelect = document.querySelector('#settings-personalization select:first-of-type');
  if (themeSelect) themeSelect.value = settings.theme || 'dark';
  
  // Accent color
  const accentSelect = document.querySelectorAll('#settings-personalization select')[1];
  if (accentSelect) accentSelect.value = settings.accent || 'gold';
  
  // Language
  const langSelect = document.querySelectorAll('#settings-personalization select')[2];
  if (langSelect) langSelect.value = settings.language || 'id';
  
  // Enable event listeners for settings
  document.querySelectorAll('#settings-personalization select').forEach(sel => {
    sel.onchange = function() { saveSettingsState(); };
  });
  
  // Notifications
  const notifCheckboxes = document.querySelectorAll('#settings-community input[type="checkbox"]');
  if (notifCheckboxes[0]) notifCheckboxes[0].checked = settings.notif_message !== false;
  if (notifCheckboxes[1]) notifCheckboxes[1].checked = settings.notif_mention !== false;
  if (notifCheckboxes[2]) notifCheckboxes[2].checked = settings.profile_public !== false;
  if (notifCheckboxes[3]) notifCheckboxes[3].checked = settings.show_online !== false;
  
  notifCheckboxes.forEach(cb => {
    cb.onchange = function() { saveSettingsState(); };
  });
  
  // Font size
  const fontSelect = document.querySelector('#settings-accessibility select:first-of-type');
  if (fontSelect) fontSelect.value = settings.font_size || 'medium';
  fontSelect?.addEventListener('change', function() {
    applyFontSize(this.value);
    saveSettingsState();
  });
  
  applySettings(settings);
}

function saveSettingsState() {
  const settings = {};
  
  const themeSelect = document.querySelector('#settings-personalization select:first-of-type');
  if (themeSelect) settings.theme = themeSelect.value;
  
  const accentSelect = document.querySelectorAll('#settings-personalization select')[1];
  if (accentSelect) settings.accent = accentSelect.value;
  
  const langSelect = document.querySelectorAll('#settings-personalization select')[2];
  if (langSelect) settings.language = langSelect.value;
  
  const notifCheckboxes = document.querySelectorAll('#settings-community input[type="checkbox"]');
  if (notifCheckboxes[0]) settings.notif_message = notifCheckboxes[0].checked;
  if (notifCheckboxes[1]) settings.notif_mention = notifCheckboxes[1].checked;
  if (notifCheckboxes[2]) settings.profile_public = notifCheckboxes[2].checked;
  if (notifCheckboxes[3]) settings.show_online = notifCheckboxes[3].checked;
  
  const fontSelect = document.querySelector('#settings-accessibility select:first-of-type');
  if (fontSelect) settings.font_size = fontSelect.value;
  
  localStorage.setItem('servermc_settings', JSON.stringify(settings));
  applySettings(settings);
  showToast('Pengaturan disimpan.');
}

function applySettings(settings) {
  // Theme
  if (settings.theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  
  // Accent color
  if (settings.accent) {
    const accentColors = {
      gold: '#d4af37',
      blue: '#3498db',
      purple: '#9b59b6'
    };
    document.documentElement.style.setProperty('--gold-primary', accentColors[settings.accent] || '#d4af37');
  }
  
  // Font size
  applyFontSize(settings.font_size || 'medium');
}

function applyFontSize(size) {
  const sizes = {
    small: '14px',
    medium: '16px',
    large: '18px'
  };
  document.documentElement.style.setProperty('--font-size-body', sizes[size] || '16px');
}

// Profile edit functions
function editProfile() {
  const actor = getCommunityActor();
  if (!actor) return;
  
  const bio = prompt('Edit Bio:', getCommunityProfile(actor.email).bio || '');
  if (bio === null) return;
  
  const profiles = loadCommunityProfiles();
  profiles[actor.email.toLowerCase()] = {
    ...profiles[actor.email.toLowerCase()],
    bio: bio.trim().slice(0, 160)
  };
  saveCommunityProfiles(profiles);
  showToast('Bio diperbarui.');
  
  // Sync to backend
  if (hasApiBridge()) {
    apiRequest('/api/community/auth', {
      method: 'POST',
      body: JSON.stringify({ bio: bio.trim().slice(0, 160) })
    }).catch(() => {});
  }
}

function changeAvatar() {
  showToast('Fitur ganti avatar akan segera hadir!');
}

function changeBanner() {
  showToast('Fitur ganti banner akan segera hadir!');
}

function changeUsername() {
  showToast('Fitur ganti username akan segera hadir!');
}

function changePassword() {
  showToast('Fitur ganti password akan segera hadir!');
}

function changeEmail() {
  showToast('Fitur ganti email akan segera hadir!');
}

function toggleMute() {
  const btn = event?.target || document.querySelector('.music-volume-btn');
  if (MusicEngine.audio) {
    MusicEngine.audio.muted = !MusicEngine.audio.muted;
    btn.textContent = MusicEngine.audio.muted ? '🔇' : '🔊';
  }
}

function toggleDeafen() {
  if (MusicEngine.audio) {
    MusicEngine.audio.muted = !MusicEngine.audio.muted;
    showToast(MusicEngine.audio.muted ? 'Deafened' : 'Undeafened');
  }
}

function togglePin() {
  showToast('Fitur pin channel akan segera hadir!');
}

function openChatSettings() {
  showToast('Info grup akan segera hadir!');
}

function inviteMember() {
  const actor = getCommunityActor();
  if (!actor) { showCommunityLoginOverlay(); return; }
  showFriends();
}

function toggleMemberList() {
  const sidebar = document.querySelector('.discord-member-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('hidden');
  }
}

// ============================================================
// 11. INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  // Initialize music engine
  MusicEngine.init();
  
  // Initialize notification system
  NotificationSystem.load();
  
  // Initialize friend system
  FriendSystem.load();
  
  // Render member list
  renderMemberList();
  
  // Setup progress bar click for seeking
  const progressBar = document.querySelector('.music-progress-bar');
  if (progressBar) {
    progressBar.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      MusicEngine.seek(pct);
    });
  }
  
  // Setup keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        MusicEngine.togglePlay();
        break;
      case 'ArrowRight':
        MusicEngine.next();
        break;
      case 'ArrowLeft':
        MusicEngine.previous();
        break;
      case 'KeyM':
        toggleMute();
        break;
    }
  });
  
  // Refresh member list periodically
  setInterval(renderMemberList, 10000);
  
  // Watch for community user changes
  const observer = new MutationObserver(() => {
    const userDisplay = document.getElementById('discord-user-name');
    const actor = getCommunityActor();
    if (userDisplay && actor) {
      userDisplay.textContent = actor.name;
      document.getElementById('discord-user-name-panel').textContent = actor.name;
      document.getElementById('discord-user-status').textContent = isUserOnline(actor.email) ? '🟢' : '⚫';
    }
  });
  
  const targetNode = document.getElementById('discord-user-avatar');
  if (targetNode) {
    observer.observe(targetNode.parentNode, { childList: true, subtree: true, characterData: true });
  }
  
  // Set initial user info
  const actor = getCommunityActor();
  if (actor) {
    document.getElementById('discord-user-name').textContent = actor.name;
    document.getElementById('discord-user-name-panel').textContent = actor.name;
    document.getElementById('discord-user-id').textContent = '#' + (actor.id || '0000');
  }
  
  // Connect chat message input to send handler
  const messageForm = document.querySelector('.discord-input-form');
  if (messageForm) {
    messageForm.addEventListener('submit', sendCommunityMessage);
  }
  
  // Load settings
  loadSettingsState();
  
  // Initial channel selection
  selectChannel('chat-umum');
});