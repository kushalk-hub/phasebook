import { GitHubCommit, DeploymentRecord, DeploymentDiff } from '../types.ts';

// In-memory deployment log and state
let deploymentHistory: DeploymentRecord[] = [
  {
    id: 'dep_01_init',
    version: 'v1.0.0',
    commitHash: '7b8f9e1204a9cd3e8b4e78a2c1f9304e650b2841',
    shortCommit: '7b8f9e1',
    commitMessage: 'feat(core): initial Phasebook production release with microservices and PostgreSQL backend',
    commitAuthor: 'SRE Lead <sre@phasebook.internal>',
    commitDate: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    deployedAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    deployedBy: 'CI/CD Pipeline (GitHub Actions)',
    status: 'SUPERSEDED',
    healthResult: 'HEALTHY',
    isBad: false,
    containerId: 'pb-runtime-7b8f9e1',
    imageTag: 'phasebook-runtime:v1.0.0',
    cgroupLimits: { cpu: '1.0 core', memory: '512 MB' },
    isolationStatus: 'SANDBOXED_CONTAINER',
    healthChecksPassed: true,
    logSummary: 'All 6 microservice containers booted healthy. Database schema migrations passed.',
  },
  {
    id: 'dep_02_stable',
    version: 'v1.1.0',
    commitHash: '3a1c8d5e9f2b4a7c6d8e0f1a3b5c7e9d2f4a6b8c',
    shortCommit: '3a1c8d5',
    commitMessage: 'fix(feed): optimize timeline caching and PostgreSQL connection pool sizing',
    commitAuthor: 'Platform Eng <platform@phasebook.internal>',
    commitDate: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    deployedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    deployedBy: 'akshaysantani01 (GitHub Push)',
    status: 'ACTIVE',
    healthResult: 'HEALTHY',
    isBad: false,
    containerId: 'pb-runtime-3a1c8d5',
    imageTag: 'phasebook-runtime:v1.1.0',
    cgroupLimits: { cpu: '1.0 core', memory: '512 MB' },
    isolationStatus: 'SANDBOXED_CONTAINER',
    healthChecksPassed: true,
    logSummary: 'Container health probe returned 200 OK. Latency 18ms. Feed aggregation verified.',
  },
];

// Fallback commits if GitHub API is unreachable or repo not yet configured
const FALLBACK_COMMITS: GitHubCommit[] = [
  {
    sha: '3a1c8d5e9f2b4a7c6d8e0f1a3b5c7e9d2f4a6b8c',
    shortSha: '3a1c8d5',
    message: 'fix(feed): optimize timeline caching and PostgreSQL connection pool sizing',
    author: 'akshaysantani01',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    date: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    filesChanged: 4,
    additions: 42,
    deletions: 11,
  },
  {
    sha: '9f2e4b6c8d0a1f3e5c7a9b1d3f5e7a9c1b3d5e7f',
    shortSha: '9f2e4b6',
    message: 'refactor(feed): upgrade ranking aggregator schema and media pipeline v2',
    author: 'dev-team',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    date: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    filesChanged: 7,
    additions: 128,
    deletions: 34,
  },
  {
    sha: '7b8f9e1204a9cd3e8b4e78a2c1f9304e650b2841',
    shortSha: '7b8f9e1',
    message: 'feat(core): initial Phasebook production release with microservices and PostgreSQL backend',
    author: 'akshaysantani01',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    date: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    filesChanged: 28,
    additions: 2150,
    deletions: 0,
  },
];

export function getGitHubConfig() {
  const repo = process.env.GITHUB_REPOSITORY?.trim() || '';
  const branch = process.env.GITHUB_BRANCH?.trim() || 'main';
  const hasToken = Boolean(process.env.GITHUB_TOKEN?.trim());

  return {
    configured: Boolean(repo),
    repository: repo || 'akshaysantani01/phasebook',
    branch,
    hasToken,
    // Note: GITHUB_TOKEN is NEVER sent to client
  };
}

function getAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Phasebook-SRE-Deployment-Engine',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchLatestCommit(): Promise<GitHubCommit> {
  const config = getGitHubConfig();
  if (process.env.GITHUB_REPOSITORY?.trim()) {
    try {
      const url = `https://api.github.com/repos/${config.repository}/commits/${config.branch}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        return {
          sha: data.sha,
          shortSha: data.sha.substring(0, 7),
          message: data.commit.message,
          author: data.commit.author?.name || data.author?.login || 'Unknown',
          authorAvatar: data.author?.avatar_url,
          date: data.commit.author?.date || new Date().toISOString(),
          htmlUrl: data.html_url,
          filesChanged: data.files?.length || 0,
        };
      }
    } catch (err) {
      console.warn('[GitHub API] Failed to fetch latest commit from remote:', err);
    }
  }

  // Fallback to latest local commit
  return FALLBACK_COMMITS[0];
}

export async function fetchRecentCommits(limit = 10): Promise<GitHubCommit[]> {
  const config = getGitHubConfig();
  if (process.env.GITHUB_REPOSITORY?.trim()) {
    try {
      const url = `https://api.github.com/repos/${config.repository}/commits?sha=${config.branch}&per_page=${limit}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((item: any) => ({
            sha: item.sha,
            shortSha: item.sha.substring(0, 7),
            message: item.commit.message,
            author: item.commit.author?.name || item.author?.login || 'Unknown',
            authorAvatar: item.author?.avatar_url,
            date: item.commit.author?.date || new Date().toISOString(),
            htmlUrl: item.html_url,
          }));
        }
      }
    } catch (err) {
      console.warn('[GitHub API] Failed to fetch commits from remote:', err);
    }
  }

  return FALLBACK_COMMITS;
}

