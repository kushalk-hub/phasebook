import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Play,
  CheckCircle2,
  XCircle,
  Activity,
  Terminal,
  Server,
  Database,
  Layers,
  Cpu,
  RefreshCw,
  Bell,
  ArrowLeft,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Flame,
  Zap,
  GitBranch,
  Box,
} from 'lucide-react';
import {
  SimulatorState,
  ServiceName,
  SREZeroToolName,
  FailureType,
} from '../../types';
import { GitHubDeploymentSection } from './GitHubDeploymentSection';
import { PostgresAdminSection } from './PostgresAdminSection';

interface AdminControlPanelProps {
  simulatorState: SimulatorState;
  onNavigateToPhasebook: () => void;
  onInjectFailure: (type: FailureType, service?: ServiceName) => Promise<void>;
  onResetSystem: () => Promise<void>;
  onRunInvestigation: () => Promise<void>;
  onApproveRemediation: () => Promise<void>;
  onVerifyRecovery: () => Promise<void>;
  onExecuteTool: (toolName: SREZeroToolName) => Promise<any>;
}

const SERVICE_KEYS: ServiceName[] = [
  'frontend',
  'feed',
  'post-service',
  'database',
  'payment-service',
  'notification-service',
];

export const AdminControlPanel: React.FC<AdminControlPanelProps> = ({
  simulatorState,
  onNavigateToPhasebook,
  onInjectFailure,
  onResetSystem,
  onRunInvestigation,
  onApproveRemediation,
  onVerifyRecovery,
  onExecuteTool,
}) => {
  const [activeTab, setActiveTab] = useState<'chaos' | 'github' | 'postgres' | 'pagerduty'>('chaos');
  const [selectedCrashService, setSelectedCrashService] = useState<ServiceName>('feed');
  const [selectedHighMemoryService, setSelectedHighMemoryService] = useState<ServiceName>('feed');
  const [activeToolResult, setActiveToolResult] = useState<{ tool: string; data: any } | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rejectionNotice, setRejectionNotice] = useState(false);

  const handleInject = async (type: FailureType, service?: ServiceName) => {
    setIsInjecting(true);
    setRejectionNotice(false);
    await onInjectFailure(type, service);
    setIsInjecting(false);
  };

  const handleRunInvestigation = async () => {
    setIsInvestigating(true);
    await onRunInvestigation();
    setIsInvestigating(false);
  };

  const handleApprove = async () => {
    setIsApproving(true);
    await onApproveRemediation();
    setIsApproving(false);
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    await onVerifyRecovery();
    setIsVerifying(false);
  };

  const handleToolClick = async (toolName: SREZeroToolName) => {
    const data = await onExecuteTool(toolName);
    setActiveToolResult({ tool: toolName, data });
  };

  const handleRollback = async () => {
    await onApproveRemediation();
  };

  const isHealthy = simulatorState.systemHealth === 'HEALTHY';
  const isDegraded = simulatorState.systemHealth === 'DEGRADED';
  const isUnhealthy = simulatorState.systemHealth === 'UNHEALTHY';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToPhasebook}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Phasebook</span>
          </button>

          <div className="h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
              S0
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">
                Phasebook SRE-Zero Incident Operations Deck
              </h1>
              <p className="text-[11px] text-slate-400">
                GitHub-Driven Deployments &bull; Neon Serverless Postgres &bull; Autonomous SRE Remediation
              </p>
            </div>
          </div>
        </div>

        {/* Global Badges & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Version Badge */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 text-xs font-mono">
            <span className="text-slate-400">Deployment:</span>
            <span
              className={`font-bold ${
                simulatorState.currentVersion === 'v1' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {simulatorState.currentVersion}
            </span>
          </div>

          {/* System Health Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold ${
              isHealthy
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                : isDegraded
                ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80'
                : 'bg-rose-950/80 text-rose-400 border border-rose-800/80 animate-pulse'
            }`}
          >
            {isHealthy && <CheckCircle2 className="w-3.5 h-3.5" />}
            {isDegraded && <AlertTriangle className="w-3.5 h-3.5" />}
            {isUnhealthy && <Flame className="w-3.5 h-3.5" />}
            <span>STATUS: {simulatorState.systemHealth}</span>
          </div>

          {/* Reset System Quick Trigger */}
          <button
            onClick={onResetSystem}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1 rounded-md text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Baseline</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 space-y-6">
        {/* TAB NAVIGATION STRIP */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('chaos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'chaos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Chaos & Operations Deck</span>
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'github'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <GitBranch className="w-4 h-4 text-purple-400" />
            <span>GitHub & Deployments</span>
          </button>

          <button
            onClick={() => setActiveTab('postgres')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'postgres'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Neon Database</span>
          </button>

          <button
            onClick={() => setActiveTab('pagerduty')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pagerduty'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>PagerDuty Events ({simulatorState.pagerDutyEvents.length})</span>
          </button>
        </div>

        {/* ACTIVE INCIDENT ALERT BANNER (Visible on all tabs when triggered) */}
        {simulatorState.activeIncident && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-900/80 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-rose-900 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-sm">
                    {simulatorState.activeIncident.severity}
                  </span>
                  <h3 className="font-bold text-white text-sm">
                    {simulatorState.activeIncident.title}
                  </h3>
                </div>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  Target: <span className="font-mono">{simulatorState.activeIncident.service}</span> &bull;{' '}
                  Triggered: {simulatorState.activeIncident.timestamp} &bull; PagerDuty Dedup: {simulatorState.activeIncident.pagerDutyDedupKey}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunInvestigation}
                disabled={isInvestigating}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>{isInvestigating ? 'Analyzing Probes...' : 'Launch SRE-Zero Agent'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: GITHUB & DEPLOYMENTS */}
        {activeTab === 'github' && (
          <GitHubDeploymentSection
            currentVersion={simulatorState.currentVersion}
            onRollback={handleRollback}
          />
        )}

        {/* TAB 2: POSTGRESQL ADMINISTRATION */}
        {activeTab === 'postgres' && (
          <PostgresAdminSection
            onInjectDbFailure={() => handleInject('DATABASE_FAILURE', 'database')}
            databaseFailureActive={simulatorState.databaseFailure}
          />
        )}

        {/* TAB 3: PAGERDUTY INCIDENT STREAM */}
        {activeTab === 'pagerduty' && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  PagerDuty Events API v2 Stream
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Mode: {simulatorState.pagerDutyConfigured ? 'LIVE PAGERDUTY API' : 'SANDBOX SIMULATED'}
              </span>
            </div>

            {simulatorState.pagerDutyEvents.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {simulatorState.pagerDutyEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${
                            evt.action === 'trigger'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {evt.action} &bull; {evt.severity}
                        </span>
                        <span className="font-bold text-white">{evt.summary}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Component: {evt.component} &bull; Dedup: {evt.dedupKey} &bull; {evt.timestamp}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-sm ${
                        evt.status === 'DISPATCHED'
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-blue-950 text-blue-400'
                      }`}
                    >
                      {evt.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
                No PagerDuty events triggered yet. Inject an incident in the Chaos deck to broadcast SEV-1 alerts.
              </div>
            )}
          </section>
        )}

        {/* TAB 4: CHAOS & OPERATIONS DECK */}
        {activeTab === 'chaos' && (
          <div className="space-y-6">
            {/* SECTION 1: FAILURE INJECTION / INCIDENT SIMULATOR */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-rose-500" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    1. Failure Injection / Incident Simulator
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Select failure & trigger controlled production incident
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Bad Deployment */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Bad Deployment</span>
                    <span className="text-[10px] text-slate-400 font-mono">v1 &rarr; v2</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Rolls out v2 with runtime TypeError in feed aggregator and schema mismatch in posts pipeline. HTTP 500 spike.
                  </p>
                  <button
                    onClick={() => handleInject('BAD_DEPLOYMENT')}
                    disabled={isInjecting}
                    className="w-full bg-rose-600/90 hover:bg-rose-600 disabled:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>INJECT FAILURE</span>
                  </button>
                </div>

                {/* 2. Database Failure */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Database Outage</span>
                    <span className="text-[10px] text-slate-400 font-mono">PostgreSQL :5432</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Closes PostgreSQL socket & exhausts connection pool. Writes fail, feed reads error out.
                  </p>
                  <button
                    onClick={() => handleInject('DATABASE_FAILURE', 'database')}
                    disabled={isInjecting}
                    className="w-full bg-rose-600/90 hover:bg-rose-600 disabled:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>INJECT FAILURE</span>
                  </button>
                </div>

                {/* 3. Service Crash */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Service Crash</span>
                    <select
                      value={selectedCrashService}
                      onChange={(e) => setSelectedCrashService(e.target.value as ServiceName)}
                      className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-1.5 py-0.5"
                    >
                      {SERVICE_KEYS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Terminates process for selected microservice. Health returns 502/503.
                  </p>
                  <button
                    onClick={() => handleInject('SERVICE_CRASH', selectedCrashService)}
                    disabled={isInjecting}
                    className="w-full bg-rose-600/90 hover:bg-rose-600 disabled:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>INJECT FAILURE</span>
                  </button>
                </div>

                {/* 4. Dependency Failure */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Dependency Failure</span>
                    <span className="text-[10px] text-slate-400 font-mono">Mock Payment API</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Upstream mock payment gateway throws 503 timeouts. Trips circuit breaker on tipping/checkout.
                  </p>
                  <button
                    onClick={() => handleInject('DEPENDENCY_FAILURE')}
                    disabled={isInjecting}
                    className="w-full bg-rose-600/90 hover:bg-rose-600 disabled:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>INJECT FAILURE</span>
                  </button>
                </div>

                {/* 5. High Memory / Exhaustion */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Memory Exhaustion</span>
                    <select
                      value={selectedHighMemoryService}
                      onChange={(e) => setSelectedHighMemoryService(e.target.value as ServiceName)}
                      className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-1.5 py-0.5"
                    >
                      {SERVICE_KEYS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Simulates memory leak approaching 256MB cgroup limit. GC pause & latency spikes to 2,900ms.
                  </p>
                  <button
                    onClick={() => handleInject('HIGH_MEMORY', selectedHighMemoryService)}
                    disabled={isInjecting}
                    className="w-full bg-rose-600/90 hover:bg-rose-600 disabled:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>INJECT FAILURE</span>
                  </button>
                </div>

                {/* Quick Safe Reset */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-400">System Reset</span>
                    <span className="text-[10px] text-slate-400 font-mono">Baseline v1</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Resets all microservices, database connections, and memory state back to clean healthy baseline.
                  </p>
                  <button
                    onClick={onResetSystem}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>RESET ALL SERVICES</span>
                  </button>
                </div>
              </div>
            </section>

            {/* SECTION 2: ARCHITECTURE & MICROSERVICES TOPOLOGY */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    2. Microservices Topology & Container Health
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  6 Microservices &bull; 15 Replicas Online
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {SERVICE_KEYS.map((key) => {
                  const svc = simulatorState.services[key];
                  const isSvcHealthy = svc.health === 'HEALTHY' && svc.status === 'RUNNING';
                  const isSvcDegraded = svc.health === 'DEGRADED';
                  return (
                    <div
                      key={key}
                      className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white font-mono">{svc.name}</span>
                        <span
                          className={`font-bold text-[10px] px-2 py-0.5 rounded-sm uppercase ${
                            isSvcHealthy
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : isSvcDegraded
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                          }`}
                        >
                          {svc.status}
                        </span>
                      </div>

                      <div className="space-y-1 font-mono text-[11px] text-slate-400">
                        <div className="flex justify-between">
                          <span>Cluster / Port:</span>
                          <span className="text-slate-300">{svc.clusterName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>HTTP Status:</span>
                          <span
                            className={
                              svc.httpStatus >= 500
                                ? 'text-rose-400 font-bold'
                                : svc.httpStatus >= 400
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {svc.httpStatus}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Latency / Errors:</span>
                          <span className="text-slate-300">
                            {svc.latencyMs}ms &bull; {svc.errorRate}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Memory / CPU:</span>
                          <span
                            className={
                              svc.memory > 90
                                ? 'text-rose-400 font-bold'
                                : svc.memory > 70
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }
                          >
                            {svc.memory}% &bull; {svc.cpu}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 3: SRE-ZERO AUTONOMOUS AGENT INVESTIGATION & REMEDIATION */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    3. SRE-Zero Autonomous Investigation & Remediation
                  </h2>
                </div>
                <button
                  onClick={handleRunInvestigation}
                  disabled={isInvestigating}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isInvestigating ? 'Probing Microservices...' : 'Run Automated SRE Investigation'}</span>
                </button>
              </div>

              {/* SRE-Zero Investigation Steps Pipeline */}
              {simulatorState.investigationSteps.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Agent Investigation Evidence & Probe Logs:
                  </p>
                  <div className="space-y-1.5">
                    {simulatorState.investigationSteps.map((step) => (
                      <div
                        key={step.id || step.stepNumber}
                        className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-start gap-3 text-xs"
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-950 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5 border border-blue-800">
                          {step.stepNumber || 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-300">
                              {step.toolName || step.message}()
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              status: {step.status}
                            </span>
                          </div>
                          <p className="text-slate-300 mt-1">{step.description || step.finding}</p>
                          {(step.output || step.commandOutput) && (
                            <div className="mt-1.5 p-2 bg-slate-900/90 rounded-md font-mono text-[11px] text-slate-400 overflow-x-auto">
                              <span className="text-slate-500">Output: </span>
                              {typeof (step.output || step.commandOutput) === 'string'
                                ? (step.output || step.commandOutput)
                                : JSON.stringify(step.output || step.commandOutput).substring(0, 180)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  No active investigation run. Click "Run Automated SRE Investigation" or inject a failure to trigger SRE-Zero diagnostic probes.
                </div>
              )}

              {/* HUMAN APPROVAL PANEL */}
              {simulatorState.recommendation && (
                <div className="mt-4 p-4 bg-slate-950 border-2 border-blue-500/50 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-400" />
                      <h3 className="font-bold text-white text-sm">
                        SRE-Zero Diagnosis & Approval Gate
                      </h3>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        simulatorState.recommendation.risk === 'LOW' || simulatorState.recommendation.risk === 'Low'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : simulatorState.recommendation.risk === 'MEDIUM' || simulatorState.recommendation.risk === 'Medium'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      Risk: {simulatorState.recommendation.risk}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wide text-[11px]">
                        Probable Root Cause:
                      </span>
                      <p className="font-semibold text-slate-100 mt-0.5">
                        {simulatorState.recommendation.rootCause}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wide text-[11px]">
                        Summary:
                      </span>
                      <p className="text-slate-300 mt-0.5">
                        {simulatorState.recommendation.summary ||
                          (simulatorState.recommendation.evidence && simulatorState.recommendation.evidence.join('; '))}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wide text-[11px]">
                        Recommended Action:
                      </span>
                      <p className="font-mono text-emerald-400 bg-slate-900 p-2 rounded-lg mt-0.5 border border-slate-800">
                        {simulatorState.recommendation.action || simulatorState.recommendation.actionName}
                      </p>
                    </div>
                  </div>

                  {/* Approval Controls */}
                  {rejectionNotice ? (
                    <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-xs text-amber-300">
                      Remediation proposal was rejected by operator. System remains in current degraded state for manual intervention.
                    </div>
                  ) : simulatorState.remediationApproved ? (
                    <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>
                          Remediation Approved & Applied ({simulatorState.recommendation.actionType})
                        </span>
                      </div>
                      <button
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify Recovery & Resolve Incident</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        id="btn-sre-approve"
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>APPROVE REMEDIATION</span>
                      </button>

                      <button
                        id="btn-sre-reject"
                        onClick={() => setRejectionNotice(true)}
                        className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-xl transition-colors border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>REJECT</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* RECOVERY VERIFICATION CHECKS */}
              {simulatorState.verificationChecks.length > 0 && (
                <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-emerald-800/80 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm">
                      Recovery Verification Probes (Real Application Endpoints)
                    </h3>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    {simulatorState.verificationChecks.map((check, i) => (
                      <div
                        key={check.id || i}
                        className="p-2.5 bg-slate-900 rounded-lg flex items-center justify-between border border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              check.passed ? 'bg-emerald-400' : 'bg-rose-500'
                            }`}
                          />
                          <span className="text-slate-200">{check.name || check.label}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{check.details || check.currentValue}</span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded-sm text-[10px] ${
                              check.passed
                                ? 'bg-emerald-950 text-emerald-400'
                                : 'bg-rose-950 text-rose-400'
                            }`}
                          >
                            {check.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-emerald-400 font-semibold">
                      All verification probes passed. Phasebook is healthy.
                    </p>
                    <button
                      onClick={onNavigateToPhasebook}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Verify on Live Feed</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* SECTION 4: DIAGNOSTIC TOOLS */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    4. SRE Diagnostic Tools
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Interactive probe endpoints callable by SRE-Zero agent
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'get_service_health',
                    'get_service_status',
                    'get_logs',
                    'get_metrics',
                    'get_recent_deployments',
                    'get_current_version',
                    'get_deployment_diff',
                    'get_database_status',
                    'get_database_health',
                    'get_database_metrics',
                    'get_dependency_status',
                  ] as SREZeroToolName[]
                ).map((tool) => (
                  <button
                    key={tool}
                    onClick={() => handleToolClick(tool)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                      activeToolResult?.tool === tool
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {tool}()
                  </button>
                ))}
              </div>

              {activeToolResult && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto max-h-64">
                  <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800 mb-2">
                    <span>Result of {activeToolResult.tool}()</span>
                    <button
                      onClick={() => setActiveToolResult(null)}
                      className="text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <pre className="text-slate-300 text-[11px] leading-relaxed">
                    {JSON.stringify(activeToolResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </section>

            {/* SECTION 5: LIVE SYSTEM LOGS */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-slate-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    5. Service Logs & Container Stdout
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">tail -n 25</span>
              </div>

              <div className="p-3.5 bg-black rounded-xl border border-slate-800 font-mono text-[11px] h-56 overflow-y-auto space-y-1">
                {simulatorState.logs.slice(0, 30).map((log) => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 shrink-0">{log.timestamp.split('T')[1]?.substring(0, 8) || log.timestamp}</span>
                    <span
                      className={`font-bold shrink-0 ${
                        log.level === 'ERROR' || log.level === 'FATAL'
                          ? 'text-rose-400'
                          : log.level === 'WARN'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-blue-400 shrink-0">[{log.service}]</span>
                    <span className="text-slate-300 break-words">{log.message}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
