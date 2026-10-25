"""Shared fixtures for the Phasebook sample tests."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


@dataclass
class FakeClock:
    """Controllable clock for payment cooling and incident windows."""

    current: datetime

    def now(self) -> datetime:
        return self.current

    def advance(self, *, seconds: float) -> datetime:
        self.current = self.current + timedelta(seconds=seconds)
        return self.current


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(datetime(2026, 10, 25, 12, 0, tzinfo=UTC))
