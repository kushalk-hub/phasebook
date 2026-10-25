"""Domain errors with stable machine-readable codes."""

from __future__ import annotations


class PhasebookError(Exception):
    """Base class for expected, user-facing failures."""

    code = "ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ValidationError(PhasebookError):
    code = "VALIDATION_ERROR"


class NotFound(PhasebookError):
    code = "NOT_FOUND"


class PermissionDenied(PhasebookError):
    code = "PERMISSION_DENIED"


class PaymentUnavailable(PhasebookError):
    code = "PAYMENT_UNAVAILABLE"


class CircuitOpen(PaymentUnavailable):
    code = "PAYMENT_CIRCUIT_OPEN"
