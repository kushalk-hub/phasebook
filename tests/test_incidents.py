"""Incident lifecycle and PagerDuty deduplication coverage."""

from __future__ import annotations

import pytest

from phasebook.config import Settings
from phasebook.errors import NotFound, ValidationError
from phasebook.incidents import IncidentManager, pager_duty_key, severity_for, slugify
from phasebook.models import (
    FailureType,
    IncidentSeverity,
    IncidentStatus,
    ServiceName,
)


def _open(
    manager: IncidentManager,
    *,
    clock,
    service: ServiceName = ServiceName.FEED,
    title: str = "Feed is slow",
):
    return manager.open_incident(
        service=service,
        title=title,
        severity=IncidentSeverity.SEV2,
        failure_type=FailureType.HIGH_MEMORY,
        symptoms=["latency high"],
        now=clock.now(),
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Feed is slow", "feed-is-slow"),
        ("  Checkout   5xx!!  ", "checkout-5xx"),
        ("", "incident"),
        ("---", "incident"),
    ],
)
def test_slugify_normalises_incident_titles(raw: str, expected: str) -> None:
    assert slugify(raw) == expected


def test_pager_duty_key_is_stable_and_service_scoped() -> None:
    first = pager_duty_key(ServiceName.DATABASE, "Database connectivity lost")
    second = pager_duty_key(ServiceName.DATABASE, "  database connectivity lost ")
    other = pager_duty_key(ServiceName.FEED, "Database connectivity lost")

    assert first == "phasebook:database:database-connectivity-lost"
    assert first == second
    assert first != other


@pytest.mark.parametrize(
    ("failure_type", "service", "expected"),
    [
        (FailureType.DATABASE_FAILURE, ServiceName.DATABASE, IncidentSeverity.SEV1),
        (FailureType.BAD_DEPLOYMENT, ServiceName.FEED, IncidentSeverity.SEV1),
        (FailureType.SERVICE_CRASH, ServiceName.FEED, IncidentSeverity.SEV2),
        (FailureType.DEPENDENCY_FAILURE, ServiceName.PAYMENT_SERVICE, IncidentSeverity.SEV2),
        (FailureType.HIGH_MEMORY, ServiceName.FEED, IncidentSeverity.SEV2),
        (FailureType.HIGH_MEMORY, ServiceName.POST_SERVICE, IncidentSeverity.SEV3),
        (FailureType.NONE, ServiceName.FEED, IncidentSeverity.SEV3),
    ],
)
def test_severity_policy(failure_type, service, expected) -> None:
    assert severity_for(failure_type, service) is expected


def test_open_incident_requires_a_title(clock) -> None:
    manager = IncidentManager()

    with pytest.raises(ValidationError):
        manager.open_incident(
            service=ServiceName.FEED,
            title="   ",
            severity=IncidentSeverity.SEV3,
            failure_type=FailureType.NONE,
            now=clock.now(),
        )


def test_open_incident_records_the_incident(clock) -> None:
    manager = IncidentManager()

    incident = _open(manager, clock=clock)

    assert incident.id == "inc-0001"
    assert incident.status is IncidentStatus.OPEN
    assert incident.started_at == clock.now()
    assert incident.dedup_key == "phasebook:feed:feed-is-slow"
    assert manager.get(incident.id) is incident


def test_symptoms_are_truncated_to_the_configured_limit(clock) -> None:
    manager = IncidentManager(Settings(max_incident_symptoms=2))

    incident = manager.open_incident(
        service=ServiceName.FEED,
        title="Many symptoms",
        severity=IncidentSeverity.SEV3,
        failure_type=FailureType.NONE,
        symptoms=["one", "two", "three"],
        now=clock.now(),
    )

    assert incident.symptoms == ["one", "two"]


def test_repeated_open_inside_the_window_is_deduplicated(clock) -> None:
    manager = IncidentManager()

    first = _open(manager, clock=clock)
    clock.advance(seconds=120)
    second = _open(manager, clock=clock, title="  feed is SLOW ")

    assert second is first
    assert len(manager.list_open()) == 1


def test_repeated_open_after_the_window_creates_a_new_incident(clock) -> None:
    manager = IncidentManager()

    first = _open(manager, clock=clock)
    clock.advance(seconds=301)
    second = _open(manager, clock=clock)

    assert second is not first
    assert second.id == "inc-0002"
    assert len(manager.list_open()) == 2


def test_dedup_window_comes_from_settings(clock) -> None:
    """PHB-007: an incident is reused only inside the configured window."""

    manager = IncidentManager(Settings(incident_dedup_window_seconds=60))

    first = _open(manager, clock=clock)
    clock.advance(seconds=59)
    still_deduplicated = _open(manager, clock=clock)

    clock.advance(seconds=2)
    after_window = _open(manager, clock=clock)

    assert still_deduplicated is first
    assert after_window is not first
    assert after_window.id == "inc-0002"


def test_deduplication_is_per_service(clock) -> None:
    manager = IncidentManager()

    database = _open(manager, clock=clock, service=ServiceName.DATABASE)
    feed = _open(manager, clock=clock, service=ServiceName.FEED)

    assert database is not feed
    assert len(manager.list_open()) == 2


def test_resolved_incidents_are_not_deduplicated(clock) -> None:
    manager = IncidentManager()

    first = _open(manager, clock=clock)
    manager.resolve(first.id, now=clock.now())
    second = _open(manager, clock=clock)

    assert second is not first
    assert first.status is IncidentStatus.RESOLVED
    assert first.resolved_at == clock.now()
    assert manager.list_open() == [second]


def test_transition_updates_status(clock) -> None:
    manager = IncidentManager()
    incident = _open(manager, clock=clock)

    moved = manager.transition(incident.id, IncidentStatus.INVESTIGATING)

    assert moved is incident
    assert incident.status is IncidentStatus.INVESTIGATING


def test_resolved_incident_cannot_transition(clock) -> None:
    manager = IncidentManager()
    incident = _open(manager, clock=clock)
    manager.resolve(incident.id, now=clock.now())

    with pytest.raises(ValidationError):
        manager.transition(incident.id, IncidentStatus.INVESTIGATING)


def test_unknown_incident_raises_not_found() -> None:
    manager = IncidentManager()

    with pytest.raises(NotFound):
        manager.get("inc-missing")


def test_reset_clears_incidents_and_counter(clock) -> None:
    manager = IncidentManager()
    _open(manager, clock=clock)

    manager.reset()

    assert manager.list_open() == []
    reopened = _open(manager, clock=clock)
    assert reopened.id == "inc-0001"
