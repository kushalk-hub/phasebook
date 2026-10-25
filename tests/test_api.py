"""End-to-end coverage through the PhasebookAPI composition layer."""

from __future__ import annotations

import pytest

from phasebook.api import PhasebookAPI
from phasebook.errors import NotFound, PermissionDenied, ValidationError
from phasebook.models import (
    ActionType,
    FailureType,
    HealthStatus,
    IncidentSeverity,
    IncidentStatus,
    ServiceName,
)


@pytest.fixture
def api(clock) -> PhasebookAPI:
    return PhasebookAPI(clock=clock.now)


# -- social feed -----------------------------------------------------------


def test_snapshot_serialises_the_platform_state(api: PhasebookAPI) -> None:
    snapshot = api.snapshot()

    assert snapshot["systemHealth"] == HealthStatus.HEALTHY.value
    assert set(snapshot["services"]) == {name.value for name in ServiceName}
    assert snapshot["activeIncident"] is None
    assert snapshot["recoveryVerified"] is False


def test_unknown_actor_is_not_found(api: PhasebookAPI) -> None:
    with pytest.raises(NotFound):
        api.create_post(actor_id="ghost", content="hello")


def test_like_comment_and_tip_update_the_post(api: PhasebookAPI) -> None:
    post = api.create_post(actor_id="u-member", content="Phasebook is up.")
    api.like(actor_id="u-member-2", post_id=post.id)
    api.comment(actor_id="u-member-2", post_id=post.id, text="Nice!")

    result = api.tip(
        actor_id="u-member-2",
        post_id=post.id,
        amount_cents=200,
        idempotency_key="tip-1",
    )

    assert post.likes == 1
    assert [comment.text for comment in post.comments] == ["Nice!"]
    assert result.idempotent_replay is False
    assert post.tips_cents == 200
    assert post.shares == 1


def test_liking_twice_removes_the_like(api: PhasebookAPI) -> None:
    """PHB-005 end to end: the second tap must un-like."""

    post = api.create_post(actor_id="u-member", content="Toggle me")

    api.like(actor_id="u-member-2", post_id=post.id)
    assert post.likes == 1

    api.like(actor_id="u-member-2", post_id=post.id)

    assert post.likes == 0
    assert post.liked_by == set()


def test_blank_comment_is_rejected_by_the_api(api: PhasebookAPI) -> None:
    """PHB-006 end to end: validation happens in the repository."""

    post = api.create_post(actor_id="u-member", content="Comment me")

    with pytest.raises(ValidationError):
        api.comment(actor_id="u-member-2", post_id=post.id, text="   ")


def test_feed_hides_deleted_posts(api: PhasebookAPI) -> None:
    for text in ("one", "two", "three"):
        api.create_post(actor_id="u-member", content=text)

    api.delete_post(actor_id="u-member", post_id="p2")

    assert [post.id for post in api.feed(limit=10)] == ["p3", "p1"]


def test_feed_respects_the_requested_page_size(api: PhasebookAPI) -> None:
    for index in range(5):
        api.create_post(actor_id="u-member", content=f"post {index}")

    assert [post.id for post in api.feed(limit=2)] == ["p5", "p4"]


def test_tip_idempotency_does_not_double_charge(api: PhasebookAPI) -> None:
    post = api.create_post(actor_id="u-member", content="Tip me")

    first = api.tip(
        actor_id="u-member-2",
        post_id=post.id,
        amount_cents=200,
        idempotency_key="tip-1",
    )
    replay = api.tip(
        actor_id="u-member-2",
        post_id=post.id,
        amount_cents=200,
        idempotency_key="tip-1",
    )

    assert first.idempotent_replay is False
    assert replay.idempotent_replay is True
    assert replay.transaction_id == first.transaction_id
    assert post.tips_cents == 200
    assert post.shares == 1


def test_member_cannot_delete_another_users_post(api: PhasebookAPI) -> None:
    post = api.create_post(actor_id="u-member", content="mine")

    with pytest.raises(PermissionDenied):
        api.delete_post(actor_id="u-member-2", post_id=post.id)


def test_operator_can_moderate_another_users_post(api: PhasebookAPI) -> None:
    post = api.create_post(actor_id="u-member", content="mine")

    api.delete_post(actor_id="u-operator", post_id=post.id)

    with pytest.raises(NotFound):
        api.repository.get_post(post.id)


# -- authorization ---------------------------------------------------------


def test_member_cannot_inject_a_failure(api: PhasebookAPI) -> None:
    with pytest.raises(PermissionDenied):
        api.inject_failure(
            actor_id="u-member",
            failure_type=FailureType.DATABASE_FAILURE,
        )


