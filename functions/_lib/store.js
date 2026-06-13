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
  // Admin role must be derived ONLY from trusted allowlist.
  // Prevent clients from granting themselves admin by sending role=admin.
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
  // If normalization changed any stored users (e.g. roles), write the repaired users back to KV
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
    // ignore write errors, but keep memoryStore consistent
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
      last_message: null
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

  const chat = {
    id: createId('group'),
    type: 'group',
    name: groupName.slice(0, 60),
    members: Array.from(members),
    created_by: normalizedCreator,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    avatar: '👥',
    last_message: null
  };

  state.community.chats.unshift(chat);
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
