-- =============================================================
-- Phasebook PostgreSQL Initialization & Schema Migration
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  username VARCHAR(64) UNIQUE NOT NULL,
  avatar TEXT,
  verified BOOLEAN DEFAULT false,
  role VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  work TEXT,
  education TEXT,
  lives_in TEXT,
  joined_date VARCHAR(64),
  cover_image TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image TEXT,
  likes_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) REFERENCES posts(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) REFERENCES posts(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  friend_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) DEFAULT 'ACCEPTED',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  actor_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,
  target TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deployments (
  id VARCHAR(64) PRIMARY KEY,
  version VARCHAR(32) NOT NULL,
  commit_sha VARCHAR(64) NOT NULL,
  commit_message TEXT,
  commit_author VARCHAR(128),
  status VARCHAR(32) NOT NULL,
  health_result VARCHAR(32),
  deployed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deployed_by VARCHAR(128),
  is_active BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS incidents (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(256) NOT NULL,
  service VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL,
  failure_type VARCHAR(64),
  details TEXT,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS incident_events (
  id VARCHAR(64) PRIMARY KEY,
  incident_id VARCHAR(64) REFERENCES incidents(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_active ON deployments(is_active);

-- Seed Initial Users
INSERT INTO users (id, name, username, avatar, verified, role) VALUES
  ('akshay_s', 'Akshay Santani', 'akshaysantani', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', true, 'Staff SRE'),
  ('sarah_c', 'Sarah Chen', 'sarahchen', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', true, 'Staff Reliability Engineer'),
  ('marcus_k', 'Marcus Kim', 'marcus_k', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', true, 'Infrastructure Architect')
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Profiles
INSERT INTO profiles (user_id, bio, work, education, lives_in, joined_date) VALUES
  ('akshay_s', 'Architecting resilient distributed systems and chaos engineering.', 'Staff Site Reliability Engineer at Phasebook', 'MIT Computer Science', 'San Francisco, California', 'Joined October 2011')
ON CONFLICT (user_id) DO NOTHING;

-- Seed Initial Posts
INSERT INTO posts (id, user_id, content, image, likes_count, shares_count, created_at) VALUES
  ('post_1', 'sarah_c', 'Excited to announce our multi-region zero-downtime deployment pipeline is now fully active! Latency dropped by 42ms worldwide. 🚀', 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1000&auto=format&fit=crop&q=80', 342, 45, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('post_2', 'marcus_k', 'Quick reminder for the on-call rotation: Phasebook microservice tracing has been integrated with PagerDuty Events v2. Check the SRE Zero Admin dashboard if any alerts fire.', NULL, 128, 12, CURRENT_TIMESTAMP - INTERVAL '5 hours')
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Deployments
INSERT INTO deployments (id, version, commit_sha, commit_message, commit_author, status, health_result, deployed_at, deployed_by, is_active) VALUES
  ('dep_01_init', 'v1.0.0', '7b8f9e1204a9cd3e8b4e78a2c1f9304e650b2841', 'feat(core): initial Phasebook production release with microservices', 'SRE Lead', 'SUPERSEDED', 'HEALTHY', CURRENT_TIMESTAMP - INTERVAL '2 days', 'CI/CD Pipeline', false),
  ('dep_02_stable', 'v1.1.0', '3a1c8d5e9f2b4a7c6d8e0f1a3b5c7e9d2f4a6b8c', 'fix(feed): optimize timeline caching and PostgreSQL connection pool sizing', 'akshaysantani01', 'ACTIVE', 'HEALTHY', CURRENT_TIMESTAMP - INTERVAL '12 hours', 'akshaysantani01', true)
ON CONFLICT (id) DO NOTHING;
