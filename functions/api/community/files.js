// Files API
// Handles file uploads, storage, and metadata tracking

import { verifySession } from '../../_lib/auth.js';
import { rateLimit } from '../../_lib/rate-limit.js';

const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

// Allowed file types and their MIME types
const ALLOWED_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/flac'],
  document: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  sticker: ['image/png', 'image/webp', 'image/gif']
};

// Maximum file sizes (in bytes)
const MAX_SIZES = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 50 * 1024 * 1024, // 50MB
  document: 25 * 1024 * 1024, // 25MB
  sticker: 2 * 1024 * 1024 // 2MB
};

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const messageId = url.searchParams.get('message_id');
    const type = url.searchParams.get('type');
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let query = `
      SELECT a.*, u.username as uploader_username
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
    `;
    const params = [];
    
    if (messageId) {
      query += ` WHERE a.message_id = ?`;
      params.push(messageId);
    }
    
    if (type) {
      query += messageId ? ` AND a.file_type = ?` : ` WHERE a.file_type = ?`;
      params.push(type);
    }
    
    query += ` ORDER BY a.uploaded_at DESC`;
    
    const files = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({ files }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Files error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    const rateLimitResult = await uploadRateLimit(env, request);
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
    const messageId = formData.get('message_id');
    const fileType = formData.get('file_type');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!fileType || !ALLOWED_TYPES[fileType]) {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate MIME type
    const mimeType = file.type;
    if (!ALLOWED_TYPES[fileType].includes(mimeType)) {
      return new Response(JSON.stringify({ error: 'Invalid MIME type for this file type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate file size
    const maxSize = MAX_SIZES[fileType];
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ 
        error: `File too large. Maximum size for ${fileType} is ${maxSize / (1024 * 1024)}MB` 
      }), {
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
    
    // Upload to R2 (or similar storage)
    const key = `community/${fileType}/${fileName}`;
    await env.BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: mimeType
      }
    });
    
    // Generate public URL
    const fileUrl = `${env.R2_PUBLIC_URL}/${key}`;
    
    // Save to database
    const attachment = await env.DB.prepare(`
      INSERT INTO attachments (message_id, file_name, file_url, file_type, file_size, mime_type, metadata, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      messageId || null,
      file.name,
      fileUrl,
      fileType,
      file.size,
      mimeType,
      JSON.stringify({ originalName: file.name }),
      session.userId
    ).first();
    
    return new Response(JSON.stringify({ attachment }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('File upload error:', error);
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
    const fileId = url.pathname.split('/').pop();
    
    const session = await verifySession(request, env);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get file and check permission
    const attachment = await env.DB.prepare(`
      SELECT * FROM attachments WHERE id = ?
    `).bind(fileId).first();
    
    if (!attachment) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user is uploader or has permission
    if (attachment.uploaded_by !== session.userId) {
      // Check if user is admin/mod in the community
      const message = await env.DB.prepare(`
        SELECT m.*, cm.role
        FROM messages m
        JOIN channels c ON m.channel_id = c.id
        JOIN community_members cm ON c.community_id = cm.community_id
        WHERE m.id = ? AND cm.user_id = ?
      `).bind(attachment.message_id, session.userId).first();
      
      if (!message || !['admin', 'moderator'].includes(message.role)) {
        return new Response(JSON.stringify({ error: 'Permission denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Delete from storage
    const key = attachment.file_url.split('/').pop();
    try {
      await env.BUCKET.delete(`community/${attachment.file_type}/${key}`);
    } catch (e) {
      console.error('Failed to delete from storage:', e);
    }
    
    // Delete from database
    await env.DB.prepare(`DELETE FROM attachments WHERE id = ?`).bind(fileId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('File deletion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
