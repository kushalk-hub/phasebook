import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

export const SCHEMA_SQL = `
-- =============================================================
-- Phasebook Schema Definition (Neon Serverless Postgres)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_active ON deployments(is_active);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
`;

export const SEED_SQL = `
-- Seed Users
INSERT INTO users (id, name, username, avatar, verified, role) VALUES
  ('akshay_s', 'Akshay Santani', 'akshaysantani', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', true, 'Lead SRE & Admin'),
  ('sarah_c', 'Sarah Chen', 'sarahchen', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', true, 'Staff Reliability Engineer'),
  ('marcus_k', 'Marcus Kim', 'marcus_k', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', true, 'Infrastructure Architect')
ON CONFLICT (id) DO NOTHING;

-- Seed Profiles
INSERT INTO profiles (user_id, bio, work, education, lives_in, joined_date) VALUES
  ('akshay_s', 'Architecting resilient distributed systems and chaos engineering with Neon Serverless Postgres.', 'Staff Site Reliability Engineer at Phasebook', 'MIT Computer Science', 'San Francisco, California', 'Joined October 2011'),
  ('sarah_c', 'Specializing in Kubernetes orchestration, zero-downtime database migrations, and SLO automation.', 'Staff SRE at Phasebook', 'Stanford University', 'Seattle, Washington', 'Joined March 2014'),
  ('marcus_k', 'Distributed systems latency tuning and cloud platform resilience.', 'Principal Architect at Phasebook', 'UC Berkeley EECS', 'Austin, Texas', 'Joined June 2016')
ON CONFLICT (user_id) DO NOTHING;

-- Seed Posts
INSERT INTO posts (id, user_id, content, image, likes_count, shares_count, created_at) VALUES
  ('post_1', 'sarah_c', 'Excited to announce our multi-region zero-downtime deployment pipeline is now fully active with Neon Serverless Postgres! Latency dropped by 42ms worldwide. 🚀', 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1000&auto=format&fit=crop&q=80', 342, 45, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('post_2', 'marcus_k', 'Quick reminder for the on-call rotation: Phasebook telemetry has been connected to PagerDuty Events v2 and our Neon Serverless Postgres database. Check the SRE Zero Admin dashboard if any alerts fire.', NULL, 128, 12, CURRENT_TIMESTAMP - INTERVAL '5 hours'),
  ('post_3', 'akshay_s', 'Phasebook has completely migrated from local Docker PostgreSQL to Neon Serverless Postgres! Scale-to-zero compute, instant branching, and connection pooling are all functioning flawlessly.', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1000&auto=format&fit=crop&q=80', 512, 89, CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Seed Comments
INSERT INTO comments (id, post_id, user_id, text, likes_count, created_at) VALUES
  ('c_1_1', 'post_1', 'marcus_k', 'Incredible work on the Neon migration pipeline Sarah! Database latency charts look pristine.', 18, CURRENT_TIMESTAMP - INTERVAL '1 hour 45 minutes'),
  ('c_1_2', 'post_1', 'akshay_s', 'Verified the connection pool metrics in SRE-Zero: 0 connection drops under load testing.', 24, CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes'),
  ('c_2_1', 'post_2', 'sarah_c', 'PagerDuty service integration key validated on staging. Ready for SEV testing.', 9, CURRENT_TIMESTAMP - INTERVAL '4 hours 15 minutes')
ON CONFLICT (id) DO NOTHING;

-- Seed Likes
INSERT INTO likes (id, post_id, user_id, created_at) VALUES
  ('like_1_akshay', 'post_1', 'akshay_s', CURRENT_TIMESTAMP - INTERVAL '1 hour 50 minutes'),
  ('like_2_sarah', 'post_2', 'sarah_c', CURRENT_TIMESTAMP - INTERVAL '4 hours 30 minutes')
ON CONFLICT (post_id, user_id) DO NOTHING;

-- Seed Notifications
INSERT INTO notifications (id, user_id, actor_id, action, target, read, created_at) VALUES
  ('notif_1', 'akshay_s', 'sarah_c', 'LIKED_POST', 'your architectural review update', false, CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  ('notif_2', 'akshay_s', 'marcus_k', 'COMMENTED', 'on your Neon database migration RFC', false, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('notif_3', 'akshay_s', 'sarah_c', 'DEPLOYED', 'Phasebook v1.1.0 to Neon Postgres cluster', true, CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Seed Deployments
INSERT INTO deployments (id, version, commit_sha, commit_message, commit_author, status, health_result, deployed_at, deployed_by, is_active) VALUES
  ('dep_01_init', 'v1.0.0', '7b8f9e1204a9cd3e8b4e78a2c1f9304e650b2841', 'feat(core): initial Phasebook production release with microservices', 'SRE Lead', 'SUPERSEDED', 'HEALTHY', CURRENT_TIMESTAMP - INTERVAL '2 days', 'CI/CD Pipeline', false),
  ('dep_02_stable', 'v1.1.0', '3a1c8d5e9f2b4a7c6d8e0f1a3b5c7e9d2f4a6b8c', 'feat(db): migrate to Neon Serverless Postgres with PagerDuty alerts and SRE-Zero', 'akshaysantani01', 'ACTIVE', 'HEALTHY', CURRENT_TIMESTAMP - INTERVAL '12 hours', 'akshaysantani01', true)
ON CONFLICT (id) DO NOTHING;
`;

