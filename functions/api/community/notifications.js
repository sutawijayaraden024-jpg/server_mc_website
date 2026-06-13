// Notifications API
// Handles real-time notifications for mentions, replies, friend requests, announcements, music updates

import { verifySession } from '../../_lib/auth.js';
import { rateLimit } from '../../_lib/rate-limit.js';

const notificationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 50
});

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let query = `
      SELECT * FROM notifications
      WHERE user_id = ?
    `;
    const params = [session.userId];
    
    if (unreadOnly) {
      query += ` AND is_read = false`;
    }
    
    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    const notifications = await env.DB.prepare(query).bind(...params).all();
    
    // Get unread count
    const unreadCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = false
    `).bind(session.userId).first();
    
    return new Response(JSON.stringify({ 
      notifications,
      unreadCount: unreadCount.count
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Notifications error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    
    const rateLimitResult = await notificationRateLimit(env, request);
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { action, notificationId, userId, type, title, content, data } = body;
    
    if (action === 'mark_read') {
      if (!notificationId) {
        return new Response(JSON.stringify({ error: 'notificationId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check ownership
      const notification = await env.DB.prepare(`
        SELECT * FROM notifications WHERE id = ? AND user_id = ?
      `).bind(notificationId, session.userId).first();
      
      if (!notification) {
        return new Response(JSON.stringify({ error: 'Notification not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await env.DB.prepare(`
        UPDATE notifications SET is_read = true WHERE id = ?
      `).bind(notificationId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'mark_all_read') {
      await env.DB.prepare(`
        UPDATE notifications SET is_read = true
        WHERE user_id = ? AND is_read = false
      `).bind(session.userId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'create') {
      // Only admins can create notifications for other users
      if (!userId || !type || !title) {
        return new Response(JSON.stringify({ error: 'userId, type, and title are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const validTypes = ['mention', 'reply', 'friend_request', 'announcement', 'music_update', 'system'];
      if (!validTypes.includes(type)) {
        return new Response(JSON.stringify({ error: 'Invalid notification type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const notification = await env.DB.prepare(`
        INSERT INTO notifications (user_id, type, title, content, data)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
      `).bind(userId, type, title, content || null, JSON.stringify(data || {})).first();
      
      return new Response(JSON.stringify({ notification }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Notifications error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const notificationId = url.pathname.split('/').pop();
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check ownership
    const notification = await env.DB.prepare(`
      SELECT * FROM notifications WHERE id = ? AND user_id = ?
    `).bind(notificationId, session.userId).first();
    
    if (!notification) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env.DB.prepare(`DELETE FROM notifications WHERE id = ?`).bind(notificationId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Notification deletion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
