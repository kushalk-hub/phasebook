import {
  ServiceName,
  HealthStatus,
  FailureType,
  ServiceState,
  MetricPoint,
  IncidentDetails,
  InvestigationStep,
  SRERecommendation,
  VerificationCheck,
  LogEntry,
  DeploymentRecord,
  SimulatorState,
  PagerDutyEventRecord,
} from '../types';

export const INITIAL_SERVICES: Record<ServiceName, ServiceState> = {
  frontend: {
    name: 'frontend',
    displayName: 'Frontend Gateway (SSR)',
    clusterName: 'phasebook-web',
    status: 'RUNNING',
    health: 'HEALTHY',
    httpStatus: 200,
    cpu: 26,
    memory: 42,
    latencyMs: 35,
    errorRate: 0.1,
    version: 'v1',
    replicas: 3,
  },
  feed: {
    name: 'feed',
    displayName: 'Feed Aggregator Service',
    clusterName: 'phasebook-feed',
    status: 'RUNNING',
    health: 'HEALTHY',
    httpStatus: 200,
    cpu: 31,
    memory: 44,
    latencyMs: 48,
    errorRate: 0.15,
    version: 'v1',
    replicas: 4,
  },
  'post-service': {
    name: 'post-service',
    displayName: 'Posts & Content Service',
    clusterName: 'phasebook-posts',
    status: 'RUNNING',
    health: 'HEALTHY',
    httpStatus: 200,
    cpu: 24,
    memory: 38,
    latencyMs: 29,
    errorRate: 0.05,
    version: 'v1',
    replicas: 3,
  },
  database: {
    name: 'database',
    displayName: 'Neon Database (Serverless Postgres)',
    clusterName: 'neon-postgres',
    status: 'RUNNING',
    health: 'HEALTHY',
    httpStatus: 200,
    cpu: 18,
    memory: 35,
    latencyMs: 14,
    errorRate: 0.0,
    version: 'PostgreSQL 16 (Neon)',
    replicas: 1,
  },
  'payment-service': {
    name: 'payment-service',
    displayName: 'Payment API (Dependency)',
    clusterName: 'phasebook-payment-mock',
    status: 'RUNNING',
    health: 'HEALTHY',
    httpStatus: 200,
    cpu: 18,
    memory: 32,
    latencyMs: 65,
    errorRate: 0.1,
    version: 'v2.4',
    replicas: 2,
  },
  'notification-service': {
    name: 'notification-service',
    displayName: 'Notification & Push Service',
    clusterName: 'phasebook-notifications',
    status: 'RUNNING',
    health: 'HEALTHY',
    httpStatus: 200,
    cpu: 22,
    memory: 36,
    latencyMs: 38,
    errorRate: 0.05,
    version: 'v1',
    replicas: 2,
  },
};

export const INITIAL_DEPLOYMENTS: DeploymentRecord[] = [
  {
    version: 'v1',
    commitHash: '7f9a20b',
    deployedAt: 'Today at 08:30:00 UTC',
    deployedBy: 'ci/cd-pipeline (prod-release)',
    status: 'ACTIVE',
    isBad: false,
  },
  {
    version: 'v0.9.8',
    commitHash: '3c4d11e',
    deployedAt: 'Yesterday at 16:15:20 UTC',
    deployedBy: 'sre-automation',
    status: 'SUPERSEDED',
    isBad: false,
  },
];

function generateInitialMetricsHistory(): MetricPoint[] {
  const points: MetricPoint[] = [];
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now - i * 3000);
    const timeStr = t.toTimeString().split(' ')[0];
    points.push({
      timestamp: timeStr,
      errorRate: +(0.1 + Math.random() * 0.15).toFixed(2),
      requestRate: Math.round(1600 + Math.random() * 150),
      cpu: +(28 + Math.random() * 5).toFixed(1),
      memory: +(42 + Math.random() * 2).toFixed(1),
      latency: Math.round(40 + Math.random() * 8),
      http5xxRate: 0,
      dbConnectionErrors: 0,
    });
  }
  return points;
}

export function createInitialSimulatorState(): SimulatorState {
  const history = generateInitialMetricsHistory();
  return {
    systemHealth: 'HEALTHY',
    currentVersion: 'v1',
    databaseFailure: false,
    activeFailureType: 'NONE',
    selectedFailureTargetService: 'feed',
    services: JSON.parse(JSON.stringify(INITIAL_SERVICES)),
    metricsHistory: history,
    currentMetrics: history[history.length - 1],
    activeIncident: null,
    investigationSteps: [],
    recommendation: null,
    remediationApproved: false,
    remediationInProgress: false,
    verificationChecks: [],
    recoveryVerified: false,
    pagerDutyEvents: [],
    deployments: JSON.parse(JSON.stringify(INITIAL_DEPLOYMENTS)),
    logs: [
      {
        id: 'log-1',
        timestamp: new Date().toTimeString().split(' ')[0],
        service: 'frontend',
        level: 'INFO',
        message: 'Edge gateway phasebook-web listening on port 3000. All microservice upstreams healthy.',
        statusCode: 200,
        traceId: 'trace-init-01',
      },
      {
        id: 'log-2',
        timestamp: new Date().toTimeString().split(' ')[0],
        service: 'feed',
        level: 'INFO',
        message: 'Feed aggregator initialized with in-memory redis cache and post ranker.',
        statusCode: 200,
        traceId: 'trace-init-02',
      },
      {
        id: 'log-3',
        timestamp: new Date().toTimeString().split(' ')[0],
        service: 'database',
        level: 'INFO',
        message: 'PostgreSQL connection pool max_conns=150, active=18, idle=32.',
        statusCode: 200,
        traceId: 'trace-init-03',
      },
    ],
    ticksElapsed: 0,
  };
}

