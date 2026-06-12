import { json, loadState, saveState } from '../../_lib/store.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase().trim();
  const xuid = String(body.xuid || '').trim();
  if (!email && !xuid) {
    return json({ ok: false, message: 'email or xuid is required' }, { status: 400 });
  }

  const state = await loadState(env);
  state.online = state.online.filter(item => {
    if (email && item.email?.toLowerCase() === email) return false;
    if (xuid && String(item.xuid || '') === xuid) return false;
    return true;
  });
  state.sessions = state.sessions.map(session => session.email.toLowerCase() === email
    ? { ...session, active: false, ended_at: new Date().toISOString() }
    : session);
  await saveState(env, { online: state.online, sessions: state.sessions });
  return json({ ok: true, online: false });
}
