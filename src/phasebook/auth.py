"""Authorization helpers.

Administrative actions (failure injection, remediation approval, rollback) are
gated by :func:`require_operator`. PHB-002 regression coverage lives in
``tests/test_auth.py``.
"""

from __future__ import annotations

from phasebook.errors import PermissionDenied
from phasebook.models import Role, User

_OPERATOR_ROLES = frozenset({Role.ADMIN, Role.OPERATOR})


def require_operator(user: User) -> bool:
    """Allow administrators and SRE operators."""

    if user.role not in _OPERATOR_ROLES:
        raise PermissionDenied(f"{user.id} is not allowed to perform this action")
    return True


def require_admin(user: User) -> bool:
    """Allow only administrators (used for destructive maintenance actions)."""

    if user.role is not Role.ADMIN:
        raise PermissionDenied(f"{user.id} is not an administrator")
    return True


def can_moderate(user: User) -> bool:
    """Return whether the user may hide another user's post."""

    return user.role in _OPERATOR_ROLES
