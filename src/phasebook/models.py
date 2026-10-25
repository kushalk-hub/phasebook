"""Domain models for the Phasebook sample application.

The models are deliberately dependency-free (stdlib dataclasses only) so the
BugLens indexer can parse them with the Python ``ast`` module and the sample
stays fast and deterministic in CI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


def utcnow() -> datetime:
    """Timezone-aware "now"; callers may inject their own clock in tests."""

    return datetime.now(UTC)


class Role(str, Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    MEMBER = "member"


class HealthStatus(str, Enum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    UNHEALTHY = "UNHEALTHY"


class ServiceStatus(str, Enum):
    RUNNING = "RUNNING"
    DEGRADED = "DEGRADED"
    DOWN = "DOWN"


class ServiceName(str, Enum):
    FRONTEND = "frontend"
    FEED = "feed"
    POST_SERVICE = "post-service"
    DATABASE = "database"
    PAYMENT_SERVICE = "payment-service"
    NOTIFICATION_SERVICE = "notification-service"


class FailureType(str, Enum):
    NONE = "NONE"
    BAD_DEPLOYMENT = "BAD_DEPLOYMENT"
    DATABASE_FAILURE = "DATABASE_FAILURE"
    SERVICE_CRASH = "SERVICE_CRASH"
    DEPENDENCY_FAILURE = "DEPENDENCY_FAILURE"
    HIGH_MEMORY = "HIGH_MEMORY"


class IncidentSeverity(str, Enum):
    SEV1 = "SEV-1"
    SEV2 = "SEV-2"
    SEV3 = "SEV-3"


class IncidentStatus(str, Enum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    REMEDIATING = "REMEDIATING"
    VERIFYING = "VERIFYING"
    RESOLVED = "RESOLVED"


class DeploymentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"
    ROLLED_BACK = "ROLLED_BACK"
    FAILED = "FAILED"


class ActionType(str, Enum):
    ROLLBACK = "ROLLBACK"
    RESTORE_DB = "RESTORE_DB"
    RESTART_SERVICE = "RESTART_SERVICE"
    RESTORE_DEPENDENCY = "RESTORE_DEPENDENCY"
    SCALE_SERVICE = "SCALE_SERVICE"


@dataclass(slots=True)
class User:
    id: str
    name: str
    role: Role = Role.MEMBER
    verified: bool = False


@dataclass(slots=True)
class Comment:
    id: str
    post_id: str
    author_id: str
    text: str
    created_at: datetime
    likes: int = 0


@dataclass(slots=True)
class Post:
    id: str
    author_id: str
    content: str
    created_at: datetime
    image: str | None = None
    likes: int = 0
    liked_by: set[str] = field(default_factory=set)
    comments: list[Comment] = field(default_factory=list)
    shares: int = 0
    tips_cents: int = 0
    deleted: bool = False
    sponsored: bool = False


@dataclass(slots=True)
class MetricPoint:
    cpu: float
    memory: float
    error_rate: float
    latency_ms: float
    request_rate: float = 120.0
    http_5xx_rate: float = 0.0
    db_connection_errors: int = 0


@dataclass(slots=True)
class ServiceState:
    name: ServiceName
    status: ServiceStatus = ServiceStatus.RUNNING
    health: HealthStatus = HealthStatus.HEALTHY
    metrics: MetricPoint = field(
        default_factory=lambda: MetricPoint(cpu=0.18, memory=0.32, error_rate=0.0, latency_ms=42.0)
    )
    version: str = "v1"
    replicas: int = 3
    last_restart: datetime | None = None


@dataclass(slots=True)
class Incident:
    id: str
    title: str
    service: ServiceName
    severity: IncidentSeverity
    failure_type: FailureType
    symptoms: list[str]
    details: str = ""
    status: IncidentStatus = IncidentStatus.OPEN
    started_at: datetime = field(default_factory=utcnow)
    resolved_at: datetime | None = None
    dedup_key: str = ""


@dataclass(slots=True)
class Deployment:
    id: str
    version: str
    commit_sha: str
    deployed_at: datetime
    status: DeploymentStatus = DeploymentStatus.ACTIVE
    deployed_by: str = "sre-zero"
    health: HealthStatus = HealthStatus.HEALTHY


@dataclass(frozen=True, slots=True)
class PaymentResult:
    transaction_id: str
    amount_cents: int
    provider: str
    idempotent_replay: bool = False


@dataclass(slots=True)
class InvestigationStep:
    id: str
    step_number: int
    tool_name: str
    message: str
    status: str = "DONE"
    finding: str = ""
    command: str | None = None


@dataclass(slots=True)
class Recommendation:
    root_cause: str
    summary: str
    action: str
    action_type: ActionType
    target_service: ServiceName
    risk: str
    execution_details: str
    evidence: list[str] = field(default_factory=list)


@dataclass(slots=True)
class VerificationCheck:
    name: str
    passed: bool
    current_value: str
    target_value: str
    details: str = ""


@dataclass(slots=True)
class SimulatorState:
    services: dict[ServiceName, ServiceState]
    deployments: list[Deployment] = field(default_factory=list)
    active_failure_type: FailureType = FailureType.NONE
    selected_failure_target_service: ServiceName = ServiceName.FEED
    active_incident: Incident | None = None
    investigation_steps: list[InvestigationStep] = field(default_factory=list)
    recommendation: Recommendation | None = None
    remediation_approved: bool = False
    verification_checks: list[VerificationCheck] = field(default_factory=list)
    recovery_verified: bool = False
    ticks_elapsed: int = 0

    def as_dict(self) -> dict[str, Any]:
        """Plain-data view used by the web app and the CLI demo."""

        return {
            "systemHealth": _system_health(self.services).value,
            "activeFailureType": self.active_failure_type.value,
            "selectedFailureTargetService": self.selected_failure_target_service.value,
            "services": {
                name.value: {
                    "status": state.status.value,
                    "health": state.health.value,
                    "version": state.version,
                    "replicas": state.replicas,
                    "metrics": {
                        "cpu": state.metrics.cpu,
                        "memory": state.metrics.memory,
                        "errorRate": state.metrics.error_rate,
                        "latencyMs": state.metrics.latency_ms,
                    },
                }
                for name, state in self.services.items()
            },
            "activeIncident": (
                {
                    "id": self.active_incident.id,
                    "title": self.active_incident.title,
                    "service": self.active_incident.service.value,
                    "severity": self.active_incident.severity.value,
                    "status": self.active_incident.status.value,
                    "failureType": self.active_incident.failure_type.value,
                    "symptoms": list(self.active_incident.symptoms),
                }
                if self.active_incident
                else None
            ),
            "recommendation": (
                {
                    "rootCause": self.recommendation.root_cause,
                    "action": self.recommendation.action,
                    "actionType": self.recommendation.action_type.value,
                    "risk": self.recommendation.risk,
                }
                if self.recommendation
                else None
            ),
            "remediationApproved": self.remediation_approved,
            "verificationChecks": [
                {
                    "name": check.name,
                    "passed": check.passed,
                    "currentValue": check.current_value,
                    "targetValue": check.target_value,
                }
                for check in self.verification_checks
            ],
            "recoveryVerified": self.recovery_verified,
            "ticksElapsed": self.ticks_elapsed,
        }


def _system_health(services: dict[ServiceName, ServiceState]) -> HealthStatus:
    statuses = {state.health for state in services.values()}
    if HealthStatus.UNHEALTHY in statuses:
        return HealthStatus.UNHEALTHY
    if HealthStatus.DEGRADED in statuses:
        return HealthStatus.DEGRADED
    return HealthStatus.HEALTHY
