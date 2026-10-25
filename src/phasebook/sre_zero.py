"""Deterministic SRE-Zero investigation, recommendation and verification."""

from __future__ import annotations

from phasebook.config import DEFAULT_SETTINGS, Settings
from phasebook.models import (
    ActionType,
    Deployment,
    FailureType,
    HealthStatus,
    Incident,
    InvestigationStep,
    MetricPoint,
    Recommendation,
    ServiceName,
    ServiceState,
    VerificationCheck,
)

_ROOT_CAUSES: dict[FailureType, tuple[str, ActionType, str, str]] = {
    FailureType.BAD_DEPLOYMENT: (
        "The active deployment introduced a regression; the previous release was healthy.",
        ActionType.ROLLBACK,
        "Roll back to the previous known-good commit.",
        "Low",
    ),
    FailureType.DATABASE_FAILURE: (
        "The database stopped accepting connections, so the feed cannot read or write.",
        ActionType.RESTORE_DB,
        "Restore database connectivity, then re-check pool saturation.",
        "High",
    ),
    FailureType.SERVICE_CRASH: (
        "The process exited and the replica set has no healthy instance.",
        ActionType.RESTART_SERVICE,
        "Restart the crashed service and confirm readiness.",
        "Low",
    ),
    FailureType.DEPENDENCY_FAILURE: (
        "The payment dependency is failing, which trips checkout and tipping.",
        ActionType.RESTORE_DEPENDENCY,
        "Restore the dependency breaker and retry the queued charges.",
        "Medium",
    ),
    FailureType.HIGH_MEMORY: (
        "Memory pressure crossed the container limit and the service is degrading.",
        ActionType.SCALE_SERVICE,
        "Raise the replica count and reduce the per-request allocation.",
        "Medium",
    ),
}


