// Online Status Detection System
// Handles automatic status detection (online, idle, do not disturb, offline)

import { verifySession } from '../_lib/auth.js';

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const OFFLINE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (userId) {
      // Get specific user's status
      const profile = await env.DB.prepare(`
        SELECT p.status, p.custom_status, p.last_seen_at,
               u.username, u.display_name, u.avatar_url
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
      `).bind(userId).first();
      
      if (!profile) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ 
        user: {
          id: userId,
          username: profile.username,
          displayName: profile.display_name,
          avatar: profile.avatar_url
        },
        status: profile.status,
        customStatus: profile.custom_status,
        lastSeenAt: profile.last_seen_at
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get all online users in user's communities
      const communities = await env.DB.prepare(`
        SELECT community_id FROM community_members WHERE user_id = ?
      `).bind(session.userId).all();
      
      const communityIds = communities.map(c => c.community_id);
      
      if (communityIds.length === 0) {
        return new Response(JSON.stringify({ users: [] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const users = await env.DB.prepare(`
        SELECT p.user_id, p.status, p.custom_status, p.last_seen_at,
               u.username, u.display_name, u.avatar_url
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id IN (
          SELECT DISTINCT user_id FROM community_members
          WHERE community_id IN (${communityIds.map(() => '?').join(',')})
        )
        AND p.status IN ('online', 'idle', 'do_not_disturb')
        ORDER BY p.status, p.last_seen_at DESC
      `).bind(...communityIds).all();
      
      return new Response(JSON.stringify({ users }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('Status error:', error);
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
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { status, customStatus } = body;
    
    if (status && !['online', 'idle', 'do_not_disturb', 'offline'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update profile status
    await env.DB.prepare(`
      UPDATE profiles
      SET status = COALESCE(?, status),
          custom_status = COALESCE(?, custom_status),
          last_seen_at = NOW(),
          updated_at = NOW()
      WHERE user_id = ?
    `).bind(status || null, customStatus || null, session.userId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Status update error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Scheduled function to update idle/offline status
export async function onRequestScheduled(context) {
  const { env } = context;
  
  try {
    const now = Date.now();
    const idleThreshold = new Date(now - IDLE_TIMEOUT).toISOString();
    const offlineThreshold = new Date(now - OFFLINE_TIMEOUT).toISOString();
    
    // Update idle users to offline
    await env.DB.prepare(`
      UPDATE profiles
      SET status = 'offline', last_seen_at = NOW()
      WHERE status = 'idle' AND last_seen_at < ?
    `).bind(idleThreshold).run();
    
    // Update online users to idle
    await env.DB.prepare(`
      UPDATE profiles
      SET status = 'idle'
      WHERE status = 'online' AND last_seen_at < ?
    `).bind(idleThreshold).run();
    
    // Update very old online/idle users to offline
    await env.DB.prepare(`
      UPDATE profiles
      SET status = 'offline', last_seen_at = NOW()
      WHERE status IN ('online', 'idle') AND last_seen_at < ?
    `).bind(offlineThreshold).run();
    
    console.log('Status update completed');
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Scheduled status update error:', error);
    return new Response('Error', { status: 500 });
  }
}

// Heartbeat endpoint to keep user online
export async function onRequestPut(context) {
  try {
    const { request, env } = context;
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update last seen time
    await env.DB.prepare(`
      UPDATE profiles
      SET last_seen_at = NOW(),
          status = CASE 
            WHEN status = 'offline' THEN 'online'
            ELSE status
          END
      WHERE user_id = ?
    `).bind(session.userId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Heartbeat error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
