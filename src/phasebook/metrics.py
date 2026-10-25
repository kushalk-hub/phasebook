"""Health evaluation and metric roll-ups."""

from __future__ import annotations

from collections.abc import Iterable

from phasebook.config import DEFAULT_SETTINGS, Settings
from phasebook.models import HealthStatus, MetricPoint, ServiceState, ServiceStatus


def evaluate_health(
    point: MetricPoint,
    settings: Settings = DEFAULT_SETTINGS,
) -> HealthStatus:
    """Map one metric sample to a health status.

    Worst signal wins: an unhealthy error rate is not masked by low CPU.
    """

    if (
        point.error_rate >= settings.unhealthy_error_rate
        or point.cpu >= settings.unhealthy_cpu
        or point.memory >= settings.unhealthy_memory
        or point.latency_ms >= settings.unhealthy_latency_ms
    ):
        return HealthStatus.UNHEALTHY
    if (
        point.error_rate >= settings.degraded_error_rate
        or point.cpu >= settings.degraded_cpu
        or point.memory >= settings.degraded_memory
        or point.latency_ms >= settings.degraded_latency_ms
    ):
        return HealthStatus.DEGRADED
    return HealthStatus.HEALTHY


def status_for_health(health: HealthStatus) -> ServiceStatus:
    return {
        HealthStatus.HEALTHY: ServiceStatus.RUNNING,
        HealthStatus.DEGRADED: ServiceStatus.DEGRADED,
        HealthStatus.UNHEALTHY: ServiceStatus.DOWN,
    }[health]


def apply_metrics(
    service: ServiceState,
    point: MetricPoint,
    settings: Settings = DEFAULT_SETTINGS,
) -> ServiceState:
    """Store a sample on the service and recompute its derived status."""

    service.metrics = point
    service.health = evaluate_health(point, settings)
    service.status = status_for_health(service.health)
    return service


def rollup(points: Iterable[MetricPoint]) -> MetricPoint:
    """Average a window of samples; an empty window is all zeroes."""

    samples = list(points)
    if not samples:
        return MetricPoint(cpu=0.0, memory=0.0, error_rate=0.0, latency_ms=0.0)
    count = len(samples)
    return MetricPoint(
        cpu=sum(point.cpu for point in samples) / count,
        memory=sum(point.memory for point in samples) / count,
        error_rate=sum(point.error_rate for point in samples) / count,
        latency_ms=sum(point.latency_ms for point in samples) / count,
        request_rate=sum(point.request_rate for point in samples) / count,
        http_5xx_rate=sum(point.http_5xx_rate for point in samples) / count,
        db_connection_errors=sum(point.db_connection_errors for point in samples),
    )


def system_health(services: dict[object, ServiceState]) -> HealthStatus:
    """Aggregate service health, worst signal first."""

    statuses = [service.health for service in services.values()]
    if HealthStatus.UNHEALTHY in statuses:
        return HealthStatus.UNHEALTHY
    if HealthStatus.DEGRADED in statuses:
        return HealthStatus.DEGRADED
    return HealthStatus.HEALTHY
