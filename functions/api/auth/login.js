import { json, loadState, saveState, normalizeUser, createSession, repairUserRole } from '../../_lib/store.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase().trim();
  const password = String(body.password || '').trim();

  if (!email || !password) {
    return json({ ok: false, message: 'email and password are required' }, { status: 400 });
  }

  const state = await loadState(env);
  const user = state.users.find(item => item.email.toLowerCase() === email);
  if (!user) {
    return json({ ok: false, message: 'account not found' }, { status: 404 });
  }

  const repairedUser = repairUserRole(user);
  const userChanged = JSON.stringify(repairedUser) !== JSON.stringify(user);
  const users = userChanged
    ? state.users.map(item => item.email.toLowerCase() === email ? repairedUser : item)
    : state.users;

  if (repairedUser.password && repairedUser.password !== password) {
    return json({ ok: false, message: 'invalid password' }, { status: 401 });
  }

  const normalized = normalizeUser(repairedUser);
  const session = createSession(normalized);
  state.sessions = state.sessions.filter(item => item.email !== normalized.email);
  state.sessions.unshift(session);
  await saveState(env, { users, sessions: state.sessions });

  return json({
    ok: true,
    token: session.token,
    role: normalized.role,
    username: normalized.name,
    xuid: normalized.xuid
  });
}
