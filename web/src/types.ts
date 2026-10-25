export type ServiceName =
  | 'frontend'
  | 'feed'
  | 'post-service'
  | 'database'
  | 'payment-service'
  | 'notification-service';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export type FailureType =
  | 'NONE'
  | 'BAD_DEPLOYMENT'
  | 'DATABASE_FAILURE'
  | 'SERVICE_CRASH'
  | 'DEPENDENCY_FAILURE'
  | 'HIGH_MEMORY';

export type IncidentSeverity = 'SEV-1' | 'SEV-2' | 'SEV-3';

export type IncidentStatus = 'IDLE' | 'INVESTIGATING' | 'REMEDIATING' | 'VERIFYING' | 'RESOLVED';

export interface ServiceState {
  name: ServiceName;
  displayName: string;
  clusterName: string;
  status: 'RUNNING' | 'DEGRADED' | 'DOWN';
  health: HealthStatus;
  httpStatus: number;
  cpu: number;
  memory: number;
  latencyMs: number;
  errorRate: number;
  version: string;
  replicas: number;
  lastRestart?: string;
}

export interface MetricPoint {
  timestamp: string;
  errorRate: number; // percentage 0-100
  requestRate: number; // req/sec
  cpu: number; // percentage 0-100
  memory: number; // percentage 0-100
  latency: number; // ms
  http5xxRate: number; // 5xx req/sec
  dbConnectionErrors: number; // error count/sec
}

export interface IncidentDetails {
  id: string;
  title: string;
  service: ServiceName;
  severity: IncidentSeverity;
  symptoms: string[];
  startedAt: string;
  status: IncidentStatus;
  failureType: FailureType;
  details: string;
}

export type SREZeroToolName =
  | 'get_service_health'
  | 'get_service_status'
  | 'get_logs'
  | 'get_metrics'
  | 'get_recent_deployments'
  | 'get_database_status'
  | 'get_dependency_status'
  | 'get_current_version'
  | 'get_deployment_diff'
  | 'get_commit_metadata'
  | 'rollback_deployment'
  | 'get_database_health'
  | 'get_database_metrics'
  | 'get_database_connection_status';

export interface InvestigationStep {
  id: string;
  stepNumber?: number;
  toolName?: string;
  timestamp: string;
  message: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FLAGGED';
  finding?: string;
  commandRun?: string;
  commandOutput?: string;
  output?: any;
  description?: string;
}

export interface SRERecommendation {
  rootCause: string;
  summary: string;
  actionName: string;
  action?: string;
  actionType: 'ROLLBACK' | 'RESTORE_DB' | 'RESTART_SERVICE' | 'RESTORE_DEPENDENCY' | 'SCALE_SERVICE';
  targetService?: ServiceName;
  risk: 'Low' | 'Medium' | 'High' | 'LOW' | 'MEDIUM' | 'HIGH';
  executionDetails: string;
  evidence?: string[];
}

export interface VerificationCheck {
  id: string;
  label: string;
  name?: string;
  passed: boolean;
  currentValue: string;
  details?: string;
  targetValue: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  service: ServiceName | 'system' | 'sre-zero';
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  statusCode?: number;
  traceId?: string;
}

export interface GitHubCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorAvatar?: string;
  date: string;
  htmlUrl?: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
}

export interface DeploymentRecord {
  id?: string;
  version: string;
  commitHash: string;
  shortCommit?: string;
  commitMessage?: string;
  commitAuthor?: string;
  commitDate?: string;
  deployedAt: string;
  deployedBy: string;
  status: 'ACTIVE' | 'ROLLED_BACK' | 'SUPERSEDED' | 'FAILED' | 'BUILDING';
  healthResult?: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'PENDING';
  isBad?: boolean;
  containerId?: string;
  imageTag?: string;
  cgroupLimits?: {
    cpu: string;
    memory: string;
  };
  isolationStatus?: string;
  healthChecksPassed?: boolean;
  logSummary?: string;
}

