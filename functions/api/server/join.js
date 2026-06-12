import {
  findKnownXuid,
  findUserByXuid,
  getSpawnForRole,
  getTeleportCommandForRole,
  json,
  loadState,
  normalizeUser,
  saveState
} from '../../_lib/store.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase().trim();
  const username = String(body.username || body.name || '').trim();
  const xuid = String(body.xuid || '').trim();

  if (!email && !xuid) {
    return json({ ok: false, message: 'email or xuid is required' }, { status: 400 });
  }

  const state = await loadState(env);
  const known = findKnownXuid(xuid);
  const existing = email
    ? state.users.find(item => item.email.toLowerCase() === email)
    : findUserByXuid(state.users, xuid);
  const user = existing || normalizeUser({
    email: email || known?.email || '',
    name: username || known?.minecraft_name || email.split('@')[0],
    role: body.role || known?.role || 'member',
    xuid: xuid || known?.xuid || '',
    minecraft_name: username || known?.minecraft_name || ''
  });
  const spawn = getSpawnForRole(user.role);
  state.online = state.online.filter(item => {
    if (email && item.email?.toLowerCase() === email) return false;
    if (xuid && String(item.xuid || '') === xuid) return false;
    return true;
  });
  state.online.unshift({
    id: user.id,
    name: user.name,
    email: user.email,
    xuid: user.xuid || xuid,
    minecraft_name: user.minecraft_name || username,
    role: user.role,
    spawn,
    teleport_command: getTeleportCommandForRole(user.role, username ? `"${username}"` : '@s'),
    joined_at: new Date().toISOString()
  });
  await saveState(env, { online: state.online });
  return json({
    ok: true,
    online: true,
    username: user.name,
    xuid: user.xuid || xuid,
    role: user.role,
    spawn,
    teleport_command: getTeleportCommandForRole(user.role, username ? `"${username}"` : '@s')
  });
}
