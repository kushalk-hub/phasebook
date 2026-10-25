import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import {
  createInitialSimulatorState,
  injectBadDeployment,
  injectDatabaseFailure,
  injectServiceCrash,
  injectDependencyFailure,
  injectHighMemory,
  rollbackDeployment,
  restoreDatabase,
  restartService,
  restoreDependency,
  scaleService,
  verifyRecovery,
  resetIncident,
  tickMetrics,
  getSystemHealth,
  getMetrics,
  getLogs,
  getRecentDeployments,
  getDatabaseHealth,
  getDependencyHealth,
  buildSREZeroInvestigation,
  createPagerDutyEvent,
} from '../lib/simulatorEngine.ts';
import {
  getGitHubConfig,
  fetchLatestCommit,
  fetchRecentCommits,
  fetchCommitMetadata,
  checkNewCommitExists,
  fetchDeploymentDiff,
  executeContainerDeployment,
  rollbackDeployment as rollbackContainerDeployment,
  getDeploymentHistory,
  getCurrentDeployment,
  getPreviousDeployment,
} from '../lib/githubService.ts';
import {
  initializeDatabase,
  ensureDatabaseConnected,
  getDatabaseHealth as getPostgresHealth,
  getDatabaseMetrics,
  getDatabaseConnectionStatus,
  setDatabaseFailure,
  isDatabaseDown,
  restartDatabaseContainer,
  getDatabaseAdminConfig,
  getNeonProjectMetadata,
  dbGetPosts,
  dbCreatePost,
  dbLikePost,
  dbAddComment,
  dbGetNotifications,
  dbResetData,
  dbGetIncidents,
  dbGetIncident,
  dbGetIncidentEvents,
  dbCreateIncident,
  dbAddIncidentEvent,
  dbUpdateIncidentStatus,
  dbResolveIncident,
  dbDeleteIncident,
  checkDatabaseLiveConnection,
} from '../lib/db.ts';
import { ServiceName } from '../types.ts';

dotenv.config();

