import {
  json,
  loadCommunityState,
  saveCommunityState,
  ensureDefaultGroup,
  getUserChats,
  sendCommunityMessage
} from '../../_lib/store.js';

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const email = String(url.searchParams.get('email') || '').toLowerCase();
  const chatId = String(url.searchParams.get('chat_id') || '');

  if (!email) {
    return json({ ok: false, message: 'email is required' }, { status: 400 });
  }

  const state = await loadCommunityState(env);
  ensureDefaultGroup(state);
  await saveCommunityState(env, state);

  const userChats = getUserChats(state, email);
  const allowedIds = new Set(userChats.map(chat => chat.id));
  const messages = (state.messages || []).filter(message => {
    if (chatId) return message.chat_id === chatId && allowedIds.has(message.chat_id);
    return allowedIds.has(message.chat_id);
  });

  return json({
    ok: true,
    messages,
    chats: userChats
  });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase();
  const chatId = String(body.chat_id || '');
  const text = String(body.text || '').trim();
  const senderName = String(body.sender_name || body.name || '').trim();

  if (!email || !chatId || !text) {
    return json({ ok: false, message: 'email, chat_id, and text are required' }, { status: 400 });
  }

  const state = await loadCommunityState(env);
  ensureDefaultGroup(state);

  const message = sendCommunityMessage(state, chatId, email, senderName, text);
  if (!message) {
    return json({ ok: false, message: 'chat not found or access denied' }, { status: 403 });
  }

  await saveCommunityState(env, state);
  return json({
    ok: true,
    message,
    chats: getUserChats(state, email)
  });
}
