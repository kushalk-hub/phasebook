"""Incident lifecycle and PagerDuty deduplication."""

from __future__ import annotations

import re
from datetime import datetime

from phasebook.config import DEFAULT_SETTINGS, Settings
from phasebook.errors import NotFound, ValidationError
from phasebook.models import (
    FailureType,
    Incident,
    IncidentSeverity,
    IncidentStatus,
    ServiceName,
    utcnow,
)

_SLUG = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Lowercase kebab-case key fragment."""

    return _SLUG.sub("-", value.strip().lower()).strip("-") or "incident"


class IncidentManager:
    """In-memory incident registry with a deduplication window.

    PagerDuty receives one event per logical incident: opening the same
    service/title again inside the window returns the existing incident and
    keeps ``dedup_key`` stable.
    """

    def __init__(self, settings: Settings = DEFAULT_SETTINGS) -> None:
        self._settings = settings
        self._incidents: dict[str, Incident] = {}
        self._counter = 0

    def open_incident(
        self,
        *,
        service: ServiceName,
        title: str,
        severity: IncidentSeverity,
        failure_type: FailureType,
        symptoms: list[str] | None = None,
        details: str = "",
        now: datetime | None = None,
    ) -> Incident:
        if not title.strip():
            raise ValidationError("Incident title is required")
        moment = now or utcnow()
        existing = self.find_recent(service=service, title=title, now=moment)
        if existing is not None:
            return existing

        self._counter += 1
        incident = Incident(
            id=f"inc-{self._counter:04d}",
            title=title.strip(),
            service=service,
            severity=severity,
            failure_type=failure_type,
            symptoms=(symptoms or [])[: self._settings.max_incident_symptoms],
            details=details.strip(),
            started_at=moment,
            dedup_key=pager_duty_key(service, title),
        )
        self._incidents[incident.id] = incident
        return incident

    def find_recent(
        self,
        *,
        service: ServiceName,
        title: str,
        now: datetime | None = None,
    ) -> Incident | None:
        """Return an unresolved incident with the same logical identity."""

        moment = now or utcnow()
        wanted = slugify(title)
        for incident in self._incidents.values():
            if incident.status is IncidentStatus.RESOLVED:
                continue
            if incident.service is not service or slugify(incident.title) != wanted:
                continue
            return incident
        return None

    def get(self, incident_id: str) -> Incident:
        try:
            return self._incidents[incident_id]
        except KeyError as exc:
            raise NotFound(f"Incident not found: {incident_id}") from exc

    def list_open(self) -> list[Incident]:
        return [
            incident
            for incident in self._incidents.values()
            if incident.status is not IncidentStatus.RESOLVED
        ]

    def transition(self, incident_id: str, status: IncidentStatus) -> Incident:
        incident = self.get(incident_id)
        if incident.status is IncidentStatus.RESOLVED:
            raise ValidationError("A resolved incident cannot transition")
        incident.status = status
        return incident

    def resolve(self, incident_id: str, *, now: datetime | None = None) -> Incident:
        incident = self.get(incident_id)
        incident.status = IncidentStatus.RESOLVED
        incident.resolved_at = now or utcnow()
        return incident

    def reset(self) -> None:
        self._incidents.clear()
        self._counter = 0


def pager_duty_key(service: ServiceName, title: str) -> str:
    """Stable PagerDuty Events v2 deduplication key."""

    return f"phasebook:{service.value}:{slugify(title)}"


def severity_for(failure_type: FailureType, service: ServiceName) -> IncidentSeverity:
    """Default severity policy for a failure class."""

    if failure_type is FailureType.DATABASE_FAILURE:
        return IncidentSeverity.SEV1
    if failure_type is FailureType.BAD_DEPLOYMENT:
        return IncidentSeverity.SEV1
    if failure_type in {FailureType.SERVICE_CRASH, FailureType.DEPENDENCY_FAILURE}:
        return IncidentSeverity.SEV2
    if failure_type is FailureType.HIGH_MEMORY:
        return IncidentSeverity.SEV2 if service is ServiceName.FEED else IncidentSeverity.SEV3
    return IncidentSeverity.SEV3
