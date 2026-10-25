"""Immutable runtime settings for the Phasebook sample.

Thresholds live here (not in the services) so tests can build small settings
objects without patching module globals.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Settings:
    feed_page_size: int = 20
    feed_max_page_size: int = 50
    max_post_length: int = 5000
    max_comment_length: int = 1000
    payment_failure_threshold: int = 3
    payment_cooldown_seconds: float = 30.0
    incident_dedup_window_seconds: float = 300.0
    max_incident_symptoms: int = 10
    degraded_cpu: float = 0.85
    unhealthy_cpu: float = 0.95
    degraded_memory: float = 0.90
    unhealthy_memory: float = 0.98
    degraded_error_rate: float = 2.0
    unhealthy_error_rate: float = 10.0
    degraded_latency_ms: float = 750.0
    unhealthy_latency_ms: float = 1500.0
    db_latency_ms: float = 120.0


DEFAULT_SETTINGS = Settings()
