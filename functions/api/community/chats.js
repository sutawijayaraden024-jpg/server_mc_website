import {
  json,
  loadCommunityState,
  saveCommunityState,
  ensureDefaultGroup,
  getUserChats,
  createGroupChat,
  createDirectChat
} from '../../_lib/store.js';

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const email = String(url.searchParams.get('email') || '').toLowerCase();
  if (!email) {
    return json({ ok: false, message: 'email is required' }, { status: 400 });
  }

  const state = await loadCommunityState(env);
  ensureDefaultGroup(state);
  await saveCommunityState(env, state);

  return json({
    ok: true,
    chats: getUserChats(state, email),
    messages: state.messages || []
  });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase();
  const name = String(body.name || body.sender_name || '').trim();
  const type = String(body.type || 'group').toLowerCase();

  if (!email) {
    return json({ ok: false, message: 'email is required' }, { status: 400 });
  }

  const state = await loadCommunityState(env);
  ensureDefaultGroup(state);

  if (type === 'direct') {
    const targetEmail = String(body.target_email || '').toLowerCase();
    if (!targetEmail || targetEmail === email) {
      return json({ ok: false, message: 'target_email is required' }, { status: 400 });
    }
    const chat = createDirectChat(state, email, name, targetEmail, body.target_name || '');
    await saveCommunityState(env, state);
    return json({ ok: true, chat, chats: getUserChats(state, email) });
  }

  const groupName = String(body.group_name || '').trim();
  const members = Array.isArray(body.members) ? body.members : [];
  if (!groupName) {
    return json({ ok: false, message: 'group_name is required' }, { status: 400 });
  }

  const chat = createGroupChat(state, email, name, groupName, members);
  await saveCommunityState(env, state);
  return json({ ok: true, chat, chats: getUserChats(state, email) });
}
