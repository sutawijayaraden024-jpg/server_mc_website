// Community/Group Management API
// Handles community creation, management, and member operations

import { verifySession } from '../_lib/auth.js';
import { rateLimit } from '../_lib/rate-limit.js';

const communityRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const communityId = url.searchParams.get('id');
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (communityId) {
      // Get specific community
      const community = await env.DB.prepare(`
        SELECT c.*, 
               u.username as owner_username,
               u.display_name as owner_display_name,
               u.avatar_url as owner_avatar,
               COUNT(DISTINCT cm.user_id) as member_count
        FROM communities c
        JOIN users u ON c.owner_id = u.id
        LEFT JOIN community_members cm ON c.id = cm.community_id
        WHERE c.id = ?
        GROUP BY c.id, u.id
      `).bind(communityId).first();
      
      if (!community) {
        return new Response(JSON.stringify({ error: 'Community not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if user is member
      const member = await env.DB.prepare(`
        SELECT role FROM community_members
        WHERE community_id = ? AND user_id = ?
      `).bind(communityId, session.userId).first();
      
      if (!member) {
        return new Response(JSON.stringify({ error: 'Not a member of this community' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ 
        community,
        userRole: member.role 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get all communities user is member of
      const communities = await env.DB.prepare(`
        SELECT c.*, cm.role, cm.joined_at,
               COUNT(DISTINCT cm2.user_id) as member_count
        FROM communities c
        JOIN community_members cm ON c.id = cm.community_id
        LEFT JOIN community_members cm2 ON c.id = cm2.community_id
        WHERE cm.user_id = ?
        GROUP BY c.id, cm.id
        ORDER BY cm.joined_at DESC
      `).bind(session.userId).all();
      
      return new Response(JSON.stringify({ communities }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('Communities error:', error);
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
    
    const rateLimitResult = await communityRateLimit(env, request);
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
    
    const { name, description, iconUrl, bannerUrl } = body;
    
    if (!name) {
      return new Response(JSON.stringify({ error: 'name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create community
    const community = await env.DB.prepare(`
      INSERT INTO communities (name, description, icon_url, banner_url, owner_id)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `).bind(name, description || null, iconUrl || null, bannerUrl || null, session.userId).first();
    
    // Add owner as member
    await env.DB.prepare(`
      INSERT INTO community_members (community_id, user_id, role)
      VALUES (?, ?, 'owner')
    `).bind(community.id, session.userId).run();
    
    // Create default channels
    const defaultChannels = [
      { name: 'rules', type: 'text', category: 'INFORMASI SERVER', position: 1 },
      { name: 'pengumuman', type: 'text', category: 'INFORMASI SERVER', position: 2 },
      { name: 'chat-umum', type: 'text', category: 'TEKS CHANNEL', position: 3 },
      { name: 'diskusi', type: 'text', category: 'TEKS CHANNEL', position: 4 },
      { name: 'media', type: 'text', category: 'TEKS CHANNEL', position: 5 },
      { name: 'minecraft-chat', type: 'text', category: 'MINECRAFT', position: 6 },
      { name: 'build-showcase', type: 'text', category: 'MINECRAFT', position: 7 },
      { name: 'music-lounge', type: 'music', category: 'MUSIC ROOM', position: 8 },
      { name: 'chill-vibes', type: 'music', category: 'MUSIC ROOM', position: 9 },
      { name: 'support', type: 'text', category: 'BANTUAN', position: 10 },
      { name: 'faq', type: 'text', category: 'BANTUAN', position: 11 }
    ];
    
    for (const channel of defaultChannels) {
      await env.DB.prepare(`
        INSERT INTO channels (community_id, name, type, category, position)
        VALUES (?, ?, ?, ?, ?)
      `).bind(community.id, channel.name, channel.type, channel.category, channel.position).run();
    }
    
    return new Response(JSON.stringify({ community }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Community creation error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPatch(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const communityId = url.pathname.split('/').pop();
    const body = await request.json();
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user is owner or admin
    const member = await env.DB.prepare(`
      SELECT role FROM community_members
      WHERE community_id = ? AND user_id = ?
    `).bind(communityId, session.userId).first();
    
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update community
    const { name, description, iconUrl, bannerUrl } = body;
    
    await env.DB.prepare(`
      UPDATE communities
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          icon_url = COALESCE(?, icon_url),
          banner_url = COALESCE(?, banner_url),
          updated_at = NOW()
      WHERE id = ?
    `).bind(name || null, description || null, iconUrl || null, bannerUrl || null, communityId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Community update error:', error);
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
    const communityId = url.pathname.split('/').pop();
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user is owner
    const community = await env.DB.prepare(`
      SELECT owner_id FROM communities WHERE id = ?
    `).bind(communityId).first();
    
    if (!community) {
      return new Response(JSON.stringify({ error: 'Community not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (community.owner_id !== session.userId) {
      return new Response(JSON.stringify({ error: 'Only owner can delete community' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete community (cascade will handle related records)
    await env.DB.prepare(`DELETE FROM communities WHERE id = ?`).bind(communityId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Community deletion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
