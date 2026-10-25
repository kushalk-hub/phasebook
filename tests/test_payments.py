"""PHB-003 regression coverage: payments idempotency and circuit breaker."""

from __future__ import annotations

from collections.abc import Callable

import pytest

from phasebook.errors import CircuitOpen, PaymentUnavailable, ValidationError
from phasebook.payments import PaymentGateway


def _gateway(
    provider: Callable[[str, int], str],
    clock,
    *,
    threshold: int = 3,
) -> PaymentGateway:
    settings = type(
        "Settings",
        (),
        {
            "payment_failure_threshold": threshold,
            "payment_cooldown_seconds": 30.0,
        },
    )()
    return PaymentGateway(provider, settings=settings, clock=clock.now)


def test_duplicate_idempotency_key_is_charged_once(clock) -> None:
    calls: list[tuple[str, int]] = []

    def provider(user_id: str, amount_cents: int) -> str:
        calls.append((user_id, amount_cents))
        return f"txn-{len(calls)}"

    gateway = _gateway(provider, clock)

    first = gateway.charge(user_id="u1", amount_cents=200, idempotency_key="tip-1")
    replay = gateway.charge(user_id="u1", amount_cents=200, idempotency_key="tip-1")

    assert first.idempotent_replay is False
    assert replay.idempotent_replay is True
    assert replay.transaction_id == first.transaction_id
    assert calls == [("u1", 200)]


def test_circuit_opens_after_the_failure_threshold(clock) -> None:
    calls: list[int] = []

    def provider(user_id: str, amount_cents: int) -> str:
        calls.append(amount_cents)
        raise RuntimeError("provider down")

    gateway = _gateway(provider, clock)

    for index in range(3):
        with pytest.raises(PaymentUnavailable):
            gateway.charge(user_id="u1", amount_cents=100, idempotency_key=f"tip-{index}")

    assert gateway.is_open is True
    with pytest.raises(CircuitOpen):
        gateway.charge(user_id="u1", amount_cents=100, idempotency_key="tip-4")
    assert len(calls) == 3


def test_circuit_allows_a_probe_after_cooldown(clock) -> None:
    healthy = {"value": False}

    def provider(user_id: str, amount_cents: int) -> str:
        if not healthy["value"]:
            raise RuntimeError("provider down")
        return "txn-recovered"

    gateway = _gateway(provider, clock)
    for index in range(3):
        with pytest.raises(PaymentUnavailable):
            gateway.charge(user_id="u1", amount_cents=100, idempotency_key=f"tip-{index}")

    clock.advance(seconds=31)
    assert gateway.is_open is False

    healthy["value"] = True
    result = gateway.charge(user_id="u1", amount_cents=100, idempotency_key="tip-after")

    assert result.transaction_id == "txn-recovered"


def test_successful_charge_resets_the_failure_count(clock) -> None:
    state = {"failures": 2}

    def provider(user_id: str, amount_cents: int) -> str:
        if state["failures"]:
            state["failures"] -= 1
            raise RuntimeError("transient")
        return "txn-ok"

    gateway = _gateway(provider, clock)
    for index in range(2):
        with pytest.raises(PaymentUnavailable):
            gateway.charge(user_id="u1", amount_cents=100, idempotency_key=f"tip-{index}")

    assert gateway.charge(user_id="u1", amount_cents=100, idempotency_key="tip-ok").transaction_id == "txn-ok"
    assert gateway.is_open is False


@pytest.mark.parametrize("amount", [0, -50])
def test_non_positive_amount_is_rejected(clock, amount: int) -> None:
    gateway = _gateway(lambda user_id, amount_cents: "txn", clock)
    with pytest.raises(ValidationError):
        gateway.charge(user_id="u1", amount_cents=amount, idempotency_key="tip")


def test_missing_idempotency_key_is_rejected(clock) -> None:
    gateway = _gateway(lambda user_id, amount_cents: "txn", clock)
    with pytest.raises(ValidationError):
        gateway.charge(user_id="u1", amount_cents=100, idempotency_key="   ")
