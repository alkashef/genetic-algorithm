# Migration Plan

Each milestone leaves the app fully working and independently testable — no
half-migrated state is left in between. See `docs/design.md` for the target
architecture these milestones move toward.

## M0 — Docs scaffold + cleanup

Create `docs/design.md` and `docs/plan.md`. Remove the empty `data/` folder
(contained only `.gitkeep`) and drop it from README's file-structure section.
No other code changes.

**Test:** N/A (docs and empty-folder removal only).

## M1 — Shared solver utilities

Move `src/utils/tsp_math.py` → `src/solvers/common/tsp_math.py` unchanged;
update its two importers (`ga_service.py`, `bruteforce_service.py`) and
`tests/test_tsp_math.py`; delete now-empty `src/utils/`.

**Test:** `tests/test_tsp_math.py`, `tests/test_ga_service.py`,
`tests/test_bruteforce_service.py` pass. Start the app, hit `/api/ga/init`
and `/api/bruteforce` once to confirm imports resolve at runtime.

## M2 — GA solver package

Move `src/models/ga_params.py` → `src/solvers/ga/ga_params.py`. Split
`src/services/ga_service.py` into `src/solvers/ga/ga_service.py` (public
stages) and `src/solvers/ga/ga_pipeline.py` (DEAP engine + operators). Update
`ga_routes.py` imports. Update `test_ga_params.py`/`test_ga_service.py`
import paths; add `test_ga_pipeline.py` if the split leaves operator-level
behavior not already covered through stage-level tests.

**Test:** GA test files pass. Manually call all 5 `/api/ga/*` endpoints in
sequence (init → evaluate → select → crossover → mutate); responses match
pre-refactor behavior.

## M3 — Brute-force solver package

Move `src/services/bruteforce_service.py` → `src/solvers/bruteforce/bruteforce_service.py`
unchanged. Update `bruteforce_routes.py` import and
`tests/test_bruteforce_service.py` import path. Delete now-empty
`src/services/` and `src/models/`.

**Test:** `tests/test_bruteforce_service.py` passes. POST `/api/bruteforce`
with a small city set; confirm the NDJSON stream still yields
`total → progress → best → done` correctly.

## M4 — HTTP layer → src/api/

Move `page_routes.py`, `ga_routes.py`, `bruteforce_routes.py` from
`src/routes/` to `src/api/`. Update `main.py`'s blueprint imports. Delete
now-empty `src/routes/`.

**Test:** full `python -m unittest discover tests` green. Start the app,
click through all three tabs (Cities, Brute Force, GA) — no import errors,
no broken requests.

## M5 — Frontend consolidation → src/frontend/

Move `src/static/{css,js,assets}` and `src/templates/index.html` into
`src/frontend/static/...` and `src/frontend/templates/index.html` unchanged.
Update `main.py`'s `Flask(static_folder=..., template_folder=...)` args.
Delete now-empty `src/static/` and `src/templates/`.

**Test:** start the app, load the page, confirm CSS renders and devtools
shows zero 404s for JS/CSS. Run through Cities/Brute-Force/GA flows again.

## M6 — Documentation sync

Update `CLAUDE.md`'s canonical structure tree and separation-of-concerns
table. Update `README.md`'s file-structure section. Confirm `docs/design.md`
matches the final tree exactly.

**Test:** repo-wide grep for stale `src/routes|src/services|src/models|src/utils`
references (excluding legitimate `solvers/common` etc.) returns nothing
stray. Full test suite green. Final manual click-through.

## Verification (end to end)

- After each milestone: run the relevant `unittest` file(s) plus a manual
  smoke test of the affected HTTP flow.
- After M4 and M5: full browser click-through of Cities setup, Brute Force
  solve, and GA step-through (init → evaluate → select → crossover → mutate
  → repeat), watching devtools console/network for errors.
- After M6: repo-wide grep for stale old-path references; full
  `python -m unittest discover tests`.
- Progress is reported after each milestone; if any test fails, the
  milestone is fixed before moving to the next rather than proceeding with a
  known-broken intermediate state.
