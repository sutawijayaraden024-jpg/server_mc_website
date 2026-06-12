import { json, loadState, saveState, normalizeUser, createSession, repairUserRole } from '../../_lib/store.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase().trim();
  const username = String(body.username || body.name || '').trim();
  const password = String(body.password || '').trim();
  const role = body.role === 'admin' ? 'admin' : 'member';
  const xuid = String(body.xuid || '').trim();
  const minecraftName = String(body.minecraft_name || body.minecraftName || '').trim();

  if (!email || !username || !password) {
    return json({ ok: false, message: 'username, email, and password are required' }, { status: 400 });
  }

  const state = await loadState(env);
  const existing = state.users.find(user => user.email.toLowerCase() === email);
  if (existing) {
    const repaired = repairUserRole({
      ...existing,
      name: username || existing.name,
      password: password || existing.password,
      xuid: xuid || existing.xuid,
      minecraft_name: minecraftName || existing.minecraft_name,
      role: role || existing.role
    });
    const updatedUsers = state.users.map(user => user.email.toLowerCase() === email ? repaired : user);
    const session = createSession(repaired);
    state.sessions = state.sessions.filter(item => item.email !== repaired.email);
    state.sessions.unshift(session);
    await saveState(env, { users: updatedUsers, sessions: state.sessions });
    return json({
      ok: true,
      message: 'Account repaired and logged in',
      role: repaired.role,
      username: repaired.name,
      xuid: repaired.xuid,
      token: session.token
    });
  }

  const user = normalizeUser({ email, name: username, password, role, xuid, minecraft_name: minecraftName });
  state.users.unshift(user);
  const session = createSession(user);
  state.sessions.unshift(session);
  await saveState(env, { users: state.users, sessions: state.sessions });

  return json({
    ok: true,
    message: 'Account created',
    role: user.role,
    username: user.name,
    xuid: user.xuid,
    token: session.token
  });
}
