// Rate Limiting Library
// Implements token bucket rate limiting for API endpoints

export function rateLimit(options) {
  const { windowMs, max } = options;
  
  return async function(env, request) {
    try {
      const session = await getSessionFromRequest(request, env);
      const userId = session?.userId || request.headers.get('CF-Connecting-IP') || 'anonymous';
      const endpoint = new URL(request.url).pathname;
      
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      
      // Check existing rate limit record
      const existing = await env.DB.prepare(`
        SELECT * FROM rate_limits
        WHERE user_id = ? AND endpoint = ? AND window_start = ?
      `).bind(userId, endpoint, new Date(windowStart).toISOString()).first();
      
      if (existing) {
        if (existing.request_count >= max) {
          return {
            success: false,
            remaining: 0,
            resetAt: windowStart + windowMs
          };
        }
        
        // Increment count
        await env.DB.prepare(`
          UPDATE rate_limits
          SET request_count = request_count + 1
          WHERE id = ?
        `).bind(existing.id).run();
        
        return {
          success: true,
          remaining: max - existing.request_count - 1,
          resetAt: windowStart + windowMs
        };
      }
      
      // Create new rate limit record
      await env.DB.prepare(`
        INSERT INTO rate_limits (user_id, endpoint, request_count, window_start)
        VALUES (?, ?, 1, ?)
      `).bind(userId, endpoint, new Date(windowStart).toISOString()).run();
      
      return {
        success: true,
        remaining: max - 1,
        resetAt: windowStart + windowMs
      };
      
    } catch (error) {
      console.error('Rate limit error:', error);
      // On error, allow request to proceed
      return { success: true, remaining: max, resetAt: Date.now() + windowMs };
    }
  };
}

async function getSessionFromRequest(request, env) {
  try {
    const cookieHeader = request.headers.get('Cookie');
    const authHeader = request.headers.get('Authorization');
    
    let token = null;
    
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith('session='));
      if (sessionCookie) {
        token = sessionCookie.split('=')[1];
      }
    }
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (!token) {
      return null;
    }
    
    const session = await env.DB.prepare(`
      SELECT s.*, u.id as user_id
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > NOW()
    `).bind(token).first();
    
    return session;
  } catch (error) {
    return null;
  }
}

// Clean up old rate limit records
export async function cleanupRateLimits(env) {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`
      DELETE FROM rate_limits WHERE window_start < ?
    `).bind(oneHourAgo).run();
  } catch (error) {
    console.error('Rate limit cleanup error:', error);
  }
}
