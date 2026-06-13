// Music Room API
// Handles playlist management, track upload, and playback

import { verifySession } from '../../_lib/auth.js';
import { rateLimit } from '../../_lib/rate-limit.js';

const musicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const playlistId = url.searchParams.get('playlist_id');
    const channelId = url.searchParams.get('channel_id');
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (playlistId) {
      // Get specific playlist with tracks
      const playlist = await env.DB.prepare(`
        SELECT p.*, u.username as created_by_username
        FROM playlists p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `).bind(playlistId).first();
      
      if (!playlist) {
        return new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const tracks = await env.DB.prepare(`
        SELECT * FROM playlist_tracks
        WHERE playlist_id = ?
        ORDER BY position ASC
      `).bind(playlistId).all();
      
      return new Response(JSON.stringify({ playlist, tracks }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (channelId) {
      // Get playlists for channel
      const playlists = await env.DB.prepare(`
        SELECT p.*, COUNT(pt.id) as track_count
        FROM playlists p
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
        WHERE p.channel_id = ? AND p.is_public = true
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `).bind(channelId).all();
      
      return new Response(JSON.stringify({ playlists }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get user's playlists
      const playlists = await env.DB.prepare(`
        SELECT p.*, COUNT(pt.id) as track_count
        FROM playlists p
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
        WHERE p.created_by = ?
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `).bind(session.userId).all();
      
      return new Response(JSON.stringify({ playlists }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('Music error:', error);
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
    
    const rateLimitResult = await musicRateLimit(env, request);
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
    
    const { action, playlistId, channelId, name, description, coverUrl, trackUrl, trackName, artist, album, duration } = body;
    
    if (action === 'create_playlist') {
      if (!name) {
        return new Response(JSON.stringify({ error: 'name is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playlist = await env.DB.prepare(`
        INSERT INTO playlists (community_id, channel_id, name, description, cover_url, is_public, created_by)
        VALUES (?, ?, ?, ?, ?, true, ?)
        RETURNING *
      `).bind(null, channelId || null, name, description || null, coverUrl || null, session.userId).first();
      
      return new Response(JSON.stringify({ playlist }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'add_track') {
      if (!playlistId || !trackUrl || !trackName) {
        return new Response(JSON.stringify({ error: 'playlist_id, trackUrl, and trackName are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if user has permission to add to playlist
      const playlist = await env.DB.prepare(`
        SELECT created_by FROM playlists WHERE id = ?
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
      
      // Get max position
      const maxPosition = await env.DB.prepare(`
        SELECT COALESCE(MAX(position), 0) as max_pos FROM playlist_tracks WHERE playlist_id = ?
      `).bind(playlistId).first();
      
      const track = await env.DB.prepare(`
        INSERT INTO playlist_tracks (playlist_id, track_name, track_url, duration, artist, album, cover_url, added_by, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        playlistId,
        trackName,
        trackUrl,
        duration || null,
        artist || null,
        album || null,
        coverUrl || null,
        session.userId,
        (maxPosition.max_pos || 0) + 1
      ).first();
      
      return new Response(JSON.stringify({ track }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'remove_track') {
      const trackId = body.trackId;
      if (!trackId) {
        return new Response(JSON.stringify({ error: 'trackId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check permission
      const track = await env.DB.prepare(`
        SELECT pt.*, p.created_by as playlist_owner
        FROM playlist_tracks pt
        JOIN playlists p ON pt.playlist_id = p.id
        WHERE pt.id = ?
      `).bind(trackId).first();
      
      if (!track) {
        return new Response(JSON.stringify({ error: 'Track not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (track.playlist_owner !== session.userId) {
        return new Response(JSON.stringify({ error: 'Only playlist owner can remove tracks' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await env.DB.prepare(`DELETE FROM playlist_tracks WHERE id = ?`).bind(trackId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Music error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPatch(context) {
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
    
    const { action, playlistId, trackId, name, description, coverUrl, position } = body;
    
    if (action === 'update_playlist') {
      if (!playlistId) {
        return new Response(JSON.stringify({ error: 'playlistId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check permission
      const playlist = await env.DB.prepare(`
        SELECT created_by FROM playlists WHERE id = ?
      `).bind(playlistId).first();
      
      if (!playlist || playlist.created_by !== session.userId) {
        return new Response(JSON.stringify({ error: 'Playlist not found or permission denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await env.DB.prepare(`
        UPDATE playlists
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            cover_url = COALESCE(?, cover_url),
            updated_at = NOW()
        WHERE id = ?
      `).bind(name || null, description || null, coverUrl || null, playlistId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'reorder_tracks') {
      if (!trackId || position === undefined) {
        return new Response(JSON.stringify({ error: 'trackId and position are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check permission
      const track = await env.DB.prepare(`
        SELECT pt.*, p.created_by as playlist_owner
        FROM playlist_tracks pt
        JOIN playlists p ON pt.playlist_id = p.id
        WHERE pt.id = ?
      `).bind(trackId).first();
      
      if (!track || track.playlist_owner !== session.userId) {
        return new Response(JSON.stringify({ error: 'Track not found or permission denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await env.DB.prepare(`
        UPDATE playlist_tracks SET position = ? WHERE id = ?
      `).bind(position, trackId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Music update error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
