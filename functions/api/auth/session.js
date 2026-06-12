import { getSpawnForRole, getTeleportCommandForRole, json, loadState } from '../../_lib/store.js';

export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return json({ ok: false, authenticated: false }, { status: 401 });
  }

  const state = await loadState(env);
  const session = state.sessions.find(item => item.token === token && item.active);
  if (!session) {
    return json({ ok: false, authenticated: false }, { status: 401 });
  }

  const user = state.users.find(item => item.email.toLowerCase() === String(session.email || '').toLowerCase());
  return json({
    ok: true,
    authenticated: true,
    username: user?.name || session.username,
    xuid: user?.xuid || session.xuid || '',
    role: user?.role || session.role,
    spawn: getSpawnForRole(user?.role || session.role),
    teleport_command: getTeleportCommandForRole(user?.role || session.role),
    online: true
  });
}
