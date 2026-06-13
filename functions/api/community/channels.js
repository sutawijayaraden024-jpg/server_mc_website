// Community Channels API
// Handles channel creation, management, and messages

import { verifySession } from '../../_lib/auth.js';
import { rateLimit } from '../../_lib/rate-limit.js';

const channelRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 50
});

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const communityId = url.searchParams.get('community_id');
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let query = `
      SELECT c.*, 
             COUNT(DISTINCT m.id) as message_count,
             MAX(m.created_at) as last_message_at
      FROM channels c
      LEFT JOIN messages m ON c.id = m.channel_id
    `;
    
    const params = [];
    
    if (communityId) {
      query += ` WHERE c.community_id = ?`;
      params.push(communityId);
    }
    
    // Check if user is member of community
    if (communityId) {
      const memberCheck = await env.DB.prepare(`
        SELECT id FROM community_members
        WHERE community_id = ? AND user_id = ?
      `).bind(communityId, session.userId).first();
      
      if (!memberCheck) {
        return new Response(JSON.stringify({ error: 'Not a member of this community' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    query += ` GROUP BY c.id ORDER BY c.position, c.created_at`;
    
    const channels = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({ channels }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Channels error:', error);
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
    
    const rateLimitResult = await channelRateLimit(env, request);
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
    
    const { communityId, name, type, category, isPrivate } = body;
    
    if (!communityId || !name) {
      return new Response(JSON.stringify({ error: 'community_id and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user has permission to create channel
    const member = await env.DB.prepare(`
      SELECT role FROM community_members
      WHERE community_id = ? AND user_id = ?
    `).bind(communityId, session.userId).first();
    
    if (!member || !['owner', 'admin', 'moderator'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get max position
    const maxPosition = await env.DB.prepare(`
      SELECT COALESCE(MAX(position), 0) as max_pos FROM channels WHERE community_id = ?
    `).bind(communityId).first();
    
    // Create channel
    const result = await env.DB.prepare(`
      INSERT INTO channels (community_id, name, type, category, position, is_private)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      communityId,
      name,
      type || 'text',
      category || null,
      (maxPosition.max_pos || 0) + 1,
      isPrivate || false
    ).first();
    
    return new Response(JSON.stringify({ channel: result }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Channel creation error:', error);
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
    const channelId = url.pathname.split('/').pop();
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get channel and check permissions
    const channel = await env.DB.prepare(`
      SELECT c.*, cm.role
      FROM channels c
      JOIN community_members cm ON c.community_id = cm.community_id
      WHERE c.id = ? AND cm.user_id = ?
    `).bind(channelId, session.userId).first();
    
    if (!channel) {
      return new Response(JSON.stringify({ error: 'Channel not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!['owner', 'admin'].includes(channel.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete channel (messages and attachments will be cascade deleted)
    await env.DB.prepare(`DELETE FROM channels WHERE id = ?`).bind(channelId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Channel deletion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
