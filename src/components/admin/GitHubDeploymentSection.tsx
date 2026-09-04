import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Box,
  Layers,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Code2,
  FileCode,
  ShieldAlert,
  Server,
  Terminal,
  ChevronRight,
  Shield,
  Zap,
} from 'lucide-react';
import { DeploymentRecord, GitHubCommit, DeploymentDiff } from '../../types';

interface GitHubDeploymentSectionProps {
  onRollback: (deploymentId?: string) => Promise<void>;
  currentVersion: string;
}

export const GitHubDeploymentSection: React.FC<GitHubDeploymentSectionProps> = ({
  onRollback,
  currentVersion,
}) => {
  const [config, setConfig] = useState<{
    configured: boolean;
    repository: string;
    branch: string;
    hasToken: boolean;
  }>({
    configured: false,
    repository: 'akshaysantani01/phasebook',
    branch: 'main',
    hasToken: false,
  });

  const [currentDeployment, setCurrentDeployment] = useState<DeploymentRecord | null>(null);
  const [previousDeployment, setPreviousDeployment] = useState<DeploymentRecord | null>(null);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [recentCommits, setRecentCommits] = useState<GitHubCommit[]>([]);
  const [selectedCommitDiff, setSelectedCommitDiff] = useState<DeploymentDiff | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [manualCommitSha, setManualCommitSha] = useState('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch GitHub Config & Deployments
  const loadDeploymentData = useCallback(async () => {
    try {
      // 1. Config
      const configRes = await fetch('/api/github/config');
      if (configRes.ok) {
        const conf = await configRes.json();
        setConfig(conf);
      }

      // 2. Deployments
      const depRes = await fetch('/api/deployments');
      if (depRes.ok) {
        const depData = await depRes.json();
        setCurrentDeployment(depData.current || null);
        setPreviousDeployment(depData.previous || null);
        setDeployments(depData.deployments || []);
      }

      // 3. Commits
      const commitsRes = await fetch('/api/github/commits?limit=5');
      if (commitsRes.ok) {
        const commitData = await commitsRes.json();
        setRecentCommits(commitData.commits || []);
      }
    } catch (err) {
      console.error('Failed to load deployment data:', err);
    }
  }, []);

  useEffect(() => {
    loadDeploymentData();
  }, [loadDeploymentData, currentVersion]);

  // Handle Deploy Commit
  const handleDeploy = async (commitSha: string, isFaulty = false) => {
    setIsDeploying(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commitSha,
          requestedBy: 'Admin (Deployment Console)',
          version: isFaulty ? 'v2.0.0' : `v1.${deployments.length}.0`,
          isFaulty,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({
          type: 'success',
          message: `Deployed commit ${commitSha.substring(0, 7)} into isolated container ${data.deployment.containerId}`,
        });
        await loadDeploymentData();
      } else {
        setActionNotice({
          type: 'error',
          message: data.message || 'Deployment execution failed',
        });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Deployment error' });
    } finally {
      setIsDeploying(false);
    }
  };

  // Handle Rollback
  const handleExecuteRollback = async () => {
    setIsRollingBack(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/deployments/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({
          type: 'success',
          message: `Rollback successful! Redeployed known-good version ${data.activeDeployment?.version || 'v1.1.0'}`,
        });
        await onRollback();
        await loadDeploymentData();
      } else {
        setActionNotice({ type: 'error', message: data.message || 'Rollback failed' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Rollback error' });
    } finally {
      setIsRollingBack(false);
    }
  };

  // Handle View Diff
  const handleViewDiff = async () => {
    try {
      const fromSha = previousDeployment?.commitHash || '7b8f9e1';
      const toSha = currentDeployment?.commitHash || '3a1c8d5';
      const res = await fetch(`/api/deployments/diff?from=${fromSha}&to=${toSha}`);
      if (res.ok) {
        const diffData = await res.json();
        setSelectedCommitDiff(diffData);
        setIsDiffModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load deployment diff:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/80 text-purple-400 flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                GitHub Repository & Isolated Container Deployment
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-400 border border-purple-800 font-mono">
                SOURCE OF TRUTH
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Code changes in GitHub repository deploy into isolated runtime containers with cgroups and health probes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDeploymentData}
            disabled={isLoadingCommits}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCommits ? 'animate-spin' : ''}`} />
            <span>Fetch from GitHub</span>
          </button>
        </div>
      </div>

      {/* REPOSITORY & BRANCH STATUS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Repository</span>
          <div className="flex items-center gap-2 text-white font-mono text-xs font-bold truncate">
            <GitPullRequest className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">{config.repository}</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Branch</span>
          <div className="flex items-center gap-2 text-white font-mono text-xs font-bold">
            <GitBranch className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{config.branch}</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">GitHub Token Auth</span>
          <div className="flex items-center gap-2 text-xs font-bold">
            {config.hasToken ? (
              <span className="text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" /> Configured (Server-Side PAT)
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 font-mono">
                <AlertCircle className="w-3.5 h-3.5" /> Public Access / Rate-Limited
              </span>
            )}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Runtime Isolation</span>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold">
            <Box className="w-3.5 h-3.5 shrink-0" />
            <span>Docker cgroups (512MB limit)</span>
          </div>
        </div>
      </div>

      {/* ACTION NOTICE BANNER */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/70 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* COMPARISON CARDS: CURRENT DEPLOYMENT vs PREVIOUS DEPLOYMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CURRENT DEPLOYMENT CARD */}
        <div className="p-5 bg-slate-900 border-2 border-blue-500/60 rounded-2xl space-y-4 relative shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                CURRENT DEPLOYMENT
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full font-mono ${
                  currentDeployment?.healthResult === 'HEALTHY'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                }`}
              >
                {currentDeployment?.healthResult || 'HEALTHY'}
              </span>
              <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 px-2 py-0.5 rounded-md border border-blue-800">
                {currentDeployment?.version || 'v1.1.0'}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Commit SHA */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Commit SHA:</span>
              <span className="font-mono text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-bold">
                {currentDeployment?.commitHash || '3a1c8d5e9f2b4a7c6d8e0f1a3b5c7e9d2f4a6b8c'}
              </span>
            </div>

            {/* Commit Message */}
            <div>
              <span className="text-slate-400 block mb-1">Commit Message:</span>
              <p className="font-mono text-slate-200 bg-slate-950 p-2.5 rounded-xl border border-slate-800 leading-relaxed text-[11px]">
                {currentDeployment?.commitMessage || 'fix(feed): optimize timeline caching and PostgreSQL connection pool sizing'}
              </p>
            </div>

            {/* Author & Timestamp */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{currentDeployment?.commitAuthor || 'akshaysantani01'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentDeployment?.deployedAt ? new Date(currentDeployment.deployedAt).toLocaleTimeString() : 'Just now'}</span>
              </div>
            </div>

            {/* Container & Sandbox Isolation Details */}
            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] space-y-1 font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Container ID:</span>
                <span className="text-blue-400">{currentDeployment?.containerId || 'pb-runtime-3a1c8d5'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>cgroup Limits:</span>
                <span className="text-slate-300">CPU 1.0 &bull; RAM 512MB</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Deployment Status:</span>
                <span className={`font-bold ${currentDeployment?.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {currentDeployment?.status || 'ACTIVE'}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleViewDiff}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                <span>View Commit Diff</span>
              </button>

              <button
                onClick={handleExecuteRollback}
                disabled={isRollingBack}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? 'animate-spin' : ''}`} />
                <span>Rollback to Previous</span>
              </button>
            </div>
          </div>
        </div>

        {/* PREVIOUS DEPLOYMENT CARD */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                PREVIOUS DEPLOYMENT
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                {previousDeployment?.healthResult || 'HEALTHY'}
              </span>
              <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                {previousDeployment?.version || 'v1.0.0'}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Commit SHA */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Commit SHA:</span>
              <span className="font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-bold">
                {previousDeployment?.commitHash || '7b8f9e1204a9cd3e8b4e78a2c1f9304e650b2841'}
              </span>
            </div>

            {/* Commit Message */}
            <div>
              <span className="text-slate-400 block mb-1">Commit Message:</span>
              <p className="font-mono text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 leading-relaxed text-[11px]">
                {previousDeployment?.commitMessage || 'feat(core): initial Phasebook production release with microservices and PostgreSQL backend'}
              </p>
            </div>

            {/* Author & Timestamp */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span className="truncate">{previousDeployment?.commitAuthor || 'SRE Lead'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{previousDeployment?.deployedAt ? new Date(previousDeployment.deployedAt).toLocaleTimeString() : 'Earlier'}</span>
              </div>
            </div>

            {/* Container & Sandbox Status */}
            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] space-y-1 font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Container ID:</span>
                <span className="text-slate-300">{previousDeployment?.containerId || 'pb-runtime-7b8f9e1'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Deployment State:</span>
                <span className="text-slate-400 uppercase">{previousDeployment?.status || 'SUPERSEDED'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Known-Good Health:</span>
                <span className="text-emerald-400 font-bold">VERIFIED STABLE</span>
              </div>
            </div>

            {/* Quick Rollback to this exact version */}
            <div className="pt-1">
              <button
                onClick={() => handleDeploy(previousDeployment?.commitHash || '7b8f9e1', false)}
                disabled={isDeploying}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Redeploy This Known-Good Version</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RECENT COMMITS & MANUAL DEPLOYMENT BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Deploy From GitHub Commits
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Select any commit to build & deploy into isolated container
          </span>
        </div>

        {/* Manual Commit Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter custom GitHub commit SHA (e.g. 9f2e4b6c8d0a...)"
            value={manualCommitSha}
            onChange={(e) => setManualCommitSha(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={() => handleDeploy(manualCommitSha || '9f2e4b6c8d0a1f3e5c7a9b1d3f5e7a9c1b3d5e7f', false)}
            disabled={isDeploying || !manualCommitSha.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
          >
            <Box className="w-3.5 h-3.5" />
            <span>Deploy SHA</span>
          </button>
        </div>

        {/* Commits List */}
        <div className="space-y-2">
          {recentCommits.map((commit) => (
            <div
              key={commit.sha}
              className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800 shrink-0">
                  {commit.shortSha}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 truncate">{commit.message}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {commit.author} &bull; {new Date(commit.date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentDeployment?.commitHash?.startsWith(commit.shortSha) ? (
                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                    CURRENTLY DEPLOYED
                  </span>
                ) : (
                  <button
                    onClick={() => handleDeploy(commit.sha, false)}
                    disabled={isDeploying}
                    className="bg-slate-800 hover:bg-purple-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors border border-slate-700 flex items-center gap-1.5"
                  >
                    <span>Deploy</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DEPLOYMENT HISTORY LOG */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Deployment History & Audit Trail
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {deployments.length} total releases
          </span>
        </div>

        <div className="space-y-2">
          {deployments.map((dep) => (
            <div
              key={dep.id}
              className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white font-mono">{dep.version}</span>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                    {dep.shortCommit || dep.commitHash.substring(0, 7)}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${
                      dep.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : dep.status === 'ROLLED_BACK'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {dep.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate max-w-md">{dep.commitMessage}</p>
              </div>

              <div className="text-right text-[11px] text-slate-400 font-mono">
                <div>{new Date(dep.deployedAt).toLocaleString()}</div>
                <div className="text-slate-500">by {dep.deployedBy}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COMMIT DIFF MODAL */}
      {isDiffModalOpen && selectedCommitDiff && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-sm">
                  Deployment Diff: {selectedCommitDiff.fromSha} &rarr; {selectedCommitDiff.toSha}
                </h3>
              </div>
              <button
                onClick={() => setIsDiffModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="flex items-center gap-4 text-slate-400 border-b border-slate-800 pb-2">
                <span>Files changed: {selectedCommitDiff.totalFiles}</span>
                <span className="text-emerald-400">+{selectedCommitDiff.additions} additions</span>
                <span className="text-rose-400">-{selectedCommitDiff.deletions} deletions</span>
              </div>

              {selectedCommitDiff.files.map((f, i) => (
                <div key={i} className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between font-bold text-slate-300">
                    <span>{f.filename}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{f.status}</span>
                  </div>
                  {f.patch && (
                    <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto text-slate-300 bg-black/60">
                      {f.patch.split('\n').map((line, idx) => (
                        <div
                          key={idx}
                          className={
                            line.startsWith('+')
                              ? 'text-emerald-400 bg-emerald-950/40'
                              : line.startsWith('-')
                              ? 'text-rose-400 bg-rose-950/40'
                              : 'text-slate-400'
                          }
                        >
                          {line}
                        </div>
                      ))}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsDiffModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
