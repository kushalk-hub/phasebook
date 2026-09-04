# Phasebook & SRE-Zero Production Incident Simulator

Phasebook is a modern social-network production application built for demonstrating **SRE-Zero**, an autonomous AI site reliability engineering agent capable of detecting, investigating, diagnosing, remediating, and verifying recovery from production failures.

---

## 🏗️ Architecture Overview

The system runs on a modern serverless backend architecture:

```
Browser / Client
      ↓
Phasebook API Gateway (Express + Vite)
      ↓
Neon Database (Neon Serverless Postgres via SSL)
```

1. **Phasebook Web & API Gateway (`phasebook-api`)**: Express + Vite TypeScript service handling social feeds, posts, likes, comments, notifications, and SRE operations.
2. **Neon Serverless Postgres**: Production serverless PostgreSQL backend with scale-to-zero compute, connection pooling, and SSL encryption. **No local Docker PostgreSQL container dependency (`phasebook-db` removed).**
3. **Mock Payment API (`phasebook-payment-mock`)**: External dependency simulating third-party billing/tipping APIs and circuit breaker tripping.
4. **Isolated Container Runtime**: Container deployment engine enforcing cgroup limits (512MB RAM, 1.0 CPU) and rollback capabilities.
5. **Prometheus Metrics**: Scrapes live telemetry from `/api/system/metrics` every 5 seconds.
6. **PagerDuty Events API v2**: Real-time webhook dispatcher broadcasting SEV-1/SEV-2 incident alerts with deduplication keys.

---

## ⚡ Neon Database (Serverless Postgres)

Phasebook connects directly to **Neon Serverless Postgres** via `@neondatabase/serverless`:

### Connection Configuration

Set your Neon connection string in your environment (e.g. `.env`):

```env
DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
```

> **Security Note:** The Neon connection string is strictly loaded and used server-side by the backend API. It is **never** hardcoded into source code and **never** exposed to client browser code.

### Schema Migration & CLI Commands

Phasebook provides automated schema migration scripts for Neon:

```bash
# Check current Neon schema and table counts
npm run db:status

# Apply schema migrations to your Neon database (safe IF NOT EXISTS)
npm run db:migrate

# Seed baseline users, posts, and sample activity into Neon
npm run db:seed

# Complete reset and re-initialization (caution: drops tables)
npm run db:reset
```

### Database Health & Telemetry Probe

The application provides a dedicated database health probe endpoint:

```bash
curl -s http://localhost:3000/health/database | jq .
```

Reports:
- Neon connectivity state (`CONNECTED`, `DEGRADED`, `DISCONNECTED`)
- Query execution latency over SSL in milliseconds
- Serverless pool capacity and connection status
- Table record statistics across all tables (users, posts, comments, likes, notifications, deployments, incidents)
- Neon endpoint host and SSL mode

---

## 🐙 GitHub Integration & Container Deployment

GitHub serves as the authoritative source of truth for Phasebook application code.

### Environment Configuration

Configure the following variables in your `.env` file (see `.env.example`):

```env
GITHUB_REPOSITORY=akshaysantani01/phasebook
GITHUB_BRANCH=main
GITHUB_TOKEN=ghp_yourPersonalAccessTokenHere
```

> **Security Note:** `GITHUB_TOKEN` is strictly accessed server-side via `process.env` and is never bundled or exposed to frontend code.

### Deployment & Rollback Workflow

1. **Automatic Commit Tracking**: Fetches recent commits, authors, and messages from your GitHub repository.
2. **Current vs. Previous Comparison**: Displays the active deployed commit side-by-side with the previous known-good deployment so operators and SRE-Zero can isolate faulty commits.
3. **Code Diff Inspection**: Provides an in-browser diff viewer displaying line-by-line additions and deletions between releases.
4. **Isolated Container Deployment**: Deploys selected commits into isolated sandbox containers with resource constraints.
5. **Instant Rollback**: Redeploys the prior known-good container image and switches live Phasebook traffic back to healthy state with 1-click or through autonomous SRE-Zero approval.

---

## 🤖 SRE-Zero Diagnostic Tools API

SRE-Zero and human operators can execute these diagnostic tools:

| Tool | Endpoint | Purpose |
| :--- | :--- | :--- |
| `get_service_health` | `GET /api/sre-zero/tools/get_service_health` | Overall system and microservice health |
| `get_current_version` | `GET /api/sre-zero/tools/get_current_version` | Current deployed version, SHA, and uptime |
| `get_recent_deployments` | `GET /api/sre-zero/tools/get_recent_deployments` | Audit history of past releases |
| `get_deployment_diff` | `GET /api/sre-zero/tools/get_deployment_diff` | File diff between current and previous commit |
| `get_commit_metadata` | `GET /api/sre-zero/tools/get_commit_metadata?sha=...` | Git commit author, timestamp, message |
| `rollback_deployment` | `POST /api/deployments/rollback` | Roll back to prior known-good version |
| `get_database_health` | `GET /api/sre-zero/tools/get_database_health` | Neon connectivity and SSL latency probe |
| `get_database_metrics` | `GET /api/sre-zero/tools/get_database_metrics` | Active/idle connections and pool utilization |
| `get_database_connection_status` | `GET /api/sre-zero/tools/get_database_connection_status` | Direct SSL socket and port connection status |

---

## 🚀 Running with Docker Compose

To start Phasebook and supporting mock dependencies:

```bash
docker-compose up --build -d
```

Access:
- **Phasebook Web App**: `http://localhost:3000`
- **SRE-Zero Admin Deck**: Click the subtle developer link in the Phasebook sidebar/footer or visit `http://localhost:3000?view=admin`
- **Neon Database**: Connected remotely over SSL via `DATABASE_URL`
