const memoryStore = globalThis.__SERVER_MC_STORE__ || (globalThis.__SERVER_MC_STORE__ = {
  users: [],
  sessions: [],
  online: []
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
  const role = isKnownAdmin || input.role === 'admin' || input.role === 'operator' ? 'admin' : 'member';
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
  const users = normalizeUserList(await readJsonStorage(env, 'users', memoryStore.users));
  const sessions = await readJsonStorage(env, 'sessions', memoryStore.sessions);
  const online = await readJsonStorage(env, 'online', memoryStore.online);
  return { users, sessions, online };
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
