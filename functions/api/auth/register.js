import { json, loadState, saveState, normalizeUser, createSession } from '../../_lib/store.js';

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
    return json({ ok: false, message: 'account already exists' }, { status: 409 });
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
