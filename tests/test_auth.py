"""PHB-002 regression coverage: operator authorization."""

from __future__ import annotations

import pytest

from phasebook.auth import can_moderate, require_admin, require_operator
from phasebook.errors import PermissionDenied
from phasebook.models import Role, User


def _user(role: Role) -> User:
    return User(id=f"u-{role.value}", name=role.value.title(), role=role)


def test_member_is_rejected_by_the_operator_gate() -> None:
    with pytest.raises(PermissionDenied):
        require_operator(_user(Role.MEMBER))


def test_operator_passes_the_operator_gate() -> None:
    assert require_operator(_user(Role.OPERATOR)) is True


def test_admin_passes_the_operator_gate() -> None:
    assert require_operator(_user(Role.ADMIN)) is True


def test_operator_is_not_an_admin() -> None:
    with pytest.raises(PermissionDenied):
        require_admin(_user(Role.OPERATOR))


def test_only_operators_may_moderate() -> None:
    assert can_moderate(_user(Role.OPERATOR)) is True
    assert can_moderate(_user(Role.ADMIN)) is True
    assert can_moderate(_user(Role.MEMBER)) is False
