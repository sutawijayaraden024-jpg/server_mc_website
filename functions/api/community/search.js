// Search API
// Handles search for messages, members, files, audio, video, links, stickers

import { verifySession } from '../_lib/auth.js';
import { rateLimit } from '../_lib/rate-limit.js';

const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type') || 'all'; // all, messages, members, files, audio, video, links, stickers
    const communityId = url.searchParams.get('community_id');
    const channelId = url.searchParams.get('channel_id');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ error: 'Query must be at least 2 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const results = {};
    const searchPattern = `%${query}%`;
    
    if (type === 'all' || type === 'messages') {
      let messageQuery = `
        SELECT m.*, c.name as channel_name, u.username, u.display_name, u.avatar_url
        FROM messages m
        JOIN channels c ON m.channel_id = c.id
        JOIN users u ON m.user_id = u.id
        WHERE m.content ILIKE ?
      `;
      const params = [searchPattern];
      
      if (communityId) {
        messageQuery += ` AND c.community_id = ?`;
        params.push(communityId);
      }
      
      if (channelId) {
        messageQuery += ` AND m.channel_id = ?`;
        params.push(channelId);
      }
      
      messageQuery += ` ORDER BY m.created_at DESC LIMIT ?`;
      params.push(limit);
      
      results.messages = await env.DB.prepare(messageQuery).bind(...params).all();
    }
    
    if (type === 'all' || type === 'members') {
      let memberQuery = `
        SELECT u.*, p.status, p.custom_status
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.username ILIKE ? OR u.display_name ILIKE ?
      `;
      const params = [searchPattern, searchPattern];
      
      if (communityId) {
        memberQuery += ` AND u.id IN (SELECT user_id FROM community_members WHERE community_id = ?)`;
        params.push(communityId);
      }
      
      memberQuery += ` LIMIT ?`;
      params.push(limit);
      
      results.members = await env.DB.prepare(memberQuery).bind(...params).all();
    }
    
    if (type === 'all' || type === 'files' || type === 'audio' || type === 'video') {
      let fileQuery = `
        SELECT a.*, u.username as uploader_username
        FROM attachments a
        LEFT JOIN users u ON a.uploaded_by = u.id
        WHERE a.file_name ILIKE ?
      `;
      const params = [searchPattern];
      
      if (type === 'audio') {
        fileQuery += ` AND a.file_type = 'audio'`;
      } else if (type === 'video') {
        fileQuery += ` AND a.file_type = 'video'`;
      } else if (type === 'files') {
        fileQuery += ` AND a.file_type IN ('image', 'document')`;
      }
      
      if (communityId) {
        fileQuery += ` AND a.message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE community_id = ?))`;
        params.push(communityId);
      }
      
      fileQuery += ` ORDER BY a.uploaded_at DESC LIMIT ?`;
      params.push(limit);
      
      results.files = await env.DB.prepare(fileQuery).bind(...params).all();
    }
    
    if (type === 'all' || type === 'links') {
      // Search for URLs in messages
      let linkQuery = `
        SELECT m.*, c.name as channel_name, u.username, u.display_name
        FROM messages m
        JOIN channels c ON m.channel_id = c.id
        JOIN users u ON m.user_id = u.id
        WHERE m.content ILIKE ? AND m.content ILIKE '%http%'
      `;
      const params = [searchPattern];
      
      if (communityId) {
        linkQuery += ` AND c.community_id = ?`;
        params.push(communityId);
      }
      
      linkQuery += ` ORDER BY m.created_at DESC LIMIT ?`;
      params.push(limit);
      
      results.links = await env.DB.prepare(linkQuery).bind(...params).all();
    }
    
    if (type === 'all' || type === 'stickers') {
      const stickerQuery = `
        SELECT s.*, u.username as uploaded_by_username
        FROM stickers s
        LEFT JOIN users u ON s.uploaded_by = u.id
        WHERE s.name ILIKE ? OR ? = ANY(s.tags)
        ORDER BY s.created_at DESC
        LIMIT ?
      `;
      
      results.stickers = await env.DB.prepare(stickerQuery).bind(searchPattern, searchPattern, limit).all();
    }
    
    return new Response(JSON.stringify({ results, query, type }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
