# Architecture Design: Domain-First Refactor

## Why

The codebase currently organizes `src/` by technical layer (`routes/`, `services/`,
`models/`, `utils/`, `static/`, `templates/`). This refactor reorganizes it by
domain instead: frontend assets grouped together, HTTP wiring grouped together,
and each solver (brute-force, GA) as a self-contained package. This scales
better as more solvers are added later (e.g. a timetable-scheduling GA is
already sketched conceptually in `docs/ga_learning_guide.html`), and makes
each solver's blast radius obvious — touching GA internals can't accidentally
break brute-force.

## Target Tree

```text
config/
docs/
  design.md
  plan.md
  ga_learning_guide.html
src/
  __init__.py
  config.py                    # unchanged — sole env-var reader
  api/                         # was src/routes/
    __init__.py
    page_routes.py
    ga_routes.py
    bruteforce_routes.py
  solvers/
    __init__.py
    common/
      __init__.py
      tsp_math.py               # moved from src/utils/, unchanged content
    ga/
      __init__.py
      ga_params.py              # moved from src/models/ga_params.py
      ga_service.py             # public stage API: init_population,
                                 #   evaluate_population, select_parents,
                                 #   crossover_stage, mutate_stage
      ga_pipeline.py            # DEAP engine: init_toolbox, creator/toolbox
                                 #   setup, _find_elite_indices,
                                 #   _tournament_select, _roulette_select_idx,
                                 #   _order_crossover_deap, _swap_mutate_deap,
                                 #   and the _select_with_*/_breed_with_deap/
                                 #   _mutate_with_deap loop wrappers
    bruteforce/
      __init__.py
      bruteforce_service.py     # moved from src/services/, unchanged
  frontend/                     # was src/static/ + src/templates/
    static/
      assets/
      css/                      # unchanged: base, tabs, controls,
                                 #   solver-view, genome-list, grid-info
      js/                       # unchanged: api, cityState, canvasUtils,
                                 #   format, events, uiConfig, tabs,
                                 #   fitnessChart, citySetupView,
                                 #   bruteForceView, gaView, main
    templates/
      index.html
tests/                          # stays flat, one file per source module
  __init__.py
  test_tsp_math.py
  test_ga_params.py
  test_ga_service.py
  test_ga_pipeline.py           # new — see plan.md M2
  test_bruteforce_service.py
main.py                         # wiring only — updated imports + folder paths
requirements.txt
```

## Key Decisions

- `api/` not `endpoints/` — shorter, common Flask convention.
- JS stays nested at `frontend/static/js` (not pulled out as a sibling) —
  keeps everything under Flask's single `static_folder` with no extra wiring.
- Solver source files keep their name prefix (`ga_service.py`, not
  `service.py`) to avoid ambiguous names once nested — also keeps the flat
  `tests/` directory collision-free.
- Shared TSP math (`tsp_math.py`) moves to `solvers/common/` since it's
  TSP-distance math only solvers need, not a generic cross-cutting utility.
- `data/` folder is removed — it was empty (only `.gitkeep`).

## Why the GA split is real code surgery, not a file move

Today's `ga_service.py` mixes thin per-stage orchestration (what routes call)
with DEAP toolbox setup and operator internals (tournament/roulette
selection, order crossover, swap mutation, elite-finding) in one file.
Splitting it: `ga_service.py` keeps the public, request-shaped stage
functions; `ga_pipeline.py` owns the toolbox/creator and every operator-level
function currently prefixed `_`. Brute-force needs no such split — it's
already one cohesive algorithm with a single entry point (`solve`).

## Documentation impact

`CLAUDE.md`'s "Project Structure (Canonical)" tree and "Separation of
Concerns" table will be updated to describe `api/` / `solvers/{common,ga,bruteforce}/`
/ `frontend/{static,templates}/` in place of the layer-first layout.
`README.md`'s file-structure section will be updated to match, and to drop
`data/`.
