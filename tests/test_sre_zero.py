"""SRE-Zero investigation, recommendation and verification coverage."""

from __future__ import annotations

import pytest

from phasebook.models import (
    ActionType,
    Deployment,
    FailureType,
    HealthStatus,
    Incident,
    IncidentSeverity,
    MetricPoint,
    ServiceName,
    ServiceState,
    ServiceStatus,
)
from phasebook.sre_zero import SREZeroAgent, remediation_metrics


def _incident(
    failure_type: FailureType,
    *,
    service: ServiceName = ServiceName.FEED,
) -> Incident:
    return Incident(
        id="inc-0001",
        title=f"{failure_type.value} on {service.value}",
        service=service,
        severity=IncidentSeverity.SEV2,
        failure_type=failure_type,
        symptoms=["symptom"],
    )


def _services() -> dict[ServiceName, ServiceState]:
    return {name: ServiceState(name=name) for name in ServiceName}


def test_investigation_always_starts_with_the_baseline_probes() -> None:
    agent = SREZeroAgent()

    steps = agent.investigate(
        incident=_incident(FailureType.HIGH_MEMORY),
        services=_services(),
        deployments=[],
    )

    assert [step.tool_name for step in steps] == [
        "get_service_health",
        "get_current_version",
        "get_recent_deployments",
        "get_metrics",
    ]
    assert [step.step_number for step in steps] == [1, 2, 3, 4]
    assert steps[2].finding == "0 deployment(s); latest=none"


def test_bad_deployment_investigation_includes_a_diff() -> None:
    agent = SREZeroAgent()
    deployment = Deployment(
        id="dep-001",
        version="v2",
        commit_sha="badc0de",
        deployed_at=_incident(FailureType.BAD_DEPLOYMENT).started_at,
    )

    steps = agent.investigate(
        incident=_incident(FailureType.BAD_DEPLOYMENT),
        services=_services(),
        deployments=[deployment],
    )

    assert [step.tool_name for step in steps] == [
        "get_service_health",
        "get_current_version",
        "get_recent_deployments",
        "get_deployment_diff",
        "get_metrics",
    ]
    assert steps[2].finding == "1 deployment(s); latest=v2"


def test_database_failure_investigation_probes_the_database() -> None:
    agent = SREZeroAgent()

    steps = agent.investigate(
        incident=_incident(FailureType.DATABASE_FAILURE, service=ServiceName.DATABASE),
        services=_services(),
    )

    assert "get_database_health" in {step.tool_name for step in steps}
    assert "get_dependency_status" not in {step.tool_name for step in steps}


def test_dependency_failure_investigation_probes_both_dependencies() -> None:
    agent = SREZeroAgent()

    steps = agent.investigate(
        incident=_incident(
            FailureType.DEPENDENCY_FAILURE,
            service=ServiceName.PAYMENT_SERVICE,
        ),
        services=_services(),
    )

    names = [step.tool_name for step in steps]
    assert "get_database_health" in names
    assert "get_dependency_status" in names


@pytest.mark.parametrize(
    ("failure_type", "service", "action", "target"),
    [
        (FailureType.BAD_DEPLOYMENT, ServiceName.FEED, ActionType.ROLLBACK, ServiceName.FEED),
        (
            FailureType.DATABASE_FAILURE,
            ServiceName.FEED,
            ActionType.RESTORE_DB,
            ServiceName.DATABASE,
        ),
        (
            FailureType.SERVICE_CRASH,
            ServiceName.FEED,
            ActionType.RESTART_SERVICE,
            ServiceName.FEED,
        ),
        (
            FailureType.DEPENDENCY_FAILURE,
            ServiceName.POST_SERVICE,
            ActionType.RESTORE_DEPENDENCY,
            ServiceName.PAYMENT_SERVICE,
        ),
        (FailureType.HIGH_MEMORY, ServiceName.FEED, ActionType.SCALE_SERVICE, ServiceName.FEED),
    ],
)
def test_recommendation_maps_each_failure_to_one_action(
    failure_type,
    service,
    action,
    target,
) -> None:
    agent = SREZeroAgent()
    incident = _incident(failure_type, service=service)

    recommendation = agent.recommend(incident=incident, services=_services())

    assert recommendation.action_type is action
    assert recommendation.target_service is target
    assert recommendation.root_cause
    assert recommendation.risk
    assert f"failure_type={failure_type.value}" in recommendation.evidence


def test_verification_passes_for_a_recovered_service() -> None:
    agent = SREZeroAgent()

    checks = agent.verify(
        incident=_incident(FailureType.HIGH_MEMORY),
        services=_services(),
    )

    assert [check.name for check in checks] == [
        "service_health",
        "error_rate",
        "latency",
        "replicas_available",
    ]
    assert all(check.passed for check in checks)
    assert agent.recovery_verified(checks) is True


def test_verification_flags_a_service_that_is_still_down() -> None:
    agent = SREZeroAgent()
    services = _services()
    services[ServiceName.FEED] = ServiceState(
        name=ServiceName.FEED,
        status=ServiceStatus.DOWN,
        health=HealthStatus.UNHEALTHY,
        metrics=MetricPoint(cpu=0.99, memory=0.99, error_rate=100.0, latency_ms=5000.0),
        replicas=0,
    )

    checks = agent.verify(
        incident=_incident(FailureType.SERVICE_CRASH),
        services=services,
    )

    failed = {check.name for check in checks if not check.passed}
    assert failed == {"service_health", "error_rate", "latency", "replicas_available"}
    assert agent.recovery_verified(checks) is False


def test_database_recovery_also_checks_database_connectivity() -> None:
    agent = SREZeroAgent()
    services = _services()
    services[ServiceName.DATABASE].health = HealthStatus.DEGRADED

    checks = agent.verify(
        incident=_incident(FailureType.DATABASE_FAILURE, service=ServiceName.DATABASE),
        services=services,
    )

    database_check = next(check for check in checks if check.name == "database_connectivity")
    assert database_check.passed is False
    assert agent.recovery_verified(checks) is False


def test_recovery_requires_at_least_one_check() -> None:
    assert SREZeroAgent().recovery_verified([]) is False


def test_scale_remediation_lowers_pressure_on_the_target() -> None:
    current = MetricPoint(cpu=0.9, memory=0.995, error_rate=6.0, latency_ms=880.0)

    result = remediation_metrics(ActionType.SCALE_SERVICE, current=current)

    assert result.cpu == pytest.approx(0.55)
    assert result.memory == pytest.approx(0.695)
    assert result.error_rate == 0.0
    assert result.latency_ms == pytest.approx(480.0)


@pytest.mark.parametrize(
    "action",
    [
        ActionType.ROLLBACK,
        ActionType.RESTORE_DB,
        ActionType.RESTART_SERVICE,
        ActionType.RESTORE_DEPENDENCY,
    ],
)
def test_other_remediations_reset_to_a_healthy_sample(action) -> None:
    current = MetricPoint(cpu=0.95, memory=0.99, error_rate=40.0, latency_ms=1500.0)

    result = remediation_metrics(action, current=current)

    assert result == MetricPoint(cpu=0.2, memory=0.35, error_rate=0.0, latency_ms=45.0)


def test_remediation_metrics_without_a_current_sample() -> None:
    assert remediation_metrics(ActionType.ROLLBACK) == MetricPoint(
        cpu=0.22,
        memory=0.34,
        error_rate=0.0,
        latency_ms=48.0,
    )
