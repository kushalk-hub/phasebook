import pg from 'pg';
import {
  DatabaseHealthInfo,
  PhasebookPost,
  PhasebookComment,
  PhasebookUser,
  PhasebookNotification,
  IncidentRecord,
  IncidentEventRecord,
} from '../types.ts';
import { INITIAL_POSTS, INITIAL_NOTIFICATIONS, CURRENT_USER } from './phasebookData.ts';
import { SCHEMA_SQL, SEED_SQL } from '../../scripts/migrate.ts';

const { Pool } = pg;

// -------------------------------------------------------------
// Neon Connection Configuration
// -------------------------------------------------------------
function parseNeonConnection() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    return {
      connectionString: undefined,
      host: 'ep-rapid-wave-b36bo6eu.c-4.ap-southeast-1.aws.neon.tech',
      port: 5432,
      database: 'neondb',
      user: 'neon_app_role',
      isNeon: true,
      neonEndpoint: 'ep-rapid-wave-b36bo6eu',
      ssl: true,
    };
  }

  try {
    const url = new URL(connStr);
    const host = url.hostname;
    const port = parseInt(url.port || '5432', 10);
    const database = url.pathname.replace(/^\//, '') || 'phasebook';
    const user = url.username || 'neon_user';
    const isNeon = host.includes('neon.tech');
    const neonEndpoint = isNeon ? host.split('.')[0] : host;

    return {
      connectionString: connStr,
      host,
      port,
      database,
      user,
      isNeon,
      neonEndpoint,
      ssl: true,
    };
  } catch {
    return {
      connectionString: connStr,
      host: 'ep-neon-placeholder.aws.neon.tech',
      port: 5432,
      database: 'phasebook',
      user: 'neon_user',
      isNeon: true,
      neonEndpoint: 'ep-neon',
      ssl: true,
    };
  }
}

let pool: pg.Pool | null = null;
let isNeonConnected = false;
let isArtificiallyDown = false; // Controlled by SRE failure injection for non-destructive chaos testing
let lastError: string | undefined = undefined;
let dbStartTime = Date.now();

// In-memory fallback dataset active ONLY when DATABASE_URL is not provided
let inMemoryUsers: PhasebookUser[] = [
  CURRENT_USER,
  {
    id: 'sarah_c',
    name: 'Sarah Chen',
    username: 'sarahchen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    verified: true,
    role: 'Staff SRE',
  },
  {
    id: 'marcus_k',
    name: 'Marcus Kim',
    username: 'marcus_k',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    verified: true,
    role: 'Infrastructure Architect',
  },
];

let inMemoryPosts: PhasebookPost[] = JSON.parse(JSON.stringify(INITIAL_POSTS));
let inMemoryNotifications: PhasebookNotification[] = JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS));
let inMemoryIncidents: IncidentRecord[] = [];
let inMemoryIncidentEvents: IncidentEventRecord[] = [];

