// Community Chat Functionality

let communityChats = [];
let communityMessages = {};
let activeChatId = null;
let activeChatType = null; // 'group' or 'dm'

// Initialize community page
document.addEventListener('DOMContentLoaded', () => {
  // Sync with main website user if not logged in to community
  if (!communityUser && currentUser) {
    communityUser = currentUser;
    localStorage.setItem('servermc_community_user', JSON.stringify(currentUser));
    localStorage.setItem('servermc_community_token', 'synced_from_main');
  }
  
  checkCommunityAuth();
  loadCommunityData();
  updateCommunityUI();
  
  // Check if user is logged in to community
  if (!communityUser) {
    showCommunityLoginOverlay();
  } else {
    loadCommunityChat();
  }
});

// Load community data from localStorage
function loadCommunityData() {
  try {
    communityChats = JSON.parse(localStorage.getItem('servermc_community_chats') || '[]');
    communityMessages = JSON.parse(localStorage.getItem('servermc_community_messages') || '{}');
  } catch (e) {
    communityChats = [];
    communityMessages = {};
  }
  
  // Initialize default chats if none exist
  if (communityChats.length === 0) {
    initializeDefaultChats();
  }
  
  // Ensure all chats have message arrays
  communityChats.forEach(chat => {
    if (!communityMessages[chat.id]) {
      communityMessages[chat.id] = [];
    }
  });
  saveCommunityMessages();
}

// Initialize default chats
function initializeDefaultChats() {
  const defaultChats = [
    {
      id: 'group_admin',
      type: 'group',
      name: 'Admin',
      avatar: '👑',
      members: ['scarlettruiss@gmail.com'],
      createdAt: new Date().toISOString(),
      unread: 0
    },
    {
      id: 'group_general',
      type: 'group',
      name: 'Grup Umum',
      avatar: '🏢',
      members: [],
      createdAt: new Date().toISOString(),
      unread: 0
    }
  ];
  
  communityChats = defaultChats;
  saveCommunityChats();
  
  // Initialize empty messages for default chats
  defaultChats.forEach(chat => {
    communityMessages[chat.id] = [];
  });
  saveCommunityMessages();
}

// Save community data
function saveCommunityChats() {
  localStorage.setItem('servermc_community_chats', JSON.stringify(communityChats));
}

function saveCommunityMessages() {
  localStorage.setItem('servermc_community_messages', JSON.stringify(communityMessages));
}

// Update community UI
function updateCommunityUI() {
  // Update user info in Discord-style sidebar
  const discordUserAvatar = document.getElementById('discord-user-avatar');
  const discordUserName = document.getElementById('discord-user-name');
  const discordUserStatus = document.getElementById('discord-user-status');
  const discordUserAvatarLarge = document.getElementById('discord-user-avatar-large');
  const discordUserNamePanel = document.getElementById('discord-user-name-panel');
  const discordUserId = document.getElementById('discord-user-id');
  
  if (communityUser) {
    if (discordUserAvatar) discordUserAvatar.textContent = '👤';
    if (discordUserName) discordUserName.textContent = communityUser.name;
    if (discordUserStatus) {
      const isOnline = isUserOnline(communityUser.email);
      discordUserStatus.textContent = isOnline ? '🟢' : '⚫';
    }
    if (discordUserAvatarLarge) discordUserAvatarLarge.textContent = '👤';
    if (discordUserNamePanel) discordUserNamePanel.textContent = communityUser.name;
    if (discordUserId) discordUserId.textContent = '#' + communityUser.email.substring(0, 4);
  } else {
    if (discordUserName) discordUserName.textContent = 'Guest';
    if (discordUserStatus) discordUserStatus.textContent = '⚫';
    if (discordUserNamePanel) discordUserNamePanel.textContent = 'Guest';
    if (discordUserId) discordUserId.textContent = '#0000';
  }
  
  // Update member list
  loadDiscordMemberList();
}

// Update community statistics
function updateCommunityStats() {
  const totalMembers = document.getElementById('total-members');
  const totalActive = document.getElementById('total-active-members');
  const totalChats = document.getElementById('total-chats');
  
  if (totalMembers) totalMembers.textContent = registeredUsers.length;
  if (totalActive) totalActive.textContent = onlinePlayers.length;
  if (totalChats) totalChats.textContent = communityChats.length;
}

// Load Discord member list
function loadDiscordMemberList() {
  const memberList = document.getElementById('discord-member-list');
  const memberCount = document.getElementById('discord-member-count');
  
  if (!memberList) return;
  
  memberList.innerHTML = '';
  
  if (memberCount) {
    memberCount.textContent = `Member — ${registeredUsers.length}`;
  }
  
  registeredUsers.forEach(user => {
    const isOnline = isUserOnline(user.email);
    
    const item = document.createElement('div');
    item.className = 'discord-member-item';
    item.innerHTML = `
      <div class="discord-member-avatar ${isOnline ? 'online' : ''}">👤</div>
      <span class="discord-member-name">${user.name}</span>
      <span class="discord-member-status">${isOnline ? '🟢' : '⚫'}</span>
    `;
    item.onclick = () => startDmChat(user);
    memberList.appendChild(item);
  });
}

