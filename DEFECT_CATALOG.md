# Defect catalogue — synthetic fixtures

> **Synthetic data notice.** These defects were authored for the BugLens demo.
> They are not derived from a real incident and no historical Jira/RCA ID is
> fabricated. Where the BugLens corpus has a *genuine* match, link it manually
> through the investigation report; the sample itself claims none.

## PHB-004 — Feed timeline renders oldest-first (demo regression)

- **Severity:** HIGH
- **Type:** ordering / regression
- **Reproduction:**
  1. Open the Phasebook feed (web app) after at least two posts exist.
  2. Observe that the oldest post is at the top and new posts land at the
     bottom.
  3. Locally: `python -m pytest tests/test_feed.py -q`.
- **Expected:** the timeline is newest-first, so a page starts with the most
  recent post.
- **Actual:** `build_feed` sorts by `(created_at, sequence)` without the
  descending direction, so pages are oldest-first. The web feed query orders by
  `p.created_at ASC` for the same reason.
- **Files/functions:** `src/phasebook/feed.py::build_feed`,
  `web/src/lib/db.ts::dbGetPosts`.
- **Resolution:** restore descending ordering at the single ordering boundary
  and order the web feed query by `p.created_at DESC`; keep the
  newest-first regression test.
- **Historical match:** this is a regression of `PHB-RCA-014` (see the BugLens
  seed `database/seeds/phasebook_demo.json`), so the RCA already documents the
  root cause, the fix and the prevention test.
- **Regression tests:** `tests/test_feed.py::test_timeline_is_rendered_newest_first`,
  `tests/test_feed.py::test_feed_orders_newest_first_and_paginates`,
  `tests/test_feed.py::test_feed_never_exceeds_the_requested_page_size`,
  `tests/test_api.py::test_feed_respects_the_requested_page_size`.

## PHB-001 — Deleted posts leak into the feed and pages are too large

- **Severity:** HIGH
- **Type:** visibility / pagination
- **Reproduction:**
  1. Create three posts (`p1`, `p2`, `p3`) and soft-delete `p2`.
  2. Call `build_feed(posts, limit=10)` or `api.feed(limit=10)`.
  3. Alternatively create five posts and call `api.feed(limit=2)`.
- **Expected:** the deleted post is hidden (`["p3", "p1"]`) and a page never
  contains more than `limit` rows (`2`).
- **Actual:** the deleted post is returned (`["p3", "p2", "p1"]`) and the page
  contains `limit + 1` rows (`3`).
- **Files/functions:** `src/phasebook/feed.py::build_feed`.
- **Resolution:** drop soft-deleted posts unless `include_deleted=True`, then
  return `ordered[offset : offset + resolved]` (no extra row).
- **Regression tests:** `tests/test_feed.py::test_deleted_posts_are_hidden_from_the_feed`,
  `tests/test_feed.py::test_feed_never_exceeds_the_requested_page_size`,
  `tests/test_feed.py::test_feed_orders_newest_first_and_paginates`,
  `tests/test_api.py::test_feed_hides_deleted_posts`,
  `tests/test_api.py::test_feed_respects_the_requested_page_size`.

## PHB-002 — Operator authorization check is inverted

- **Severity:** CRITICAL
- **Type:** authentication / authorization
- **Reproduction:**
  1. Build a user with `role=Role.MEMBER`.
  2. Call `auth.require_operator(user)` or `api.inject_failure(actor_id=..., ...)`.
  3. Repeat with `role=Role.OPERATOR` or `role=Role.ADMIN`.
- **Expected:** members are rejected with `PermissionDenied`; operators and
  administrators are allowed.
- **Actual:** members pass the gate while operators and administrators are
  rejected, so no administrator can inject, investigate or remediate an
  incident.
- **Files/functions:** `src/phasebook/auth.py::require_operator`.
- **Resolution:** reject when `user.role not in _OPERATOR_ROLES`; return `True`
  for admins and operators.
- **Regression tests:** `tests/test_auth.py::test_member_is_rejected_by_the_operator_gate`,
  `tests/test_auth.py::test_operator_passes_the_operator_gate`,
  `tests/test_auth.py::test_admin_passes_the_operator_gate`,
  `tests/test_api.py::test_member_cannot_inject_a_failure`,
  `tests/test_api.py::test_admin_can_inject_a_failure`,
  `tests/test_api.py::test_full_lifecycle_restores_health_and_resolves_the_incident`.

## PHB-003 — Payments ignore idempotency and never trip the breaker

- **Severity:** HIGH
- **Type:** payment correctness / resilience
- **Reproduction:**
  1. Charge twice with the same `idempotency_key` and a provider that records
     calls.
  2. Charge repeatedly while the provider raises an error.
- **Expected:** the provider is called once per idempotency key and the second
  result has `idempotent_replay=True`; the circuit opens after
  `payment_failure_threshold` consecutive failures and further calls raise
  `CircuitOpen`.
- **Actual:** the second charge calls the provider again (double charge), and
  the failure counter is reset on every error, so the circuit never opens.
- **Files/functions:** `src/phasebook/payments.py::PaymentGateway.charge`.
- **Resolution:** return the cached `PaymentResult` (marked as a replay) before
  calling the provider; on provider errors increment `_failures` and set
  `_opened_at` once the threshold is reached.
- **Regression tests:** `tests/test_payments.py::test_duplicate_idempotency_key_is_charged_once`,
  `tests/test_payments.py::test_circuit_opens_after_the_failure_threshold`,
  `tests/test_payments.py::test_circuit_allows_a_probe_after_cooldown`,
  `tests/test_payments.py::test_successful_charge_resets_the_failure_count`,
  `tests/test_api.py::test_tip_idempotency_does_not_double_charge`.