// -------------------------------------------------------------------------
// PAGERDUTY DISPATCH HELPER
// -------------------------------------------------------------------------
export function createPagerDutyEvent(
  state: SimulatorState,
  action: 'trigger' | 'resolve',
  severity: 'critical' | 'error' | 'warning' | 'info',
  summary: string,
  component: string,
  customDetails: Record<string, any>
): PagerDutyEventRecord {
  const dedupKey = state.activeIncident ? `phasebook-inc-${state.activeIncident.id}` : `phasebook-inc-global`;
  return {
    id: `pd-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    eventAction: action,
    dedupKey,
    severity,
    summary,
    source: 'Phasebook Monitoring & SRE-Zero Engine',
    component,
    customDetails: {
      ...customDetails,
      environment: 'production',
      cluster: 'phasebook-k8s-prod',
      version: state.currentVersion,
    },
    status: 'MOCK_DISPATCHED',
  };
}

// -------------------------------------------------------------------------
// REUSABLE QUERY FUNCTIONS FOR SRE-ZERO
// -------------------------------------------------------------------------

export function getSystemHealth(state: SimulatorState): HealthStatus {
  return state.systemHealth;
}

export function getServiceHealth(state: SimulatorState, service: ServiceName): HealthStatus {
  return state.services[service]?.health ?? 'UNHEALTHY';
}

export function getMetrics(state: SimulatorState): MetricPoint {
  return state.currentMetrics;
}

export function getLogs(state: SimulatorState, limit = 50): LogEntry[] {
  return state.logs.slice(-limit);
}

export function getRecentDeployments(state: SimulatorState): DeploymentRecord[] {
  return state.deployments;
}

export function getDatabaseHealth(state: SimulatorState): {
  status: 'RUNNING' | 'DOWN';
  health: HealthStatus;
  connectionErrors: number;
} {
  const db = state.services.database;
  return {
    status: db.status === 'DOWN' ? 'DOWN' : 'RUNNING',
    health: db.health,
    connectionErrors: state.currentMetrics.dbConnectionErrors,
  };
}

export function getDependencyHealth(state: SimulatorState): {
  name: string;
  status: 'RUNNING' | 'DOWN';
  health: HealthStatus;
  httpStatus: number;
} {
  const dep = state.services['payment-service'];
  return {
    name: 'Payment API',
    status: dep.status === 'DOWN' ? 'DOWN' : 'RUNNING',
    health: dep.health,
    httpStatus: dep.httpStatus,
  };
}

// -------------------------------------------------------------------------
// FAILURE INJECTION ENGINE
// -------------------------------------------------------------------------

export function injectBadDeployment(state: SimulatorState): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedDeployments: DeploymentRecord[] = [
    {
      version: 'v2',
      commitHash: '9b2e88a',
      deployedAt: `Today at ${timeStr} UTC`,
      deployedBy: 'deploy-bot (release-pipeline)',
      status: 'ACTIVE',
      isBad: true,
    },
    ...state.deployments.map((d) => ({
      ...d,
      status: 'SUPERSEDED' as const,
    })),
  ];

  const updatedServices = { ...state.services };
  updatedServices.feed = {
    ...updatedServices.feed,
    version: 'v2',
    health: 'UNHEALTHY',
    status: 'DEGRADED',
    httpStatus: 500,
    errorRate: 88.5,
    latencyMs: 740,
    cpu: 65,
  };
  updatedServices['post-service'] = {
    ...updatedServices['post-service'],
    version: 'v2',
    health: 'DEGRADED',
    httpStatus: 500,
    errorRate: 64.2,
  };
  updatedServices.frontend = {
    ...updatedServices.frontend,
    health: 'DEGRADED',
    errorRate: 35.0,
  };

  const newLogs: LogEntry[] = [
    {
      id: `log-${Date.now()}-1`,
      timestamp: timeStr,
      service: 'frontend',
      level: 'INFO',
      message: 'Rolling deployment v2 rollout completed across phasebook-feed and phasebook-posts pods.',
      statusCode: 200,
      traceId: 'deploy-v2-canary',
    },
    {
      id: `log-${Date.now()}-2`,
      timestamp: timeStr,
      service: 'feed',
      level: 'ERROR',
      message: 'FATAL [v2-feed-aggregator] TypeError: Cannot read property "rankingScore" of undefined in v2.buildFeed()',
      statusCode: 500,
      traceId: 'trace-v2-err-01',
    },
    {
      id: `log-${Date.now()}-3`,
      timestamp: timeStr,
      service: 'post-service',
      level: 'ERROR',
      message: 'FATAL [v2-post-pipeline] Schema mismatch: field "mediaTags" not supported in schema v2. Dropping commit.',
      statusCode: 500,
      traceId: 'trace-v2-err-02',
    },
  ];

  const incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
  const incident: IncidentDetails = {
    id: incidentId,
    title: 'SEV-1: High HTTP 500 Spike & Feed Outage Post-Deployment v2',
    service: 'feed',
    severity: 'SEV-1',
    symptoms: [
      'Feed service returning HTTP 500 Internal Server Error (88% rate)',
      'Post publishing failing with schema mismatch exception',
      'End-user browser feed failing to render; retry loop active',
      'Correlated exactly with deployment v2 (commit 9b2e88a)',
    ],
    startedAt: timeStr,
    status: 'INVESTIGATING',
    failureType: 'BAD_DEPLOYMENT',
    details: 'Deployment v2 introduced unhandled TypeError in feed aggregator and schema validation error in post service.',
  };

  const pdEvent = createPagerDutyEvent(
    state,
    'trigger',
    'critical',
    incident.title,
    'phasebook-feed',
    {
      incidentId,
      symptoms: incident.symptoms,
      failureType: 'BAD_DEPLOYMENT',
      version: 'v2',
      commitHash: '9b2e88a',
    }
  );

  return {
    ...state,
    systemHealth: 'UNHEALTHY',
    currentVersion: 'v2',
    databaseFailure: false,
    activeFailureType: 'BAD_DEPLOYMENT',
    selectedFailureTargetService: 'feed',
    services: updatedServices,
    deployments: updatedDeployments,
    logs: [...state.logs, ...newLogs],
    activeIncident: incident,
    pagerDutyEvents: [pdEvent, ...state.pagerDutyEvents],
    investigationSteps: [],
    recommendation: null,
    remediationApproved: false,
    remediationInProgress: false,
    verificationChecks: [],
    recoveryVerified: false,
  };
}

export function injectDatabaseFailure(state: SimulatorState): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedServices = { ...state.services };
  updatedServices.database = {
    ...updatedServices.database,
    status: 'DOWN',
    health: 'UNHEALTHY',
    httpStatus: 500,
    latencyMs: 1400,
    errorRate: 100.0,
    replicas: 0,
  };
  updatedServices.feed = {
    ...updatedServices.feed,
    health: 'DEGRADED',
    httpStatus: 500,
    errorRate: 75.0,
  };
  updatedServices['post-service'] = {
    ...updatedServices['post-service'],
    health: 'UNHEALTHY',
    httpStatus: 500,
    errorRate: 98.0,
  };
  updatedServices.frontend = {
    ...updatedServices.frontend,
    health: 'DEGRADED',
    errorRate: 45.0,
  };

  const newLogs: LogEntry[] = [
    {
      id: `log-${Date.now()}-1`,
      timestamp: timeStr,
      service: 'database',
      level: 'ERROR',
      message: 'CRITICAL [phasebook-db] PostgreSQL connection pool exhausted (max 150/150). Daemon socket closed: ECONNREFUSED 5432.',
      statusCode: 500,
      traceId: 'db-crash-01',
    },
    {
      id: `log-${Date.now()}-2`,
      timestamp: timeStr,
      service: 'post-service',
      level: 'ERROR',
      message: 'Error: Cannot acquire database client for post write transaction. Timed out after 5000ms.',
      statusCode: 500,
      traceId: 'trace-db-fail-02',
    },
    {
      id: `log-${Date.now()}-3`,
      timestamp: timeStr,
      service: 'feed',
      level: 'WARN',
      message: 'Feed query fallback to stale cache due to primary database connection timeout.',
      statusCode: 500,
      traceId: 'trace-db-fail-03',
    },
  ];

  const incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
  const incident: IncidentDetails = {
    id: incidentId,
    title: 'SEV-1: Neon Serverless Postgres Unreachable / Connection Timeout',
    service: 'database',
    severity: 'SEV-1',
    symptoms: [
      'Neon Serverless Postgres endpoint connection timed out on port 5432',
      'Post creation and comment writes failing with 500 Database Error',
      'Feed service queries failing to fetch fresh timeline items',
      'Connection pool error count spiked to 85+ errors/sec',
    ],
    startedAt: timeStr,
    status: 'INVESTIGATING',
    failureType: 'DATABASE_FAILURE',
    details: 'Neon serverless connection pool exhausted or socket closed due to max connection saturation.',
  };

  const pdEvent = createPagerDutyEvent(
    state,
    'trigger',
    'critical',
    incident.title,
    'neon-database',
    {
      incidentId,
      symptoms: incident.symptoms,
      failureType: 'DATABASE_FAILURE',
      port: 5432,
    }
  );

  return {
    ...state,
    systemHealth: 'UNHEALTHY',
    databaseFailure: true,
    activeFailureType: 'DATABASE_FAILURE',
    selectedFailureTargetService: 'database',
    services: updatedServices,
    logs: [...state.logs, ...newLogs],
    activeIncident: incident,
    pagerDutyEvents: [pdEvent, ...state.pagerDutyEvents],
    investigationSteps: [],
    recommendation: null,
    remediationApproved: false,
    remediationInProgress: false,
    verificationChecks: [],
    recoveryVerified: false,
  };
}

export function injectServiceCrash(
  state: SimulatorState,
  targetService: ServiceName = 'feed'
): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedServices = { ...state.services };
  const target = updatedServices[targetService];
  if (!target) return state;

  updatedServices[targetService] = {
    ...target,
    status: 'DOWN',
    health: 'UNHEALTHY',
    httpStatus: 502,
    latencyMs: 2500,
    errorRate: 100,
    cpu: 0,
    replicas: 0,
  };

  if (targetService === 'frontend') {
    state.systemHealth = 'UNHEALTHY';
  } else {
    updatedServices.frontend = {
      ...updatedServices.frontend,
      health: 'DEGRADED',
      errorRate: 30,
    };
  }

  const newLogs: LogEntry[] = [
    {
      id: `log-${Date.now()}-1`,
      timestamp: timeStr,
      service: targetService,
      level: 'ERROR',
      message: `SIGKILL [k8s-pod-watcher] Pod ${target.clusterName}-78bf9c9-x92q terminated unexpectedly (Exit Code 137).`,
      statusCode: 502,
      traceId: `crash-${targetService}-01`,
    },
    {
      id: `log-${Date.now()}-2`,
      timestamp: timeStr,
      service: 'frontend',
      level: 'ERROR',
      message: `HTTP 502 Bad Gateway: Upstream ${targetService} (${target.clusterName}:3000) connection refused.`,
      statusCode: 502,
      traceId: `crash-${targetService}-02`,
    },
  ];

  const isCore = targetService === 'feed' || targetService === 'database' || targetService === 'frontend';
  const severity = isCore ? 'SEV-1' : 'SEV-2';
  const incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;

  const incident: IncidentDetails = {
    id: incidentId,
    title: `${severity}: ${target.displayName} Process Crashed / Zero Replicas`,
    service: targetService,
    severity,
    symptoms: [
      `Service ${target.displayName} (${target.clusterName}) down with 0 healthy replicas`,
      `Gateway returning 502 Bad Gateway for ${targetService} routes`,
      targetService === 'feed'
        ? 'Feed unavailable; other services (profile, notifications) continue to respond'
        : `${target.displayName} functionality completely unavailable to users`,
    ],
    startedAt: timeStr,
    status: 'INVESTIGATING',
    failureType: 'SERVICE_CRASH',
    details: `The isolated ${target.clusterName} container exited with error. Zero active pod instances.`,
  };

  const pdEvent = createPagerDutyEvent(
    state,
    'trigger',
    isCore ? 'critical' : 'error',
    incident.title,
    target.clusterName,
    {
      incidentId,
      symptoms: incident.symptoms,
      failureType: 'SERVICE_CRASH',
      targetService,
    }
  );

  return {
    ...state,
    systemHealth: isCore ? 'UNHEALTHY' : 'DEGRADED',
    activeFailureType: 'SERVICE_CRASH',
    selectedFailureTargetService: targetService,
    services: updatedServices,
    logs: [...state.logs, ...newLogs],
    activeIncident: incident,
    pagerDutyEvents: [pdEvent, ...state.pagerDutyEvents],
    investigationSteps: [],
    recommendation: null,
    remediationApproved: false,
    remediationInProgress: false,
    verificationChecks: [],
    recoveryVerified: false,
  };
}

export function injectDependencyFailure(state: SimulatorState): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedServices = { ...state.services };
  updatedServices['payment-service'] = {
    ...updatedServices['payment-service'],
    status: 'DEGRADED',
    health: 'UNHEALTHY',
    httpStatus: 503,
    latencyMs: 1800,
    errorRate: 95.0,
  };

  const newLogs: LogEntry[] = [
    {
      id: `log-${Date.now()}-1`,
      timestamp: timeStr,
      service: 'payment-service',
      level: 'WARN',
      message: 'WARN [payment-proxy] Upstream payment gateway endpoint returned HTTP 503 Service Unavailable (DNS timeout / gateway load shedding).',
      statusCode: 503,
      traceId: 'dep-fail-01',
    },
    {
      id: `log-${Date.now()}-2`,
      timestamp: timeStr,
      service: 'payment-service',
      level: 'ERROR',
      message: 'Circuit breaker OPEN for mock Payment API after 5 consecutive 503 responses.',
      statusCode: 503,
      traceId: 'dep-fail-02',
    },
  ];

  const incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
  const incident: IncidentDetails = {
    id: incidentId,
    title: 'SEV-2: External Mock Payment API Degradation / HTTP 503',
    service: 'payment-service',
    severity: 'SEV-2',
    symptoms: [
      'Payment API dependency returning HTTP 503 Service Unavailable',
      'Phasebook Plus subscription checkout & creator tipping failing',
      'Core Phasebook Feed, Posts, and DB remain 100% operational',
      'External gateway circuit breaker open',
    ],
    startedAt: timeStr,
    status: 'INVESTIGATING',
    failureType: 'DEPENDENCY_FAILURE',
    details: 'Third-party mock payment gateway upstream experiencing outage; Phasebook core social features unaffected.',
  };

  const pdEvent = createPagerDutyEvent(
    state,
    'trigger',
    'warning',
    incident.title,
    'phasebook-payment-mock',
    {
      incidentId,
      symptoms: incident.symptoms,
      failureType: 'DEPENDENCY_FAILURE',
    }
  );

  return {
    ...state,
    systemHealth: 'DEGRADED',
    activeFailureType: 'DEPENDENCY_FAILURE',
    selectedFailureTargetService: 'payment-service',
    services: updatedServices,
    logs: [...state.logs, ...newLogs],
    activeIncident: incident,
    pagerDutyEvents: [pdEvent, ...state.pagerDutyEvents],
    investigationSteps: [],
    recommendation: null,
    remediationApproved: false,
    remediationInProgress: false,
    verificationChecks: [],
    recoveryVerified: false,
  };
}

export function injectHighMemory(
  state: SimulatorState,
  targetService: ServiceName = 'feed'
): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedServices = { ...state.services };
  const target = updatedServices[targetService] || updatedServices.feed;

  updatedServices[target.name] = {
    ...target,
    status: 'DEGRADED',
    health: 'UNHEALTHY',
    httpStatus: 504,
    memory: 96.5,
    cpu: 89.2,
    latencyMs: 2950,
    errorRate: 45.0,
  };

  const newLogs: LogEntry[] = [
    {
      id: `log-${Date.now()}-1`,
      timestamp: timeStr,
      service: target.name,
      level: 'WARN',
      message: `RESOURCE WARNING: Memory usage on ${target.clusterName} reached 247MB / 256MB limit (96.5%).`,
      statusCode: 200,
      traceId: `mem-warn-${target.name}-01`,
    },
    {
      id: `log-${Date.now()}-2`,
      timestamp: timeStr,
      service: target.name,
      level: 'ERROR',
      message: `GC pause thrashing (>2200ms). Gateway timeout 504 on ${target.name} query pipeline.`,
      statusCode: 504,
      traceId: `mem-warn-${target.name}-02`,
    },
  ];

  const incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
  const incident: IncidentDetails = {
    id: incidentId,
    title: `SEV-2: Critical Memory Exhaustion on ${target.displayName} (256MB Limit)`,
    service: target.name,
    severity: 'SEV-2',
    symptoms: [
      `Memory utilization at 96.5% inside isolated 256MB container`,
      `P99 latency spiked from 45ms to 2,950ms due to GC thrashing`,
      `Client requests timing out with HTTP 504 Gateway Timeout`,
      `Container approaching OOMKilled threshold`,
    ],
    startedAt: timeStr,
    status: 'INVESTIGATING',
    failureType: 'HIGH_MEMORY',
    details: `Controlled heap pressure inside isolated ${target.clusterName} sandbox. Service CPU & latency severely degraded.`,
  };

  const pdEvent = createPagerDutyEvent(
    state,
    'trigger',
    'warning',
    incident.title,
    target.clusterName,
    {
      incidentId,
      symptoms: incident.symptoms,
      failureType: 'HIGH_MEMORY',
      memoryUsedMB: 247,
      memoryLimitMB: 256,
    }
  );

  return {
    ...state,
    systemHealth: 'DEGRADED',
    activeFailureType: 'HIGH_MEMORY',
    selectedFailureTargetService: target.name,
    services: updatedServices,
    logs: [...state.logs, ...newLogs],
    activeIncident: incident,
    pagerDutyEvents: [pdEvent, ...state.pagerDutyEvents],
    investigationSteps: [],
    recommendation: null,
    remediationApproved: false,
    remediationInProgress: false,
    verificationChecks: [],
    recoveryVerified: false,
  };
}

// -------------------------------------------------------------------------
// REMEDIATION ENGINE
// -------------------------------------------------------------------------

export function rollbackDeployment(state: SimulatorState): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedDeployments: DeploymentRecord[] = [
    {
      version: 'v1',
      commitHash: '7f9a20b',
      deployedAt: `Today at ${timeStr} UTC (Rollback)`,
      deployedBy: 'SRE-Zero Agent (Automated Remediation)',
      status: 'ACTIVE',
      isBad: false,
    },
    ...state.deployments.map((d) => ({
      ...d,
      status: d.version === 'v2' ? ('ROLLED_BACK' as const) : ('SUPERSEDED' as const),
    })),
  ];

  const updatedServices = { ...state.services };
  updatedServices.feed = {
    ...INITIAL_SERVICES.feed,
    version: 'v1',
    lastRestart: timeStr,
  };
  updatedServices['post-service'] = {
    ...INITIAL_SERVICES['post-service'],
    version: 'v1',
    lastRestart: timeStr,
  };
  updatedServices.frontend = {
    ...INITIAL_SERVICES.frontend,
  };

  const rollbackLog: LogEntry = {
    id: `log-${Date.now()}-rb`,
    timestamp: timeStr,
    service: 'system',
    level: 'INFO',
    message: 'REMEDIATION [sre-zero]: kubectl rollout undo deployment/phasebook-feed deployment/phasebook-posts -> v1 successful.',
    statusCode: 200,
    traceId: 'sre-rollback-01',
  };

  return {
    ...state,
    currentVersion: 'v1',
    services: updatedServices,
    deployments: updatedDeployments,
    logs: [...state.logs, rollbackLog],
    remediationApproved: true,
    remediationInProgress: false,
  };
}

export function restoreDatabase(state: SimulatorState): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedServices = { ...state.services };
  updatedServices.database = {
    ...INITIAL_SERVICES.database,
    lastRestart: timeStr,
  };
  updatedServices.feed = {
    ...INITIAL_SERVICES.feed,
  };
  updatedServices['post-service'] = {
    ...INITIAL_SERVICES['post-service'],
  };
  updatedServices.frontend = {
    ...INITIAL_SERVICES.frontend,
  };

  const restoreLog: LogEntry = {
    id: `log-${Date.now()}-dbr`,
    timestamp: timeStr,
    service: 'database',
    level: 'INFO',
    message: 'REMEDIATION [sre-zero]: Neon Serverless Postgres connection pool recycled and SSL connection re-established. All queries accepted.',
    statusCode: 200,
    traceId: 'sre-dbrestore-01',
  };

  return {
    ...state,
    databaseFailure: false,
    services: updatedServices,
    logs: [...state.logs, restoreLog],
    remediationApproved: true,
    remediationInProgress: false,
  };
}

export function restartService(
  state: SimulatorState,
  targetService: ServiceName = 'feed'
): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedServices = { ...state.services };
  const baseline = INITIAL_SERVICES[targetService];
  if (baseline) {
    updatedServices[targetService] = {
      ...baseline,
      lastRestart: timeStr,
    };
  }
  updatedServices.frontend = {
    ...INITIAL_SERVICES.frontend,
  };

  const restartLog: LogEntry = {
    id: `log-${Date.now()}-rst`,
    timestamp: timeStr,
    service: targetService,
    level: 'INFO',
    message: `REMEDIATION [sre-zero]: Restarted ${targetService} container (${baseline?.clusterName}). Container re-spawned with 3 healthy replicas.`,
    statusCode: 200,
    traceId: `sre-restart-${targetService}`,
  };

  return {
    ...state,
    services: updatedServices,
    logs: [...state.logs, restartLog],
    remediationApproved: true,
    remediationInProgress: false,
  };
}

export function restoreDependency(state: SimulatorState): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedServices = { ...state.services };
  updatedServices['payment-service'] = {
    ...INITIAL_SERVICES['payment-service'],
    lastRestart: timeStr,
  };

  const depLog: LogEntry = {
    id: `log-${Date.now()}-depr`,
    timestamp: timeStr,
    service: 'payment-service',
    level: 'INFO',
    message: 'REMEDIATION [sre-zero]: Upstream mock Payment API gateway reconnected. Circuit breaker reset to CLOSED state. 200 OK verified.',
    statusCode: 200,
    traceId: 'sre-deprestore-01',
  };

  return {
    ...state,
    services: updatedServices,
    logs: [...state.logs, depLog],
    remediationApproved: true,
    remediationInProgress: false,
  };
}

export function scaleService(
  state: SimulatorState,
  targetService: ServiceName = 'feed'
): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const updatedServices = { ...state.services };
  const baseline = INITIAL_SERVICES[targetService] || INITIAL_SERVICES.feed;
  updatedServices[targetService] = {
    ...baseline,
    replicas: 6,
    memory: 38,
    cpu: 25,
    latencyMs: 32,
    lastRestart: timeStr,
  };

  const scaleLog: LogEntry = {
    id: `log-${Date.now()}-scl`,
    timestamp: timeStr,
    service: targetService,
    level: 'INFO',
    message: `REMEDIATION [sre-zero]: Scaled ${targetService} from 3 -> 6 replicas. Traffic rebalanced, heap pressure relieved.`,
    statusCode: 200,
    traceId: `sre-scale-${targetService}`,
  };

  return {
    ...state,
    services: updatedServices,
    logs: [...state.logs, scaleLog],
    remediationApproved: true,
    remediationInProgress: false,
  };
}

export function verifyRecovery(state: SimulatorState): SimulatorState {
  const checks: VerificationCheck[] = [
    {
      id: 'chk-1',
      label: 'Edge Gateway Health (GET /api/health)',
      passed: true,
      currentValue: '200 OK',
      targetValue: '200 OK',
    },
    {
      id: 'chk-2',
      label: 'Feed Pipeline Query (GET /api/feed)',
      passed: true,
      currentValue: '200 OK (38ms latency)',
      targetValue: '200 OK (<100ms)',
    },
    {
      id: 'chk-3',
      label: 'Post Creation Transaction (POST /api/posts)',
      passed: true,
      currentValue: '201 Created (DB committed)',
      targetValue: '201 Created',
    },
    {
      id: 'chk-4',
      label: 'Notification Service (GET /api/notifications)',
      passed: true,
      currentValue: '200 OK (2 replicas online)',
      targetValue: '200 OK',
    },
    {
      id: 'chk-5',
      label: 'System Error Rate & SLO Compliance',
      passed: true,
      currentValue: '0.08% errors (99.92% SLO)',
      targetValue: '<0.5% errors',
    },
  ];

  let updatedIncident = state.activeIncident;
  let pdEvents = state.pagerDutyEvents;

  if (updatedIncident) {
    updatedIncident = {
      ...updatedIncident,
      status: 'RESOLVED',
    };

    // Send PagerDuty Resolve event!
    const pdResolve = createPagerDutyEvent(
      state,
      'resolve',
      'info',
      `Incident ${updatedIncident.id} Resolved: ${updatedIncident.title}`,
      updatedIncident.service,
      {
        incidentId: updatedIncident.id,
        resolutionTime: new Date().toISOString(),
        verifiedChecks: '5/5 Passed',
      }
    );
    pdEvents = [pdResolve, ...pdEvents];
  }

  return {
    ...state,
    systemHealth: 'HEALTHY',
    activeFailureType: 'NONE',
    databaseFailure: false,
    activeIncident: updatedIncident,
    pagerDutyEvents: pdEvents,
    verificationChecks: checks,
    recoveryVerified: true,
    remediationInProgress: false,
  };
}

export function resetIncident(): SimulatorState {
  return createInitialSimulatorState();
}

// -------------------------------------------------------------------------
// SRE-ZERO INVESTIGATION EVIDENCE BUILDER
// -------------------------------------------------------------------------

export function buildSREZeroInvestigation(state: SimulatorState): {
  steps: InvestigationStep[];
  recommendation: SRERecommendation;
} {
  const steps: InvestigationStep[] = [];
  const now = new Date();
  const formatT = (offsetSeconds: number) => {
    return new Date(now.getTime() - offsetSeconds * 1000).toTimeString().split(' ')[0];
  };

  // Step 1: Health check across edge gateway
  steps.push({
    id: 'step-1',
    timestamp: formatT(14),
    message: 'Executing tool: get_service_health() across all 6 registered microservices',
    status: 'DONE',
    commandRun: 'curl -s http://localhost:3000/api/system/health | jq .',
    commandOutput: JSON.stringify(
      {
        overall: state.systemHealth,
        activeDeployments: state.currentVersion,
        services: Object.keys(state.services).map((k) => ({
          name: k,
          status: state.services[k as ServiceName].status,
          httpStatus: state.services[k as ServiceName].httpStatus,
        })),
      },
      null,
      2
    ),
    finding: `Service health check returned overall status: ${state.systemHealth}. Anomaly detected in telemetry.`,
  });

  // Step 2: Recent deployment verification
  const recentDeploy = state.deployments[0];
  const isBadDeploy = state.activeFailureType === 'BAD_DEPLOYMENT';
  steps.push({
    id: 'step-2',
    timestamp: formatT(11),
    message: 'Executing tool: get_recent_deployments() to correlate incident timing with git commits',
    status: isBadDeploy ? 'FLAGGED' : 'DONE',
    commandRun: 'git log -n 2 --oneline && kubectl get deployment -o jsonpath="{..image}"',
    commandOutput: `Current active: ${recentDeploy.version} (${recentDeploy.commitHash}) by ${recentDeploy.deployedBy}`,
    finding: isBadDeploy
      ? `CRITICAL CORRELATION: Deployment ${recentDeploy.version} (${recentDeploy.commitHash}) was deployed recently. High error rate began immediately post-rollout.`
      : `Deployments checked: Active version is ${recentDeploy.version} (${recentDeploy.commitHash}). No recent abnormal deployments.`,
  });

  // Step 3: Database health check
  const isDbFailure = state.databaseFailure || state.services.database.status === 'DOWN';
  steps.push({
    id: 'step-3',
    timestamp: formatT(8),
    message: 'Executing tool: get_database_status() on Neon Serverless Postgres endpoint',
    status: isDbFailure ? 'FLAGGED' : 'DONE',
    commandRun: 'psql "$DATABASE_URL" -c "SELECT 1 as ping, count(*) FROM pg_stat_activity;"',
    commandOutput: isDbFailure
      ? 'Connection timed out: neon.tech:5432. Serverless connection pool exhausted or closed.'
      : 'neon.tech:5432 - accepting SSL connections. Active pooled connections: 8/10. Latency: 14ms.',
    finding: isDbFailure
      ? 'DATABASE CRITICAL: Neon Serverless Postgres connection timed out. Pool exhausted. Write transactions failing across post-service.'
      : 'Neon Serverless Postgres database healthy and responsive with sub-15ms query execution.',
  });

  // Step 4: External dependency verification
  const isDepFailure = state.activeFailureType === 'DEPENDENCY_FAILURE';
  steps.push({
    id: 'step-4',
    timestamp: formatT(6),
    message: 'Executing tool: get_dependency_status() for Payment API mock gateway',
    status: isDepFailure ? 'FLAGGED' : 'DONE',
    commandRun: 'curl -sI https://payment-api.internal/healthz',
    commandOutput: isDepFailure
      ? 'HTTP/1.1 503 Service Unavailable\r\nContent-Type: application/json\r\n{"error": "Upstream timeout"}'
      : 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n{"status": "ready"}',
    finding: isDepFailure
      ? 'DEPENDENCY ANOMALY: Mock Payment API returning HTTP 503. Dependent checkout and tipping features blocked.'
      : 'Payment API dependency responding with 200 OK.',
  });

  // Step 5: Log & metric inspection
  const isHighMem = state.activeFailureType === 'HIGH_MEMORY';
  const isCrash = state.activeFailureType === 'SERVICE_CRASH';
  const targetSvc = state.selectedFailureTargetService;

  steps.push({
    id: 'step-5',
    timestamp: formatT(3),
    message: 'Executing tool: get_logs() and get_metrics() to inspect stack traces and resource utilization',
    status: isHighMem || isCrash ? 'FLAGGED' : 'DONE',
    commandRun: `kubectl logs -l app=${targetSvc} --tail=10 && kubectl top pods`,
    commandOutput: isHighMem
      ? `MEMORY CRITICAL: Pod ${targetSvc} memory at 247MB / 256MB limit. GC thrashing observed.`
      : isCrash
      ? `CRASHED POD: Pod ${targetSvc} terminated with exit code 137. 0 running replicas.`
      : `Tail logs normal. Recent error rate: ${state.currentMetrics.errorRate}%.`,
    finding: isHighMem
      ? `Resource limit reached on ${targetSvc} container. High latency (2800ms+) and 504 timeouts.`
      : isCrash
      ? `Container for ${targetSvc} is completely down. Gateway unable to route traffic.`
      : 'Log inspection complete.',
  });

  // Determine recommendation based on actual gathered evidence:
  let recommendation: SRERecommendation;

  if (isBadDeploy) {
    recommendation = {
      rootCause: 'Bad deployment v2 syntax error in feed aggregator & post schema mismatch',
      summary:
        'Telemetry confirms error spike immediately followed deployment v2 (commit 9b2e88a). Feed aggregator throws unhandled TypeError, preventing feed construction.',
      actionName: 'Rollback Deployment: v2 → v1',
      actionType: 'ROLLBACK',
      targetService: 'feed',
      risk: 'Low',
      executionDetails:
        'Executes kubectl rollout undo deployment/phasebook-feed and deployment/phasebook-posts, reverting to proven stable v1 container images.',
    };
  } else if (isDbFailure) {
    recommendation = {
      rootCause: 'Neon Serverless Postgres connection pool exhausted / socket timeout',
      summary:
        'Database health check returned connection timeout on Neon endpoint. All downstream write operations and cache refreshes are failing with database timeout errors.',
      actionName: 'Restore Neon Connection & Recycle Pool',
      actionType: 'RESTORE_DB',
      targetService: 'database',
      risk: 'Low',
      executionDetails:
        'Clears orphan connections, recycles Neon Serverless Postgres client pool, and restores SSL connection pool capacity with zero data loss.',
    };
  } else if (isDepFailure) {
    recommendation = {
      rootCause: 'External Mock Payment API returning HTTP 503 upstream error',
      summary:
        'Core Phasebook application is healthy, but third-party mock Payment API has failed or trip circuit breakers. Phasebook Plus checkout is degraded.',
      actionName: 'Restore Payment API Dependency & Reset Gateway Circuit Breaker',
      actionType: 'RESTORE_DEPENDENCY',
      targetService: 'payment-service',
      risk: 'Low',
      executionDetails:
        'Resets mock payment gateway connection endpoint, closes open circuit breaker, and verifies mock token transactions.',
    };
  } else if (isHighMem) {
    recommendation = {
      rootCause: `Critical memory constraint on isolated ${targetSvc} service (96.5% of 256MB limit)`,
      summary:
        `Container reached 247MB of its strict 256MB memory quota. Excessive garbage collection cycles are causing 2,900ms+ request latency and gateway timeouts.`,
      actionName: `Scale & Restart ${targetSvc} Service`,
      actionType: 'SCALE_SERVICE',
      targetService: targetSvc,
      risk: 'Low',
      executionDetails:
        `Scales ${targetSvc} deployment from 3 to 6 pods and recycles exhausted worker processes to rebalance heap memory.`,
    };
  } else if (isCrash) {
    recommendation = {
      rootCause: `Pod crash on ${targetSvc} service (Process exited, 0 healthy replicas)`,
      summary:
        `Microservice ${targetSvc} container terminated unexpectedly. Edge gateway returns 502 Bad Gateway for all associated routes.`,
      actionName: `Restart ${targetSvc} Service Container`,
      actionType: 'RESTART_SERVICE',
      targetService: targetSvc,
      risk: 'Low',
      executionDetails:
        `Re-spawns ${targetSvc} pods, verifies liveness and readiness probes, and reconnects gateway ingress routing.`,
    };
  } else {
    recommendation = {
      rootCause: 'Transient network perturbation or baseline degradation',
      summary: 'Automated probes have re-evaluated all upstreams. Telemetry indicates system is operating within target SLOs.',
      actionName: 'Restart Service',
      actionType: 'RESTART_SERVICE',
      targetService: 'feed',
      risk: 'Low',
      executionDetails: 'Standard diagnostic restart.',
    };
  }

  return { steps, recommendation };
}

// -------------------------------------------------------------------------
// PERIODIC METRIC TICK
// -------------------------------------------------------------------------

export function tickMetrics(state: SimulatorState): SimulatorState {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  let targetErrorRate = 0.1;
  let targetHttp5xx = 0;
  let targetDbErrors = 0;
  let targetLatency = 42;
  let targetCpu = 28;
  let targetMemory = 42;

  if (state.activeFailureType === 'BAD_DEPLOYMENT') {
    targetErrorRate = 88.0;
    targetHttp5xx = 1420;
    targetLatency = 680;
    targetCpu = 62;
  } else if (state.activeFailureType === 'DATABASE_FAILURE') {
    targetErrorRate = 95.0;
    targetHttp5xx = 1850;
    targetDbErrors = 85;
    targetLatency = 1200;
  } else if (state.activeFailureType === 'SERVICE_CRASH') {
    targetErrorRate = 48.0;
    targetHttp5xx = 920;
    targetLatency = 850;
  } else if (state.activeFailureType === 'DEPENDENCY_FAILURE') {
    targetErrorRate = 18.5;
    targetHttp5xx = 160;
    targetLatency = 240;
  } else if (state.activeFailureType === 'HIGH_MEMORY') {
    targetErrorRate = 35.0;
    targetHttp5xx = 480;
    targetLatency = 2850;
    targetCpu = 88;
    targetMemory = 96.5;
  }

  const newMetric: MetricPoint = {
    timestamp: timeStr,
    errorRate: +(targetErrorRate + (Math.random() * 2 - 1)).toFixed(2),
    requestRate: Math.round(1600 + Math.random() * 120),
    cpu: +(targetCpu + Math.random() * 3).toFixed(1),
    memory: +(targetMemory + Math.random() * 1.5).toFixed(1),
    latency: Math.round(targetLatency + (Math.random() * 10 - 5)),
    http5xxRate: targetHttp5xx > 0 ? Math.round(targetHttp5xx + Math.random() * 40) : 0,
    dbConnectionErrors: targetDbErrors > 0 ? Math.round(targetDbErrors + Math.random() * 8) : 0,
  };

  const updatedHistory = [...state.metricsHistory.slice(1), newMetric];

  return {
    ...state,
    metricsHistory: updatedHistory,
    currentMetrics: newMetric,
    ticksElapsed: state.ticksElapsed + 1,
  };
}
