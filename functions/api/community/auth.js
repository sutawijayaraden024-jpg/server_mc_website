// Community Authentication API
// Integrated with main website authentication system

import { verifySession } from '../_lib/auth.js';
import { rateLimit } from '../_lib/rate-limit.js';

// Rate limiting: 100 requests per minute per user
const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
    // Check if user is authenticated from main website
    const session = await verifySession(request, env);
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get user profile from main website database
    const user = await env.DB.prepare(`
      SELECT id, email, username, display_name, avatar_url, banner_url, bio, created_at
      FROM users
      WHERE id = ?
    `).bind(session.userId).first();
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get community profile
    const profile = await env.DB.prepare(`
      SELECT status, custom_status, last_seen_at, message_count, friend_count
      FROM profiles
      WHERE user_id = ?
    `).bind(user.id).first();
    
    return new Response(JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar_url,
        banner: user.banner_url,
        bio: user.bio,
        createdAt: user.created_at
      },
      profile: profile || {
        status: 'online',
        customStatus: null,
        lastSeenAt: new Date().toISOString(),
        messageCount: 0,
        friendCount: 0
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Auth error:', error);
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
    
    // Rate limiting
    const rateLimitResult = await authRateLimit(env, request);
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify session from main website
    const session = await verifySession(request, env);
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update profile
    const { status, customStatus } = body;
    
    if (status && !['online', 'idle', 'do_not_disturb', 'offline'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update or create profile
    const existingProfile = await env.DB.prepare(`
      SELECT id FROM profiles WHERE user_id = ?
    `).bind(session.userId).first();
    
    if (existingProfile) {
      await env.DB.prepare(`
        UPDATE profiles
        SET status = COALESCE(?, status),
            custom_status = COALESCE(?, custom_status),
            last_seen_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ?
      `).bind(status || null, customStatus || null, session.userId).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO profiles (user_id, status, custom_status, last_seen_at)
        VALUES (?, ?, ?, NOW())
      `).bind(session.userId, status || 'online', customStatus || null).run();
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Auth update error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