// -------------------------------------------------------------
// Database Initialization & Neon Schema Auto-Migration
// -------------------------------------------------------------
export async function initializeDatabase(forceReconnect: boolean = false): Promise<boolean> {
  dbStartTime = Date.now();
  const neonConfig = parseNeonConnection();

  if (!neonConfig.connectionString) {
    isNeonConnected = false;
    lastError = 'DATABASE_URL environment variable is not configured. Define DATABASE_URL in .env to connect your Neon Serverless Postgres database.';
    console.warn('[Neon Database] Running in standby mode:', lastError);
    return false;
  }

  // Reuse existing active pool if not forcing reconnection (optimizes serverless execution)
  if (!forceReconnect && pool && isNeonConnected && !isArtificiallyDown) {
    return true;
  }

  try {
    if (pool) {
      try {
        await pool.end();
      } catch {}
    }

    pool = new Pool({
      connectionString: neonConfig.connectionString,
      ssl: {
        rejectUnauthorized: false, // Supports Neon serverless connection with SNI
      },
      connectionTimeoutMillis: 8000,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    // Test connectivity
    const client = await pool.connect();
    const testResult = await client.query('SELECT version();');
    console.log('[Neon Database] Connected to Neon Serverless Postgres:', testResult.rows[0]?.version);
    isNeonConnected = true;
    lastError = undefined;

    // Apply migrations if tables do not exist (without destroying existing data)
    await runAutoMigrations(client);
    client.release();
    return true;
  } catch (err: any) {
    isNeonConnected = false;
    lastError = err?.message || 'Failed to connect to Neon Serverless Postgres';
    console.error('[Neon Database] Connection failed:', lastError);
    return false;
  }
}

export async function checkDatabaseLiveConnection(): Promise<boolean> {
  if (isArtificiallyDown) {
    return false;
  }
  const neonConfig = parseNeonConnection();
  if (!neonConfig.connectionString) {
    isNeonConnected = false;
    return false;
  }

  try {
    if (!pool) {
      return await initializeDatabase();
    }
    const client = await pool.connect();
    await client.query('SELECT 1;');
    client.release();
    isNeonConnected = true;
    return true;
  } catch (err: any) {
    isNeonConnected = false;
    lastError = err?.message;
    return false;
  }
}

export async function ensureDatabaseConnected(): Promise<boolean> {
  if (isArtificiallyDown) {
    return false;
  }
  if (pool && isNeonConnected) {
    return true;
  }
  return await initializeDatabase();
}

async function runAutoMigrations(client: pg.PoolClient) {
  try {
    // Run schema definition (CREATE TABLE IF NOT EXISTS)
    await client.query(SCHEMA_SQL);

    // Check if initial users exist
    const userCheck = await client.query('SELECT count(*) FROM users;');
    const count = parseInt(userCheck.rows[0]?.count || '0', 10);
    if (count === 0) {
      console.log('[Neon Database] Initializing demo data in Neon...');
      await client.query(SEED_SQL);
      console.log('[Neon Database] Demo seed data initialized successfully.');
    } else {
      console.log(`[Neon Database] Neon schema validated (${count} registered users found).`);
    }
  } catch (err: any) {
    console.error('[Neon Database] Auto-migration error:', err.message);
  }
}

// -------------------------------------------------------------
// SRE-Zero Diagnostic Probes & Database Health
// -------------------------------------------------------------

export async function getDatabaseHealth(): Promise<DatabaseHealthInfo> {
  const neonConfig = parseNeonConnection();

  // If chaos failure injected
  if (isArtificiallyDown) {
    return {
      status: 'DISCONNECTED',
      latencyMs: 5000,
      activeConnections: 0,
      idleConnections: 0,
      maxConnections: 10,
      database: neonConfig.database,
      host: neonConfig.host,
      port: neonConfig.port,
      user: neonConfig.user,
      isPostgres: true,
      isNeon: true,
      version: 'PostgreSQL 16 (Neon Serverless Postgres)',
      uptimeSeconds: 0,
      tableCounts: {
        users: 0,
        profiles: 0,
        posts: 0,
        comments: 0,
        likes: 0,
        friendships: 0,
        notifications: 0,
        deployments: 0,
        incidents: 0,
        incident_events: 0,
      },
      lastError: `FATAL: Connection refused to Neon Serverless Postgres (${neonConfig.host}:5432). Pool exhausted.`,
      neonEndpoint: neonConfig.neonEndpoint,
      sslEnabled: true,
      connectionType: 'NEON_SERVERLESS',
      availability: 'UNAVAILABLE',
    };
  }

  // Real Neon Database connection check
  if (pool && isNeonConnected) {
    const start = performance.now();
    try {
      const client = await pool.connect();
      const pingResult = await client.query('SELECT 1 as ping, version();');
      const latencyMs = Math.round((performance.now() - start) * 10) / 10;

      // Query real table counts from Neon
      const countsResult = await client.query(`
        SELECT
          (SELECT count(*) FROM users) as users,
          (SELECT count(*) FROM profiles) as profiles,
          (SELECT count(*) FROM posts) as posts,
          (SELECT count(*) FROM comments) as comments,
          (SELECT count(*) FROM likes) as likes,
          (SELECT count(*) FROM friendships) as friendships,
          (SELECT count(*) FROM notifications) as notifications,
          (SELECT count(*) FROM deployments) as deployments,
          (SELECT count(*) FROM incidents) as incidents,
          (SELECT count(*) FROM incident_events) as incident_events;
      `);

      client.release();

      const counts = countsResult.rows[0] || {};
      const parsedCounts = {
        users: parseInt(counts.users || '0', 10),
        profiles: parseInt(counts.profiles || '0', 10),
        posts: parseInt(counts.posts || '0', 10),
        comments: parseInt(counts.comments || '0', 10),
        likes: parseInt(counts.likes || '0', 10),
        friendships: parseInt(counts.friendships || '0', 10),
        notifications: parseInt(counts.notifications || '0', 10),
        deployments: parseInt(counts.deployments || '0', 10),
        incidents: parseInt(counts.incidents || '0', 10),
        incident_events: parseInt(counts.incident_events || '0', 10),
      };

      return {
        status: 'CONNECTED',
        latencyMs,
        activeConnections: pool.totalCount - pool.idleCount,
        idleConnections: pool.idleCount,
        maxConnections: 10,
        database: neonConfig.database,
        host: neonConfig.host,
        port: neonConfig.port,
        user: neonConfig.user,
        isPostgres: true,
        isNeon: neonConfig.isNeon,
        version: pingResult.rows[0]?.version || 'PostgreSQL 16 (Neon Serverless)',
        uptimeSeconds: Math.floor((Date.now() - dbStartTime) / 1000),
        tableCounts: parsedCounts,
        neonEndpoint: neonConfig.neonEndpoint,
        sslEnabled: true,
        connectionType: 'NEON_SERVERLESS',
        availability: 'AVAILABLE',
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        status: 'DEGRADED',
        latencyMs,
        activeConnections: 0,
        idleConnections: 0,
        maxConnections: 10,
        database: neonConfig.database,
        host: neonConfig.host,
        port: neonConfig.port,
        user: neonConfig.user,
        isPostgres: true,
        isNeon: neonConfig.isNeon,
        version: 'PostgreSQL 16 (Neon Serverless)',
        uptimeSeconds: Math.floor((Date.now() - dbStartTime) / 1000),
        tableCounts: {
          users: 3,
          profiles: 3,
          posts: 3,
          comments: 3,
          likes: 2,
          friendships: 0,
          notifications: 3,
          deployments: 2,
          incidents: 0,
          incident_events: 0,
        },
        lastError: err?.message || 'Neon query failed',
        neonEndpoint: neonConfig.neonEndpoint,
        sslEnabled: true,
        connectionType: 'NEON_SERVERLESS',
        availability: 'DEGRADED',
      };
    }
  }

  // When DATABASE_URL is not yet configured
  return {
    status: 'DISCONNECTED',
    latencyMs: 1.5,
    activeConnections: 0,
    idleConnections: 0,
    maxConnections: 10,
    database: neonConfig.database,
    host: neonConfig.host,
    port: neonConfig.port,
    user: neonConfig.user,
    isPostgres: false,
    isNeon: true,
    version: 'Neon Serverless Postgres (Awaiting DATABASE_URL in .env)',
    uptimeSeconds: Math.floor((Date.now() - dbStartTime) / 1000),
    tableCounts: {
      users: inMemoryUsers.length,
      profiles: 3,
      posts: inMemoryPosts.length,
      comments: inMemoryPosts.reduce((acc, p) => acc + p.comments.length, 0),
      likes: inMemoryPosts.reduce((acc, p) => acc + p.likes, 0),
      friendships: 4,
      notifications: inMemoryNotifications.length,
      deployments: 2,
      incidents: 0,
      incident_events: 0,
    },
    lastError: lastError || 'DATABASE_URL environment variable is not configured',
    neonEndpoint: neonConfig.neonEndpoint,
    sslEnabled: true,
    connectionType: 'SANDBOX_FALLBACK',
    availability: 'UNAVAILABLE',
  };
}

export async function getDatabaseMetrics() {
  const health = await getDatabaseHealth();
  return {
    latencyMs: health.latencyMs,
    activeConnections: health.activeConnections,
    idleConnections: health.idleConnections,
    maxConnections: health.maxConnections,
    status: health.status,
    tableCounts: health.tableCounts,
    isNeon: health.isNeon,
    neonEndpoint: health.neonEndpoint,
    availability: health.availability,
  };
}

export async function getDatabaseConnectionStatus() {
  const health = await getDatabaseHealth();
  return {
    connected: health.status === 'CONNECTED',
    status: health.status,
    host: health.host,
    port: health.port,
    database: health.database,
    user: health.user,
    latencyMs: health.latencyMs,
    lastError: health.lastError,
    isNeon: health.isNeon,
    neonEndpoint: health.neonEndpoint,
    sslEnabled: health.sslEnabled,
    connectionType: health.connectionType,
  };
}

// -------------------------------------------------------------
// Operational Database Controls
// -------------------------------------------------------------

export function setDatabaseFailure(fail: boolean) {
  isArtificiallyDown = fail;
}

export function isDatabaseDown(): boolean {
  return isArtificiallyDown;
}

export async function restartDatabaseConnectionPool(): Promise<{
  success: boolean;
  message: string;
  restartedAt: string;
}> {
  isArtificiallyDown = false;
  dbStartTime = Date.now();
  const connected = await initializeDatabase();
  return {
    success: connected,
    message: connected
      ? 'Neon Serverless connection pool recycled. Verified live connectivity via SSL (SELECT 1).'
      : `Neon connection pool reset. Status: ${lastError || 'Standby'}`,
    restartedAt: new Date().toISOString(),
  };
}

export const restartDatabaseContainer = restartDatabaseConnectionPool;

export function getDatabaseAdminConfig() {
  const neonConfig = parseNeonConnection();
  return {
    host: neonConfig.host,
    port: neonConfig.port,
    database: neonConfig.database,
    user: neonConfig.user,
    isNeon: neonConfig.isNeon,
    neonEndpoint: neonConfig.neonEndpoint,
    restEndpoint: 'https://ep-rapid-wave-b36bo6eu.apirest.c-4.ap-southeast-1.aws.neon.tech/neondb/rest/v1',
    sslEnabled: true,
    // Note: Secrets are kept server-side and never leaked
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    neonApiKeyConfigured: Boolean(process.env.NEON_API_KEY),
    connectionFormat: 'postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require',
  };
}

// -------------------------------------------------------------
// Optional Neon Console API Operational Probes (Requirement 8)
// -------------------------------------------------------------
export async function getNeonProjectMetadata(): Promise<{
  configured: boolean;
  project?: any;
  error?: string;
}> {
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      configured: false,
      error: 'NEON_API_KEY not configured. Set NEON_API_KEY in server environment for Neon Console API telemetry.',
    };
  }

  try {
    const resp = await fetch('https://console.neon.tech/api/v2/projects', {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        Accept: 'application/json',
      },
    });

    if (!resp.ok) {
      return {
        configured: true,
        error: `Neon API HTTP ${resp.status}: ${resp.statusText}`,
      };
    }

    const data = await resp.json();
    return {
      configured: true,
      project: data.projects?.[0] || null,
    };
  } catch (err: any) {
    return {
      configured: true,
      error: err?.message || 'Failed to query Neon Console API',
    };
  }
}

