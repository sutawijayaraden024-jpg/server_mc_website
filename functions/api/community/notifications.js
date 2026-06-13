// Notifications API
// Handles notification retrieval, read status, and management

import { json } from '../../_lib/store.js';

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const email = String(url.searchParams.get('email') || '').toLowerCase();
    
    if (!email) {
      return json({ ok: false, message: 'email is required' }, { status: 400 });
    }
    
    // Load community state (which includes notifications if stored)
    const stored = env?.SERVER_MC_KV 
      ? await env.SERVER_MC_KV.get('community', { type: 'json' })
      : null;
    
    const notifications = stored?.notifications 
      ? stored.notifications.filter(n => n.user_id === email).slice(0, 50)
      : [];
    
    return json({ ok: true, notifications });
  } catch (error) {
    console.error('Notifications error:', error);
    return json({ ok: false, message: 'Internal error' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, notificationId, email } = body;
    
    if (!email) {
      return json({ ok: false, message: 'email is required' }, { status: 400 });
    }
    
    // Load community state
    const stored = env?.SERVER_MC_KV 
      ? await env.SERVER_MC_KV.get('community', { type: 'json' })
      : { notifications: [] };
    
    if (!stored.notifications) stored.notifications = [];
    
    if (action === 'mark_read' && notificationId) {
      const notif = stored.notifications.find(n => n.id === notificationId && n.user_id === email);
      if (notif) notif.is_read = true;
    } else if (action === 'mark_all_read') {
      stored.notifications.forEach(n => {
        if (n.user_id === email) n.is_read = true;
      });
    }
    
    // Save back to KV
    if (env?.SERVER_MC_KV) {
      await env.SERVER_MC_KV.put('community', JSON.stringify(stored));
    }
    
    return json({ ok: true });
  } catch (error) {
    console.error('Notifications error:', error);
    return json({ ok: false, message: 'Internal error' }, { status: 500 });
  }
}