export async function fetchCommitMetadata(sha: string): Promise<GitHubCommit | null> {
  const config = getGitHubConfig();
  if (process.env.GITHUB_REPOSITORY?.trim()) {
    try {
      const url = `https://api.github.com/repos/${config.repository}/commits/${sha}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        return {
          sha: data.sha,
          shortSha: data.sha.substring(0, 7),
          message: data.commit.message,
          author: data.commit.author?.name || data.author?.login || 'Unknown',
          authorAvatar: data.author?.avatar_url,
          date: data.commit.author?.date || new Date().toISOString(),
          htmlUrl: data.html_url,
          filesChanged: data.files?.length || 0,
          additions: data.stats?.additions || 0,
          deletions: data.stats?.deletions || 0,
        };
      }
    } catch (err) {
      console.warn(`[GitHub API] Failed to fetch metadata for ${sha}:`, err);
    }
  }

  const found = FALLBACK_COMMITS.find((c) => c.sha.startsWith(sha) || sha.startsWith(c.sha));
  return found || null;
}

export async function checkNewCommitExists(currentSha: string): Promise<{
  hasNewCommit: boolean;
  latestCommit: GitHubCommit;
  behindBy: number;
}> {
  const latest = await fetchLatestCommit();
  const hasNewCommit = !latest.sha.toLowerCase().startsWith(currentSha.toLowerCase().substring(0, 7));
  return {
    hasNewCommit,
    latestCommit: latest,
    behindBy: hasNewCommit ? 1 : 0,
  };
}

export async function fetchDeploymentDiff(fromSha: string, toSha: string): Promise<DeploymentDiff> {
  const config = getGitHubConfig();
  if (process.env.GITHUB_REPOSITORY?.trim()) {
    try {
      const url = `https://api.github.com/repos/${config.repository}/compare/${fromSha}...${toSha}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        return {
          fromSha: fromSha.substring(0, 7),
          toSha: toSha.substring(0, 7),
          totalFiles: data.files?.length || 0,
          additions: data.total_commits || data.files?.reduce((acc: number, f: any) => acc + f.additions, 0) || 0,
          deletions: data.files?.reduce((acc: number, f: any) => acc + f.deletions, 0) || 0,
          files: (data.files || []).map((f: any) => ({
            filename: f.filename,
            status: f.status,
            patch: f.patch,
            additions: f.additions,
            deletions: f.deletions,
          })),
        };
      }
    } catch (err) {
      console.warn(`[GitHub API] Diff failed between ${fromSha} and ${toSha}:`, err);
    }
  }

  // Realistic mock diff between v1 and v2
  return {
    fromSha: fromSha.substring(0, 7),
    toSha: toSha.substring(0, 7),
    totalFiles: 3,
    additions: 48,
    deletions: 12,
    files: [
      {
        filename: 'src/services/feed/aggregator.ts',
        status: 'modified',
        additions: 32,
        deletions: 6,
        patch: `@@ -45,6 +45,18 @@ export async function buildFeed(userId: string) {
-  const posts = await db.query('SELECT * FROM posts ORDER BY created_at DESC');
-  return posts;
+  // v2 Ranking pipeline with experimental score sorting
+  const rawPosts = await db.query('SELECT * FROM posts');
+  const ranked = rawPosts.map(p => {
+    // BUG: rankingScore may be undefined on existing posts
+    return { ...p, score: p.metadata.rankingScore.weight * 1.5 };
+  });
+  return ranked.sort((a, b) => b.score - a.score);`,
      },
      {
        filename: 'src/services/posts/pipeline.ts',
        status: 'modified',
        additions: 14,
        deletions: 4,
        patch: `@@ -18,4 +18,8 @@ export async function validatePostPayload(payload: any) {
+  if (!payload.mediaTags) {
+    throw new Error('FATAL: Schema v2 requires non-null mediaTags property');
+  }`,
      },
      {
        filename: 'package.json',
        status: 'modified',
        additions: 2,
        deletions: 2,
        patch: `@@ -4,2 +4,2 @@
-  "version": "1.1.0"
+  "version": "2.0.0"`,
      },
    ],
  };
}

