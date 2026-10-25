"""Run a complete inject → investigate → remediate → verify demo."""

from __future__ import annotations

import json

from phasebook.api import PhasebookAPI
from phasebook.models import FailureType


def main() -> int:
    api = PhasebookAPI()
    admin = "u-admin"

    post = api.create_post(actor_id="u-member", content="Phasebook is up.")
    api.tip(actor_id="u-member-2", post_id=post.id, amount_cents=200, idempotency_key="demo-tip")
    api.like(actor_id="u-member-2", post_id=post.id)

    incident = api.inject_failure(
        actor_id=admin,
        failure_type=FailureType.DATABASE_FAILURE,
    )
    print(f"Incident {incident.id}: {incident.title} ({incident.severity.value})")

    for step in api.investigate(actor_id=admin):
        print(f"  {step.step_number}. {step.tool_name}: {step.finding}")

    recommendation = api.approve_remediation(actor_id=admin)
    print(f"Remediation: {recommendation.action_type.value} → {recommendation.target_service.value}")

    checks = api.verify_recovery(actor_id=admin)
    for check in checks:
        flag = "PASS" if check.passed else "FAIL"
        print(f"  [{flag}] {check.name}: {check.current_value} (target {check.target_value})")

    print(json.dumps(api.snapshot(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
