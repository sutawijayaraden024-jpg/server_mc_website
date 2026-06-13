-- Community Database Schema (D1 / SQLite Compatible)
-- Run: npx wrangler d1 execute server-mc-db --file=functions/api/community/database-schema.sql --remote

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT DEFAULT (datetime('now'))
);

-- Community Groups
CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Community Members
CREATE TABLE IF NOT EXISTS community_members (
  id TEXT PRIMARY KEY,
  community_id TEXT REFERENCES communities(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now')),
  UNIQUE(community_id, user_id)
);

-- Custom Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  community_id TEXT REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#D4AF37',
  permissions TEXT DEFAULT '{}',
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  community_id TEXT REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  category TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  is_private INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  content TEXT DEFAULT '',
  reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  is_edited INTEGER DEFAULT 0,
  edited_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TEXT DEFAULT (datetime('now'))
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  community_id TEXT REFERENCES communities(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  is_public INTEGER DEFAULT 1,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Playlist Tracks
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
  track_name TEXT NOT NULL,
  track_url TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  artist TEXT DEFAULT '',
  album TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  added_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  added_at TEXT DEFAULT (datetime('now'))
);

-- Friends
CREATE TABLE IF NOT EXISTS friends (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, friend_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  data TEXT DEFAULT '{}',
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Custom Emojis
CREATE TABLE IF NOT EXISTS custom_emojis (
  id TEXT PRIMARY KEY,
  community_id TEXT REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(community_id, name)
);

-- Stickers
CREATE TABLE IF NOT EXISTS stickers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  is_animated INTEGER DEFAULT 0,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- User Stickers
CREATE TABLE IF NOT EXISTS user_stickers (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  sticker_id TEXT REFERENCES stickers(id) ON DELETE CASCADE,
  is_favorite INTEGER DEFAULT 0,
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, sticker_id)
);

-- Link Previews
CREATE TABLE IF NOT EXISTS link_previews (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  site_name TEXT DEFAULT '',
  fetched_at TEXT DEFAULT (datetime('now'))
);

-- Rate Limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT '',
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  window_start TEXT NOT NULL
);

-- Profiles (Extended user data)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'online',
  custom_status TEXT DEFAULT '',
  last_seen_at TEXT DEFAULT (datetime('now')),
  message_count INTEGER DEFAULT 0,
  friend_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(user_id, endpoint, window_start);