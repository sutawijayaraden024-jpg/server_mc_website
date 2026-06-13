// WebSocket Server for Real-time Chat
// Handles real-time message delivery, online status, and notifications

export async function onRequest(context) {
  const { request, env } = context;
  
  // Upgrade to WebSocket
  if (request.headers.get('Upgrade') === 'websocket') {
    return handleWebSocket(request, env);
  }
  
  return new Response('Expected WebSocket connection', { status: 400 });
}

async function handleWebSocket(request, env) {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  
  server.accept();
  
  // Store connection
  const userId = request.headers.get('X-User-ID');
  const sessionId = request.headers.get('X-Session-ID');
  
  if (!userId || !sessionId) {
    server.close(1008, 'Authentication required');
    return new Response(null, { status: 101, webSocket: client });
  }
  
  // Verify session
  const session = await env.DB.prepare(`
    SELECT * FROM sessions WHERE id = ? AND user_id = ? AND expires_at > NOW()
  `).bind(sessionId, userId).first();
  
  if (!session) {
    server.close(1008, 'Invalid session');
    return new Response(null, { status: 101, webSocket: client });
  }
  
  // Store connection in Durable Object or KV
  await env.WEBSOCKETS.put(userId, JSON.stringify({
    connected: true,
    connectedAt: Date.now()
  }));
  
  // Update user status to online
  await env.DB.prepare(`
    UPDATE profiles SET status = 'online', last_seen_at = NOW() WHERE user_id = ?
  `).bind(userId).run();
  
  // Broadcast user online status
  await broadcastStatus(env, userId, 'online');
  
  // Handle messages from client
  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'message':
          await handleNewMessage(env, userId, data);
          break;
        case 'typing':
          await handleTyping(env, userId, data);
          break;
        case 'status_update':
          await handleStatusUpdate(env, userId, data);
          break;
        case 'join_channel':
          await handleJoinChannel(env, userId, data);
          break;
        case 'leave_channel':
          await handleLeaveChannel(env, userId, data);
          break;
        case 'music_control':
          await handleMusicControl(env, userId, data);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      server.send(JSON.stringify({ error: 'Failed to process message' }));
    }
  });
  
  // Handle connection close
  server.addEventListener('close', async () => {
    await env.WEBSOCKETS.delete(userId);
    
    // Update user status to offline
    await env.DB.prepare(`
      UPDATE profiles SET status = 'offline', last_seen_at = NOW() WHERE user_id = ?
    `).bind(userId).run();
    
    // Broadcast user offline status
    await broadcastStatus(env, userId, 'offline');
  });
  
  // Send initial data
  server.send(JSON.stringify({
    type: 'connected',
    userId,
    timestamp: Date.now()
  }));
  
  return new Response(null, { status: 101, webSocket: client });
}

async function handleNewMessage(env, userId, data) {
  const { channelId, content, attachments, replyTo } = data;
  
  // Verify user has access to channel
  const channel = await env.DB.prepare(`
    SELECT c.*, cm.role
    FROM channels c
    JOIN community_members cm ON c.community_id = cm.community_id
    WHERE c.id = ? AND cm.user_id = ?
  `).bind(channelId, userId).first();
  
  if (!channel) {
    return;
  }
  
  // Create message
  const message = await env.DB.prepare(`
    INSERT INTO messages (channel_id, user_id, content, reply_to_id)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `).bind(channelId, userId, content, replyTo || null).first();
  
  // Get user info
  const user = await env.DB.prepare(`
    SELECT username, display_name, avatar_url FROM users WHERE id = ?
  `).bind(userId).first();
  
  // Broadcast to channel members
  await broadcastToChannel(env, channelId, {
    type: 'new_message',
    message: {
      id: message.id,
      channelId: message.channel_id,
      userId: message.user_id,
      username: user.username,
      displayName: user.display_name,
      avatar: user.avatar_url,
      content: message.content,
      replyTo: message.reply_to_id,
      createdAt: message.created_at,
      isEdited: message.is_edited
    },
    attachments: attachments || []
  });
  
  // Check for mentions and send notifications
  const mentions = content.match(/@(\w+)/g) || [];
  for (const mention of mentions) {
    const username = mention.substring(1);
    const mentionedUser = await env.DB.prepare(`
      SELECT id FROM users WHERE username = ?
    `).bind(username).first();
    
    if (mentionedUser) {
      await env.DB.prepare(`
        INSERT INTO notifications (user_id, type, title, content, data)
        VALUES (?, 'mention', 'You were mentioned', ?, ?)
      `).bind(
        mentionedUser.id,
        `${user.display_name || user.username} mentioned you in #${channel.name}`,
        JSON.stringify({ messageId: message.id, channelId, userId })
      ).run();
      
      // Send notification via WebSocket
      await sendToUser(env, mentionedUser.id, {
        type: 'notification',
        notification: {
          type: 'mention',
          title: 'You were mentioned',
          content: `${user.display_name || user.username} mentioned you in #${channel.name}`,
          data: { messageId: message.id, channelId }
        }
      });
    }
  }
  
  // Update message count
  await env.DB.prepare(`
    UPDATE profiles SET message_count = message_count + 1 WHERE user_id = ?
  `).bind(userId).run();
}

