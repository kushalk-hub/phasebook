# Live demo — historical context beats cold search

This demo shows the benefit of BugLens' historical knowledge on a *new*
regression that Phasebook already fixed once before.

## Story

1. Phasebook hits **PHB-RCA-014**: after a feed-ordering refactor, the timeline
   renders oldest-first. The RCA records the root cause, the one-line fix and
   the prevention test.
2. The regression comes back (**PHB-004**): `build_feed` loses its descending
   direction and the web feed query orders by `created_at ASC`.
3. The hosted app visibly shows the bug: the feed starts with the oldest posts
   and new posts land at the bottom.
4. BugLens retrieves the historical RCA/PR/contract, so the agent goes straight
   to `src/phasebook/feed.py::build_feed` instead of scanning unrelated
   candidates. The fix and the regression test are already known.

Everything here is **synthetic** and labelled as such. No real incident,
history ID or test output is fabricated.

## What is intentionally broken

| Where | Change | Symptom |
|---|---|---|
| `src/phasebook/feed.py::build_feed` | sort drops `reverse=True` | pages are oldest-first |
| `web/src/lib/db.ts::dbGetPosts` | `ORDER BY p.created_at ASC` | hosted timeline is oldest-first |
| `web/src/lib/db.ts::dbGetPosts` fallback | sorts by post id | same symptom without a database |

`python -m pytest` fails with **6 failed, 95 passed** at this state. The six
failures all come from the single ordering defect (four in `tests/test_feed.py`,
two in `tests/test_api.py`). The defect is tagged `demo-bug`.

## Historical assets (BugLens repository)

`database/seeds/phasebook_demo.json` contains three synthetic documents:

| external_id | Type | Why it helps |
|---|---|---|
| `PHB-RCA-014` | RCA | names the symptom, root cause (`build_feed` ascending), the fix and the prevention test |
| `PHB-PR-221` | GITHUB_PR | names the exact files and the newest-first contract test |
| `PHB-FEED-CONTRACT` | CONFLUENCE | states the ordering contract so a fix cannot contradict policy |

Load them once:

```bash
python scripts/load_seeds.py --seed database/seeds/phasebook_demo.json
# keyword/fuzzy retrieval without the embedding model:
python scripts/load_seeds.py --seed database/seeds/phasebook_demo.json --no-embed
```

> The seed file and the metrics script live in the BugLens repository
> (`database/seeds/phasebook_demo.json`, `scripts/demo_phasebook_history.py`),
> not in this repository, because that is where historical evidence is stored.
> Commit them there before pushing BugLens.

## Reproduce the metrics offline

From the BugLens repository root:

```bash
python scripts/demo_phasebook_history.py
python scripts/demo_phasebook_history.py --json   # machine-readable
```

Measured on this repository (2026-10-25, Windows, Python 3.12):

```text
indexed symbols  191
cold  top=src/phasebook/errors.py::CircuitOpen  rank=3/5  files-before-hit=3
warm  top=src/phasebook/feed.py::build_feed     rank=1/5  files-before-hit=1
      reason: matched terms: feed, new, phasebook, post, posts; history hint; not proof
tests: 6 failed, 95 passed
```

Interpretation: without history the first two candidates are unrelated
(`errors.py::CircuitOpen` from the word "open", `repository.py::list_posts` from
"posts"). The agent inspects three files before reaching the defect. With the
retrieved RCA the correct symbol is the top candidate, so the agent reads one
file.

## End-to-end demo flow

1. **Push the buggy state** to Kushal's repository and merge it to `main`; the
   Netlify deploy of `web/` then shows the reversed timeline.
2. **Register the repository** in BugLens (see [BUGLENS_SAMPLE.md](BUGLENS_SAMPLE.md))
   using the `demo-bug` revision (`git rev-parse demo-bug`).
3. **Load the historical seeds** so retrieval can find `PHB-RCA-014`.
4. **Submit the bug** with the same user report used by the metrics script:

   > Title: New posts are buried at the bottom of my feed
   >
   > Description: When I open Phasebook the top of my feed shows very old posts
   > and my latest post appears at the bottom. Refreshing does not help.

5. **Show the report**: the historical match is listed, the localization is
   `src/phasebook/feed.py::build_feed`, and the pytest run reports 6 failures.
6. **Apply the known fix** (branch `fix/phb-004`, tag `demo-fixed`):

   ```diff
   -        key=lambda post: (post.created_at, _sequence(post.id)),
   +        key=lambda post: (post.created_at, _sequence(post.id)),
   +        reverse=True,
   ```

   and in the web query:

   ```diff
   -        ORDER BY p.created_at ASC
   +        ORDER BY p.created_at DESC
   ```

7. **Verify**: `python -m pytest` → `101 passed`, the hosted feed is
   newest-first again.

## Presentation numbers to capture

| Metric | Cold run | History-assisted run |
|---|---|---|
| Top-1 localization correct | no (`errors.py::CircuitOpen`) | yes (`feed.py::build_feed`) |
| Rank of the true location | 3 | 1 |
| Files read before the defect | 3 | 1 |
| Retrieval documents used | 0 | 3 |
| Time to localize (median) | see script output | see script output |
| Failing tests at baseline | 6 | 6 |
| Tests after the fix | 101 passed | 101 passed |
| Fix size | 1 line (core) + 1 line (web query) | same |

Re-run the script before the presentation so the numbers are from that machine,
and do not quote the table above as a universal speedup — it is a single
deterministic sample.