export function createPhasebookApp() {
  const app = express();

  app.use(express.json());

  // Normalize Netlify Functions paths if routed through Netlify's rewrite rules
  app.use((req: Request, res: Response, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      let subPath = req.url.slice('/.netlify/functions/api'.length);
      if (!subPath.startsWith('/')) {
        subPath = '/' + subPath;
      }
      if (!subPath.startsWith('/api') && !subPath.startsWith('/health/database')) {
        req.url = '/api' + subPath;
      } else {
        req.url = subPath;
      }
    }
    next();
  });

  // Ensure database is initialized/connected across both persistent servers and serverless invocations
  app.use(async (req: Request, res: Response, next) => {
    try {
      await ensureDatabaseConnected();
    } catch (err: any) {
      console.warn('[Neon Database] Auto-connect check failed:', err?.message);
    }
    next();
  });

  // Global in-memory simulation state
  let serverState = createInitialSimulatorState();

  // Background metric tick (runs continuously on servers; ticks on request in serverless)
  if (typeof setInterval !== 'undefined') {
    const timer = setInterval(() => {
      serverState = tickMetrics(serverState);
    }, 3000);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  // ---------------------------------------------------------
  // PAGERDUTY DISPATCHER
  // ---------------------------------------------------------
  async function dispatchPagerDuty(
    action: 'trigger' | 'resolve',
    severity: 'critical' | 'error' | 'warning' | 'info',
    summary: string,
    component: string,
    customDetails: Record<string, any> = {}
  ) {
    const event = createPagerDutyEvent(serverState, action, severity, summary, component, customDetails);

    const routingKey = process.env.PAGERDUTY_INTEGRATION_KEY;
    const apiUrl = process.env.PAGERDUTY_API_URL || 'https://events.pagerduty.com/v2/enqueue';

    if (routingKey && routingKey.trim().length > 0) {
      try {
        const pdPayload = {
          routing_key: routingKey.trim(),
          event_action: action,
          dedup_key: event.dedupKey,
          payload: {
            summary: event.summary,
            severity: event.severity,
            source: event.source,
            component: event.component,
            timestamp: event.timestamp,
            custom_details: event.customDetails,
          },
        };

        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pdPayload),
        });

        if (resp.ok) {
          event.status = 'DISPATCHED';
          console.log(`[PagerDuty] Event dispatched to ${apiUrl}: ${summary}`);
        } else {
          event.status = 'FAILED';
          console.warn(`[PagerDuty] Failed with status ${resp.status}`);
        }
      } catch (err: any) {
        event.status = 'FAILED';
        console.error(`[PagerDuty] Error dispatching event:`, err?.message || err);
      }
    } else {
      event.status = 'MOCK_DISPATCHED';
    }

    serverState.pagerDutyEvents = [event, ...serverState.pagerDutyEvents];
    return event;
  }

  // Helper to record crashes in Neon
  async function recordCrashInNeon(state: typeof serverState, eventDetails?: any) {
    if (!state.activeIncident) return;
    try {
      await dbCreateIncident({
        id: state.activeIncident.id,
        title: state.activeIncident.title,
        service: state.activeIncident.service,
        severity: state.activeIncident.severity,
        status: state.activeIncident.status,
        failure_type: state.activeIncident.failureType,
        details: state.activeIncident.details,
        started_at: state.activeIncident.startedAt,
      });
      await dbAddIncidentEvent({
        incident_id: state.activeIncident.id,
        event_type: 'APP_CRASH_DETECTED',
        message: `Demo application crash detected: ${state.activeIncident.title}`,
        details: eventDetails || null,
      });
    } catch (err: any) {
      console.warn('[Neon Incidents] Failed to persist crash incident in Neon:', err?.message);
    }
  }

  // ---------------------------------------------------------
  // PHASEBOOK APPLICATION APIS (POSTGRESQL-BACKED)
  // ---------------------------------------------------------

  // GET Feed
  app.get('/api/feed', async (req: Request, res: Response) => {
    // 1. Bad Deployment check (v2 failure)
    if (serverState.activeFailureType === 'BAD_DEPLOYMENT' || serverState.currentVersion === 'v2') {
      return res.status(500).json({
        error: '500 Internal Server Error',
        message: 'FATAL [v2-feed-aggregator] TypeError: Cannot read property "rankingScore" of undefined in v2.buildFeed()',
        service: 'phasebook-feed',
        version: 'v2',
        traceId: `trace-v2-${Date.now()}`,
      });
    }

    // 2. Database Failure check
    if (serverState.databaseFailure || isDatabaseDown() || serverState.services.database.status === 'DOWN') {
      return res.status(500).json({
        error: '500 Internal Server Error',
        message: 'Neon Database Error: Connection pool exhausted (Connection refused on Neon Serverless Postgres endpoint)',
        service: 'neon-database',
        traceId: `trace-neon-${Date.now()}`,
      });
    }

    // 3. Feed service crashed
    if (serverState.services.feed.status === 'DOWN') {
      return res.status(502).json({
        error: '502 Bad Gateway',
        message: 'Feed service unavailable (phasebook-feed:8081 unreachable: connection refused)',
        service: 'phasebook-feed',
      });
    }

    // 4. High memory latency/timeout
    if (serverState.activeFailureType === 'HIGH_MEMORY' && serverState.selectedFailureTargetService === 'feed') {
      return res.status(504).json({
        error: '504 Gateway Timeout',
        message: 'Feed request timed out after 3000ms: phasebook-feed GC paused (>2200ms) under high memory pressure (247MB/256MB limit)',
        service: 'phasebook-feed',
      });
    }

    // Retrieve from PostgreSQL database
    try {
      const posts = await dbGetPosts();
      res.json({
        success: true,
        feed: posts,
        version: serverState.currentVersion,
        activeDeployment: getCurrentDeployment(),
      });
    } catch (err: any) {
      res.status(500).json({
        error: '500 Internal Server Error',
        message: err?.message || 'Database query error',
        service: 'phasebook-db',
      });
    }
  });

  // POST Create Post
  app.post('/api/posts', async (req: Request, res: Response) => {
    // 1. Bad Deployment failure
    if (serverState.activeFailureType === 'BAD_DEPLOYMENT' || serverState.currentVersion === 'v2') {
      return res.status(500).json({
        error: '500 Internal Server Error',
        message: 'FATAL [v2-post-pipeline] Schema mismatch: field "mediaTags" not supported in schema v2. Failed to commit post transaction.',
        service: 'phasebook-posts',
        version: 'v2',
      });
    }

    // 2. Database failure
    if (serverState.databaseFailure || isDatabaseDown() || serverState.services.database.status === 'DOWN') {
      return res.status(500).json({
        error: '500 Internal Server Error',
        message: 'Database Write Error: Could not acquire client connection from pool (timeout 5000ms on phasebook-db:5432).',
        service: 'phasebook-db',
      });
    }

    // 3. Post-service crashed
    if (serverState.services['post-service'].status === 'DOWN') {
      return res.status(502).json({
        error: '502 Bad Gateway',
        message: 'Post service unavailable (phasebook-posts:8082 unreachable)',
        service: 'phasebook-posts',
      });
    }

    const { content, image } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    try {
      const newPost = await dbCreatePost(content, image);
      res.status(201).json({ success: true, post: newPost });
    } catch (err: any) {
      res.status(500).json({
        error: '500 Internal Server Error',
        message: err?.message || 'Database write error',
      });
    }
  });

  // POST Like Post
  app.post('/api/posts/:id/like', async (req: Request, res: Response) => {
    if (serverState.databaseFailure || isDatabaseDown() || serverState.services.database.status === 'DOWN') {
      return res.status(500).json({
        error: '500 Internal Server Error',
        message: 'Database connection failed: cannot update likes record.',
      });
    }

    try {
      const post = await dbLikePost(req.params.id);
      res.json({ success: true, post });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Like failed' });
    }
  });

  // POST Comment on Post
  app.post('/api/posts/:id/comment', async (req: Request, res: Response) => {
    if (serverState.databaseFailure || isDatabaseDown() || serverState.services.database.status === 'DOWN') {
      return res.status(500).json({
        error: '500 Internal Server Error',
        message: 'Database connection failed: cannot insert comment row into comments table.',
      });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    try {
      const result = await dbAddComment(req.params.id, text);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Comment failed' });
    }
  });

  // GET Notifications
  app.get('/api/notifications', async (req: Request, res: Response) => {
    if (serverState.services['notification-service'].status === 'DOWN') {
      return res.status(502).json({
        error: '502 Bad Gateway',
        message: 'Notification service unavailable (phasebook-notifications:8083 unreachable)',
        service: 'phasebook-notifications',
      });
    }

    try {
      const notifications = await dbGetNotifications();
      res.json({ success: true, notifications });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Notifications unavailable' });
    }
  });

  // POST Payments Checkout (Dependency test)
  app.post('/api/payments/checkout', (req: Request, res: Response) => {
    if (
      serverState.activeFailureType === 'DEPENDENCY_FAILURE' ||
      serverState.services['payment-service'].status === 'DOWN' ||
      serverState.services['payment-service'].health === 'UNHEALTHY'
    ) {
      return res.status(503).json({
        error: '503 Service Unavailable',
        message: 'Upstream Payment API dependency timeout (Circuit breaker OPEN). External payment gateway unreachable.',
        provider: 'Mock Payment API',
        code: 'PAYMENT_GATEWAY_TIMEOUT',
      });
    }

    const { amount, purpose } = req.body;
    res.json({
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount: amount || 4.99,
      purpose: purpose || 'Phasebook Plus Subscription',
      message: 'Payment authorized and settled successfully via Payment API.',
    });
  });

  // ---------------------------------------------------------
  // DATABASE HEALTH & OPERATIONAL APIS
  // ---------------------------------------------------------

  // Required explicit route: GET /health/database
  app.get('/health/database', async (req: Request, res: Response) => {
    const health = await getPostgresHealth();
    const httpCode = health.status === 'CONNECTED' ? 200 : health.status === 'DEGRADED' ? 200 : 503;
    res.status(httpCode).json(health);
  });

  // Safe database health-check endpoint (returns only connected or disconnected without exposing credentials)
  app.get('/api/health/db', async (req: Request, res: Response) => {
    const isConnected = await checkDatabaseLiveConnection();
    res.json({ database: isConnected ? 'connected' : 'disconnected' });
  });

  // Alias for frontend fetch
  app.get('/api/health/database', async (req: Request, res: Response) => {
    const health = await getPostgresHealth();
    res.json(health);
  });

  // Database admin configuration for external connection (psql, DBeaver, pgAdmin)
  app.get('/api/database/config', (req: Request, res: Response) => {
    res.json(getDatabaseAdminConfig());
  });

  // Database metrics
  app.get('/api/database/metrics', async (req: Request, res: Response) => {
    const metrics = await getDatabaseMetrics();
    res.json(metrics);
  });

  // Database connection status
  app.get('/api/database/connections', async (req: Request, res: Response) => {
    const status = await getDatabaseConnectionStatus();
    res.json(status);
  });

  // Safe manual query test on Neon
  app.post('/api/database/test-query', async (req: Request, res: Response) => {
    const health = await getPostgresHealth();
    if (health.status === 'DISCONNECTED') {
      return res.status(500).json({
        success: false,
        error: health.lastError || 'Connection refused on Neon Serverless Postgres endpoint.',
      });
    }
    res.json({
      success: true,
      query: 'SELECT 1 as ping, version();',
      latencyMs: health.latencyMs,
      neonEndpoint: health.neonEndpoint,
      version: health.version,
      message: `Executed on Neon in ${health.latencyMs}ms. Live connection verified via SSL.`,
    });
  });

  // Neon Project & Compute API metadata
  app.get('/api/database/neon-project', async (req: Request, res: Response) => {
    const meta = await getNeonProjectMetadata();
    res.json(meta);
  });

  // Neon Connection Pool recycling
  app.post('/api/database/restart', async (req: Request, res: Response) => {
    const result = await restartDatabaseContainer();
    setDatabaseFailure(false);
    serverState.databaseFailure = false;
    serverState.services.database = {
      ...serverState.services.database,
      status: 'RUNNING',
      health: 'HEALTHY',
      errorRate: 0,
      latencyMs: 12,
    };
    res.json(result);
  });

  // ---------------------------------------------------------
  // INCIDENTS & INCIDENT EVENTS APIS (NEON-BACKED)
  // ---------------------------------------------------------

  // Read incidents from Neon
  app.get('/api/incidents', async (req: Request, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || '50', 10);
      const isConnected = await checkDatabaseLiveConnection();
      const incidents = await dbGetIncidents(limit);
      res.json({
        incidents,
        source: isConnected ? 'neon' : 'fallback',
        database: isConnected ? 'connected' : 'disconnected',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read incidents from Neon' });
    }
  });

  // Read a single incident and its events
  app.get('/api/incidents/:id', async (req: Request, res: Response) => {
    try {
      const incident = await dbGetIncident(req.params.id);
      if (!incident) {
        return res.status(404).json({ error: `Incident ${req.params.id} not found` });
      }
      const events = await dbGetIncidentEvents(req.params.id);
      res.json({ incident, events });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read incident from Neon' });
    }
  });

  // Read incident events for an incident
  app.get('/api/incidents/:id/events', async (req: Request, res: Response) => {
    try {
      const events = await dbGetIncidentEvents(req.params.id);
      res.json({ events });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read incident events from Neon' });
    }
  });

  // Create a new incident in Neon
  app.post('/api/incidents', async (req: Request, res: Response) => {
    try {
      const { id, title, service, severity, status, failure_type, details, started_at } = req.body;
      if (!title || !service || !severity) {
        return res.status(400).json({ error: 'Missing required incident fields: title, service, severity' });
      }
      const incident = await dbCreateIncident({
        id,
        title,
        service,
        severity,
        status: status || 'INVESTIGATING',
        failure_type,
        details,
        started_at,
      });

      // Initial event logged in Neon
      await dbAddIncidentEvent({
        incident_id: incident.id,
        event_type: 'INCIDENT_CREATED',
        message: `Incident ${incident.id} registered in Neon: ${incident.title}`,
        details: { service, severity, failure_type },
      });

      res.status(201).json({ incident });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create incident in Neon' });
    }
  });

  // Clean up an incident safely
  app.delete('/api/incidents/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await dbDeleteIncident(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: `Incident ${req.params.id} not found` });
      }
      res.json({ success: true, message: `Incident ${req.params.id} deleted successfully` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete incident from Neon' });
    }
  });

  // Add incident event as the incident progresses
  app.post('/api/incidents/:id/events', async (req: Request, res: Response) => {
    try {
      const { event_type, message, details } = req.body;
      if (!event_type || !message) {
        return res.status(400).json({ error: 'Missing required event fields: event_type, message' });
      }
      const event = await dbAddIncidentEvent({
        incident_id: req.params.id,
        event_type,
        message,
        details,
      });
      res.status(201).json({ event });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to add incident event in Neon' });
    }
  });

  // Update incident status
  app.patch('/api/incidents/:id/status', async (req: Request, res: Response) => {
    try {
      const { status, details } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Missing required field: status' });
      }
      const incident = await dbUpdateIncidentStatus(req.params.id, status, details);
      if (!incident) {
        return res.status(404).json({ error: `Incident ${req.params.id} not found` });
      }

      await dbAddIncidentEvent({
        incident_id: req.params.id,
        event_type: 'STATUS_UPDATED',
        message: `Incident ${req.params.id} status updated to ${status}`,
        details: { status, details },
      });

      res.json({ incident });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update incident status in Neon' });
    }
  });

  // Mark an incident resolved
  app.post('/api/incidents/:id/resolve', async (req: Request, res: Response) => {
    try {
      const { resolvedAt, details } = req.body;
      const incident = await dbResolveIncident(req.params.id, resolvedAt);
      if (!incident) {
        return res.status(404).json({ error: `Incident ${req.params.id} not found` });
      }

      await dbAddIncidentEvent({
        incident_id: req.params.id,
        event_type: 'INCIDENT_RESOLVED',
        message: `Incident ${req.params.id} marked RESOLVED in Neon`,
        details: { resolvedAt: incident.resolved_at, details },
      });

      res.json({ incident });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to mark incident resolved in Neon' });
    }
  });

  // ---------------------------------------------------------
  // GITHUB & CONTAINER DEPLOYMENT APIS
  // ---------------------------------------------------------

  // GitHub configuration (Never exposes token!)
  app.get('/api/github/config', (req: Request, res: Response) => {
    res.json(getGitHubConfig());
  });

  // Latest commit from GitHub
  app.get('/api/github/commit/latest', async (req: Request, res: Response) => {
    const commit = await fetchLatestCommit();
    res.json(commit);
  });

  // Recent commits list
  app.get('/api/github/commits', async (req: Request, res: Response) => {
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const commits = await fetchRecentCommits(limit);
    res.json({ commits });
  });

  // Specific commit metadata
  app.get('/api/github/commit/:sha', async (req: Request, res: Response) => {
    const commit = await fetchCommitMetadata(req.params.sha);
    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }
    res.json(commit);
  });

  // Check if remote GitHub has newer commit
  app.get('/api/github/check-new', async (req: Request, res: Response) => {
    const currentSha = (req.query.currentSha as string) || getCurrentDeployment().commitHash;
    const check = await checkNewCommitExists(currentSha);
    res.json(check);
  });

  // Deployment history
  app.get('/api/deployments', (req: Request, res: Response) => {
    res.json({
      deployments: getDeploymentHistory(),
      current: getCurrentDeployment(),
      previous: getPreviousDeployment(),
    });
  });

  // Current and previous deployment comparison
  app.get('/api/deployments/current', (req: Request, res: Response) => {
    res.json({
      current: getCurrentDeployment(),
      previous: getPreviousDeployment(),
      all: getDeploymentHistory(),
    });
  });

  // Deployment diff between commits
  app.get('/api/deployments/diff', async (req: Request, res: Response) => {
    const fromSha = (req.query.from as string) || getPreviousDeployment()?.commitHash || '7b8f9e1';
    const toSha = (req.query.to as string) || getCurrentDeployment().commitHash || '3a1c8d5';
    const diff = await fetchDeploymentDiff(fromSha, toSha);
    res.json(diff);
  });

  // Deploy selected GitHub commit into isolated container
  app.post('/api/deployments', async (req: Request, res: Response) => {
    const { commitSha, requestedBy, version, isFaulty } = req.body;
    if (!commitSha) {
      return res.status(400).json({ error: 'commitSha is required for deployment' });
    }

    try {
      const result = await executeContainerDeployment(commitSha, {
        requestedBy,
        version,
        isFaulty,
      });

      // Update simulation state to reflect newly deployed version
      if (isFaulty) {
        serverState = injectBadDeployment(serverState);
        await dispatchPagerDuty(
          'trigger',
          'critical',
          `SEV-1: Faulty deployment ${result.deployment.version} (${result.deployment.shortCommit}) deployed from GitHub`,
          'phasebook-feed',
          {
            commitSha,
            version: result.deployment.version,
            containerId: result.deployment.containerId,
          }
        );
      } else {
        serverState.currentVersion = 'v1';
        serverState.activeFailureType = 'NONE';
      }

      res.status(201).json({
        success: true,
        deployment: result.deployment,
        buildLogs: result.buildLogs,
        containerHealth: result.containerHealth,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Deployment failed',
        message: err?.message || 'Error executing isolated container deployment',
      });
    }
  });

  // Rollback deployment to previous known-good version
  app.post('/api/deployments/rollback', async (req: Request, res: Response) => {
    const { deploymentId } = req.body;
    const rollbackResult = rollbackContainerDeployment(deploymentId);

    // Rollback simulation state as well
    serverState = rollbackDeployment(serverState);

    await dispatchPagerDuty(
      'resolve',
      'info',
      `Rollback Executed: Redeployed known-good version ${rollbackResult.activeDeployment?.version || 'v1.1.0'}`,
      'phasebook-feed',
      {
        restoredVersion: rollbackResult.activeDeployment?.version,
        restoredCommit: rollbackResult.activeDeployment?.shortCommit,
        action: 'rollbackDeployment',
      }
    );

    res.json({
      success: true,
      message: rollbackResult.message,
      activeDeployment: rollbackResult.activeDeployment,
      rolledBackDeployment: rollbackResult.rolledBackDeployment,
      state: serverState,
    });
  });

  // ---------------------------------------------------------
  // SRE-ZERO APIS & SYSTEM TOOLS
  // ---------------------------------------------------------

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Phasebook Edge Gateway',
      systemHealth: getSystemHealth(serverState),
      version: serverState.currentVersion,
      activeDeployment: getCurrentDeployment(),
    });
  });

  app.get('/api/system/state', (req: Request, res: Response) => {
    res.json(serverState);
  });

  app.get('/api/system/health', async (req: Request, res: Response) => {
    const dbHealth = await getPostgresHealth();
    res.json({
      overall: getSystemHealth(serverState),
      services: serverState.services,
      database: dbHealth,
      dependencies: getDependencyHealth(serverState),
      currentVersion: serverState.currentVersion,
      currentDeployment: getCurrentDeployment(),
    });
  });

  app.get('/api/system/metrics', (req: Request, res: Response) => {
    res.json({
      current: getMetrics(serverState),
      history: serverState.metricsHistory,
    });
  });

  app.get('/api/system/logs', (req: Request, res: Response) => {
    res.json({
      logs: getLogs(serverState, 100),
    });
  });

  app.get('/api/system/deployments', (req: Request, res: Response) => {
    res.json({
      deployments: getDeploymentHistory(),
      current: getCurrentDeployment(),
      previous: getPreviousDeployment(),
    });
  });

  // Individual SRE-Zero Diagnostic Tools
  app.get('/api/sre-zero/tools/:toolName', async (req: Request, res: Response) => {
    const tool = req.params.toolName;
    switch (tool) {
      case 'get_service_health':
        return res.json({ result: getSystemHealth(serverState), services: serverState.services });
      case 'get_service_status':
        return res.json({ services: serverState.services });
      case 'get_logs':
        return res.json({ logs: getLogs(serverState, 20) });
      case 'get_metrics':
        return res.json({ metrics: getMetrics(serverState) });
      case 'get_recent_deployments':
        return res.json({
          deployments: getDeploymentHistory(),
          current: getCurrentDeployment(),
          previous: getPreviousDeployment(),
        });
      case 'get_current_version':
        return res.json({
          version: serverState.currentVersion,
          currentDeployment: getCurrentDeployment(),
          isHealthy: serverState.systemHealth === 'HEALTHY',
          uptime: '14h 22m',
        });
      case 'get_deployment_diff': {
        const from = getPreviousDeployment()?.commitHash || '7b8f9e1';
        const to = getCurrentDeployment().commitHash || '3a1c8d5';
        const diff = await fetchDeploymentDiff(from, to);
        return res.json({ diff, from, to });
      }
      case 'get_commit_metadata': {
        const sha = (req.query.sha as string) || getCurrentDeployment().commitHash;
        const meta = await fetchCommitMetadata(sha);
        return res.json({ metadata: meta });
      }
      case 'rollback_deployment': {
        const rollbackResult = rollbackContainerDeployment();
        serverState = rollbackDeployment(serverState);
        return res.json({ success: true, result: rollbackResult });
      }
      case 'get_database_status':
      case 'get_database_health': {
        const dbHealth = await getPostgresHealth();
        return res.json({ database: dbHealth });
      }
      case 'get_database_metrics': {
        const metrics = await getDatabaseMetrics();
        return res.json({ metrics });
      }
      case 'get_database_connection_status': {
        const status = await getDatabaseConnectionStatus();
        return res.json({ status });
      }
      case 'get_dependency_status':
        return res.json({ dependency: getDependencyHealth(serverState) });
      default:
        return res.status(404).json({ error: `Tool ${tool} not found` });
    }
  });

  // Run SRE-Zero Automated Investigation
  app.post('/api/sre-zero/investigate', async (req: Request, res: Response) => {
    const { steps, recommendation } = buildSREZeroInvestigation(serverState);
    serverState.investigationSteps = steps;
    serverState.recommendation = recommendation;
    serverState.remediationApproved = false;
    serverState.remediationInProgress = false;

    if (serverState.activeIncident) {
      try {
        await dbAddIncidentEvent({
          incident_id: serverState.activeIncident.id,
          event_type: 'INVESTIGATION_PROGRESS',
          message: `SRE-Zero automated diagnosis completed: ${recommendation.actionName}`,
          details: { stepsCount: steps.length, recommendation: recommendation.summary },
        });
      } catch (err: any) {
        console.warn('[Neon Incidents] Failed to log investigation event:', err?.message);
      }
    }

    res.json({
      success: true,
      investigationSteps: steps,
      recommendation,
    });
  });

  // SRE-Zero Human Approval & Remediation Execution
  app.post('/api/sre-zero/approve', async (req: Request, res: Response) => {
    if (!serverState.recommendation) {
      return res.status(400).json({ error: 'No active SRE recommendation to approve' });
    }

    const { actionType, targetService } = serverState.recommendation;
    serverState.remediationApproved = true;
    serverState.remediationInProgress = true;

    if (serverState.activeIncident) {
      try {
        await dbUpdateIncidentStatus(
          serverState.activeIncident.id,
          'REMEDIATING',
          `Remediation approved: ${actionType} on ${targetService || 'service'}`
        );
        await dbAddIncidentEvent({
          incident_id: serverState.activeIncident.id,
          event_type: 'REMEDIATION_APPROVED',
          message: `Remediation approved: ${actionType} executing for ${targetService || 'service'}`,
          details: { actionType, targetService },
        });
      } catch (err: any) {
        console.warn('[Neon Incidents] Failed to log remediation approval:', err?.message);
      }
    }

    if (actionType === 'ROLLBACK') {
      rollbackContainerDeployment();
      serverState = rollbackDeployment(serverState);
    } else if (actionType === 'RESTORE_DB') {
      setDatabaseFailure(false);
      await restartDatabaseContainer();
      serverState = restoreDatabase(serverState);
    } else if (actionType === 'RESTART_SERVICE') {
      serverState = restartService(serverState, targetService || 'feed');
    } else if (actionType === 'RESTORE_DEPENDENCY') {
      serverState = restoreDependency(serverState);
    } else if (actionType === 'SCALE_SERVICE') {
      serverState = scaleService(serverState, targetService || 'feed');
    }

    res.json({
      success: true,
      message: `Remediation ${actionType} executed successfully`,
      state: serverState,
    });
  });

  // SRE-Zero Verification & PagerDuty Resolution
  app.post('/api/sre-zero/verify', async (req: Request, res: Response) => {
    serverState = verifyRecovery(serverState);

    // Resolve incident in Neon
    if (serverState.activeIncident) {
      try {
        await dbResolveIncident(serverState.activeIncident.id);
        await dbAddIncidentEvent({
          incident_id: serverState.activeIncident.id,
          event_type: 'INCIDENT_RESOLVED',
          message: `Incident ${serverState.activeIncident.id} verified resolved in Neon`,
          details: { recoveryVerified: true },
        });
      } catch (err: any) {
        console.warn('[Neon Incidents] Failed to log incident resolution:', err?.message);
      }
    }

    // Also dispatch PagerDuty resolve
    if (serverState.activeIncident) {
      await dispatchPagerDuty(
        'resolve',
        'info',
        `Incident Resolved: ${serverState.activeIncident.title}`,
        serverState.activeIncident.service,
        {
          resolutionTime: new Date().toISOString(),
          checksPassed: '5/5 verification probes passed',
        }
      );
    }

    res.json({
      success: true,
      verificationChecks: serverState.verificationChecks,
      recoveryVerified: true,
      state: serverState,
    });
  });

  // ---------------------------------------------------------
  // FAILURE INJECTION APIS
  // ---------------------------------------------------------

  app.post('/api/inject/bad-deployment', async (req: Request, res: Response) => {
    serverState = injectBadDeployment(serverState);
    await recordCrashInNeon(serverState, { version: 'v2', failureType: 'BAD_DEPLOYMENT' });
    await dispatchPagerDuty(
      'trigger',
      'critical',
      'SEV-1: High HTTP 500 Spike & Feed Outage Post-Deployment v2',
      'phasebook-feed',
      { failureType: 'BAD_DEPLOYMENT', version: 'v2' }
    );
    res.json({ success: true, message: 'Bad deployment v2 injected', state: serverState });
  });

  app.post('/api/inject/database-failure', async (req: Request, res: Response) => {
    setDatabaseFailure(true);
    serverState = injectDatabaseFailure(serverState);
    await recordCrashInNeon(serverState, { failureType: 'DATABASE_FAILURE' });
    await dispatchPagerDuty(
      'trigger',
      'critical',
      'SEV-1: Neon Serverless Postgres Unreachable / Connection Timeout',
      'neon-database',
      { failureType: 'DATABASE_FAILURE', host: 'neon.tech', port: 5432 }
    );
    res.json({ success: true, message: 'Neon database failure injected', state: serverState });
  });

  app.post('/api/inject/service-crash', async (req: Request, res: Response) => {
    const service = (req.body.service || 'feed') as ServiceName;
    serverState = injectServiceCrash(serverState, service);
    await recordCrashInNeon(serverState, { failureType: 'SERVICE_CRASH', targetService: service });
    await dispatchPagerDuty(
      'trigger',
      service === 'feed' || service === 'database' || service === 'frontend' ? 'critical' : 'error',
      `SEV-1: Process Crash on ${service}`,
      service,
      { failureType: 'SERVICE_CRASH', targetService: service }
    );
    res.json({ success: true, message: `Service crash injected on ${service}`, state: serverState });
  });

  app.post('/api/inject/dependency-failure', async (req: Request, res: Response) => {
    serverState = injectDependencyFailure(serverState);
    await recordCrashInNeon(serverState, { failureType: 'DEPENDENCY_FAILURE' });
    await dispatchPagerDuty(
      'trigger',
      'warning',
      'SEV-2: External Mock Payment API Degradation / HTTP 503',
      'phasebook-payment-mock',
      { failureType: 'DEPENDENCY_FAILURE' }
    );
    res.json({ success: true, message: 'Payment API dependency failure injected', state: serverState });
  });

  app.post('/api/inject/high-memory', async (req: Request, res: Response) => {
    const service = (req.body.service || 'feed') as ServiceName;
    serverState = injectHighMemory(serverState, service);
    await recordCrashInNeon(serverState, { failureType: 'HIGH_MEMORY', memoryLimitMB: 256, targetService: service });
    await dispatchPagerDuty(
      'trigger',
      'warning',
      `SEV-2: Critical Memory Exhaustion on ${service} (256MB Limit)`,
      service,
      { failureType: 'HIGH_MEMORY', memoryLimitMB: 256 }
    );
    res.json({ success: true, message: `High memory pressure injected on ${service}`, state: serverState });
  });

  app.post('/api/remediate/reset', async (req: Request, res: Response) => {
    const prevIncident = serverState.activeIncident;
    if (prevIncident) {
      try {
        await dbResolveIncident(prevIncident.id);
        await dbAddIncidentEvent({
          incident_id: prevIncident.id,
          event_type: 'SYSTEM_RESET',
          message: `Incident ${prevIncident.id} closed via manual system baseline reset`,
        });
      } catch (err: any) {
        console.warn('[Neon Incidents] Failed to close incident on reset:', err?.message);
      }
    }
    setDatabaseFailure(false);
    dbResetData();
    serverState = resetIncident();
    await dispatchPagerDuty(
      'resolve',
      'info',
      'Manual System Reset: All services restored to healthy baseline v1',
      'phasebook-web',
      { resetBy: 'admin' }
    );
    res.json({ success: true, message: 'System reset to healthy baseline', state: serverState });
  });

  // PagerDuty Events List
  app.get('/api/pagerduty/events', (req: Request, res: Response) => {
    res.json({
      configured: Boolean(process.env.PAGERDUTY_INTEGRATION_KEY),
      apiUrl: process.env.PAGERDUTY_API_URL || 'https://events.pagerduty.com/v2/enqueue',
      events: serverState.pagerDutyEvents,
    });
  });

  return app;
}

export const app = createPhasebookApp();