class SREZeroAgent:
    """The bounded diagnostic loop shown in the admin deck.

    Every method is pure with respect to the repository: callers decide when to
    mutate service state, which keeps the investigation replayable.
    """

    def __init__(self, settings: Settings = DEFAULT_SETTINGS) -> None:
        self._settings = settings

    def investigate(
        self,
        *,
        incident: Incident,
        services: dict[ServiceName, ServiceState],
        deployments: list[Deployment] | None = None,
    ) -> list[InvestigationStep]:
        """Produce the ordered tool calls an operator would make."""

        deployments = deployments or []
        target = incident.service
        service = services[target]
        steps: list[InvestigationStep] = []

        def add(tool_name: str, message: str, finding: str, command: str | None = None) -> None:
            steps.append(
                InvestigationStep(
                    id=f"step-{len(steps) + 1}",
                    step_number=len(steps) + 1,
                    tool_name=tool_name,
                    message=message,
                    finding=finding,
                    command=command,
                )
            )

        add(
            "get_service_health",
            f"Read health for {target.value}",
            f"{service.health.value} (status={service.status.value})",
            f"GET /api/sre-zero/tools/get_service_health?service={target.value}",
        )
        add(
            "get_current_version",
            "Read the deployed version",
            service.version,
            "GET /api/sre-zero/tools/get_current_version",
        )
        add(
            "get_recent_deployments",
            "Inspect the deployment history",
            f"{len(deployments)} deployment(s); latest={deployments[-1].version if deployments else 'none'}",
            "GET /api/sre-zero/tools/get_recent_deployments",
        )

        if incident.failure_type is FailureType.BAD_DEPLOYMENT:
            add(
                "get_deployment_diff",
                "Diff the active deployment against the previous release",
                "A regression is present in the active commit.",
                "GET /api/sre-zero/tools/get_deployment_diff",
            )
        if incident.failure_type in {FailureType.DATABASE_FAILURE, FailureType.DEPENDENCY_FAILURE}:
            add(
                "get_database_health",
                "Probe the database dependency",
                "Connectivity probe completed; see verification checks.",
                "GET /api/sre-zero/tools/get_database_health",
            )
        if incident.failure_type is FailureType.DEPENDENCY_FAILURE:
            add(
                "get_dependency_status",
                "Probe the payment dependency",
                "Payment dependency reported failures.",
                "GET /api/sre-zero/tools/get_dependency_status",
            )

        add(
            "get_metrics",
            "Read the current error rate and latency",
            (
                f"error_rate={service.metrics.error_rate:.1f}% "
                f"latency={service.metrics.latency_ms:.0f}ms"
            ),
            f"GET /api/sre-zero/tools/get_metrics?service={target.value}",
        )
        return steps

    def recommend(
        self,
        *,
        incident: Incident,
        services: dict[ServiceName, ServiceState],
    ) -> Recommendation:
        """Map the diagnosed failure class to one remediation action."""

        root_cause, action_type, execution, risk = _ROOT_CAUSES[incident.failure_type]
        target = incident.service
        if incident.failure_type is FailureType.DEPENDENCY_FAILURE:
            target = ServiceName.PAYMENT_SERVICE
        elif incident.failure_type is FailureType.DATABASE_FAILURE:
            target = ServiceName.DATABASE

        evidence = [
            f"{incident.service.value} health={services[incident.service].health.value}",
            f"failure_type={incident.failure_type.value}",
            f"severity={incident.severity.value}",
        ]
        return Recommendation(
            root_cause=root_cause,
            summary=f"{incident.title} — {root_cause}",
            action=execution,
            action_type=action_type,
            target_service=target,
            risk=risk,
            execution_details=(
                f"Execute {action_type.value} against {target.value}; "
                "keep the previous deployment available for comparison."
            ),
            evidence=evidence,
        )

    def verify(
        self,
        *,
        incident: Incident,
        services: dict[ServiceName, ServiceState],
    ) -> list[VerificationCheck]:
        """Check that the incident's service has actually recovered."""

        target = incident.service
        service = services[target]
        checks = [
            VerificationCheck(
                name="service_health",
                passed=service.health is HealthStatus.HEALTHY,
                current_value=service.health.value,
                target_value=HealthStatus.HEALTHY.value,
                details=f"{target.value} must return to HEALTHY",
            ),
            VerificationCheck(
                name="error_rate",
                passed=service.metrics.error_rate <= self._settings.degraded_error_rate,
                current_value=f"{service.metrics.error_rate:.1f}%",
                target_value=f"<= {self._settings.degraded_error_rate:.1f}%",
            ),
            VerificationCheck(
                name="latency",
                passed=service.metrics.latency_ms <= self._settings.degraded_latency_ms,
                current_value=f"{service.metrics.latency_ms:.0f}ms",
                target_value=f"<= {self._settings.degraded_latency_ms:.0f}ms",
            ),
            VerificationCheck(
                name="replicas_available",
                passed=service.replicas > 0,
                current_value=str(service.replicas),
                target_value=">= 1",
            ),
        ]
        if incident.failure_type is FailureType.DATABASE_FAILURE:
            database = services[ServiceName.DATABASE]
            checks.append(
                VerificationCheck(
                    name="database_connectivity",
                    passed=database.health is HealthStatus.HEALTHY,
                    current_value=database.health.value,
                    target_value=HealthStatus.HEALTHY.value,
                )
            )
        return checks

    def recovery_verified(self, checks: list[VerificationCheck]) -> bool:
        return bool(checks) and all(check.passed for check in checks)


def remediation_metrics(
    action_type: ActionType,
    *,
    current: MetricPoint | None = None,
) -> MetricPoint:
    """Return the post-remediation metrics the sample applies to a service."""

    if current is None:
        return MetricPoint(cpu=0.22, memory=0.34, error_rate=0.0, latency_ms=48.0)
    if action_type is ActionType.SCALE_SERVICE:
        return MetricPoint(
            cpu=max(0.2, current.cpu - 0.35),
            memory=max(0.3, current.memory - 0.3),
            error_rate=0.0,
            latency_ms=max(40.0, current.latency_ms - 400.0),
        )
    return MetricPoint(cpu=0.2, memory=0.35, error_rate=0.0, latency_ms=45.0)
