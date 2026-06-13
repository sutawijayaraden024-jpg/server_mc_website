// Emoji System API
// Handles custom server emoji upload and management

import { verifySession } from '../../_lib/auth.js';
import { rateLimit } from '../../_lib/rate-limit.js';

const emojiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

const ALLOWED_EMOJI_TYPES = ['image/png', 'image/webp', 'image/gif'];
const MAX_EMOJI_SIZE = 256 * 1024; // 256KB

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const communityId = url.searchParams.get('community_id');
    const emojiId = url.searchParams.get('id');
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (emojiId) {
      // Get specific emoji
      const emoji = await env.DB.prepare(`
        SELECT e.*, u.username as created_by_username
        FROM custom_emojis e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.id = ?
      `).bind(emojiId).first();
      
      if (!emoji) {
        return new Response(JSON.stringify({ error: 'Emoji not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ emoji }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (communityId) {
      // Get all emojis for community
      const emojis = await env.DB.prepare(`
        SELECT e.*, u.username as created_by_username
        FROM custom_emojis e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.community_id = ?
        ORDER BY e.created_at DESC
      `).bind(communityId).all();
      
      return new Response(JSON.stringify({ emojis }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get all emojis from user's communities
    const communities = await env.DB.prepare(`
      SELECT community_id FROM community_members WHERE user_id = ?
    `).bind(session.userId).all();
    
    if (communities.length === 0) {
      return new Response(JSON.stringify({ emojis: [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const communityIds = communities.map(c => c.community_id);
    const emojis = await env.DB.prepare(`
      SELECT e.*, u.username as created_by_username
      FROM custom_emojis e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.community_id IN (${communityIds.map(() => '?').join(',')})
      ORDER BY e.created_at DESC
    `).bind(...communityIds).all();
    
    return new Response(JSON.stringify({ emojis }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Emojis error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    const rateLimitResult = await emojiRateLimit(env, request);
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
    
    const formData = await request.formData();
    const file = formData.get('file');
    const communityId = formData.get('community_id');
    const name = formData.get('name');
    
    if (!file || !communityId || !name) {
      return new Response(JSON.stringify({ error: 'file, community_id, and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate emoji name (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return new Response(JSON.stringify({ error: 'Emoji name must be alphanumeric with underscores only' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user has permission to upload emoji
    const member = await env.DB.prepare(`
      SELECT role FROM community_members
      WHERE community_id = ? AND user_id = ?
    `).bind(communityId, session.userId).first();
    
    if (!member || !['owner', 'admin', 'moderator'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions to upload emoji' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate file type
    if (!ALLOWED_EMOJI_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Only PNG, WEBP, and GIF are allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate file size
    if (file.size > MAX_EMOJI_SIZE) {
      return new Response(JSON.stringify({ error: `File too large. Maximum size is ${MAX_EMOJI_SIZE / 1024}KB` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if emoji name already exists in community
    const existing = await env.DB.prepare(`
      SELECT id FROM custom_emojis WHERE community_id = ? AND name = ?
    `).bind(communityId, name).first();
    
    if (existing) {
      return new Response(JSON.stringify({ error: 'Emoji name already exists in this community' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const fileName = `${timestamp}-${random}.${extension}`;
    
    // Upload to R2
    const key = `community/emojis/${fileName}`;
    await env.BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: file.type
      }
    });
    
    // Generate public URL
    const imageUrl = `${env.R2_PUBLIC_URL}/${key}`;
    
    // Save to database
    const emoji = await env.DB.prepare(`
      INSERT INTO custom_emojis (community_id, name, image_url, created_by)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `).bind(communityId, name, imageUrl, session.userId).first();
    
    return new Response(JSON.stringify({ emoji }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Emoji upload error:', error);
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
    const emojiId = url.pathname.split('/').pop();
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get emoji and check permission
    const emoji = await env.DB.prepare(`
      SELECT e.*, cm.role
      FROM custom_emojis e
      JOIN community_members cm ON e.community_id = cm.community_id
      WHERE e.id = ? AND cm.user_id = ?
    `).bind(emojiId, session.userId).first();
    
    if (!emoji) {
      return new Response(JSON.stringify({ error: 'Emoji not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Only owner, admin, or creator can delete
    if (!['owner', 'admin'].includes(emoji.role) && emoji.created_by !== session.userId) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete from storage
    const key = emoji.image_url.split('/').pop();
    try {
      await env.BUCKET.delete(`community/emojis/${key}`);
    } catch (e) {
      console.error('Failed to delete from storage:', e);
    }
    
    // Delete from database
    await env.DB.prepare(`DELETE FROM custom_emojis WHERE id = ?`).bind(emojiId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Emoji deletion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
