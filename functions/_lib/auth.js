// Authentication Library
// Integrated with main website authentication system

export async function verifySession(request, env) {
  try {
    // Get session token from cookie or header
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
    
    // Verify session in database
    const session = await env.DB.prepare(`
      SELECT s.*, u.id as user_id, u.email, u.username, u.display_name, u.avatar_url, u.banner_url, u.bio
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > NOW()
    `).bind(token).first();
    
    if (!session) {
      return null;
    }
    
    // Update last used time
    await env.DB.prepare(`
      UPDATE sessions SET last_used_at = NOW() WHERE id = ?
    `).bind(session.id).run();
    
    return {
      userId: session.user_id,
      email: session.email,
      username: session.username,
      displayName: session.display_name,
      avatar: session.avatar_url,
      banner: session.banner_url,
      bio: session.bio,
      sessionId: session.id
    };
    
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export async function createSession(env, userId, expiresIn = 30 * 24 * 60 * 60 * 1000) {
  try {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + expiresIn);
    
    const session = await env.DB.prepare(`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (?, ?, ?)
      RETURNING *
    `).bind(userId, token, expiresAt.toISOString()).first();
    
    return session;
  } catch (error) {
    console.error('Session creation error:', error);
    return null;
  }
}

export async function revokeSession(env, sessionId) {
  try {
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
    return true;
  } catch (error) {
    console.error('Session revocation error:', error);
    return false;
  }
}

export async function revokeAllUserSessions(env, userId) {
  try {
    await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
    return true;
  } catch (error) {
    console.error('Session revocation error:', error);
    return false;
  }
}

function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function checkPermission(env, userId, communityId, requiredRole) {
  try {
    const roleHierarchy = {
      'owner': 5,
      'admin': 4,
      'moderator': 3,
      'member': 2,
      'guest': 1
    };
    
    const member = await env.DB.prepare(`
      SELECT role FROM community_members
      WHERE community_id = ? AND user_id = ?
    `).bind(communityId, userId).first();
    
    if (!member) {
      return false;
    }
    
    const userRoleLevel = roleHierarchy[member.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
    
    return userRoleLevel >= requiredRoleLevel;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}
