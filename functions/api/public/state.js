import { json, loadState } from '../../_lib/store.js';

export async function onRequestGet({ env }) {
  const state = await loadState(env);
  return json({
    ok: true,
    users: state.users || [],
    online: state.online || [],
    sessions: []
  });
}