// -------------------------------------------------------------
// Social Network Application Data Operations (Neon-Backed)
// -------------------------------------------------------------

function formatPostTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export async function dbGetPosts(): Promise<PhasebookPost[]> {
  const neonConfig = parseNeonConnection();

  if (isArtificiallyDown) {
    throw new Error(`Database Error: Connection refused on Neon endpoint ${neonConfig.host}:5432 (Pool exhausted / timeout)`);
  }

  // If connected to Neon, perform real SQL queries
  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const currentUserId = typeof CURRENT_USER.id === 'number' || /^\d+$/.test(String(CURRENT_USER.id))
        ? Number(CURRENT_USER.id)
        : null;

      // 1. Fetch Posts with Author profile info matching Neon schema (image_url, like_count, comment_count)
      const postsRes = await client.query(`
        SELECT
          p.id,
          p.content,
          p.image_url,
          p.like_count,
          p.comment_count,
          p.created_at,
          u.id as author_id,
          COALESCE(pr.display_name, u.username, 'Phasebook User') as author_name,
          u.username as author_username,
          COALESCE(pr.avatar_url, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150') as author_avatar,
          true as author_verified,
          u.role as author_role,
          CASE WHEN $1::integer IS NOT NULL THEN
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1::integer)
          ELSE false END as user_liked
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN profiles pr ON u.id = pr.user_id
        ORDER BY p.created_at DESC
        LIMIT 50;
      `, [currentUserId]);

      // 2. Fetch Comments for these posts matching Neon schema (content, user_id)
      const commentsRes = await client.query(`
        SELECT
          c.id,
          c.post_id,
          c.content as text,
          0 as likes_count,
          c.created_at,
          u.id as author_id,
          COALESCE(pr.display_name, u.username, 'Phasebook User') as author_name,
          u.username as author_username,
          COALESCE(pr.avatar_url, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150') as author_avatar
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN profiles pr ON u.id = pr.user_id
        ORDER BY c.created_at ASC;
      `);

      const commentsByPost: Record<string, PhasebookComment[]> = {};
      for (const row of commentsRes.rows) {
        const comment: PhasebookComment = {
          id: String(row.id),
          text: row.text,
          likes: row.likes_count || 0,
          timestamp: formatPostTime(row.created_at),
          author: {
            id: String(row.author_id),
            name: row.author_name || 'Phasebook User',
            username: row.author_username || 'user',
            avatar: row.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          },
        };
        const pKey = String(row.post_id);
        if (!commentsByPost[pKey]) {
          commentsByPost[pKey] = [];
        }
        commentsByPost[pKey].push(comment);
      }

      const formattedPosts: PhasebookPost[] = postsRes.rows.map((r) => ({
        id: String(r.id),
        content: r.content,
        image: r.image_url || undefined,
        imageUrl: r.image_url || undefined,
        likes: Number(r.like_count) || 0,
        userLiked: Boolean(r.user_liked),
        shares: 0,
        timestamp: formatPostTime(r.created_at),
        author: {
          id: String(r.author_id || CURRENT_USER.id),
          name: r.author_name || CURRENT_USER.name,
          username: r.author_username || CURRENT_USER.username,
          avatar: r.author_avatar || CURRENT_USER.avatar,
          verified: Boolean(r.author_verified),
          role: r.author_role || undefined,
        },
        comments: commentsByPost[String(r.id)] || [],
      }));

      return formattedPosts;
    } catch (err: any) {
      console.error('[Neon Database] Error fetching posts from Neon:', err);
      throw new Error(`Neon Query Failure: ${err.message}`);
    } finally {
      client.release();
    }
  }

  // Fallback when DATABASE_URL is not set yet
  return inMemoryPosts;
}

