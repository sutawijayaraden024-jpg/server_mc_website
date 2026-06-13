// Link Preview API
// Handles fetching and caching link previews for URLs in messages

import { verifySession } from '../_lib/auth.js';
import { rateLimit } from '../_lib/rate-limit.js';

const linkPreviewRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'url parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check cache
    const cached = await env.DB.prepare(`
      SELECT * FROM link_previews WHERE url = ?
    `).bind(targetUrl).first();
    
    if (cached) {
      // Return cached if less than 24 hours old
      const cacheAge = Date.now() - new Date(cached.fetched_at).getTime();
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({
          url: cached.url,
          title: cached.title,
          description: cached.description,
          image: cached.image_url,
          siteName: cached.site_name
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Fetch new preview
    const preview = await fetchLinkPreview(targetUrl, env);
    
    // Cache the result
    if (preview) {
      await env.DB.prepare(`
        INSERT INTO link_previews (url, title, description, image_url, site_name, fetched_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON CONFLICT (url) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          site_name = EXCLUDED.site_name,
          fetched_at = NOW()
      `).bind(
        targetUrl,
        preview.title || null,
        preview.description || null,
        preview.image || null,
        preview.siteName || null
      ).run();
    }
    
    return new Response(JSON.stringify(preview || { error: 'Failed to fetch preview' }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Link preview error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function fetchLinkPreview(url, env) {
  try {
    // Use a proxy service to fetch the page (to avoid CORS)
    const proxyUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    return {
      url: url,
      title: data.data?.title,
      description: data.data?.description,
      image: data.data?.image?.url,
      siteName: data.data?.publisher?.name
    };
    
  } catch (error) {
    console.error('Failed to fetch link preview:', error);
    return null;
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    
    const rateLimitResult = await linkPreviewRateLimit(env, request);
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
    
    const { urls } = body;
    
    if (!urls || !Array.isArray(urls)) {
      return new Response(JSON.stringify({ error: 'urls array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const previews = {};
    
    for (const url of urls) {
      try {
        new URL(url);
        
        // Check cache
        const cached = await env.DB.prepare(`
          SELECT * FROM link_previews WHERE url = ?
        `).bind(url).first();
        
        if (cached) {
          const cacheAge = Date.now() - new Date(cached.fetched_at).getTime();
          if (cacheAge < 24 * 60 * 60 * 1000) {
            previews[url] = {
              url: cached.url,
              title: cached.title,
              description: cached.description,
              image: cached.image_url,
              siteName: cached.site_name
            };
            continue;
          }
        }
        
        // Fetch new preview
        const preview = await fetchLinkPreview(url, env);
        
        if (preview) {
          previews[url] = preview;
          
          // Cache
          await env.DB.prepare(`
            INSERT INTO link_previews (url, title, description, image_url, site_name, fetched_at)
            VALUES (?, ?, ?, ?, ?, NOW())
            ON CONFLICT (url) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              image_url = EXCLUDED.image_url,
              site_name = EXCLUDED.site_name,
              fetched_at = NOW()
          `).bind(
            url,
            preview.title || null,
            preview.description || null,
            preview.image || null,
            preview.siteName || null
          ).run();
        }
        
      } catch (error) {
        console.error('Failed to process URL:', url, error);
        previews[url] = null;
      }
    }
    
    return new Response(JSON.stringify({ previews }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Batch link preview error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
