// Community API Client
// Integrasi frontend komunitas dengan backend Cloudflare Workers

const API_BASE = '';

// ==================== AUTH ====================

export async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

export async function apiGetSession(token) {
  const res = await fetch(`${API_BASE}/api/auth/session`, {
    headers: { 'authorization': `Bearer ${token}` }
  });
  return res.json();
}

export async function apiGetProfile(email) {
  const res = await fetch(`${API_BASE}/api/community/auth?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function apiUpdateProfile(email, data) {
  const res = await fetch(`${API_BASE}/api/community/auth`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, ...data })
  });
  return res.json();
}

// ==================== CHATS ====================

export async function apiGetChats(email) {
  const res = await fetch(`${API_BASE}/api/community/chats?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function apiCreateGroup(email, name, groupName, members) {
  const res = await fetch(`${API_BASE}/api/community/chats`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, name, type: 'group', group_name: groupName, members })
  });
  return res.json();
}

export async function apiCreateDM(email, name, targetEmail, targetName) {
  const res = await fetch(`${API_BASE}/api/community/chats`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, name, type: 'direct', target_email: targetEmail, target_name: targetName })
  });
  return res.json();
}

// ==================== MESSAGES ====================

export async function apiGetMessages(email, chatId) {
  const url = `${API_BASE}/api/community/messages?email=${encodeURIComponent(email)}${chatId ? '&chat_id=' + chatId : ''}`;
  const res = await fetch(url);
  return res.json();
}

export async function apiSendMessage(email, chatId, text, senderName) {
  const res = await fetch(`${API_BASE}/api/community/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, chat_id: chatId, text, sender_name: senderName })
  });
  return res.json();
}

// ==================== FRIENDS ====================

export async function apiGetFriends(email) {
  const res = await fetch(`${API_BASE}/api/community/friends?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function apiAddFriend(email, targetEmail) {
  const res = await fetch(`${API_BASE}/api/community/friends`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, target_email: targetEmail, action: 'add' })
  });
  return res.json();
}

export async function apiRespondFriend(email, targetEmail, action) {
  const res = await fetch(`${API_BASE}/api/community/friends`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, target_email: targetEmail, action })
  });
  return res.json();
}

// ==================== NOTIFICATIONS ====================

export async function apiGetNotifications(email) {
  const res = await fetch(`${API_BASE}/api/community/notifications?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function apiMarkNotificationRead(email, notificationId) {
  const res = await fetch(`${API_BASE}/api/community/notifications`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, notification_id: notificationId, action: 'read' })
  });
  return res.json();
}

// ==================== MUSIC ====================

export async function apiGetMusic(email) {
  const res = await fetch(`${API_BASE}/api/community/music?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function apiAddMusic(email, title, artist, url) {
  const res = await fetch(`${API_BASE}/api/community/music`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, title, artist, url })
  });
  return res.json();
}

// ==================== STATUS ====================

export async function apiUpdateStatus(email, status) {
  const res = await fetch(`${API_BASE}/api/community/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, status })
  });
  return res.json();
}

export async function apiGetOnlineUsers() {
  const res = await fetch(`${API_BASE}/api/community/status`);
  return res.json();
}

// ==================== SEARCH ====================

export async function apiSearch(email, query) {
  const res = await fetch(`${API_BASE}/api/community/search?email=${encodeURIComponent(email)}&q=${encodeURIComponent(query)}`);
  return res.json();
}

// ==================== WEBSOCKET ====================

export function createWebSocket(email, onMessage) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/api/community/websocket?email=${encodeURIComponent(email)}`);

  ws.onopen = () => console.log('[WS] Connected');
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('[WS] Parse error:', e);
    }
  };
  ws.onclose = () => console.log('[WS] Disconnected');
  ws.onerror = (err) => console.error('[WS] Error:', err);

  return ws;
}

// ==================== UTILITY ====================

export function isOnline(status) {
  return status === 'online' || status === 'active';
}

export function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}h`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
