// Performance Optimization Configuration
// Database indexes, caching strategies, and query optimization

// Database Indexes for Performance
export const PERFORMANCE_INDEXES = `
-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded ON attachments(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_role ON community_members(community_id, role);
CREATE INDEX IF NOT EXISTS idx_friends_user_status ON friends(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_updated ON friends(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_added ON playlist_tracks(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_emojis_community ON custom_emojis(community_id);
CREATE INDEX IF NOT EXISTS idx_stickers_created ON stickers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_stickers_user ON user_stickers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_favorite ON user_stickers(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_link_previews_url ON link_previews(url);
CREATE INDEX IF NOT EXISTS idx_link_previews_fetched ON link_previews(fetched_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON rate_limits(user_id, endpoint, window_start);
`;

// Query Optimization Strategies
export const QUERY_OPTIMIZATION = {
  // Use LIMIT clauses to prevent large result sets
  MAX_RESULTS: 100,
  
  // Use pagination for large datasets
  PAGE_SIZE: 50,
  
  // Cache frequently accessed data
  CACHE_TTL: 300000, // 5 minutes
  
  // Use prepared statements
  USE_PREPARED_STATEMENTS: true,
  
  // Batch operations
  BATCH_SIZE: 100
};

// Caching Strategy
export const CACHE_STRATEGY = {
  // Cache user profiles
  USER_PROFILE_TTL: 600000, // 10 minutes
  
  // Cache community data
  COMMUNITY_DATA_TTL: 300000, // 5 minutes
  
  // Cache channel lists
  CHANNEL_LIST_TTL: 120000, // 2 minutes
  
  // Cache member lists
  MEMBER_LIST_TTL: 60000, // 1 minute
  
  // Cache message previews
  MESSAGE_PREVIEW_TTL: 30000, // 30 seconds
  
  // Cache link previews
  LINK_PREVIEW_TTL: 86400000, // 24 hours
  
  // Cache emoji lists
  EMOJI_LIST_TTL: 300000, // 5 minutes
  
  // Cache sticker lists
  STICKER_LIST_TTL: 300000 // 5 minutes
};

// Connection Pooling
export const CONNECTION_POOL = {
  MAX_CONNECTIONS: 100,
  MIN_CONNECTIONS: 10,
  ACQUIRE_TIMEOUT: 30000,
  IDLE_TIMEOUT: 300000
};

// WebSocket Performance
export const WEBSOCKET_CONFIG = {
  MAX_CONNECTIONS_PER_USER: 5,
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  RECONNECT_DELAY: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  MESSAGE_QUEUE_SIZE: 1000
};

// Rate Limiting
export const RATE_LIMITS = {
  // General API
  GENERAL: { windowMs: 60000, max: 100 },
  
  // Auth endpoints
  AUTH: { windowMs: 60000, max: 10 },
  
  // Message sending
  MESSAGES: { windowMs: 60000, max: 30 },
  
  // File uploads
  UPLOADS: { windowMs: 60000, max: 20 },
  
  // Search
  SEARCH: { windowMs: 60000, max: 30 },
  
  // Friend operations
  FRIENDS: { windowMs: 60000, max: 30 },
  
  // Emoji/Sticker operations
  EMOJI_STICKER: { windowMs: 60000, max: 20 }
};

// Message Pagination
export const MESSAGE_PAGINATION = {
  INITIAL_LOAD: 50,
  SCROLL_LOAD: 20,
  MAX_HISTORY: 500
};

// File Upload Optimization
export const UPLOAD_OPTIMIZATION = {
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
  MAX_CONCURRENT_UPLOADS: 3,
  COMPRESSION_THRESHOLD: 1024 * 1024 // 1MB
};

// Database Cleanup Schedule
export const CLEANUP_SCHEDULE = {
  // Clean old rate limit records
  RATE_LIMIT_CLEANUP: '0 */1 * * *', // Every hour
  
  // Clean expired sessions
  SESSION_CLEANUP: '0 */2 * * *', // Every 2 hours
  
  // Clean old notifications (read, older than 30 days)
  NOTIFICATION_CLEANUP: '0 0 */6 * * *', // Every 6 hours
  
  // Clean old link previews (older than 7 days)
  LINK_PREVIEW_CLEANUP: '0 0 */12 * * *', // Every 12 hours
};

// Performance Monitoring
export const MONITORING = {
  // Track slow queries (> 1 second)
  SLOW_QUERY_THRESHOLD: 1000,
  
  // Track API response times
  API_RESPONSE_THRESHOLD: 500,
  
  // Track WebSocket latency
  WEBSOCKET_LATENCY_THRESHOLD: 100,
  
  // Track memory usage
  MEMORY_THRESHOLD: 512 * 1024 * 1024 // 512MB
};

// Load Balancing
export const LOAD_BALANCING = {
  // Distribute WebSocket connections across multiple servers
  WEBSOCKET_SHARDING: true,
  
  // Use read replicas for read-heavy operations
  READ_REPLICAS: true,
  
  // Cache database query results
  QUERY_CACHE: true
};