export async function dbCreatePost(content: string, image?: string): Promise<PhasebookPost> {
  const neonConfig = parseNeonConnection();

  if (isArtificiallyDown) {
    throw new Error(`Database Write Error: Could not acquire client connection from pool (timeout 5000ms on ${neonConfig.host}:5432)`);
  }

  const postId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const userId = typeof CURRENT_USER.id === 'number' || /^\d+$/.test(String(CURRENT_USER.id))
        ? Number(CURRENT_USER.id)
        : 1;

      // Insert post into Neon matching posts schema
      const res = await client.query(`
        INSERT INTO posts (user_id, content, image_url, like_count, comment_count, created_at, updated_at)
        VALUES ($1, $2, $3, 0, 0, NOW(), NOW())
        RETURNING *;
      `, [userId, content.trim(), image || null]);

      const inserted = res.rows[0];
      return {
        id: String(inserted.id),
        author: CURRENT_USER,
        timestamp: 'Just now',
        content: inserted.content,
        image: inserted.image_url || undefined,
        imageUrl: inserted.image_url || undefined,
        likes: 0,
        userLiked: false,
        shares: 0,
        comments: [],
      };
    } catch (err: any) {
      console.error('[Neon Database] Error inserting post into Neon:', err);
      throw new Error(`Neon Write Failure: ${err.message}`);
    } finally {
      client.release();
    }
  }

  // In-memory fallback
  const newPost: PhasebookPost = {
    id: postId,
    author: CURRENT_USER,
    timestamp: 'Just now',
    content: content.trim(),
    image: image || undefined,
    imageUrl: image || undefined,
    likes: 0,
    userLiked: false,
    shares: 0,
    comments: [],
  };
  inMemoryPosts = [newPost, ...inMemoryPosts];
  return newPost;
}