async function handleTyping(env, userId, data) {
  const { channelId } = data;
  
  await broadcastToChannel(env, channelId, {
    type: 'typing',
    userId,
    channelId
  }, userId); // Exclude sender
}

async function handleStatusUpdate(env, userId, data) {
  const { status } = data;
  
  if (!['online', 'idle', 'do_not_disturb', 'offline'].includes(status)) {
    return;
  }
  
  await env.DB.prepare(`
    UPDATE profiles SET status = ?, last_seen_at = NOW() WHERE user_id = ?
  `).bind(status, userId).run();
  
  await broadcastStatus(env, userId, status);
}

async function handleJoinChannel(env, userId, data) {
  const { channelId } = data;
  
  // Verify access
  const channel = await env.DB.prepare(`
    SELECT c.id FROM channels c
    JOIN community_members cm ON c.community_id = cm.community_id
    WHERE c.id = ? AND cm.user_id = ?
  `).bind(channelId, userId).first();
  
  if (!channel) {
    return;
  }
  
  await broadcastToChannel(env, channelId, {
    type: 'user_joined',
    userId,
    channelId
  }, userId);
}

async function handleLeaveChannel(env, userId, data) {
  const { channelId } = data;
  
  await broadcastToChannel(env, channelId, {
    type: 'user_left',
    userId,
    channelId
  }, userId);
}

async function handleMusicControl(env, userId, data) {
  const { channelId, action, trackId, position } = data;
  
  await broadcastToChannel(env, channelId, {
    type: 'music_control',
    userId,
    channelId,
    action,
    trackId,
    position
  }, userId);
}

async function broadcastToChannel(env, channelId, message, excludeUserId = null) {
  // Get all users in the channel's community
  const users = await env.DB.prepare(`
    SELECT DISTINCT cm.user_id
    FROM community_members cm
    JOIN channels c ON cm.community_id = c.community_id
    WHERE c.id = ?
  `).bind(channelId).all();
  
  for (const user of users) {
    if (excludeUserId && user.user_id === excludeUserId) {
      continue;
    }
    
    await sendToUser(env, user.user_id, message);
  }
}

async function broadcastStatus(env, userId, status) {
  // Get user's friends
  const friends = await env.DB.prepare(`
    SELECT friend_id FROM friends
    WHERE user_id = ? AND status = 'accepted'
  `).bind(userId).all();
  
  // Get user's communities
  const communities = await env.DB.prepare(`
    SELECT DISTINCT community_id FROM community_members WHERE user_id = ?
  `).bind(userId).all();
  
  // Get all members of user's communities
  const communityMembers = await env.DB.prepare(`
    SELECT DISTINCT user_id FROM community_members
    WHERE community_id IN (${communities.map(() => '?').join(',')})
  `).bind(...communities.map(c => c.community_id)).all();
  
  // Combine friends and community members
  const allUsers = new Set([
    ...friends.map(f => f.friend_id),
    ...communityMembers.map(m => m.user_id)
  ]);
  
  const user = await env.DB.prepare(`
    SELECT username, display_name, avatar_url FROM users WHERE id = ?
  `).bind(userId).first();
  
  for (const targetUserId of allUsers) {
    await sendToUser(env, targetUserId, {
      type: 'status_update',
      userId,
      username: user.username,
      displayName: user.display_name,
      avatar: user.avatar_url,
      status
    });
  }
}

async function sendToUser(env, userId, message) {
  try {
    const connection = await env.WEBSOCKETS.get(userId);
    if (connection) {
      // In a real implementation, you'd use a Durable Object to manage WebSocket connections
      // For now, we'll store pending messages
      const pending = await env.PENDING_MESSAGES.get(userId) || '[]';
      const messages = JSON.parse(pending);
      messages.push(message);
      await env.PENDING_MESSAGES.put(userId, JSON.stringify(messages));
    }
  } catch (error) {
    console.error('Failed to send to user:', error);
  }
}