export interface DeploymentDiff {
  fromSha: string;
  toSha: string;
  totalFiles: number;
  additions: number;
  deletions: number;
  files: Array<{
    filename: string;
    status: 'modified' | 'added' | 'removed';
    patch?: string;
    additions: number;
    deletions: number;
  }>;
}

export interface DatabaseHealthInfo {
  status: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
  latencyMs: number;
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  database: string;
  host: string;
  port: number;
  user: string;
  isPostgres: boolean;
  version: string;
  uptimeSeconds: number;
  tableCounts: {
    users: number;
    profiles: number;
    posts: number;
    comments: number;
    likes: number;
    friendships: number;
    notifications: number;
    deployments: number;
    incidents: number;
    incident_events?: number;
  };
  lastError?: string;
  // Neon Serverless operational fields
  isNeon?: boolean;
  neonEndpoint?: string;
  neonProjectId?: string;
  neonComputeState?: string;
  sslEnabled?: boolean;
  connectionType?: 'NEON_SERVERLESS' | 'DIRECT_POSTGRES' | 'SANDBOX_FALLBACK';
  availability?: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE';
}

// -------------------------------------------------------------
// PagerDuty Integration Data Models
// -------------------------------------------------------------
export interface PagerDutyEventRecord {
  id: string;
  timestamp: string;
  eventAction: 'trigger' | 'acknowledge' | 'resolve';
  dedupKey: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  summary: string;
  source: string;
  component: string;
  customDetails: Record<string, any>;
  status: 'DISPATCHED' | 'FAILED' | 'MOCK_DISPATCHED';
}

// -------------------------------------------------------------
// Phasebook Social Network Data Models
// -------------------------------------------------------------
export interface PhasebookUser {
  id: string | number;
  name: string;
  username: string;
  avatar: string;
  verified?: boolean;
  role?: string;
}

export interface PhasebookComment {
  id: string | number;
  author: PhasebookUser;
  text: string;
  timestamp: string;
  likes: number;
}

export interface PhasebookPost {
  id: string | number;
  author: PhasebookUser;
  timestamp: string;
  content: string;
  image?: string;
  imageUrl?: string;
  likes: number;
  userLiked: boolean;
  comments: PhasebookComment[];
  shares: number;
  isSponsored?: boolean;
}

export interface PhasebookStory {
  id: string;
  user: PhasebookUser;
  image: string;
  hasUnseen: boolean;
}

export interface PhasebookNotification {
  id: string;
  user: PhasebookUser;
  action: string;
  target: string;
  timestamp: string;
  read: boolean;
  avatarIcon?: string;
}

export interface SimulatorState {
  // Global health
  systemHealth: HealthStatus;
  currentVersion: 'v1' | 'v2';
  databaseFailure: boolean;
  activeFailureType: FailureType;
  selectedFailureTargetService: ServiceName;

  // Services
  services: Record<ServiceName, ServiceState>;

  // Metrics time-series
  metricsHistory: MetricPoint[];
  currentMetrics: MetricPoint;

  // Incident & SRE-Zero
  activeIncident: IncidentDetails | null;
  investigationSteps: InvestigationStep[];
  recommendation: SRERecommendation | null;
  remediationApproved: boolean;
  remediationInProgress: boolean;
  verificationChecks: VerificationCheck[];
  recoveryVerified: boolean;

  // PagerDuty Events Log
  pagerDutyEvents: PagerDutyEventRecord[];

  // Logs & Deployments
  logs: LogEntry[];
  deployments: DeploymentRecord[];

  // Simulation clock
  ticksElapsed: number;
}

export interface IncidentRecord {
  id: string | number;
  title: string;
  service: string;
  severity: string;
  status: string;
  deployment_id?: number | null;
  root_cause?: string | null;
  failure_type?: string | null;
  details?: string | null;
  started_at: string;
  resolved_at?: string | null;
}

export interface IncidentEventRecord {
  id: string | number;
  incident_id: string | number;
  event_type: string;
  message?: string;
  description?: string;
  actor?: string | null;
  details?: any;
  created_at: string;
}
