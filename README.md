# Phasebook — BugLens sample application

Phasebook is a small social feed with tipping plus a deterministic SRE
remediation simulator. The repository is shaped like a BugLens sample:

- **`src/phasebook/`** — a dependency-free Python core that BugLens can index,
  localize and test end to end.
- **`web/`** — the original React/Vite Phasebook application, kept unchanged.
  See [`web/README.md`](web/README.md) for the full-stack setup.

> **Synthetic data notice.** Every defect in the Python core was authored for
> this demo. None of them is a real production incident, and no historical
> Jira/RCA ID is invented.

## Run the Python tests

```bash
python -m pytest
```

The baseline has failing tests in each defect area. At the `fixed` tag the whole
suite passes.

Run the end-to-end CLI demo:

```bash
# POSIX
PYTHONPATH=src python -m phasebook

# PowerShell
$env:PYTHONPATH = "src"; python -m phasebook
```

## Git history

| Tag | Meaning |
|---|---|
| `buggy-baseline` | Reproducible defective state used for the first three defects |
| `fixed` | All original defects fixed (`100 passed`) |
| `demo-bug` | Historical-context demo: feed ordering regression, tests fail |
| `demo-fixed` | Same tree with the known fix applied (`101 passed`) |

The tags are local to this clone (nothing is pushed by the sample workflow).
Resolve a pinned revision with:

```bash
git rev-parse buggy-baseline
git rev-parse demo-bug
```

## Defects

See [DEFECT_CATALOG.md](DEFECT_CATALOG.md). Summary:

- **PHB-004** — feed timeline renders oldest-first (demo regression, HIGH).
- **PHB-001** — deleted posts leak into the feed and pages are one row too large (HIGH).
- **PHB-002** — operator authorization is inverted (CRITICAL).
- **PHB-003** — payments ignore idempotency keys and never trip the circuit breaker (HIGH).
- **PHB-005 / PHB-006 / PHB-007** — local, uncommitted practice bugs: like toggle,
  comment validation and incident dedup (see the catalogue).

PHB-004 is the live demonstration: it is a regression of a historically solved
bug, so BugLens' retrieved RCA shortens the investigation. See [DEMO.md](DEMO.md).

## Layout

```text
src/phasebook/          indexable Python core
tests/                  pytest regression suite
web/                    React/Vite application and Netlify/Neon config
docker-compose.yml      full-stack stack (builds from ./web)
netlify.toml            Netlify config with base = "web"
DEMO.md                 historical-context demo script and metrics
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module map and
[BUGLENS_SAMPLE.md](BUGLENS_SAMPLE.md) for indexing and registration details.
