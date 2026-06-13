// Sticker System API
// Handles sticker upload, sending, saving, and favoriting

import { verifySession } from '../../_lib/auth.js';
import { rateLimit } from '../../_lib/rate-limit.js';

const stickerRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

const ALLOWED_STICKER_TYPES = ['image/png', 'image/webp', 'image/gif'];
const MAX_STICKER_SIZE = 512 * 1024; // 512KB

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const stickerId = url.searchParams.get('id');
    const favorites = url.searchParams.get('favorites') === 'true';
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (stickerId) {
      // Get specific sticker
      const sticker = await env.DB.prepare(`
        SELECT s.*, u.username as uploaded_by_username
        FROM stickers s
        LEFT JOIN users u ON s.uploaded_by = u.id
        WHERE s.id = ?
      `).bind(stickerId).first();
      
      if (!sticker) {
        return new Response(JSON.stringify({ error: 'Sticker not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if user has saved/favorited this sticker
      const userSticker = await env.DB.prepare(`
        SELECT is_favorite FROM user_stickers
        WHERE user_id = ? AND sticker_id = ?
      `).bind(session.userId, stickerId).first();
      
      return new Response(JSON.stringify({ 
        sticker,
        isSaved: !!userSticker,
        isFavorite: userSticker?.is_favorite || false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (favorites) {
      // Get user's favorite stickers
      const stickers = await env.DB.prepare(`
        SELECT s.*, us.is_favorite
        FROM stickers s
        JOIN user_stickers us ON s.id = us.sticker_id
        WHERE us.user_id = ? AND us.is_favorite = true
        ORDER BY us.added_at DESC
      `).bind(session.userId).all();
      
      return new Response(JSON.stringify({ stickers }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get all available stickers
    const stickers = await env.DB.prepare(`
      SELECT s.*, u.username as uploaded_by_username
      FROM stickers s
      LEFT JOIN users u ON s.uploaded_by = u.id
      ORDER BY s.created_at DESC
      LIMIT 100
    `).all();
    
    return new Response(JSON.stringify({ stickers }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Stickers error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    const rateLimitResult = await stickerRateLimit(env, request);
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
    
    const body = await request.json();
    const { action, stickerId, name, tags } = body;
    
    if (action === 'upload') {
      const formData = await request.formData();
      const file = formData.get('file');
      const stickerName = formData.get('name');
      const stickerTags = formData.get('tags');
      
      if (!file || !stickerName) {
        return new Response(JSON.stringify({ error: 'file and name are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Validate file type
      if (!ALLOWED_STICKER_TYPES.includes(file.type)) {
        return new Response(JSON.stringify({ error: 'Invalid file type. Only PNG, WEBP, and GIF are allowed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Validate file size
      if (file.size > MAX_STICKER_SIZE) {
        return new Response(JSON.stringify({ error: `File too large. Maximum size is ${MAX_STICKER_SIZE / 1024}KB` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Determine if animated
      const isAnimated = file.type === 'image/gif';
      
      // Read file content
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const extension = file.name.split('.').pop();
      const fileName = `${timestamp}-${random}.${extension}`;
      
      // Upload to R2
      const key = `community/stickers/${fileName}`;
      await env.BUCKET.put(key, buffer, {
        httpMetadata: {
          contentType: file.type
        }
      });
      
      // Generate public URL
      const imageUrl = `${env.R2_PUBLIC_URL}/${key}`;
      
      // Parse tags
      const tagArray = stickerTags ? stickerTags.split(',').map(t => t.trim()) : [];
      
      // Save to database
      const sticker = await env.DB.prepare(`
        INSERT INTO stickers (name, image_url, tags, is_animated, uploaded_by)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
      `).bind(stickerName, imageUrl, JSON.stringify(tagArray), isAnimated, session.userId).first();
      
      // Add to user's stickers
      await env.DB.prepare(`
        INSERT INTO user_stickers (user_id, sticker_id, is_favorite)
        VALUES (?, ?, false)
      `).bind(session.userId, sticker.id).run();
      
      return new Response(JSON.stringify({ sticker }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'save') {
      if (!stickerId) {
        return new Response(JSON.stringify({ error: 'stickerId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if sticker exists
      const sticker = await env.DB.prepare(`
        SELECT id FROM stickers WHERE id = ?
      `).bind(stickerId).first();
      
      if (!sticker) {
        return new Response(JSON.stringify({ error: 'Sticker not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Add to user's stickers
      await env.DB.prepare(`
        INSERT INTO user_stickers (user_id, sticker_id, is_favorite)
        VALUES (?, ?, false)
        ON CONFLICT (user_id, sticker_id) DO NOTHING
      `).bind(session.userId, stickerId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'favorite') {
      if (!stickerId) {
        return new Response(JSON.stringify({ error: 'stickerId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if sticker exists
      const sticker = await env.DB.prepare(`
        SELECT id FROM stickers WHERE id = ?
      `).bind(stickerId).first();
      
      if (!sticker) {
        return new Response(JSON.stringify({ error: 'Sticker not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Add to user's stickers and mark as favorite
      await env.DB.prepare(`
        INSERT INTO user_stickers (user_id, sticker_id, is_favorite)
        VALUES (?, ?, true)
        ON CONFLICT (user_id, sticker_id) DO UPDATE SET is_favorite = true
      `).bind(session.userId, stickerId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'unfavorite') {
      if (!stickerId) {
        return new Response(JSON.stringify({ error: 'stickerId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await env.DB.prepare(`
        UPDATE user_stickers SET is_favorite = false
        WHERE user_id = ? AND sticker_id = ?
      `).bind(session.userId, stickerId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'unsave') {
      if (!stickerId) {
        return new Response(JSON.stringify({ error: 'stickerId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await env.DB.prepare(`
        DELETE FROM user_stickers WHERE user_id = ? AND sticker_id = ?
      `).bind(session.userId, stickerId).run();
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Stickers error:', error);
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
    const stickerId = url.pathname.split('/').pop();
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get sticker and check ownership
    const sticker = await env.DB.prepare(`
      SELECT * FROM stickers WHERE id = ?
    `).bind(stickerId).first();
    
    if (!sticker) {
      return new Response(JSON.stringify({ error: 'Sticker not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Only uploader can delete
    if (sticker.uploaded_by !== session.userId) {
      return new Response(JSON.stringify({ error: 'Only the uploader can delete this sticker' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete from storage
    const key = sticker.image_url.split('/').pop();
    try {
      await env.BUCKET.delete(`community/stickers/${key}`);
    } catch (e) {
      console.error('Failed to delete from storage:', e);
    }
    
    // Delete from database
    await env.DB.prepare(`DELETE FROM stickers WHERE id = ?`).bind(stickerId).run();
    
    // Delete from user_stickers
    await env.DB.prepare(`DELETE FROM user_stickers WHERE sticker_id = ?`).bind(stickerId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Sticker deletion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