// Load Discord text channels
function loadDiscordTextChannels() {
  const textChannels = document.getElementById('discord-text-channels');
  
  if (!textChannels) return;
  
  textChannels.innerHTML = '';
  
  communityChats.forEach(chat => {
    const channel = document.createElement('div');
    channel.className = 'discord-text-channel';
    channel.innerHTML = `
      <span>#</span>
      <span>${chat.name}</span>
    `;
    channel.onclick = () => selectDiscordChannel(chat.id, chat.type);
    textChannels.appendChild(channel);
  });
}

// Select Discord channel
function selectDiscordChannel(chatId, chatType) {
  activeChatId = chatId;
  activeChatType = chatType;
  
  // Update active state
  document.querySelectorAll('.discord-text-channel').forEach(item => {
    item.classList.remove('active');
  });
  
  // Update chat name
  const chatName = document.getElementById('discord-chat-name');
  const chat = communityChats.find(c => c.id === chatId);
  if (chat && chatName) {
    chatName.textContent = chat.name;
  }
  
  // Load messages
  loadDiscordMessages(chatId);
}

// Load community chat list
function loadCommunityChat() {
  const chatList = document.getElementById('chat-list');
  if (!chatList) return;
  
  chatList.innerHTML = '';
  
  if (communityChats.length === 0) {
    chatList.innerHTML = `
      <div class="chat-empty" style="padding: 40px 20px;">
        <p style="color: var(--gray-muted);">Belum ada chat. Buat grup atau mulai chat baru!</p>
      </div>
    `;
    return;
  }
  
  // Sort chats by last message time
  const sortedChats = [...communityChats].sort((a, b) => {
    const aMessages = communityMessages[a.id] || [];
    const bMessages = communityMessages[b.id] || [];
    const aLastMsg = aMessages[aMessages.length - 1];
    const bLastMsg = bMessages[bMessages.length - 1];
    
    if (!aLastMsg && !bLastMsg) return 0;
    if (!aLastMsg) return 1;
    if (!bLastMsg) return -1;
    
    return new Date(bLastMsg.timestamp) - new Date(aLastMsg.timestamp);
  });
  
  sortedChats.forEach(chat => {
    const chatItem = createChatListItem(chat);
    chatList.appendChild(chatItem);
  });
}

// Create chat list item
function createChatListItem(chat) {
  const messages = communityMessages[chat.id] || [];
  const lastMessage = messages[messages.length - 1];
  const isActive = activeChatId === chat.id;
  
  const div = document.createElement('div');
  div.className = `chat-list-item ${isActive ? 'active' : ''} ${chat.unread > 0 ? 'unread' : ''}`;
  div.onclick = () => selectChat(chat.id, chat.type);
  
  let previewText = 'Belum ada pesan';
  let previewSender = '';
  let timeText = formatChatTime(chat.createdAt);
  
  if (lastMessage) {
    previewText = lastMessage.content;
    timeText = formatChatTime(lastMessage.timestamp);
    if (chat.type === 'group' && lastMessage.senderEmail !== communityUser?.email) {
      const sender = registeredUsers.find(u => u.email === lastMessage.senderEmail);
      previewSender = sender ? sender.name + ': ' : 'Member: ';
    } else if (chat.type === 'group') {
      previewSender = 'Anda: ';
    }
  }
  
  const isOnline = chat.type === 'dm' ? isUserOnline(chat.name) : false;
  
  div.innerHTML = `
    <div class="chat-avatar ${isOnline ? 'online' : ''}">${chat.avatar}</div>
    <div class="chat-list-body">
      <div class="chat-list-header">
        <span class="chat-list-name">${chat.name}</span>
        <span class="chat-list-time">${timeText}</span>
      </div>
      <div class="chat-list-preview">
        ${previewSender ? `<span class="sender">${previewSender}</span>` : ''}
        <span class="message">${previewText}</span>
        ${chat.unread > 0 ? `<span class="unread-count">${chat.unread}</span>` : ''}
      </div>
    </div>
  `;
  
  return div;
}