export async function dbLikePost(postId: string): Promise<PhasebookPost> {
  const neonConfig = parseNeonConnection();

  if (isArtificiallyDown) {
    throw new Error(`Database Error: Cannot commit like transaction (${neonConfig.host}:5432 unreachable)`);
  }

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const numericPostId = Number(postId);
      const userId = typeof CURRENT_USER.id === 'number' || /^\d+$/.test(String(CURRENT_USER.id))
        ? Number(CURRENT_USER.id)
        : 1;

      // Check if like exists
      const existingLike = await client.query(
        'SELECT 1 FROM likes WHERE post_id = $1 AND user_id = $2;',
        [numericPostId, userId]
      );

      let userLiked = false;
      if (existingLike.rowCount && existingLike.rowCount > 0) {
        // Unlike
        await client.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2;', [numericPostId, userId]);
        await client.query('UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = $1;', [numericPostId]);
        userLiked = false;
      } else {
        // Like
        await client.query('INSERT INTO likes (post_id, user_id, created_at) VALUES ($1, $2, NOW());', [numericPostId, userId]);
        await client.query('UPDATE posts SET like_count = like_count + 1 WHERE id = $1;', [numericPostId]);
        userLiked = true;
      }

      await client.query('COMMIT');

      // Fetch updated post
      const postRes = await client.query(`
        SELECT
          p.id,
          p.content,
          p.image_url,
          p.like_count,
          p.comment_count,
          p.created_at,
          u.id as author_id,
          COALESCE(pr.display_name, u.username, 'Phasebook User') as author_name,
          u.username as author_username,
          COALESCE(pr.avatar_url, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150') as author_avatar,
          true as author_verified,
          u.role as author_role
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN profiles pr ON u.id = pr.user_id
        WHERE p.id = $1;
      `, [numericPostId]);

      if (postRes.rowCount === 0) {
        throw new Error('Post not found in Neon database');
      }

      const p = postRes.rows[0];
      return {
        id: String(p.id),
        author: {
          id: String(p.author_id || p.user_id),
          name: p.author_name || 'User',
          username: p.author_username || 'user',
          avatar: p.author_avatar || CURRENT_USER.avatar,
        },
        content: p.content,
        image: p.image_url || undefined,
        imageUrl: p.image_url || undefined,
        likes: p.like_count,
        userLiked,
        shares: 0,
        timestamp: formatPostTime(p.created_at),
        comments: [],
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[Neon Database] Like transaction failed:', err);
      throw new Error(`Neon Like Transaction Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  // In-memory fallback
  const post = inMemoryPosts.find((p) => String(p.id) === String(postId));
  if (!post) {
    throw new Error('Post not found');
  }
  post.userLiked = !post.userLiked;
  post.likes += post.userLiked ? 1 : -1;
  return post;
}

export async function dbAddComment(postId: string, text: string): Promise<{ post: PhasebookPost; comment: PhasebookComment }> {
  const neonConfig = parseNeonConnection();

  if (isArtificiallyDown) {
    throw new Error(`Database Error: Cannot insert comment row into Neon comments table (${neonConfig.host}:5432 unreachable)`);
  }

  const commentId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const numericPostId = Number(postId);
      const userId = typeof CURRENT_USER.id === 'number' || /^\d+$/.test(String(CURRENT_USER.id))
        ? Number(CURRENT_USER.id)
        : 1;

      // Insert comment
      const commentRes = await client.query(`
        INSERT INTO comments (post_id, user_id, content, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *;
      `, [numericPostId, userId, text.trim()]);

      await client.query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1;', [numericPostId]);

      await client.query('COMMIT');

      const insertedComment = commentRes.rows[0];
      const comment: PhasebookComment = {
        id: String(insertedComment.id),
        author: CURRENT_USER,
        text: insertedComment.content,
        timestamp: 'Just now',
        likes: 0,
      };

      // Fetch parent post
      const post = (await dbGetPosts()).find((p) => String(p.id) === String(postId));
      if (!post) {
        throw new Error('Post not found');
      }

      return { post, comment };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[Neon Database] Comment write error in Neon:', err);
      throw new Error(`Neon Comment Insert Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  // In-memory fallback
  const post = inMemoryPosts.find((p) => String(p.id) === String(postId));
  if (!post) {
    throw new Error('Post not found');
  }
  const comment: PhasebookComment = {
    id: commentId,
    author: CURRENT_USER,
    text: text.trim(),
    timestamp: 'Just now',
    likes: 0,
  };
  post.comments.push(comment);
  return { post, comment };
}

export async function dbGetNotifications(): Promise<PhasebookNotification[]> {
  const neonConfig = parseNeonConnection();

  if (isArtificiallyDown) {
    throw new Error(`Database Error: Failed to query Neon notifications table (connection refused on ${neonConfig.host})`);
  }

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT
          n.id,
          n.type as action,
          n.content as target,
          n.is_read as read,
          n.created_at,
          u.id as actor_id,
          COALESCE(pr.display_name, u.username, 'Phasebook User') as actor_name,
          u.username as actor_username,
          COALESCE(pr.avatar_url, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150') as actor_avatar
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        LEFT JOIN profiles pr ON u.id = pr.user_id
        ORDER BY n.created_at DESC
        LIMIT 25;
      `);

      return res.rows.map((r) => ({
        id: String(r.id),
        user: {
          id: String(r.actor_id || 'unknown'),
          name: r.author_name || 'Phasebook User',
          username: r.actor_username || 'user',
          avatar: r.actor_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        },
        action: r.action,
        target: r.target,
        timestamp: formatPostTime(r.created_at),
        read: Boolean(r.read),
      }));
    } catch (err: any) {
      console.error('[Neon Database] Error querying notifications:', err);
      throw new Error(`Neon Notifications Query Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return inMemoryNotifications;
}

export function dbResetData() {
  inMemoryPosts = JSON.parse(JSON.stringify(INITIAL_POSTS));
  inMemoryNotifications = JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS));
  isArtificiallyDown = false;
}

// -------------------------------------------------------------
// Incident & Incident Events Management (Neon Serverless Postgres)
// -------------------------------------------------------------

export async function dbGetIncidents(limit = 50): Promise<IncidentRecord[]> {
  const neonConfig = parseNeonConnection();
  if (isArtificiallyDown) {
    throw new Error(`Database Error: Failed to query Neon incidents table (connection refused on ${neonConfig.host})`);
  }

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT
          id,
          title,
          service,
          severity,
          status,
          deployment_id,
          root_cause,
          started_at,
          resolved_at
        FROM incidents
        ORDER BY started_at DESC
        LIMIT $1;`,
        [limit]
      );
      return res.rows.map((r) => ({
        id: r.id,
        title: r.title,
        service: r.service,
        severity: r.severity,
        status: r.status,
        deployment_id: r.deployment_id,
        root_cause: r.root_cause,
        failure_type: null,
        details: r.root_cause,
        started_at: r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
        resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
      }));
    } catch (err: any) {
      console.error('[Neon Database] Error reading incidents:', err);
      throw new Error(`Neon Incidents Query Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return [...inMemoryIncidents].slice(0, limit);
}

export async function dbGetIncident(id: string | number): Promise<IncidentRecord | null> {
  const neonConfig = parseNeonConnection();
  if (isArtificiallyDown) {
    throw new Error(`Database Error: Failed to query Neon incident ${id} (connection refused on ${neonConfig.host})`);
  }

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const isNumeric = typeof id === 'number' || /^\d+$/.test(String(id));
      const res = isNumeric
        ? await client.query(
            `SELECT id, title, service, severity, status, deployment_id, root_cause, started_at, resolved_at
             FROM incidents WHERE id = $1;`,
            [Number(id)]
          )
        : await client.query(
            `SELECT id, title, service, severity, status, deployment_id, root_cause, started_at, resolved_at
             FROM incidents WHERE title ILIKE '%' || $1 || '%' ORDER BY id DESC LIMIT 1;`,
            [String(id)]
          );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        title: r.title,
        service: r.service,
        severity: r.severity,
        status: r.status,
        deployment_id: r.deployment_id,
        root_cause: r.root_cause,
        failure_type: null,
        details: r.root_cause,
        started_at: r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
        resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
      };
    } catch (err: any) {
      console.error(`[Neon Database] Error reading incident ${id}:`, err);
      throw new Error(`Neon Incident Query Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return inMemoryIncidents.find((i) => String(i.id) === String(id)) || null;
}

export async function dbGetIncidentEvents(incidentId: string | number): Promise<IncidentEventRecord[]> {
  const neonConfig = parseNeonConnection();
  if (isArtificiallyDown) {
    throw new Error(`Database Error: Failed to query Neon incident events (connection refused on ${neonConfig.host})`);
  }

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const isNumeric = typeof incidentId === 'number' || /^\d+$/.test(String(incidentId));
      let numericId: number | null = isNumeric ? Number(incidentId) : null;

      if (numericId === null) {
        const incLookup = await client.query(
          `SELECT id FROM incidents WHERE title ILIKE '%' || $1 || '%' ORDER BY id DESC LIMIT 1;`,
          [String(incidentId)]
        );
        if (incLookup.rows.length > 0) {
          numericId = incLookup.rows[0].id;
        }
      }

      if (numericId === null) {
        return [];
      }

      const res = await client.query(
        `SELECT id, incident_id, event_type, description, actor, created_at
         FROM incident_events
         WHERE incident_id = $1
         ORDER BY created_at ASC;`,
        [numericId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        incident_id: r.incident_id,
        event_type: r.event_type,
        message: r.description || '',
        description: r.description || '',
        actor: r.actor || 'SRE-Zero',
        details: { actor: r.actor },
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));
    } catch (err: any) {
      console.error(`[Neon Database] Error reading events for incident ${incidentId}:`, err);
      throw new Error(`Neon Incident Events Query Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return inMemoryIncidentEvents.filter((e) => String(e.incident_id) === String(incidentId));
}

export async function dbCreateIncident(incident: {
  id?: string | number;
  title: string;
  service: string;
  severity: string;
  status?: string;
  deployment_id?: number | null;
  root_cause?: string;
  failure_type?: string;
  details?: string;
  started_at?: string;
}): Promise<IncidentRecord> {
  const neonConfig = parseNeonConnection();
  if (isArtificiallyDown) {
    throw new Error(`Database Error: Failed to create incident in Neon (connection refused on ${neonConfig.host})`);
  }

  const title = incident.title;
  const service = incident.service;
  const severity = incident.severity;
  const status = (incident.status || 'investigating').toLowerCase();
  const rootCause = incident.root_cause || incident.details || incident.failure_type || 'Automated incident triggered by system health monitor';
  const startedAt = incident.started_at ? new Date(incident.started_at) : new Date();

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO incidents (title, service, severity, status, root_cause, started_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, service, severity, status, deployment_id, root_cause, started_at, resolved_at;`,
        [title, service, severity, status, rootCause, startedAt]
      );
      const r = res.rows[0];
      const createdRecord: IncidentRecord = {
        id: r.id,
        title: r.title,
        service: r.service,
        severity: r.severity,
        status: r.status,
        deployment_id: r.deployment_id,
        root_cause: r.root_cause,
        details: r.root_cause,
        started_at: r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
        resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
      };
      inMemoryIncidents.unshift(createdRecord);
      return createdRecord;
    } catch (err: any) {
      console.error('[Neon Database] Error creating incident in Neon:', err);
      throw new Error(`Neon Incident Creation Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  const fallbackRecord: IncidentRecord = {
    id: incident.id || `inc_${Date.now()}`,
    title,
    service,
    severity,
    status,
    details: rootCause,
    root_cause: rootCause,
    started_at: startedAt.toISOString(),
    resolved_at: null,
  };
  inMemoryIncidents.unshift(fallbackRecord);
  return fallbackRecord;
}

export async function dbAddIncidentEvent(event: {
  id?: string | number;
  incident_id: string | number;
  event_type: string;
  message?: string;
  description?: string;
  actor?: string;
  details?: any;
}): Promise<IncidentEventRecord> {
  const neonConfig = parseNeonConnection();
  if (isArtificiallyDown) {
    throw new Error(`Database Error: Failed to add incident event in Neon (connection refused on ${neonConfig.host})`);
  }

  const desc = event.description || event.message || 'Incident status updated';
  const actor = event.actor || 'SRE-Zero';

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const isNumeric = typeof event.incident_id === 'number' || /^\d+$/.test(String(event.incident_id));
      let numericId: number | null = isNumeric ? Number(event.incident_id) : null;

      if (numericId === null) {
        const incLookup = await client.query(
          `SELECT id FROM incidents WHERE title ILIKE '%' || $1 || '%' ORDER BY id DESC LIMIT 1;`,
          [String(event.incident_id)]
        );
        if (incLookup.rows.length > 0) {
          numericId = incLookup.rows[0].id;
        }
      }

      if (numericId !== null) {
        const res = await client.query(
          `INSERT INTO incident_events (incident_id, event_type, description, actor, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id, incident_id, event_type, description, actor, created_at;`,
          [numericId, event.event_type, desc, actor]
        );
        const r = res.rows[0];
        const record: IncidentEventRecord = {
          id: r.id,
          incident_id: r.incident_id,
          event_type: r.event_type,
          message: r.description,
          description: r.description,
          actor: r.actor,
          details: event.details || null,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        };
        inMemoryIncidentEvents.push(record);
        return record;
      }
    } catch (err: any) {
      console.error('[Neon Database] Error adding incident event in Neon:', err);
      throw new Error(`Neon Incident Event Creation Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  const fallbackEvt: IncidentEventRecord = {
    id: event.id || `evt_${Date.now()}`,
    incident_id: event.incident_id,
    event_type: event.event_type,
    message: desc,
    description: desc,
    actor,
    details: event.details || null,
    created_at: new Date().toISOString(),
  };
  inMemoryIncidentEvents.push(fallbackEvt);
  return fallbackEvt;
}

export async function dbUpdateIncidentStatus(
  incidentId: string | number,
  status: string,
  details?: string
): Promise<IncidentRecord | null> {
  const neonConfig = parseNeonConnection();
  if (isArtificiallyDown) {
    throw new Error(`Database Error: Failed to update incident status in Neon (connection refused on ${neonConfig.host})`);
  }

  const isResolved = status.toLowerCase() === 'resolved';
  const resolvedAt = isResolved ? new Date().toISOString() : null;

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const isNumeric = typeof incidentId === 'number' || /^\d+$/.test(String(incidentId));
      let numericId: number | null = isNumeric ? Number(incidentId) : null;

      if (numericId === null) {
        const incLookup = await client.query(
          `SELECT id FROM incidents WHERE title ILIKE '%' || $1 || '%' ORDER BY id DESC LIMIT 1;`,
          [String(incidentId)]
        );
        if (incLookup.rows.length > 0) {
          numericId = incLookup.rows[0].id;
        }
      }

      if (numericId !== null) {
        const res = await client.query(
          `UPDATE incidents
           SET status = $2,
               resolved_at = CASE WHEN $3::text IS NOT NULL THEN $3::timestamp ELSE resolved_at END
           WHERE id = $1
           RETURNING id, title, service, severity, status, deployment_id, root_cause, started_at, resolved_at;`,
          [numericId, status.toLowerCase(), resolvedAt]
        );
        if (res.rows.length > 0) {
          const r = res.rows[0];
          const updated: IncidentRecord = {
            id: r.id,
            title: r.title,
            service: r.service,
            severity: r.severity,
            status: r.status,
            deployment_id: r.deployment_id,
            root_cause: r.root_cause,
            details: r.root_cause,
            started_at: r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
            resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
          };
          return updated;
        }
      }
    } catch (err: any) {
      console.error(`[Neon Database] Error updating incident status for ${incidentId}:`, err);
      throw new Error(`Neon Incident Status Update Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  const existing = inMemoryIncidents.find((i) => String(i.id) === String(incidentId));
  if (existing) {
    existing.status = status;
    if (details) existing.details = details;
    if (isResolved) existing.resolved_at = resolvedAt;
    return existing;
  }
  return null;
}

export async function dbResolveIncident(
  incidentId: string | number,
  resolvedAt?: string
): Promise<IncidentRecord | null> {
  const timestamp = resolvedAt || new Date().toISOString();
  return dbUpdateIncidentStatus(incidentId, 'resolved', `Resolved at ${timestamp}`);
}

export async function dbDeleteIncident(incidentId: string | number): Promise<boolean> {
  const neonConfig = parseNeonConnection();
  if (isArtificiallyDown) {
    throw new Error(`Database Error: Failed to delete incident in Neon (connection refused on ${neonConfig.host})`);
  }

  if (pool && isNeonConnected) {
    const client = await pool.connect();
    try {
      const isNumeric = typeof incidentId === 'number' || /^\d+$/.test(String(incidentId));
      let numericId: number | null = isNumeric ? Number(incidentId) : null;

      if (numericId === null) {
        const incLookup = await client.query(
          `SELECT id FROM incidents WHERE title ILIKE '%' || $1 || '%' ORDER BY id DESC LIMIT 1;`,
          [String(incidentId)]
        );
        if (incLookup.rows.length > 0) {
          numericId = incLookup.rows[0].id;
        }
      }

      if (numericId !== null) {
        await client.query(`DELETE FROM incident_events WHERE incident_id = $1;`, [numericId]);
        const res = await client.query(`DELETE FROM incidents WHERE id = $1;`, [numericId]);
        inMemoryIncidents = inMemoryIncidents.filter((i) => String(i.id) !== String(numericId));
        inMemoryIncidentEvents = inMemoryIncidentEvents.filter((e) => String(e.incident_id) !== String(numericId));
        return (res.rowCount || 0) > 0;
      }
    } catch (err: any) {
      console.error(`[Neon Database] Error deleting incident ${incidentId}:`, err);
      throw new Error(`Neon Incident Delete Failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  inMemoryIncidents = inMemoryIncidents.filter((i) => String(i.id) !== String(incidentId));
  inMemoryIncidentEvents = inMemoryIncidentEvents.filter((e) => String(e.incident_id) !== String(incidentId));
  return true;
}
