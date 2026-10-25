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
| `buggy-baseline` | Reproducible defective state |
| `fixed` | Fixed state used for verification |

The tags are local to this clone (nothing is pushed by the sample workflow).
Resolve a pinned revision with:

```bash
git rev-parse buggy-baseline
git rev-parse fixed
```

## Defects

See [DEFECT_CATALOG.md](DEFECT_CATALOG.md). Summary:

- **PHB-001** — deleted posts leak into the feed and pages are one row too large (HIGH).
- **PHB-002** — operator authorization is inverted (CRITICAL).
- **PHB-003** — payments ignore idempotency keys and never trip the circuit breaker (HIGH).

## Layout

```text
src/phasebook/          indexable Python core
tests/                  pytest regression suite
web/                    React/Vite application and Netlify/Neon config
docker-compose.yml      full-stack stack (builds from ./web)
netlify.toml            Netlify config with base = "web"
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module map and
[BUGLENS_SAMPLE.md](BUGLENS_SAMPLE.md) for indexing and registration details.
