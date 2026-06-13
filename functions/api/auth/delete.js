import { json, loadState, saveState, isKnownAdminEmail } from '../../_lib/store.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase().trim();
  if (!email) {
    return json({ ok: false, message: 'email is required' }, { status: 400 });
  }

  const state = await loadState(env);
  // Determine admin status from allowlist (trusted source), not from stored role
  const isAdmin = isKnownAdminEmail(email);
  if (isAdmin) {
    return json({ ok: false, message: 'cannot delete admin account' }, { status: 403 });
  }

  const users = state.users.filter(u => String(u.email || '').toLowerCase() !== email);
  const online = state.online.filter(o => String(o.email || '').toLowerCase() !== email);
  const sessions = state.sessions.filter(s => String(s.email || '').toLowerCase() !== email);

  await saveState(env, { users, online, sessions });

  return json({ ok: true, message: 'account deleted' });
}
