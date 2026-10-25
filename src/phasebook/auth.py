"""Authorization helpers. PHB-002 lives here.

Administrative actions (failure injection, remediation approval, rollback) are
gated by :func:`require_operator`. The baseline check is inverted.
"""

from __future__ import annotations

from phasebook.errors import PermissionDenied
from phasebook.models import Role, User

_OPERATOR_ROLES = frozenset({Role.ADMIN, Role.OPERATOR})


def require_operator(user: User) -> bool:
    """Allow administrators and SRE operators.

    PHB-002 baseline behaviour: the membership test is inverted, so members
    pass the gate while operators and administrators are rejected.
    """

    if user.role in _OPERATOR_ROLES:
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
