"""Composition layer used by the CLI, tests and the admin deck contract."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from uuid import uuid4

from phasebook.auth import require_operator
from phasebook.config import DEFAULT_SETTINGS, Settings
from phasebook.errors import ValidationError
from phasebook.feed import build_viewer_page
from phasebook.incidents import IncidentManager, severity_for
from phasebook.metrics import apply_metrics, system_health
from phasebook.models import (
    ActionType,
    Comment,
    DeploymentStatus,
    FailureType,
    HealthStatus,
    Incident,
    IncidentStatus,
    InvestigationStep,
    MetricPoint,
    PaymentResult,
    Post,
    Recommendation,
    ServiceName,
    SimulatorState,
    User,
    VerificationCheck,
    utcnow,
)
from phasebook.payments import PaymentGateway, Provider
from phasebook.repository import InMemoryRepository
from phasebook.sre_zero import SREZeroAgent, remediation_metrics

_FAILURE_COPY: dict[FailureType, tuple[str, list[str]]] = {
    FailureType.BAD_DEPLOYMENT: (
        "Elevated 5xx rate after deployment",
        ["Checkout returns 5xx", "Latency above 900 ms", "Error budget burning"],
    ),
    FailureType.DATABASE_FAILURE: (
        "Database connectivity lost",
        ["Feed requests fail", "Connection pool exhausted", "Payment authorization errors"],
    ),
    FailureType.SERVICE_CRASH: (
        "Service process crashed",
        ["Readiness probe failing", "Replicas unavailable", "Requests timing out"],
    ),
    FailureType.DEPENDENCY_FAILURE: (
        "Payment dependency unavailable",
        ["Tips fail", "Circuit breaker open", "Checkout latency climbing"],
    ),
    FailureType.HIGH_MEMORY: (
        "High memory pressure",
        ["Container above 95% memory", "Latency above 800 ms", "OOM restart risk"],
    ),
}


def _mock_provider(user_id: str, amount_cents: int) -> str:
    """Deterministic-enough stand-in for the external payment provider."""

    return f"mock_{user_id}_{amount_cents}_{uuid4().hex[:8]}"


def _unhealthy(
    *,
    cpu: float = 0.9,
    memory: float = 0.9,
    error_rate: float = 15.0,
    latency_ms: float = 1200.0,
) -> MetricPoint:
    return MetricPoint(cpu=cpu, memory=memory, error_rate=error_rate, latency_ms=latency_ms)


class PhasebookAPI:
    """One object that wires the social feed, payments and SRE simulator."""

    def __init__(
        self,
        *,
        repository: InMemoryRepository | None = None,
        payments: PaymentGateway | None = None,
        incidents: IncidentManager | None = None,
        agent: SREZeroAgent | None = None,
        settings: Settings = DEFAULT_SETTINGS,
        clock: Callable[[], datetime] = utcnow,
        provider: Provider | None = None,
    ) -> None:
        self.settings = settings
        self._clock = clock
        self.repository = repository or InMemoryRepository(settings=settings, clock=clock)
        self.incidents = incidents or IncidentManager(settings)
        self.agent = agent or SREZeroAgent(settings)
        self.payments = payments or PaymentGateway(
            provider or _mock_provider,
            settings=settings,
            clock=clock,
        )
        self.state = SimulatorState(
            services=self.repository.services,
            deployments=self.repository.deployments,
        )

    # -- social feed -------------------------------------------------------

    def feed(
        self,
        *,
        viewer_id: str | None = None,
        limit: int = DEFAULT_SETTINGS.feed_page_size,
        offset: int = 0,
    ) -> list[Post]:
        return build_viewer_page(
            self.repository.list_posts(),
            viewer_id=viewer_id,
            limit=limit,
            offset=offset,
            settings=self.settings,
        )

    def create_post(
        self,
        *,
        actor_id: str,
        content: str,
        image: str | None = None,
    ) -> Post:
        return self.repository.create_post(
            author_id=actor_id,
            content=content,
            image=image,
            now=self._clock(),
        )

    def comment(self, *, actor_id: str, post_id: str, text: str) -> Comment:
        return self.repository.add_comment(
            post_id=post_id,
            author_id=actor_id,
            text=text,
            now=self._clock(),
        )

    def like(self, *, actor_id: str, post_id: str) -> Post:
        return self.repository.toggle_like(post_id=post_id, user_id=actor_id)

    def delete_post(self, *, actor_id: str, post_id: str) -> Post:
        return self.repository.soft_delete_post(post_id=post_id, actor_id=actor_id)

    def tip(
        self,
        *,
        actor_id: str,
        post_id: str,
        amount_cents: int,
        idempotency_key: str,
    ) -> PaymentResult:
        post = self.repository.get_post(post_id)
        self.repository.get_user(actor_id)
        result = self.payments.charge(
            user_id=actor_id,
            amount_cents=amount_cents,
            idempotency_key=idempotency_key,
        )
        if not result.idempotent_replay:
            post.tips_cents += amount_cents
            post.shares += 1
        return result

    # -- SRE simulator -----------------------------------------------------

    def inject_failure(
        self,
        *,
        actor_id: str,
        failure_type: FailureType,
        service: ServiceName | None = None,
    ) -> Incident:
        actor = self._operator(actor_id)
        if failure_type is FailureType.NONE:
            raise ValidationError("failure_type must name a real failure")

        target = self._normalise_target(failure_type, service)
        title, symptoms = _FAILURE_COPY[failure_type]
        self._apply_failure(target, failure_type)

        incident = self.incidents.open_incident(
            service=target,
            title=title,
            severity=severity_for(failure_type, target),
            failure_type=failure_type,
            symptoms=symptoms,
            details=f"Injected by {actor.name} through the SRE admin deck.",
            now=self._clock(),
        )
        self.state.active_failure_type = failure_type
        self.state.selected_failure_target_service = target
        self.state.active_incident = incident
        self.state.investigation_steps = []
        self.state.recommendation = None
        self.state.remediation_approved = False
        self.state.verification_checks = []
        self.state.recovery_verified = False
        self.state.ticks_elapsed += 1
        return incident

    def investigate(self, *, actor_id: str) -> list[InvestigationStep]:
        self._operator(actor_id)
        incident = self._require_incident()
        self.incidents.transition(incident.id, IncidentStatus.INVESTIGATING)
        steps = self.agent.investigate(
            incident=incident,
            services=self.repository.services,
            deployments=self.repository.deployments,
        )
        self.state.investigation_steps = steps
        self.state.recommendation = self.agent.recommend(
            incident=incident,
            services=self.repository.services,
        )
        return steps

    def approve_remediation(self, *, actor_id: str) -> Recommendation:
        self._operator(actor_id)
        incident = self._require_incident()
        recommendation = self.state.recommendation
        if recommendation is None:
            raise ValidationError("Run an investigation before approving remediation")
        self.incidents.transition(incident.id, IncidentStatus.REMEDIATING)
        self._apply_remediation(recommendation)
        self.state.remediation_approved = True
        return recommendation

    def verify_recovery(self, *, actor_id: str) -> list[VerificationCheck]:
        self._operator(actor_id)
        incident = self._require_incident()
        if not self.state.remediation_approved:
            raise ValidationError("Approve remediation before verifying recovery")
        self.incidents.transition(incident.id, IncidentStatus.VERIFYING)
        checks = self.agent.verify(
            incident=incident,
            services=self.repository.services,
        )
        self.state.verification_checks = checks
        self.state.recovery_verified = self.agent.recovery_verified(checks)
        if self.state.recovery_verified:
            self.incidents.resolve(incident.id, now=self._clock())
            self.state.active_failure_type = FailureType.NONE
        return checks

    def reset(self, *, actor_id: str) -> None:
        self._operator(actor_id)
        self.repository.reset_platform()
        self.incidents.reset()
        self.state.active_failure_type = FailureType.NONE
        self.state.active_incident = None
        self.state.investigation_steps = []
        self.state.recommendation = None
        self.state.remediation_approved = False
        self.state.verification_checks = []
        self.state.recovery_verified = False

    def health(self) -> HealthStatus:
        return system_health(self.repository.services)

    def snapshot(self) -> dict[str, object]:
        return self.state.as_dict()

    # -- internals ---------------------------------------------------------

    def _operator(self, actor_id: str) -> User:
        actor = self.repository.get_user(actor_id)
        require_operator(actor)
        return actor

    def _require_incident(self) -> Incident:
        incident = self.state.active_incident
        if incident is None:
            raise ValidationError("No active incident; inject a failure first")
        return incident

    @staticmethod
    def _normalise_target(
        failure_type: FailureType,
        service: ServiceName | None,
    ) -> ServiceName:
        if failure_type is FailureType.DATABASE_FAILURE:
            return ServiceName.DATABASE
        if failure_type is FailureType.DEPENDENCY_FAILURE:
            return ServiceName.PAYMENT_SERVICE
        return service or ServiceName.FEED

    def _apply_failure(self, target: ServiceName, failure_type: FailureType) -> None:
        repository = self.repository
        if failure_type is FailureType.BAD_DEPLOYMENT:
            repository.record_deployment(
                version="v2",
                commit_sha="badc0de",
                deployed_at=self._clock(),
            )
            repository.update_service(
                target,
                metrics=_unhealthy(cpu=0.55, memory=0.62, error_rate=16.0, latency_ms=980.0),
                version="v2",
            )
        elif failure_type is FailureType.DATABASE_FAILURE:
            repository.update_service(
                ServiceName.DATABASE,
                metrics=_unhealthy(cpu=0.94, memory=0.91, error_rate=100.0, latency_ms=2200.0),
            )
            repository.update_service(
                ServiceName.FEED,
                metrics=_unhealthy(cpu=0.72, memory=0.7, error_rate=22.0, latency_ms=1500.0),
            )
        elif failure_type is FailureType.SERVICE_CRASH:
            repository.update_service(
                target,
                metrics=_unhealthy(cpu=0.0, memory=0.12, error_rate=100.0, latency_ms=0.0),
                replicas=0,
            )
        elif failure_type is FailureType.DEPENDENCY_FAILURE:
            repository.update_service(
                ServiceName.PAYMENT_SERVICE,
                metrics=_unhealthy(cpu=0.6, memory=0.55, error_rate=38.0, latency_ms=1400.0),
            )
            repository.update_service(
                ServiceName.POST_SERVICE,
                metrics=_unhealthy(cpu=0.5, memory=0.48, error_rate=9.0, latency_ms=820.0),
            )
        elif failure_type is FailureType.HIGH_MEMORY:
            repository.update_service(
                target,
                metrics=_unhealthy(cpu=0.9, memory=0.995, error_rate=6.0, latency_ms=880.0),
            )

    def _apply_remediation(self, recommendation: Recommendation) -> None:
        repository = self.repository
        target = recommendation.target_service

        if recommendation.action_type is ActionType.ROLLBACK:
            for deployment in repository.deployments:
                if deployment.status is DeploymentStatus.ACTIVE:
                    deployment.status = DeploymentStatus.ROLLED_BACK
        if recommendation.action_type is ActionType.RESTORE_DB:
            apply_metrics(
                repository.get_service(ServiceName.DATABASE),
                MetricPoint(cpu=0.24, memory=0.36, error_rate=0.0, latency_ms=95.0),
                self.settings,
            )
            apply_metrics(
                repository.get_service(ServiceName.FEED),
                MetricPoint(cpu=0.25, memory=0.35, error_rate=0.0, latency_ms=60.0),
                self.settings,
            )
        if recommendation.action_type is ActionType.RESTORE_DEPENDENCY:
            apply_metrics(
                repository.get_service(ServiceName.PAYMENT_SERVICE),
                MetricPoint(cpu=0.25, memory=0.35, error_rate=0.0, latency_ms=120.0),
                self.settings,
            )
            apply_metrics(
                repository.get_service(ServiceName.POST_SERVICE),
                MetricPoint(cpu=0.24, memory=0.34, error_rate=0.0, latency_ms=70.0),
                self.settings,
            )

        service = repository.get_service(target)
        metrics = remediation_metrics(recommendation.action_type, current=service.metrics)
        repository.update_service(
            target,
            metrics=metrics,
            version="v1" if recommendation.action_type is ActionType.ROLLBACK else service.version,
            replicas=(max(service.replicas, 1) if recommendation.action_type is ActionType.RESTART_SERVICE else service.replicas),
            restart=recommendation.action_type in {
                ActionType.RESTART_SERVICE,
                ActionType.RESTORE_DB,
                ActionType.RESTORE_DEPENDENCY,
            },
            now=self._clock(),
        )
        if recommendation.action_type is ActionType.SCALE_SERVICE:
            repository.update_service(target, replicas=service.replicas + 2)
        self.state.ticks_elapsed += 1
