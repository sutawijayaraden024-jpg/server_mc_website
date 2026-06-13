const memoryStore = globalThis.__SERVER_MC_STORE__ || (globalThis.__SERVER_MC_STORE__ = {
  users: [],
  sessions: [],
  online: [],
  community: { chats: [], messages: [] }
});

export const ROLE_SPAWNS = {
  login: { x: 951, y: 48, z: -574 },
  member: { x: -2068, y: 33, z: -2043 },
  admin: { x: 1600, y: 31, z: -241 }
};

export const KNOWN_XUIDS = [
  {
    email: 'scarlettruiss@gmail.com',
    xuid: '2535433223991124',
    minecraft_name: 'ruiss971',
    role: 'admin'
  },

  {
    email: 'khumairaputry3@gmail.com',
    xuid: '',
    minecraft_name: 'people1975',
    role: 'admin'
  }
];

export const ADMIN_EMAILS = [
  'scarlettruiss@gmail.com',
  'khumairaputry3@gmail.com'
];

async function readJsonStorage(env, key, fallback) {
  if (env?.SERVER_MC_KV) {
    const value = await env.SERVER_MC_KV.get(key, { type: 'json' });
    return value ?? fallback;
  }
  return fallback;
}

async function writeJsonStorage(env, key, value) {
  if (env?.SERVER_MC_KV) {
    await env.SERVER_MC_KV.put(key, JSON.stringify(value));
  }
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      ...(init.headers || {})
    }
  });
}

export function normalizeUser(input = {}) {
  const email = String(input.email || '').toLowerCase();
  const name = input.name || input.username || email.split('@')[0] || 'Player';
  const known = KNOWN_XUIDS.find(item => item.email === email || item.xuid === String(input.xuid || ''));
  const xuid = String(input.xuid || known?.xuid || '').trim();
  const minecraftName = input.minecraft_name || input.minecraftName || known?.minecraft_name || '';
  const isKnownAdmin = ADMIN_EMAILS.includes(email) || known?.role === 'admin';
  const role = isKnownAdmin ? 'admin' : 'member';

  return {
    id: input.id || Date.now(),
    name,
    email,
    role,
    password: input.password || '',
    xuid,
    minecraft_name: minecraftName,
    joined_at: input.joined_at || new Date().toISOString(),
    online: Boolean(input.online)
  };
}

export function normalizeUserList(users = []) {
  return users.map(user => normalizeUser(user));
}

export function isKnownAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').toLowerCase());
}

export function repairUserRole(user = {}) {
  const normalized = normalizeUser(user);
  if (isKnownAdminEmail(normalized.email)) {
    return { ...normalized, role: 'admin' };
  }
  return normalized;
}

export async function loadState(env) {
  const storedUsers = await readJsonStorage(env, 'users', memoryStore.users);
  const users = normalizeUserList(storedUsers);
  const sessions = await readJsonStorage(env, 'sessions', memoryStore.sessions);
  const online = await readJsonStorage(env, 'online', memoryStore.online);
  const seededUsers = users.length ? users : normalizeUserList([
    {
      id: 1,
      name: 'Ra172',
      email: 'scarlettruiss@gmail.com',
      role: 'admin',
      xuid: '2535433223991124',
      minecraft_name: 'ruiss971'
    },
    {
      id: 2,
      name: 'people1975',
      email: 'khumairaputry3@gmail.com',
      role: 'admin',
      xuid: '',
      minecraft_name: 'people1975'
    }
  ]);
  if (!users.length && env?.SERVER_MC_KV) {
    memoryStore.users = seededUsers;
    await writeJsonStorage(env, 'users', seededUsers);
  }
  try {
    if (env?.SERVER_MC_KV) {
      const original = JSON.stringify(storedUsers || []);
      const repaired = JSON.stringify(users || []);
      if (original !== repaired) {
        memoryStore.users = users;
        await writeJsonStorage(env, 'users', users);
      }
    }
  } catch (e) {
    memoryStore.users = users;
  }
  return { users: seededUsers, sessions, online };
}

export async function saveState(env, state) {
  if (state.users) {
    memoryStore.users = state.users;
    await writeJsonStorage(env, 'users', state.users);
  }
  if (state.sessions) {
    memoryStore.sessions = state.sessions;
    await writeJsonStorage(env, 'sessions', state.sessions);
  }
  if (state.online) {
    memoryStore.online = state.online;
    await writeJsonStorage(env, 'online', state.online);
  }
}

