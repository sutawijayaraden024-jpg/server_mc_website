// Friends API
// Handles friend requests, acceptance, rejection, and blocking

import { verifySession } from '../_lib/auth.js';
import { rateLimit } from '../_lib/rate-limit.js';

const friendRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // all, online, pending, blocked
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let query = `
      SELECT f.*, 
             u.username, u.display_name, u.avatar_url,
             p.status as online_status, p.last_seen_at
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE f.user_id = ?
    `;
    const params = [session.userId];
    
    if (status === 'pending') {
      query += ` AND f.status = 'pending'`;
    } else if (status === 'blocked') {
      query += ` AND f.status = 'blocked'`;
    } else if (status === 'online') {
      query += ` AND f.status = 'accepted' AND p.status = 'online'`;
    } else if (status === 'all') {
      query += ` AND f.status = 'accepted'`;
    }
    
    query += ` ORDER BY f.updated_at DESC`;
    
    const friends = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({ friends }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Friends error:', error);
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
    
    const rateLimitResult = await friendRateLimit(env, request);
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
    
    const { action, friendId } = body;
    
    if (!friendId) {
      return new Response(JSON.stringify({ error: 'friendId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (friendId === session.userId) {
      return new Response(JSON.stringify({ error: 'Cannot add yourself as friend' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'send_request') {
      // Check if friendship already exists
      const existing = await env.DB.prepare(`
        SELECT status FROM friends
        WHERE user_id = ? AND friend_id = ?
      `).bind(session.userId, friendId).first();
      
      if (existing) {
        if (existing.status === 'pending') {
          return new Response(JSON.stringify({ error: 'Friend request already sent' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (existing.status === 'accepted') {
          return new Response(JSON.stringify({ error: 'Already friends' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (existing.status === 'blocked') {
          return new Response(JSON.stringify({ error: 'User is blocked' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Create friend request
      const friend = await env.DB.prepare(`
        INSERT INTO friends (user_id, friend_id, status)
        VALUES (?, ?, 'pending')
        RETURNING *
      `).bind(session.userId, friendId).first();
      
      // Create notification for recipient
      await env.DB.prepare(`
        INSERT INTO notifications (user_id, type, title, content, data)
        VALUES (?, 'friend_request', 'New Friend Request', ?, ?)
      `).bind(friendId, 'Someone wants to be your friend!', JSON.stringify({ fromUserId: session.userId })).run();
      
      return new Response(JSON.stringify({ friend }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'accept_request') {
      // Check if request exists
      const request = await env.DB.prepare(`
        SELECT * FROM friends
        WHERE user_id = ? AND friend_id = ? AND status = 'pending'
      `).bind(friendId, session.userId).first();
      
      if (!request) {
        return new Response(JSON.stringify({ error: 'Friend request not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Update both directions
      await env.DB.prepare(`
        UPDATE friends SET status = 'accepted', updated_at = NOW()
        WHERE user_id = ? AND friend_id = ?
      `).bind(friendId, session.userId).run();
      
      await env.DB.prepare(`
        INSERT INTO friends (user_id, friend_id, status)
        VALUES (?, ?, 'accepted')
        ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted', updated_at = NOW()
      `).bind(session.userId, friendId).run();
      
      // Update friend counts
      await env.DB.prepare(`
        UPDATE profiles SET friend_count = friend_count + 1 WHERE user_id = ?
      `).bind(session.userId).run();
      
      await env.DB.prepare(`
        UPDATE profiles SET friend_count = friend_count + 1 WHERE user_id = ?
      `).bind(friendId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'reject_request') {
      const result = await env.DB.prepare(`
        DELETE FROM friends
        WHERE user_id = ? AND friend_id = ? AND status = 'pending'
        RETURNING *
      `).bind(friendId, session.userId).first();
      
      if (!result) {
        return new Response(JSON.stringify({ error: 'Friend request not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'block') {
      // Check if friendship exists
      const existing = await env.DB.prepare(`
        SELECT * FROM friends WHERE user_id = ? AND friend_id = ?
      `).bind(session.userId, friendId).first();
      
      if (existing) {
        await env.DB.prepare(`
          UPDATE friends SET status = 'blocked', updated_at = NOW()
          WHERE user_id = ? AND friend_id = ?
        `).bind(session.userId, friendId).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO friends (user_id, friend_id, status)
          VALUES (?, ?, 'blocked')
        `).bind(session.userId, friendId).run();
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'unblock') {
      const result = await env.DB.prepare(`
        DELETE FROM friends
        WHERE user_id = ? AND friend_id = ? AND status = 'blocked'
        RETURNING *
      `).bind(session.userId, friendId).first();
      
      if (!result) {
        return new Response(JSON.stringify({ error: 'Block not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'unfriend') {
      const result = await env.DB.prepare(`
        DELETE FROM friends
        WHERE user_id = ? AND friend_id = ? AND status = 'accepted'
        RETURNING *
      `).bind(session.userId, friendId).first();
      
      if (!result) {
        return new Response(JSON.stringify({ error: 'Friendship not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Delete reverse friendship
      await env.DB.prepare(`
        DELETE FROM friends WHERE user_id = ? AND friend_id = ?
      `).bind(friendId, session.userId).run();
      
      // Update friend counts
      await env.DB.prepare(`
        UPDATE profiles SET friend_count = friend_count - 1 WHERE user_id = ?
      `).bind(session.userId).run();
      
      await env.DB.prepare(`
        UPDATE profiles SET friend_count = friend_count - 1 WHERE user_id = ?
      `).bind(friendId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Friends error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
