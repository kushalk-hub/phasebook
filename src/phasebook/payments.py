"""Payment gateway with idempotency and a circuit breaker.

PHB-003 lives here: the baseline clears the failure counter on every error and
ignores an idempotency key it has already seen.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from datetime import datetime

from phasebook.config import DEFAULT_SETTINGS, Settings
from phasebook.errors import CircuitOpen, PaymentUnavailable, ValidationError
from phasebook.models import PaymentResult, utcnow

Provider = Callable[[str, int], str]


class PaymentGateway:
    """Charge the external payment provider, protecting it with a breaker.

    ``provider`` receives ``(user_id, amount_cents)`` and returns a transaction
    id, or raises to signal a provider outage.
    """

    def __init__(
        self,
        provider: Provider,
        *,
        settings: Settings = DEFAULT_SETTINGS,
        clock: Callable[[], datetime] = utcnow,
        provider_name: str = "phasebook-payment-mock",
    ) -> None:
        self._provider = provider
        self._settings = settings
        self._clock = clock
        self._provider_name = provider_name
        self._failures = 0
        self._opened_at: datetime | None = None
        self._results: dict[str, PaymentResult] = {}

    @property
    def is_open(self) -> bool:
        """True while the breaker is refusing calls."""

        if self._opened_at is None:
            return False
        elapsed = (self._clock() - self._opened_at).total_seconds()
        if elapsed >= self._settings.payment_cooldown_seconds:
            # Cooldown elapsed: half-open, allow the next charge to probe.
            self._opened_at = None
            self._failures = 0
            return False
        return True

    def charge(
        self,
        *,
        user_id: str,
        amount_cents: int,
        idempotency_key: str,
    ) -> PaymentResult:
        """Charge ``amount_cents`` at most once per idempotency key."""

        if amount_cents <= 0:
            raise ValidationError("amount_cents must be greater than zero")
        key = idempotency_key.strip()
        if not key:
            raise ValidationError("idempotency_key is required")
        if self.is_open:
            raise CircuitOpen(
                "Payment circuit is open; the provider is being protected from retries"
            )

        try:
            transaction_id = self._provider(user_id, amount_cents)
        except Exception as exc:  # noqa: BLE001 - all provider errors trip the breaker
            # Deliberate baseline defect: the counter is cleared instead of
            # incremented, so the breaker never opens.
            self._failures = 0
            raise PaymentUnavailable(
                f"Payment provider failed for user {user_id}: {exc}"
            ) from exc

        result = PaymentResult(
            transaction_id=transaction_id,
            amount_cents=amount_cents,
            provider=self._provider_name,
        )
        # The baseline does not consult this cache before calling the provider.
        self._results[key] = result
        self._failures = 0
        self._opened_at = None
        return result

    def peek(self, idempotency_key: str) -> PaymentResult | None:
        """Return a previously charged result without performing a charge."""

        found = self._results.get(idempotency_key.strip())
        return replace(found, idempotent_replay=True) if found else None