def test_admin_can_inject_a_failure(api: PhasebookAPI) -> None:
    incident = api.inject_failure(
        actor_id="u-admin",
        failure_type=FailureType.DATABASE_FAILURE,
    )

    assert incident.severity is IncidentSeverity.SEV1
    assert incident.service is ServiceName.DATABASE
    assert incident.status is IncidentStatus.OPEN
    assert api.health() is HealthStatus.UNHEALTHY
    assert api.snapshot()["activeFailureType"] == FailureType.DATABASE_FAILURE.value


def test_member_cannot_investigate(api: PhasebookAPI) -> None:
    with pytest.raises(PermissionDenied):
        api.investigate(actor_id="u-member")


# -- incident lifecycle ----------------------------------------------------


def test_full_lifecycle_restores_health_and_resolves_the_incident(
    api: PhasebookAPI,
) -> None:
    incident = api.inject_failure(
        actor_id="u-admin",
        failure_type=FailureType.DATABASE_FAILURE,
    )

    steps = api.investigate(actor_id="u-admin")
    assert [step.step_number for step in steps] == list(range(1, len(steps) + 1))
    assert api.snapshot()["activeIncident"]["status"] == IncidentStatus.INVESTIGATING.value

    recommendation = api.approve_remediation(actor_id="u-admin")
    assert recommendation.action_type is ActionType.RESTORE_DB
    assert recommendation.target_service is ServiceName.DATABASE
    assert api.snapshot()["remediationApproved"] is True

    checks = api.verify_recovery(actor_id="u-admin")

    assert checks
    assert all(check.passed for check in checks)
    assert incident.status is IncidentStatus.RESOLVED
    assert incident.resolved_at is not None
    assert api.snapshot()["recoveryVerified"] is True
    assert api.health() is HealthStatus.HEALTHY
    assert api.snapshot()["activeFailureType"] == FailureType.NONE.value


@pytest.mark.parametrize(
    ("failure_type", "action", "target"),
    [
        (FailureType.BAD_DEPLOYMENT, ActionType.ROLLBACK, ServiceName.FEED),
        (FailureType.DATABASE_FAILURE, ActionType.RESTORE_DB, ServiceName.DATABASE),
        (FailureType.SERVICE_CRASH, ActionType.RESTART_SERVICE, ServiceName.FEED),
        (
            FailureType.DEPENDENCY_FAILURE,
            ActionType.RESTORE_DEPENDENCY,
            ServiceName.PAYMENT_SERVICE,
        ),
        (FailureType.HIGH_MEMORY, ActionType.SCALE_SERVICE, ServiceName.FEED),
    ],
)
def test_every_failure_class_can_be_remediated(
    api: PhasebookAPI,
    failure_type: FailureType,
    action: ActionType,
    target: ServiceName,
) -> None:
    api.inject_failure(actor_id="u-admin", failure_type=failure_type)
    api.investigate(actor_id="u-admin")

    recommendation = api.approve_remediation(actor_id="u-admin")
    assert recommendation.action_type is action
    assert recommendation.target_service is target

    checks = api.verify_recovery(actor_id="u-admin")
    assert all(check.passed for check in checks), [check.name for check in checks]
    assert api.health() is HealthStatus.HEALTHY


def test_approval_requires_an_investigation(api: PhasebookAPI) -> None:
    api.inject_failure(actor_id="u-admin", failure_type=FailureType.HIGH_MEMORY)

    with pytest.raises(ValidationError):
        api.approve_remediation(actor_id="u-admin")


def test_verification_requires_approved_remediation(api: PhasebookAPI) -> None:
    api.inject_failure(actor_id="u-admin", failure_type=FailureType.HIGH_MEMORY)
    api.investigate(actor_id="u-admin")

    with pytest.raises(ValidationError):
        api.verify_recovery(actor_id="u-admin")


def test_actions_require_an_active_incident(api: PhasebookAPI) -> None:
    with pytest.raises(ValidationError):
        api.investigate(actor_id="u-admin")


def test_reset_restores_the_healthy_baseline(api: PhasebookAPI) -> None:
    api.inject_failure(actor_id="u-admin", failure_type=FailureType.SERVICE_CRASH)
    assert api.health() is HealthStatus.UNHEALTHY

    api.reset(actor_id="u-admin")
    snapshot = api.snapshot()

    assert api.health() is HealthStatus.HEALTHY
    assert snapshot["activeIncident"] is None
    assert snapshot["activeFailureType"] == FailureType.NONE.value
    assert snapshot["remediationApproved"] is False
    assert snapshot["recoveryVerified"] is False
