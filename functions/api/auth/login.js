import { json, loadState, saveState, normalizeUser, createSession } from '../../_lib/store.js';

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

  if (user.password && user.password !== password) {
    return json({ ok: false, message: 'invalid password' }, { status: 401 });
  }

  const normalized = normalizeUser(user);
  const session = createSession(normalized);
  state.sessions = state.sessions.filter(item => item.email !== normalized.email);
  state.sessions.unshift(session);
  await saveState(env, { sessions: state.sessions });

  return json({
    ok: true,
    token: session.token,
    role: normalized.role,
    username: normalized.name,
    xuid: normalized.xuid
  });
}