// Select a chat
function selectChat(chatId, chatType) {
  activeChatId = chatId;
  activeChatType = chatType;
  
  // Update active state in list
  document.querySelectorAll('.chat-list-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Find and activate the selected item
  const chatItems = document.querySelectorAll('.chat-list-item');
  const chatIndex = communityChats.findIndex(c => c.id === chatId);
  if (chatIndex >= 0 && chatItems[chatIndex]) {
    chatItems[chatIndex].classList.add('active');
  }
  
  // Clear unread count
  const chat = communityChats.find(c => c.id === chatId);
  if (chat) {
    chat.unread = 0;
    saveCommunityChats();
  }
  
  // Show chat panel
  showChatPanel(chatId, chatType);
  
  // Mobile: hide sidebar, show main
  if (window.innerWidth <= 900) {
    document.getElementById('chat-sidebar').classList.add('mobile-hidden');
    document.getElementById('chat-main').classList.remove('mobile-hidden');
  }
}

// Show chat panel
function showChatPanel(chatId, chatType) {
  const emptyState = document.getElementById('chat-empty-state');
  const activePanel = document.getElementById('chat-active-panel');
  
  if (!emptyState || !activePanel) return;
  
  emptyState.classList.add('hidden');
  activePanel.classList.remove('hidden');
  
  const chat = communityChats.find(c => c.id === chatId);
  if (!chat) return;
  
  // Update header
  const avatar = document.getElementById('chat-active-avatar');
  const name = document.getElementById('chat-active-name');
  const meta = document.getElementById('chat-active-meta');
  
  if (avatar) avatar.textContent = chat.avatar;
  if (name) name.textContent = chat.name;
  
  if (chatType === 'group') {
    const memberCount = chat.members.length;
    if (meta) meta.textContent = memberCount > 0 ? `${memberCount} anggota` : 'Grup';
  } else {
    const isOnline = isUserOnline(chat.name);
    if (meta) {
      meta.textContent = isOnline ? 'Online' : 'Offline';
      meta.style.color = isOnline ? '#22c55e' : 'var(--gray-muted)';
    }
  }
  
  // Load messages
  loadChatMessages(chatId);
}

// Load chat messages
function loadChatMessages(chatId) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  
  const messages = communityMessages[chatId] || [];
  messagesContainer.innerHTML = '';
  
  if (messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="chat-empty" style="padding: 40px 20px;">
        <p style="color: var(--gray-muted); font-size: 14px;">Mulai percakapan dengan mengirim pesan!</p>
      </div>
    `;
    return;
  }
  
  // Group messages by date
  let lastDate = null;
  messages.forEach(msg => {
    const msgDate = new Date(msg.timestamp).toDateString();
    if (msgDate !== lastDate) {
      const dateDivider = document.createElement('div');
      dateDivider.className = 'chat-date-divider';
      dateDivider.textContent = formatDate(msg.timestamp);
      messagesContainer.appendChild(dateDivider);
      lastDate = msgDate;
    }
    
    const messageBubble = createMessageBubble(msg);
    messagesContainer.appendChild(messageBubble);
  });
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Create message bubble
function createMessageBubble(message) {
  const isOwn = message.senderEmail === communityUser?.email;
  const sender = registeredUsers.find(u => u.email === message.senderEmail);
  const senderName = sender ? sender.name : 'Member';
  
  const div = document.createElement('div');
  div.className = `chat-bubble-row ${isOwn ? 'own' : 'other'}`;
  
  div.innerHTML = `
    <div class="chat-bubble">
      ${!isOwn && activeChatType === 'group' ? `<button class="chat-bubble-sender" onclick="viewProfile('${message.senderEmail}')">${senderName}</button>` : ''}
      <div class="chat-bubble-content">${escapeHtml(message.content)}</div>
      <div class="chat-bubble-time">
        ${formatMessageTime(message.timestamp)}
        ${isOwn ? `<span class="read-receipt ${message.read ? 'read' : 'delivered'}">${message.read ? '✓✓' : '✓'}</span>` : ''}
      </div>
    </div>
  `;
  
  return div;
}

// Send community message
function sendCommunityMessage(event) {
  event.preventDefault();
  
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  
  if (!activeChatId) {
    showToast('Pilih chat terlebih dahulu');
    return;
  }
  
  const input = document.getElementById('chat-message-input');
  const content = input.value.trim();
  
  if (!content) return;
  
  const message = {
    id: Date.now().toString(),
    senderEmail: communityUser.email,
    content: content,
    timestamp: new Date().toISOString(),
    read: false
  };
  
  // Add to messages
  if (!communityMessages[activeChatId]) {
    communityMessages[activeChatId] = [];
  }
  communityMessages[activeChatId].push(message);
  saveCommunityMessages();
  
  // Clear input
  input.value = '';
  
  // Reload messages immediately
  loadChatMessages(activeChatId);
  
  // Update chat list preview with a small delay to ensure data is saved
  setTimeout(() => {
    loadCommunityChat();
  }, 100);
  
  showToast('Pesan terkirim');
}

// Filter chat list
function filterChatList() {
  const query = document.getElementById('chat-search').value.toLowerCase();
  const chatItems = document.querySelectorAll('.chat-list-item');
  
  chatItems.forEach((item, index) => {
    const chat = communityChats[index];
    if (!chat) return;
    
    const matchesName = chat.name.toLowerCase().includes(query);
    const matchesMembers = chat.members.some(email => {
      const user = registeredUsers.find(u => u.email === email);
      return user && user.name.toLowerCase().includes(query);
    });
    
    item.style.display = (matchesName || matchesMembers) ? 'grid' : 'none';
  });
}

// Show new group modal
function showNewGroupModal() {
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  
  const modal = document.getElementById('new-group-modal');
  const picker = document.getElementById('group-member-picker');
  
  if (modal) modal.classList.remove('hidden');
  
  // Load member picker
  if (picker) {
    picker.innerHTML = '';
    registeredUsers.forEach(user => {
      if (user.email === communityUser.email) return;
      
      const item = document.createElement('label');
      item.className = 'member-picker-item';
      item.innerHTML = `
        <input type="checkbox" value="${user.email}">
        <span style="font-size: 24px;">👤</span>
        <div>
          <div style="font-weight: 600; color: var(--white-primary);">${user.name}</div>
          <div style="font-size: 12px; color: var(--gray-muted);">${user.email}</div>
        </div>
      `;
      picker.appendChild(item);
    });
  }
}

// Hide new group modal
function hideNewGroupModal() {
  document.getElementById('new-group-modal')?.classList.add('hidden');
  document.getElementById('group-name').value = '';
}

// Handle create group
function handleCreateGroup(event) {
  event.preventDefault();
  
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  
  const name = document.getElementById('group-name').value.trim();
  const checkboxes = document.querySelectorAll('#group-member-picker input[type="checkbox"]:checked');
  const members = Array.from(checkboxes).map(cb => cb.value);
  
  if (!name) {
    showToast('Nama grup harus diisi');
    return;
  }
  
  // Add current user to members
  members.push(communityUser.email);
  
  const newGroup = {
    id: 'group_' + Date.now(),
    type: 'group',
    name: name,
    avatar: '👥',
    members: members,
    createdAt: new Date().toISOString(),
    unread: 0
  };
  
  communityChats.push(newGroup);
  communityMessages[newGroup.id] = [];
  
  saveCommunityChats();
  saveCommunityMessages();
  
  hideNewGroupModal();
  loadCommunityChat();
  updateCommunityStats();
  
  showToast('Grup berhasil dibuat');
  
  // Select the new group
  selectChat(newGroup.id, 'group');
}

// Show new DM modal
function showNewDmModal() {
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  
  const modal = document.getElementById('new-dm-modal');
  const list = document.getElementById('dm-member-list');
  
  if (modal) modal.classList.remove('hidden');
  
  // Load member list
  loadDmMemberList();
}

// Hide new DM modal
function hideNewDmModal() {
  document.getElementById('new-dm-modal')?.classList.add('hidden');
  document.getElementById('dm-member-search').value = '';
}

// Load DM member list
function loadDmMemberList() {
  const list = document.getElementById('dm-member-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (!registeredUsers || registeredUsers.length === 0) {
    list.innerHTML = '<p style="color: var(--gray-muted); text-align: center; padding: 20px;">Belum ada member terdaftar.</p>';
    return;
  }
  
  registeredUsers.forEach(user => {
    if (user.email === communityUser?.email) return;
    
    const item = document.createElement('button');
    item.className = 'member-picker-item clickable-dm';
    item.innerHTML = `
      <span style="font-size: 24px;">👤</span>
      <div>
        <div style="font-weight: 600; color: var(--white-primary);">${user.name}</div>
        <div style="font-size: 12px; color: var(--gray-muted);">${user.email}</div>
      </div>
    `;
    item.onclick = () => startDmChat(user);
    list.appendChild(item);
  });
}

// Filter DM member list
function filterDmMemberList() {
  const query = document.getElementById('dm-member-search').value.toLowerCase();
  const items = document.querySelectorAll('#dm-member-list .member-picker-item');
  
  items.forEach(item => {
    const name = item.querySelector('div > div:first-child')?.textContent.toLowerCase() || '';
    const email = item.querySelector('div > div:last-child')?.textContent.toLowerCase() || '';
    
    item.style.display = (name.includes(query) || email.includes(query)) ? 'flex' : 'none';
  });
}

// Start DM chat
function startDmChat(user) {
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  
  if (!user || !user.email) {
    showToast('User tidak valid');
    return;
  }
  
  // Check if DM already exists
  const existingDm = communityChats.find(c => 
    c.type === 'dm' && 
    c.name === user.email
  );
  
  if (existingDm) {
    hideNewDmModal();
    selectChat(existingDm.id, 'dm');
    return;
  }
  
  // Create new DM
  const newDm = {
    id: 'dm_' + Date.now(),
    type: 'dm',
    name: user.email,
    avatar: '👤',
    members: [communityUser.email, user.email],
    createdAt: new Date().toISOString(),
    unread: 0
  };
  
  communityChats.push(newDm);
  communityMessages[newDm.id] = [];
  
  saveCommunityChats();
  saveCommunityMessages();
  
  hideNewDmModal();
  loadCommunityChat();
  updateCommunityStats();
  
  showToast('Chat dimulai');
  
  // Select the new DM
  selectChat(newDm.id, 'dm');
}

// Close active chat
function closeActiveChat() {
  activeChatId = null;
  activeChatType = null;
  
  const emptyState = document.getElementById('chat-empty-state');
  const activePanel = document.getElementById('chat-active-panel');
  
  if (emptyState) emptyState.classList.remove('hidden');
  if (activePanel) activePanel.classList.add('hidden');
  
  // Remove active state from list
  document.querySelectorAll('.chat-list-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Mobile: show sidebar, hide main
  if (window.innerWidth <= 900) {
    document.getElementById('chat-sidebar').classList.remove('mobile-hidden');
    document.getElementById('chat-main').classList.add('mobile-hidden');
  }
}

// Open active chat profile
function openActiveChatProfile() {
  if (!activeChatId || activeChatType !== 'dm') return;
  
  const chat = communityChats.find(c => c.id === activeChatId);
  if (!chat) return;
  
  const user = registeredUsers.find(u => u.email === chat.name);
  if (!user) return;
  
  viewProfile(user.email);
}

// View profile
function viewProfile(email) {
  const user = registeredUsers.find(u => u.email === email);
  if (!user) return;
  
  const modal = document.getElementById('profile-modal');
  const avatar = document.getElementById('profile-avatar');
  const name = document.getElementById('profile-name');
  const role = document.getElementById('profile-role');
  const details = document.getElementById('profile-details');
  const chatBtn = document.getElementById('profile-chat-btn');
  
  if (modal) modal.classList.remove('hidden');
  
  if (avatar) avatar.textContent = '👤';
  if (name) name.textContent = user.name;
  if (role) {
    role.textContent = user.role === 'admin' ? 'Admin' : 'Member';
  }
  
  if (details) {
    const isOnline = isUserOnline(user.email);
    details.innerHTML = `
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Role:</strong> ${user.role === 'admin' ? 'Admin' : 'Member'}</p>
      <p><strong>Status:</strong> ${isOnline ? '🟢 Online' : '⚫ Offline'}</p>
      <p><strong>Bergabung:</strong> ${formatDate(user.joined_at)}</p>
    `;
  }
  
  if (chatBtn) {
    if (user.email === communityUser?.email) {
      chatBtn.style.display = 'none';
    } else {
      chatBtn.style.display = 'inline-block';
      chatBtn.onclick = () => {
        hideProfileModal();
        startDmChat(user);
      };
    }
  }
  
  profileViewEmail = email;
}

// Hide profile modal
function hideProfileModal() {
  document.getElementById('profile-modal')?.classList.add('hidden');
  profileViewEmail = null;
}

// Profile start chat
function profileStartChat() {
  if (!profileViewEmail) return;
  
  const user = registeredUsers.find(u => u.email === profileViewEmail);
  if (user) {
    hideProfileModal();
    startDmChat(user);
  }
}

// Open chat settings
function openChatSettings() {
  if (!activeChatId) return;
  
  const chat = communityChats.find(c => c.id === activeChatId);
  if (!chat) return;
  
  const modal = document.getElementById('chat-settings-modal');
  const content = document.getElementById('chat-settings-content');
  
  if (modal) modal.classList.remove('hidden');
  
  if (content) {
    let memberList = '';
    if (chat.type === 'group') {
      chat.members.forEach(email => {
        const user = registeredUsers.find(u => u.email === email);
        const userName = user ? user.name : email;
        memberList += `<div style="padding: 8px 0; border-bottom: 1px solid rgba(212, 175, 55, 0.1);">${userName}</div>`;
      });
    }
    
    content.innerHTML = `
      <div class="chat-info-item">
        <span class="chat-info-label">Nama</span>
        <span class="chat-info-value">${chat.name}</span>
      </div>
      <div class="chat-info-item">
        <span class="chat-info-label">Tipe</span>
        <span class="chat-info-value">${chat.type === 'group' ? 'Grup' : 'Chat Pribadi'}</span>
      </div>
      <div class="chat-info-item">
        <span class="chat-info-label">Dibuat</span>
        <span class="chat-info-value">${formatDate(chat.createdAt)}</span>
      </div>
      ${chat.type === 'group' ? `
        <div class="chat-info-item" style="flex-direction: column; align-items: flex-start;">
          <span class="chat-info-label" style="margin-bottom: 12px;">Anggota (${chat.members.length})</span>
          <div style="width: 100%;">${memberList}</div>
        </div>
      ` : ''}
      <div class="chat-info-actions">
        <button type="button" class="btn btn-secondary" onclick="hideChatSettingsModal()">Tutup</button>
        ${chat.type === 'group' && communityUser?.role === 'admin' ? `
          <button type="button" class="btn btn-danger" onclick="leaveChat()">Keluar Grup</button>
        ` : ''}
      </div>
    `;
  }
}

// Hide chat settings modal
function hideChatSettingsModal() {
  document.getElementById('chat-settings-modal')?.classList.add('hidden');
}

// Leave chat
function leaveChat() {
  if (!activeChatId) return;
  
  if (confirm('Apakah Anda yakin ingin keluar dari chat ini?')) {
    communityChats = communityChats.filter(c => c.id !== activeChatId);
    delete communityMessages[activeChatId];
    
    saveCommunityChats();
    saveCommunityMessages();
    
    hideChatSettingsModal();
    closeActiveChat();
    loadCommunityChat();
    updateCommunityStats();
    
    showToast('Berhasil keluar dari chat');
  }
}

// Open community settings
function openCommunitySettings() {
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  window.location.href = 'community-settings.html';
}

// Navigate to page
function navigateToPage(page) {
  window.location.href = 'index.html#' + page;
}

// Utility functions
function formatChatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 86400000) { // Less than 24 hours
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 604800000) { // Less than 7 days
    return date.toLocaleDateString('id-ID', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }
}

function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Hari ini';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Kemarin';
  } else {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show toast message
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

// Profile Tab Switching
function switchProfileTab(tabName) {
  // Remove active class from all tabs
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Hide all tab panes
  document.querySelectorAll('.profile-tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  
  // Activate selected tab and pane
  document.querySelector(`.profile-tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Settings Modal Functions
function showSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
}

function hideSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function switchSettingsCategory(category) {
  // Remove active class from all categories
  document.querySelectorAll('.settings-category').forEach(cat => {
    cat.classList.remove('active');
  });
  
  // Hide all settings panes
  document.querySelectorAll('.settings-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  
  // Activate selected category and pane
  document.querySelector(`.settings-category[data-category="${category}"]`).classList.add('active');
  document.getElementById(`settings-${category}`).classList.add('active');
}

// Channel Selection
function selectChannel(channelId) {
  // Update active state
  document.querySelectorAll('.discord-text-channel').forEach(item => {
    item.classList.remove('active');
  });
  
  // Find and activate the selected channel
  const channels = document.querySelectorAll('.discord-text-channel');
  channels.forEach(channel => {
    if (channel.textContent.includes(channelId)) {
      channel.classList.add('active');
    }
  });
  
  // Update chat name
  const chatName = document.getElementById('discord-chat-name');
  if (chatName) {
    chatName.textContent = channelId;
  }
  
  // Update placeholder
  const messageInput = document.getElementById('discord-message-input');
  if (messageInput) {
    messageInput.placeholder = `Kirim pesan ke #${channelId}`;
  }
  
  showToast(`Masuk ke #${channelId}`);
}

// Music Player Functions
let isPlaying = false;
let isMuted = false;
let currentVolume = 70;

function musicPlayPause() {
  isPlaying = !isPlaying;
  const btn = document.querySelector('.music-play-btn');
  if (btn) {
    btn.textContent = isPlaying ? '⏸️' : '▶️';
  }
  showToast(isPlaying ? 'Memutar musik' : 'Musik dijeda');
}

function musicNext() {
  showToast('Lagu berikutnya');
}

function musicPrevious() {
  showToast('Lagu sebelumnya');
}

function musicShuffle() {
  showToast('Shuffle diaktifkan');
}

function musicRepeat() {
  showToast('Repeat diaktifkan');
}

function toggleMute() {
  isMuted = !isMuted;
  const volumeBtn = document.querySelector('.music-volume-btn');
  if (volumeBtn) {
    volumeBtn.textContent = isMuted ? '🔇' : '🔊';
  }
  showToast(isMuted ? 'Volume dimatikan' : 'Volume diaktifkan');
}

function setVolume(value) {
  currentVolume = value;
  if (value == 0) {
    isMuted = true;
    document.querySelector('.music-volume-btn').textContent = '🔇';
  } else {
    isMuted = false;
    document.querySelector('.music-volume-btn').textContent = '🔊';
  }
}

// Navigation Functions
function showMessagesPanel() {
  showToast('Panel Pesan');
}

function showMusicPlaylist() {
  showToast('Playlist Musik');
}

function showNotifications() {
  showToast('Notifikasi');
}

function showFriends() {
  showToast('Daftar Teman');
}

function showBookmarks() {
  showToast('Bookmark');
}

function togglePin() {
  showToast('Channel dipin');
}

function inviteMember() {
  showNewDmModal();
}

function toggleMemberList() {
  const memberSidebar = document.querySelector('.discord-member-sidebar');
  if (memberSidebar) {
    memberSidebar.classList.toggle('hidden');
  }
}

function joinMusicRoom() {
  showToast('Bergabung ke Music Room');
}

function showMusicRoomSettings() {
  showToast('Pengaturan Music Room');
}

// Update Member List with Role Categories
function loadDiscordMemberList() {
  const memberOwner = document.getElementById('member-owner');
  const memberAdmin = document.getElementById('member-admin');
  const memberModerator = document.getElementById('member-moderator');
  const memberOnline = document.getElementById('member-online');
  const memberOffline = document.getElementById('member-offline');
  
  if (!memberOwner || !memberAdmin || !memberModerator || !memberOnline || !memberOffline) return;
  
  // Clear existing members
  memberOwner.innerHTML = '';
  memberAdmin.innerHTML = '';
  memberModerator.innerHTML = '';
  memberOnline.innerHTML = '';
  memberOffline.innerHTML = '';
  
  registeredUsers.forEach(user => {
    const isOnline = isUserOnline(user.email);
    const role = user.role || 'member';
    
    const item = document.createElement('div');
    item.className = 'discord-member-item';
    item.innerHTML = `
      <div class="discord-member-avatar ${isOnline ? 'online' : ''}">👤</div>
      <span class="discord-member-name">${user.name}</span>
      <span class="discord-member-status">${isOnline ? '🟢' : '⚫'}</span>
    `;
    item.onclick = () => startDmChat(user);
    
    // Categorize by role
    if (role === 'owner') {
      memberOwner.appendChild(item);
    } else if (role === 'admin') {
      memberAdmin.appendChild(item);
    } else if (role === 'moderator') {
      memberModerator.appendChild(item);
    } else if (isOnline) {
      memberOnline.appendChild(item);
    } else {
      memberOffline.appendChild(item);
    }
  });
  
  // Update member count
  const memberCount = document.getElementById('discord-member-count');
  if (memberCount) {
    memberCount.textContent = `Member — ${registeredUsers.length}`;
  }
  
  // Update chat header member count
  const chatMembers = document.getElementById('discord-chat-members');
  if (chatMembers) {
    const onlineCount = registeredUsers.filter(u => isUserOnline(u.email)).length;
    chatMembers.textContent = `${onlineCount}/${registeredUsers.length} Online`;
  }
}

// Override openCommunitySettings to use new settings modal
const originalOpenCommunitySettings = openCommunitySettings;
openCommunitySettings = function() {
  if (!communityUser) {
    showCommunityLoginOverlay();
    return;
  }
  showSettingsModal();
};

// ============================================
// NEW BACKEND API INTEGRATION
// ============================================

// API Configuration
const API_BASE_URL = '/api/community';
const WS_URL = '/api/community/websocket';

// WebSocket Connection
let ws = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000;

// Current user session
let currentUser = null;
let currentSession = null;

// Initialize WebSocket connection
function initWebSocket() {
  if (ws) {
    ws.close();
  }
  
  const userId = currentUser?.id;
  const sessionId = currentSession?.id;
  
  if (!userId || !sessionId) {
    console.log('Cannot connect to WebSocket: missing user or session');
    return;
  }
  
  try {
    ws = new WebSocket(`${WS_URL}?user_id=${userId}&session_id=${sessionId}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      wsReconnectAttempts = 0;
      
      // Send heartbeat every 30 seconds
      setInterval(sendHeartbeat, 30000);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        wsReconnectAttempts++;
        setTimeout(initWebSocket, RECONNECT_DELAY);
      }
    };
  } catch (error) {
    console.error('Failed to connect to WebSocket:', error);
  }
}

function sendHeartbeat() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'heartbeat' }));
  }
  
  // Also send heartbeat via API
  fetch(`${API_BASE_URL}/status`, {
    method: 'PUT',
    credentials: 'include'
  }).catch(console.error);
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'connected':
      console.log('WebSocket connection confirmed');
      break;
      
    case 'new_message':
      handleNewMessage(data.message);
      break;
      
    case 'typing':
      handleTypingIndicator(data.userId, data.channelId);
      break;
      
    case 'status_update':
      handleStatusUpdate(data);
      break;
      
    case 'user_joined':
      handleUserJoined(data.userId, data.channelId);
      break;
      
    case 'user_left':
      handleUserLeft(data.userId, data.channelId);
      break;
      
    case 'music_control':
      handleMusicControl(data);
      break;
      
    case 'notification':
      handleNotification(data.notification);
      break;
      
    default:
      console.log('Unknown WebSocket message type:', data.type);
  }
}

function handleNewMessage(message) {
  // Add message to chat
  const messagesContainer = document.getElementById('discord-messages');
  if (!messagesContainer) return;
  
  const messageElement = createMessageElement(message);
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleTypingIndicator(userId, channelId) {
  // Show typing indicator
  console.log(`User ${userId} is typing in channel ${channelId}`);
}

function handleStatusUpdate(data) {
  // Update user status in member list
  console.log('User status update:', data);
  loadDiscordMemberList();
}

function handleUserJoined(userId, channelId) {
  console.log(`User ${userId} joined channel ${channelId}`);
}

function handleUserLeft(userId, channelId) {
  console.log(`User ${userId} left channel ${channelId}`);
}

function handleMusicControl(data) {
  console.log('Music control:', data);
  // Update music player state
}

function handleNotification(notification) {
  showToast(notification.title);
  // Update notification count
}

// API Functions
async function fetchCurrentUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      currentSession = { id: data.sessionId };
      
      // Update UI with user data
      updateUserDisplay(data.user, data.profile);
      
      // Initialize WebSocket
      initWebSocket();
      
      return data;
    } else {
      console.error('Failed to fetch user');
      return null;
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

function updateUserDisplay(user, profile) {
  // Update avatar
  const avatarElements = document.querySelectorAll('#discord-user-avatar, #discord-user-avatar-large');
  avatarElements.forEach(el => {
    if (user.avatar) {
      el.style.backgroundImage = `url(${user.avatar})`;
      el.textContent = '';
    }
  });
  
  // Update username
  const nameElements = document.querySelectorAll('#discord-user-name, #discord-user-name-panel');
  nameElements.forEach(el => {
    el.textContent = user.displayName || user.username;
  });
  
  // Update status
  const statusElement = document.getElementById('discord-user-status');
  if (statusElement && profile) {
    const statusColors = {
      'online': '🟢',
      'idle': '🌙',
      'do_not_disturb': '🔴',
      'offline': '⚫'
    };
    statusElement.textContent = statusColors[profile.status] || '⚫';
  }
}

async function fetchCommunities() {
  try {
    const response = await fetch(`${API_BASE_URL}/communities`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.communities;
    }
    return [];
  } catch (error) {
    console.error('Error fetching communities:', error);
    return [];
  }
}

async function fetchChannels(communityId) {
  try {
    const response = await fetch(`${API_BASE_URL}/channels?community_id=${communityId}`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.channels;
    }
    return [];
  } catch (error) {
    console.error('Error fetching channels:', error);
    return [];
  }
}

async function fetchMessages(channelId, limit = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/messages?channel_id=${channelId}&limit=${limit}`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.messages;
    }
    return [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

async function sendMessage(channelId, content, attachments = []) {
  try {
    const response = await fetch(`${API_BASE_URL}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId,
        content,
        attachments
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.message;
    }
    return null;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

async function uploadFile(file, messageId, fileType) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('message_id', messageId);
    formData.append('file_type', fileType);
    
    const response = await fetch(`${API_BASE_URL}/files`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.attachment;
    }
    return null;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
}

async function fetchFriends(status = 'all') {
  try {
    const response = await fetch(`${API_BASE_URL}/friends?status=${status}`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.friends;
    }
    return [];
  } catch (error) {
    console.error('Error fetching friends:', error);
    return [];
  }
}

async function fetchNotifications(unreadOnly = false) {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications?unread=${unreadOnly}`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return { notifications: [], unreadCount: 0 };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { notifications: [], unreadCount: 0 };
  }
}

async function search(query, type = 'all', communityId = null) {
  try {
    let url = `${API_BASE_URL}/search?q=${encodeURIComponent(query)}&type=${type}`;
    if (communityId) {
      url += `&community_id=${communityId}`;
    }
    
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.results;
    }
    return {};
  } catch (error) {
    console.error('Error searching:', error);
    return {};
  }
}

async function fetchPlaylists(playlistId = null, channelId = null) {
  try {
    let url = `${API_BASE_URL}/music`;
    if (playlistId) {
      url += `?playlist_id=${playlistId}`;
    } else if (channelId) {
      url += `?channel_id=${channelId}`;
    }
    
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (playlistId) {
        return { playlist: data.playlist, tracks: data.tracks };
      }
      return data.playlists;
    }
    return [];
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return [];
  }
}

async function createPlaylist(name, description, channelId) {
  try {
    const response = await fetch(`${API_BASE_URL}/music`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'create_playlist',
        channelId,
        name,
        description
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.playlist;
    }
    return null;
  } catch (error) {
    console.error('Error creating playlist:', error);
    return null;
  }
}

async function addTrackToPlaylist(playlistId, trackUrl, trackName, artist, album) {
  try {
    const response = await fetch(`${API_BASE_URL}/music`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'add_track',
        playlistId,
        trackUrl,
        trackName,
        artist,
        album
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.track;
    }
    return null;
  } catch (error) {
    console.error('Error adding track to playlist:', error);
    return null;
  }
}

async function fetchLinkPreview(url) {
  try {
    const response = await fetch(`${API_BASE_URL}/link-preview?url=${encodeURIComponent(url)}`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching link preview:', error);
    return null;
  }
}

async function fetchEmojis(communityId = null) {
  try {
    let url = `${API_BASE_URL}/emojis`;
    if (communityId) {
      url += `?community_id=${communityId}`;
    }
    
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.emojis;
    }
    return [];
  } catch (error) {
    console.error('Error fetching emojis:', error);
    return [];
  }
}

async function fetchStickers(favorites = false) {
  try {
    const response = await fetch(`${API_BASE_URL}/stickers?favorites=${favorites}`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.stickers;
    }
    return [];
  } catch (error) {
    console.error('Error fetching stickers:', error);
    return [];
  }
}

// Initialize new backend integration on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Try to fetch current user from new backend
  const userData = await fetchCurrentUser();
  if (userData) {
    console.log('Connected to new backend API');
    
    // Load communities from new backend
    const communities = await fetchCommunities();
    console.log('Communities from backend:', communities);
    
    // Load notifications
    const notifications = await fetchNotifications();
    console.log('Notifications:', notifications);
  } else {
    console.log('Using legacy localStorage-based system');
  }
});
