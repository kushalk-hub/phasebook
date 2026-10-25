# Architecture

```text
src/phasebook/
  api.py           thin composition layer (feed, payments, SRE lifecycle)
  auth.py          authorization policy                  (PHB-002)
  config.py        immutable runtime settings
  errors.py        domain error types with stable codes
  feed.py          feed ordering, visibility, pagination (PHB-001)
  incidents.py     incident lifecycle + PagerDuty dedup keys
  metrics.py       health evaluation and metric roll-ups
  models.py        dataclasses for users, posts, services, incidents
  payments.py      payment gateway, idempotency, circuit breaker (PHB-003)
  repository.py    in-memory persistence (SQL stand-in)
  sre_zero.py      investigation, recommendation, verification
  __main__.py      inject → investigate → remediate → verify demo
tests/
  conftest.py      controllable clock fixture
  test_feed.py     PHB-001 regression coverage
  test_auth.py     PHB-002 regression coverage
  test_payments.py PHB-003 regression coverage
  test_incidents.py incident lifecycle + deduplication
  test_metrics.py  health thresholds and roll-ups
  test_sre_zero.py investigation/recommendation/verification
  test_api.py      integration across all layers
web/               React/Vite application (not indexed by BugLens)
```

## Feed request path

```text
api.feed
  -> build_viewer_page        (viewer-specific copy)
  -> build_feed               (visibility, ordering, page slice)
  -> InMemoryRepository       (posts)
```

`build_feed` is the single visibility boundary: soft-deleted posts must never
reach a default page, and the returned list must contain at most `limit` rows.

## Payments path

```text
api.tip
  -> InMemoryRepository.get_post
  -> PaymentGateway.charge
       -> idempotency cache lookup
       -> circuit-breaker gate
       -> provider call (mock in tests)
```

The gateway is the only place that talks to a provider. A repeated idempotency
key must return the cached `PaymentResult` with `idempotent_replay=True`, and
consecutive provider failures must open the breaker after
`payment_failure_threshold` attempts.

## Incident path

```text
api.inject_failure      admin/operator only  (auth.require_operator)
  -> IncidentManager.open_incident           (dedup within the window)
api.investigate
  -> SREZeroAgent.investigate + recommend    (pure reads)
api.approve_remediation
  -> repository.update_service / deployments (the only mutation)
api.verify_recovery
  -> SREZeroAgent.verify                     (all checks must pass)
  -> IncidentManager.resolve
```

The agent itself is pure with respect to the repository: `investigate` and
`recommend` only read state, so the diagnostic sequence is replayable.

## Deliberate non-goals

- No real database, network calls, credentials or external services.
- No framework dependency: the Python core is importable with the standard
  library only, so BugLens can index and test it quickly.
- The `web/` application is out of scope for the Python code graph; it remains
  a normal React/Vite app.
