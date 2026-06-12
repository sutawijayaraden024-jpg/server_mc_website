import {
  findKnownXuid,
  findUserByXuid,
  getSpawnForRole,
  getTeleportCommandForRole,
  json,
  loadState
} from '../../_lib/store.js';

async function resolvePlayer(request, env) {
  const url = new URL(request.url);
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const xuid = String(body.xuid || url.searchParams.get('xuid') || '').trim();
  const username = String(body.username || body.name || url.searchParams.get('username') || '').trim();

  if (!xuid) {
    return json({ ok: false, message: 'xuid is required' }, { status: 400 });
  }

  const state = await loadState(env);
  const known = findKnownXuid(xuid);
  const user = findUserByXuid(state.users, xuid);
  const role = user?.role || known?.role || 'guest';
  const spawn = getSpawnForRole(role === 'guest' ? 'member' : role);

  return json({
    ok: true,
    authenticated: Boolean(user || known),
    username: user?.name || username || known?.minecraft_name || '',
    email: user?.email || known?.email || '',
    xuid,
    role,
    spawn,
    teleport_command: getTeleportCommandForRole(role === 'guest' ? 'member' : role, username ? `"${username}"` : '@s')
  });
}

export async function onRequestGet({ request, env }) {
  return resolvePlayer(request, env);
}

export async function onRequestPost({ request, env }) {
  return resolvePlayer(request, env);
}