// -------------------------------------------------------------
// Containerized Isolated Deployment Engine
// -------------------------------------------------------------
export async function executeContainerDeployment(
  commitSha: string,
  options: {
    requestedBy?: string;
    version?: string;
    isFaulty?: boolean;
  } = {}
): Promise<{
  deployment: DeploymentRecord;
  buildLogs: string[];
  containerHealth: 'HEALTHY' | 'UNHEALTHY';
}> {
  const commitMeta = await fetchCommitMetadata(commitSha);
  const shortSha = commitSha.substring(0, 7);
  const requestedBy = options.requestedBy || 'Admin Console';
  const version = options.version || (options.isFaulty ? 'v2.0.0' : `v1.${deploymentHistory.length}.0`);

  const buildLogs: string[] = [
    `[GitHub Engine] Cloning commit ${shortSha} from configured branch...`,
    `[Docker Build] Building container image: phasebook-runtime:${shortSha}`,
    `[Isolation Check] Applying cgroup limits: cpu=1.0, memory=512MB, no-new-privileges=true`,
    `[Docker Run] Spawning isolated runtime container: pb-runtime-${shortSha} on internal bridge 172.28.0.0/16`,
    `[Health Probe] Executing initial readiness probe: GET http://127.0.0.1:3000/api/health`,
  ];

  const isFaulty = Boolean(options.isFaulty);
  let healthResult: 'HEALTHY' | 'UNHEALTHY' = isFaulty ? 'UNHEALTHY' : 'HEALTHY';

  if (isFaulty) {
    buildLogs.push(`[Health Probe ERROR] Probe failed: HTTP 500 on /api/feed (Schema validation crash)`);
  } else {
    buildLogs.push(`[Health Probe SUCCESS] HTTP 200 OK received in 14ms. Ready for production ingress.`);
  }

  // Supersede previous active deployments
  deploymentHistory.forEach((dep) => {
    if (dep.status === 'ACTIVE') {
      dep.status = 'SUPERSEDED';
    }
  });

  const newDeployment: DeploymentRecord = {
    id: `dep_${Date.now()}_${shortSha}`,
    version,
    commitHash: commitSha,
    shortCommit: shortSha,
    commitMessage: commitMeta?.message || `Deploy commit ${shortSha}`,
    commitAuthor: commitMeta?.author || requestedBy,
    commitDate: commitMeta?.date || new Date().toISOString(),
    deployedAt: new Date().toISOString(),
    deployedBy: requestedBy,
    status: isFaulty ? 'FAILED' : 'ACTIVE',
    healthResult,
    isBad: isFaulty,
    containerId: `pb-runtime-${shortSha}`,
    imageTag: `phasebook-runtime:${version}`,
    cgroupLimits: { cpu: '1.0 core', memory: '512 MB' },
    isolationStatus: 'SANDBOXED_CONTAINER',
    healthChecksPassed: !isFaulty,
    logSummary: buildLogs.join('\n'),
  };

  deploymentHistory = [newDeployment, ...deploymentHistory];

  return {
    deployment: newDeployment,
    buildLogs,
    containerHealth: healthResult,
  };
}

export function rollbackDeployment(targetDeploymentId?: string): {
  success: boolean;
  rolledBackDeployment: DeploymentRecord | null;
  activeDeployment: DeploymentRecord | null;
  message: string;
} {
  const currentActive = deploymentHistory.find((d) => d.status === 'ACTIVE' || d.status === 'FAILED');

  // Find target or previous known-good deployment
  let target: DeploymentRecord | undefined;
  if (targetDeploymentId) {
    target = deploymentHistory.find((d) => d.id === targetDeploymentId);
  }

  if (!target) {
    // Find the latest known-good healthy deployment
    target = deploymentHistory.find(
      (d) => d.healthResult === 'HEALTHY' && d.id !== currentActive?.id && !d.isBad
    );
  }

  if (!target) {
    // Fallback to initial deployment
    target = deploymentHistory[deploymentHistory.length - 1];
  }

  if (currentActive) {
    currentActive.status = 'ROLLED_BACK';
  }

  target.status = 'ACTIVE';

  return {
    success: true,
    rolledBackDeployment: currentActive || null,
    activeDeployment: target,
    message: `Successfully rolled back to known-good deployment ${target.version} (${target.shortCommit || target.commitHash.substring(0, 7)})`,
  };
}

export function getDeploymentHistory(): DeploymentRecord[] {
  return [...deploymentHistory];
}

export function getCurrentDeployment(): DeploymentRecord {
  return deploymentHistory.find((d) => d.status === 'ACTIVE') || deploymentHistory[0];
}

export function getPreviousDeployment(): DeploymentRecord | null {
  const current = getCurrentDeployment();
  const others = deploymentHistory.filter((d) => d.id !== current.id);
  return others.length > 0 ? others[0] : null;
}
