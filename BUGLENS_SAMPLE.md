# Using Phasebook with BugLens

Phasebook is shaped to plug into BugLens exactly like
`sample_repos/buglens-demo-app`: a Python core with tests, two Git tags and a
synthetic defect catalogue.

## What BugLens indexes

- `code_intelligence/graph/builder.py` walks the repository and indexes
  `*.py` files. That covers `src/phasebook/`, `tests/` and `pyproject.toml`'s
  test configuration. `web/` has no Python, so it stays out of the code graph.
- Test nodes are detected for paths under `tests/` or filenames starting with
  `test_`. The test runner only executes pytest through its allowlist, so use
  `pytest -q`.
- The sample has no third-party runtime dependencies, so indexing and test runs
  are fast and deterministic.

## Register the checkout

The local-registration endpoint only accepts paths under `SAMPLE_REPOS_ROOT`
(the compose stack uses `/app/sample_repos`, mounted read-only from
`./sample_repos`). Pick one of these:

**Option A — put the checkout under `sample_repos` (container stack):**

```bash
cp -r Phasebook-Netlify sample_repos/Phasebook-Netlify
```

**Option B — run the backend directly against a parent directory:**

Point `SAMPLE_REPOS_ROOT` at the directory that contains `Phasebook-Netlify`
and run the API with the same Python environment.

Then register it:

```bash
curl -X POST http://localhost:8000/api/v1/repositories/local \
  -H "Content-Type: application/json" \
  -d '{"name":"Phasebook-Netlify","path":"/app/sample_repos/Phasebook-Netlify","branch":"main","test_command":"pytest -q"}'
```

The response is `READY`; indexing continues in the background. Poll
`GET /api/v1/repositories/{id}` until `READY`.

## Investigate the baseline

Use the revision tagged `buggy-baseline` as the base SHA:

```bash
git rev-parse buggy-baseline
```

Then submit a bug through `/investigate` with the real failing output, for
example:

```text
New posts are buried at the bottom of my feed
```

This is the PHB-004 demo report; it is the text the metrics script uses.

Expected localization:

| Defect | Top finding | Failing regression tests |
|---|---|---|
| PHB-004 (demo) | `src/phasebook/feed.py::build_feed` | `tests/test_feed.py`, `tests/test_api.py` |
| PHB-001 | `src/phasebook/feed.py::build_feed` | `tests/test_feed.py`, `tests/test_api.py` |
| PHB-002 | `src/phasebook/auth.py::require_operator` | `tests/test_auth.py`, `tests/test_api.py` |
| PHB-003 | `src/phasebook/payments.py::PaymentGateway.charge` | `tests/test_payments.py`, `tests/test_api.py` |

At `buggy-baseline` the suite fails in three areas; at `fixed` it passes 100%.
At `demo-bug` the feed-ordering regression fails six tests; at `demo-fixed` the
suite is green again. See [DEMO.md](DEMO.md) for the historical-context
walkthrough.

```bash
git checkout buggy-baseline && python -m pytest   # failures for PHB-001/002/003
git checkout fixed && python -m pytest            # all pass
git checkout demo-bug && python -m pytest         # 6 failures (PHB-004)
git checkout demo-fixed && python -m pytest       # all pass
```

## Local verification without the full stack

The graph builder can be exercised directly from the BugLens repository:

```python
from pathlib import Path
from code_intelligence.graph.builder import build_repo_graph

graph = build_repo_graph(Path("Phasebook-Netlify"))
print(len(graph.nodes), len(graph.edges))
```

The exact builder signature lives in `code_intelligence/graph/builder.py`; the
sample only requires that the resulting nodes include `src/phasebook/*.py` and
`tests/test_*.py`.
