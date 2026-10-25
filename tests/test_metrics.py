"""Health evaluation and metric roll-up coverage."""

from __future__ import annotations

import pytest

from phasebook.metrics import (
    apply_metrics,
    evaluate_health,
    rollup,
    status_for_health,
    system_health,
)
from phasebook.models import (
    HealthStatus,
    MetricPoint,
    ServiceName,
    ServiceState,
    ServiceStatus,
)


def _point(**overrides) -> MetricPoint:
    base = {"cpu": 0.1, "memory": 0.2, "error_rate": 0.0, "latency_ms": 40.0}
    base.update(overrides)
    return MetricPoint(**base)


def test_healthy_sample_stays_healthy() -> None:
    assert evaluate_health(_point()) is HealthStatus.HEALTHY


@pytest.mark.parametrize(
    "overrides",
    [
        {"error_rate": 2.0},
        {"cpu": 0.85},
        {"memory": 0.90},
        {"latency_ms": 750.0},
    ],
)
def test_any_degraded_signal_marks_the_service_degraded(overrides) -> None:
    assert evaluate_health(_point(**overrides)) is HealthStatus.DEGRADED


@pytest.mark.parametrize(
    "overrides",
    [
        {"error_rate": 10.0},
        {"cpu": 0.95},
        {"memory": 0.98},
        {"latency_ms": 1500.0},
    ],
)
def test_any_unhealthy_signal_marks_the_service_unhealthy(overrides) -> None:
    assert evaluate_health(_point(**overrides)) is HealthStatus.UNHEALTHY


def test_worst_signal_wins() -> None:
    point = _point(cpu=0.1, memory=0.99, error_rate=0.0, latency_ms=40.0)

    assert evaluate_health(point) is HealthStatus.UNHEALTHY


@pytest.mark.parametrize(
    ("health", "expected"),
    [
        (HealthStatus.HEALTHY, ServiceStatus.RUNNING),
        (HealthStatus.DEGRADED, ServiceStatus.DEGRADED),
        (HealthStatus.UNHEALTHY, ServiceStatus.DOWN),
    ],
)
def test_status_for_health(health, expected) -> None:
    assert status_for_health(health) is expected


def test_apply_metrics_updates_value_health_and_status() -> None:
    service = ServiceState(name=ServiceName.FEED)
    point = _point(error_rate=15.0, latency_ms=1600.0)

    returned = apply_metrics(service, point)

    assert returned is service
    assert service.metrics is point
    assert service.health is HealthStatus.UNHEALTHY
    assert service.status is ServiceStatus.DOWN


def test_rollup_averages_rates_and_sums_connection_errors() -> None:
    points = [
        MetricPoint(
            cpu=0.2,
            memory=0.4,
            error_rate=1.0,
            latency_ms=100.0,
            request_rate=100.0,
            http_5xx_rate=0.5,
            db_connection_errors=2,
        ),
        MetricPoint(
            cpu=0.4,
            memory=0.6,
            error_rate=3.0,
            latency_ms=300.0,
            request_rate=200.0,
            http_5xx_rate=1.5,
            db_connection_errors=3,
        ),
    ]

    averaged = rollup(points)

    assert averaged.cpu == pytest.approx(0.3)
    assert averaged.memory == pytest.approx(0.5)
    assert averaged.error_rate == pytest.approx(2.0)
    assert averaged.latency_ms == pytest.approx(200.0)
    assert averaged.request_rate == pytest.approx(150.0)
    assert averaged.http_5xx_rate == pytest.approx(1.0)
    assert averaged.db_connection_errors == 5


def test_rollup_of_an_empty_window_is_all_zeroes() -> None:
    averaged = rollup([])

    assert averaged == MetricPoint(cpu=0.0, memory=0.0, error_rate=0.0, latency_ms=0.0)


def test_system_health_reports_the_worst_service() -> None:
    services = {
        ServiceName.FEED: ServiceState(name=ServiceName.FEED),
        ServiceName.DATABASE: ServiceState(
            name=ServiceName.DATABASE,
            health=HealthStatus.DEGRADED,
            status=ServiceStatus.DEGRADED,
        ),
    }

    assert system_health(services) is HealthStatus.DEGRADED

    services[ServiceName.DATABASE].health = HealthStatus.UNHEALTHY

    assert system_health(services) is HealthStatus.UNHEALTHY


def test_system_health_without_services_is_healthy() -> None:
    assert system_health({}) is HealthStatus.HEALTHY
