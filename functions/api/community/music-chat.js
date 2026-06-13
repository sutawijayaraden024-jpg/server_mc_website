// Music from Chat Feature
// Allows adding audio files from chat to playlist

import { verifySession } from '../_lib/auth.js';
import { rateLimit } from '../_lib/rate-limit.js';

const musicChatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    
    const rateLimitResult = await musicChatRateLimit(env, request);
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
    
    const { action, attachmentId, playlistId, channelId } = body;
    
    if (action === 'add_to_playlist') {
      if (!attachmentId || !playlistId) {
        return new Response(JSON.stringify({ error: 'attachmentId and playlistId are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get attachment details
      const attachment = await env.DB.prepare(`
        SELECT * FROM attachments WHERE id = ?
      `).bind(attachmentId).first();
      
      if (!attachment) {
        return new Response(JSON.stringify({ error: 'Attachment not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (attachment.file_type !== 'audio') {
        return new Response(JSON.stringify({ error: 'Attachment is not an audio file' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check playlist ownership
      const playlist = await env.DB.prepare(`
        SELECT created_by, channel_id FROM playlists WHERE id = ?
      `).bind(playlistId).first();
      
      if (!playlist) {
        return new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (playlist.created_by !== session.userId) {
        return new Response(JSON.stringify({ error: 'Only playlist owner can add tracks' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Extract track info from attachment metadata
      const metadata = JSON.parse(attachment.metadata || '{}');
      const trackName = metadata.trackName || attachment.file_name;
      const artist = metadata.artist || 'Unknown';
      
      // Check if track already exists in playlist
      const existing = await env.DB.prepare(`
        SELECT id FROM playlist_tracks
        WHERE playlist_id = ? AND track_url = ?
      `).bind(playlistId, attachment.file_url).first();
      
      if (existing) {
        return new Response(JSON.stringify({ error: 'Track already in playlist' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get max position
      const maxPosition = await env.DB.prepare(`
        SELECT COALESCE(MAX(position), 0) as max_pos FROM playlist_tracks WHERE playlist_id = ?
      `).bind(playlistId).first();
      
      // Add to playlist
      const track = await env.DB.prepare(`
        INSERT INTO playlist_tracks (playlist_id, track_name, track_url, artist, added_by, position)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        playlistId,
        trackName,
        attachment.file_url,
        artist,
        session.userId,
        (maxPosition.max_pos || 0) + 1
      ).first();
      
      // Send notification about playlist update
      if (playlist.channel_id) {
        const channel = await env.DB.prepare(`
          SELECT name FROM channels WHERE id = ?
        `).bind(playlist.channel_id).first();
        
        await env.DB.prepare(`
          INSERT INTO notifications (user_id, type, title, content, data)
          VALUES (?, 'music_update', 'Playlist Updated', ?, ?)
        `).bind(
          session.userId,
          `New track added to playlist in #${channel.name}`,
          JSON.stringify({ playlistId, trackId: track.id })
        ).run();
      }
      
      return new Response(JSON.stringify({ track }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'create_playlist_from_audio') {
      if (!attachmentId || !channelId) {
        return new Response(JSON.stringify({ error: 'attachmentId and channelId are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get attachment details
      const attachment = await env.DB.prepare(`
        SELECT * FROM attachments WHERE id = ?
      `).bind(attachmentId).first();
      
      if (!attachment || attachment.file_type !== 'audio') {
        return new Response(JSON.stringify({ error: 'Invalid audio attachment' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get channel info
      const channel = await env.DB.prepare(`
        SELECT c.*, cm.community_id
        FROM channels c
        JOIN community_members cm ON c.community_id = cm.community_id
        WHERE c.id = ? AND cm.user_id = ?
      `).bind(channelId, session.userId).first();
      
      if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Create new playlist
      const metadata = JSON.parse(attachment.metadata || '{}');
      const playlistName = metadata.playlistName || 'New Playlist';
      
      const playlist = await env.DB.prepare(`
        INSERT INTO playlists (community_id, channel_id, name, description, created_by)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        channel.community_id,
        channelId,
        playlistName,
        'Created from chat attachment',
        session.userId
      ).first();
      
      // Add track to playlist
      const trackName = metadata.trackName || attachment.file_name;
      const artist = metadata.artist || 'Unknown';
      
      const track = await env.DB.prepare(`
        INSERT INTO playlist_tracks (playlist_id, track_name, track_url, artist, added_by, position)
        VALUES (?, ?, ?, ?, ?, 1)
        RETURNING *
      `).bind(playlist.id, trackName, attachment.file_url, artist, session.userId).first();
      
      return new Response(JSON.stringify({ playlist, track }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'get_audio_attachments') {
      if (!channelId) {
        return new Response(JSON.stringify({ error: 'channelId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check access to channel
      const channel = await env.DB.prepare(`
        SELECT c.id FROM channels c
        JOIN community_members cm ON c.community_id = cm.community_id
        WHERE c.id = ? AND cm.user_id = ?
      `).bind(channelId, session.userId).first();
      
      if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found or access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get audio attachments from channel
      const attachments = await env.DB.prepare(`
        SELECT a.*, m.created_at as message_created_at
        FROM attachments a
        JOIN messages m ON a.message_id = m.id
        WHERE m.channel_id = ? AND a.file_type = 'audio'
        ORDER BY a.uploaded_at DESC
        LIMIT 50
      `).bind(channelId).all();
      
      return new Response(JSON.stringify({ attachments }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Music chat error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