export function getPool(connectionString?: string): pg.Pool {
  const connStr = connectionString || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }

  return new Pool({
    connectionString: connStr,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 8000,
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

export async function applyMigrations(pool: pg.Pool) {
  console.log('[Neon Migration] Applying Phasebook schema migrations...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);
    await client.query('COMMIT');
    console.log('[Neon Migration] ✅ All tables, constraints, and indexes created successfully in Neon.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Neon Migration] ❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

export async function seedDemoData(pool: pg.Pool) {
  console.log('[Neon Migration] Checking demo seed data in Neon...');
  const client = await pool.connect();
  try {
    const userCountRes = await client.query('SELECT count(*) FROM users;');
    const userCount = parseInt(userCountRes.rows[0]?.count || '0', 10);

    if (userCount === 0) {
      console.log('[Neon Migration] Seeding initial Phasebook data...');
      await client.query(SEED_SQL);
      console.log('[Neon Migration] ✅ Demo data successfully seeded into Neon.');
    } else {
      console.log(`[Neon Migration] Tables already contain ${userCount} user(s). Preserving existing Neon data.`);
    }
  } catch (err: any) {
    console.error('[Neon Migration] ❌ Seeding failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabaseStatus(pool: pg.Pool) {
  console.log('[Neon Status] Checking Neon Serverless Postgres status...');
  const client = await pool.connect();
  try {
    const start = performance.now();
    const versionRes = await client.query('SELECT version();');
    const latency = (performance.now() - start).toFixed(1);

    const countsRes = await client.query(`
      SELECT
        (SELECT count(*) FROM users) as users,
        (SELECT count(*) FROM profiles) as profiles,
        (SELECT count(*) FROM posts) as posts,
        (SELECT count(*) FROM comments) as comments,
        (SELECT count(*) FROM likes) as likes,
        (SELECT count(*) FROM notifications) as notifications,
        (SELECT count(*) FROM deployments) as deployments,
        (SELECT count(*) FROM incidents) as incidents;
    `);

    console.log('---------------------------------------------------------');
    console.log('Neon Database Status: CONNECTED');
    console.log(`Query Latency: ${latency}ms`);
    console.log(`Version: ${versionRes.rows[0]?.version}`);
    console.log('Table Row Counts:');
    console.log(countsRes.rows[0]);
    console.log('---------------------------------------------------------');
    return {
      connected: true,
      latencyMs: parseFloat(latency),
      version: versionRes.rows[0]?.version,
      counts: countsRes.rows[0],
    };
  } finally {
    client.release();
  }
}

export async function resetDatabase(pool: pg.Pool) {
  console.log('[Neon Reset] Resetting Phasebook demo database in Neon...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      DROP TABLE IF EXISTS incident_events CASCADE;
      DROP TABLE IF EXISTS incidents CASCADE;
      DROP TABLE IF EXISTS deployments CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS friendships CASCADE;
      DROP TABLE IF EXISTS likes CASCADE;
      DROP TABLE IF EXISTS comments CASCADE;
      DROP TABLE IF EXISTS posts CASCADE;
      DROP TABLE IF EXISTS profiles CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    await client.query(SCHEMA_SQL);
    await client.query(SEED_SQL);
    await client.query('COMMIT');
    console.log('[Neon Reset] ✅ Neon database reset and re-seeded successfully.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Neon Reset] ❌ Reset failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// CLI Command Dispatcher
async function runCli() {
  const command = process.argv[2] || 'apply';

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required.');
    console.error('Example: DATABASE_URL=postgresql://user:pass@ep-xyz.neon.tech/phasebook?sslmode=require');
    process.exit(1);
  }

  const pool = getPool();

  try {
    if (command === 'apply' || command === 'migrate') {
      await applyMigrations(pool);
      await seedDemoData(pool);
      await checkDatabaseStatus(pool);
    } else if (command === 'seed') {
      await seedDemoData(pool);
      await checkDatabaseStatus(pool);
    } else if (command === 'status') {
      await checkDatabaseStatus(pool);
    } else if (command === 'reset') {
      const confirm = process.argv.includes('--confirm') || process.env.FORCE_RESET === 'true';
      if (!confirm) {
        console.warn('⚠️  Safety check: Resetting the database will drop and recreate all Phasebook tables.');
        console.warn('To proceed, re-run with: npm run db:reset -- --confirm');
        process.exit(1);
      }
      await resetDatabase(pool);
    } else {
      console.log('Unknown command:', command);
      console.log('Available commands: apply, seed, status, reset');
    }
  } catch (err: any) {
    console.error('Operation failed:', err?.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// If run directly as script
const isMainScript = typeof process !== 'undefined' && process.argv[1]?.includes('migrate');
if (isMainScript) {
  runCli();
}