export function findUserByEmail(email) {
  return memoryStore.users.find(user => user.email.toLowerCase() === String(email || '').toLowerCase()) || null;
}

export function upsertUser(user) {
  const normalized = normalizeUser(user);
  const idx = memoryStore.users.findIndex(u => u.email.toLowerCase() === normalized.email);
  if (idx >= 0) {
    memoryStore.users[idx] = { ...memoryStore.users[idx], ...normalized };
    return memoryStore.users[idx];
  }
  memoryStore.users.unshift(normalized);
  return normalized;
}

export function createSession(user) {
  const token = `smc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const session = {
    token,
    email: user.email,
    username: user.name,
    xuid: user.xuid || '',
    role: user.role,
    active: true,
    created_at: new Date().toISOString()
  };
  memoryStore.sessions = memoryStore.sessions.filter(s => s.email !== user.email);
  memoryStore.sessions.unshift(session);
  return session;
}

export function setOnline(user) {
  const normalized = normalizeUser(user);
  const record = {
    id: normalized.id,
    name: normalized.name,
    email: normalized.email,
    xuid: normalized.xuid,
    minecraft_name: normalized.minecraft_name,
    role: normalized.role,
    spawn: getSpawnForRole(normalized.role),
    joined_at: new Date().toISOString()
  };
  memoryStore.online = memoryStore.online.filter(item => item.email !== record.email);
  memoryStore.online.unshift(record);
  return record;
}

export function setOffline(email) {
  memoryStore.online = memoryStore.online.filter(item => item.email.toLowerCase() !== String(email || '').toLowerCase());
  memoryStore.sessions = memoryStore.sessions.map(session => session.email.toLowerCase() === String(email || '').toLowerCase()
    ? { ...session, active: false, ended_at: new Date().toISOString() }
    : session);
}

export function getSessionByToken(token) {
  return memoryStore.sessions.find(session => session.token === token && session.active) || null;
}

export function getSpawnForRole(role = 'member') {
  return ROLE_SPAWNS[role] || ROLE_SPAWNS.member;
}

export function getTeleportCommandForRole(role = 'member', target = '@s') {
  const spawn = getSpawnForRole(role);
  return `tp ${target} ${spawn.x} ${spawn.y} ${spawn.z}`;
}

export function findKnownXuid(xuid) {
  const normalizedXuid = String(xuid || '').trim();
  if (!normalizedXuid) return null;
  return KNOWN_XUIDS.find(item => item.xuid === normalizedXuid) || null;
}

export function findUserByXuid(users, xuid) {
  const normalizedXuid = String(xuid || '').trim();
  return users.find(user => String(user.xuid || '').trim() === normalizedXuid) || null;
}

const DEFAULT_GROUP_ID = 'group_umum';

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function buildDirectChatId(emailA, emailB) {
  return `dm_${[normalizeEmail(emailA), normalizeEmail(emailB)].sort().join('_')}`;
}

function touchChatLastMessage(chat, message) {
  chat.last_message = {
    text: message.text,
    sender_name: message.sender_name,
    sender_email: message.sender_email,
    created_at: message.created_at
  };
  chat.updated_at = message.created_at;
}

export function ensureDefaultGroup(state) {
  if (!state.community) state.community = { chats: [], messages: [] };
  if (!Array.isArray(state.community.chats)) state.community.chats = [];
  if (!Array.isArray(state.community.messages)) state.community.messages = [];

  let defaultGroup = state.community.chats.find(chat => chat.id === DEFAULT_GROUP_ID);
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
      last_message: null,
      channels: [
        { id: createId('ch'), name: 'pengumuman', type: 'text', category: 'INFORMASI SERVER' },
        { id: createId('ch'), name: 'umum', type: 'text', category: 'TEKS CHANNEL' },
        { id: createId('ch'), name: 'media', type: 'text', category: 'TEKS CHANNEL' },
        { id: createId('ch'), name: 'musik', type: 'music', category: 'MUSIC ROOM' },
        { id: createId('ch'), name: 'bantuan', type: 'text', category: 'BANTUAN' }
      ],
      permissions: {
        member: { send_messages: true, upload_files: true, create_invite: true, add_members: false, remove_members: false, manage_channels: false, manage_roles: false },
        moderator: { send_messages: true, upload_files: true, create_invite: true, add_members: true, remove_members: true, manage_channels: false, manage_roles: false },
        admin: { send_messages: true, upload_files: true, create_invite: true, add_members: true, remove_members: true, manage_channels: true, manage_roles: true },
        guest: { send_messages: true, upload_files: false, create_invite: false, add_members: false, remove_members: false, manage_channels: false, manage_roles: false }
      }
    };
    state.community.chats.unshift(defaultGroup);
  }
  return defaultGroup;
}

export function getUserChats(state, email) {
  const normalizedEmail = normalizeEmail(email);
  ensureDefaultGroup(state);

  const defaultGroup = state.community.chats.find(chat => chat.id === DEFAULT_GROUP_ID);
  if (defaultGroup && !defaultGroup.members.includes(normalizedEmail)) {
    defaultGroup.members.push(normalizedEmail);
  }

  return state.community.chats
    .filter(chat => Array.isArray(chat.members) && chat.members.includes(normalizedEmail))
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
}

export function createGroupChat(state, creatorEmail, creatorName, groupName, memberEmails = []) {
  const normalizedCreator = normalizeEmail(creatorEmail);
  const members = new Set([normalizedCreator]);
  memberEmails.forEach(item => {
    const email = normalizeEmail(typeof item === 'string' ? item : item.email);
    if (email) members.add(email);
  });

  const chatId = createId('group');
  const chat = {
    id: chatId,
    type: 'group',
    name: groupName.slice(0, 60),
    members: Array.from(members),
    created_by: normalizedCreator,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    avatar: '👥',
    last_message: null,
    // Default roles
    roles: {
      owner: [normalizedCreator],
      admins: [],
      moderators: []
    },
    // Default channels
    channels: [
      { id: createId('ch'), name: 'pengumuman', type: 'text', category: 'INFORMASI SERVER' },
      { id: createId('ch'), name: 'umum', type: 'text', category: 'TEKS CHANNEL' },
      { id: createId('ch'), name: 'media', type: 'text', category: 'TEKS CHANNEL' },
      { id: createId('ch'), name: 'musik', type: 'music', category: 'MUSIC ROOM' },
      { id: createId('ch'), name: 'bantuan', type: 'text', category: 'BANTUAN' }
    ],
    // Default permissions
    permissions: {
      member: { send_messages: true, upload_files: true, create_invite: true, add_members: false, remove_members: false, manage_channels: false, manage_roles: false },
      moderator: { send_messages: true, upload_files: true, create_invite: true, add_members: true, remove_members: true, manage_channels: false, manage_roles: false },
      admin: { send_messages: true, upload_files: true, create_invite: true, add_members: true, remove_members: true, manage_channels: true, manage_roles: true },
      guest: { send_messages: true, upload_files: false, create_invite: false, add_members: false, remove_members: false, manage_channels: false, manage_roles: false }
    }
  };

  state.community.chats.unshift(chat);

  // Auto-create welcome message
  const welcomeMsg = {
    id: createId('msg'),
    chat_id: chatId,
    sender_email: 'system@servermc',
    sender_name: 'System',
    text: `🎉 Grup "${groupName}" telah dibuat oleh ${creatorName}! Channel tersedia: ${chat.channels.map(c => '#' + c.name).join(', ')}`,
    created_at: new Date().toISOString(),
    system: true
  };
  state.community.messages.push(welcomeMsg);
  chat.last_message = {
    text: welcomeMsg.text,
    sender_name: 'System',
    sender_email: 'system@servermc',
    created_at: welcomeMsg.created_at
  };
  chat.updated_at = welcomeMsg.created_at;

  return chat;
}

export function createDirectChat(state, emailA, nameA, emailB, nameB) {
  const normalizedA = normalizeEmail(emailA);
  const normalizedB = normalizeEmail(emailB);
  const chatId = buildDirectChatId(normalizedA, normalizedB);

  let chat = state.community.chats.find(item => item.id === chatId);
  if (!chat) {
    chat = {
      id: chatId,
      type: 'direct',
      name: nameB || normalizedB.split('@')[0],
      members: [normalizedA, normalizedB],
      member_names: {
        [normalizedA]: nameA || normalizedA.split('@')[0],
        [normalizedB]: nameB || normalizedB.split('@')[0]
      },
      created_by: normalizedA,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      avatar: '💬',
      last_message: null
    };
    state.community.chats.unshift(chat);
  }
  return chat;
}

export function sendCommunityMessage(state, chatId, senderEmail, senderName, text) {
  const normalizedEmail = normalizeEmail(senderEmail);
  const chat = state.community.chats.find(item => item.id === chatId);
  if (!chat || !Array.isArray(chat.members) || !chat.members.includes(normalizedEmail)) {
    return null;
  }

  const message = {
    id: createId('msg'),
    chat_id: chatId,
    sender_email: normalizedEmail,
    sender_name: senderName || normalizedEmail.split('@')[0],
    text: text.slice(0, 2000),
    created_at: new Date().toISOString()
  };

  state.community.messages.push(message);
  touchChatLastMessage(chat, message);
  return message;
}

export function getChatPermission(chat, email) {
  if (!chat || !chat.permissions) return null;
  const normalizedEmail = normalizeEmail(email);
  
  // Check role hierarchy
  if (chat.roles?.owner?.includes(normalizedEmail)) return 'owner';
  if (chat.roles?.admins?.includes(normalizedEmail)) return 'admin';
  if (chat.roles?.moderators?.includes(normalizedEmail)) return 'moderator';
  if (chat.members?.includes(normalizedEmail)) return 'member';
  return 'guest';
}

export function checkChatPermission(chat, email, action) {
  const role = getChatPermission(chat, email);
  if (!role) return false;
  const perms = chat.permissions?.[role];
  if (!perms) return false;
  return perms[action] === true;
}

export async function loadCommunityState(env) {
  const stored = await readJsonStorage(env, 'community', memoryStore.community);
  memoryStore.community = {
    chats: Array.isArray(stored?.chats) ? stored.chats : [],
    messages: Array.isArray(stored?.messages) ? stored.messages : []
  };
  return { community: memoryStore.community };
}

export async function saveCommunityState(env, state) {
  if (state?.community) {
    memoryStore.community = state.community;
    await writeJsonStorage(env, 'community', state.community);
  }
}

// Notification helpers
export function createNotification(state, userId, type, title, content, data = {}) {
  if (!state.notifications) state.notifications = [];
  const notification = {
    id: createId('notif'),
    user_id: userId,
    type,
    title: title.slice(0, 255),
    content: content?.slice(0, 500) || '',
    data,
    is_read: false,
    created_at: new Date().toISOString()
  };
  state.notifications.unshift(notification);
  return notification;
}

export function getUserNotifications(state, userId, limit = 50) {
  if (!state.notifications) return [];
  return state.notifications
    .filter(n => n.user_id === userId)
    .slice(0, limit);
}

export function markNotificationRead(state, notificationId, userId) {
  if (!state.notifications) return false;
  const notif = state.notifications.find(n => n.id === notificationId && n.user_id === userId);
  if (notif) {
    notif.is_read = true;
    return true;
  }
  return false;
}

export function markAllNotificationsRead(state, userId) {
  if (!state.notifications) return;
  state.notifications.forEach(n => {
    if (n.user_id === userId) n.is_read = true;
  });
}

// Friend helpers (local storage)
export function getFriends(state, userId) {
  if (!state.friends) return [];
  return state.friends.filter(f => f.user_id === userId || f.friend_id === userId);
}

export function sendFriendRequest(state, userId, friendId) {
  if (!state.friends) state.friends = [];
  if (state.friends.some(f => f.user_id === userId && f.friend_id === friendId)) return null;
  const request = {
    id: createId('fr'),
    user_id: userId,
    friend_id: friendId,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  state.friends.push(request);
  return request;
}

export function acceptFriendRequest(state, requestId, userId) {
  const request = state.friends?.find(f => f.id === requestId && f.friend_id === userId);
  if (!request) return false;
  request.status = 'accepted';
  request.updated_at = new Date().toISOString();
  // Add reverse friendship
  state.friends.push({
    id: createId('fr'),
    user_id: userId,
    friend_id: request.user_id,
    status: 'accepted',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return true;
}

export function rejectFriendRequest(state, requestId, userId) {
  const idx = state.friends?.findIndex(f => f.id === requestId && f.friend_id === userId);
  if (idx === -1 || idx === undefined) return false;
  state.friends.splice(idx, 1);
  return true;
}

export function blockUser(state, userId, blockUserId) {
  if (!state.friends) state.friends = [];
  // Remove any existing friendship
  state.friends = state.friends.filter(f => !(f.user_id === userId && f.friend_id === blockUserId) && !(f.user_id === blockUserId && f.friend_id === userId));
  state.friends.push({
    id: createId('fr'),
    user_id: userId,
    friend_id: blockUserId,
    status: 'blocked',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return true;
}