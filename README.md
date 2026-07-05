# TSP Genetic Algorithm Visualizer

## What it does

An interactive web application that solves the Traveling Salesman Problem (TSP)
two ways and visualizes both: exhaustive brute-force search finds the exact
optimum, while a classic genetic algorithm evolves toward it generation by
generation. You place or randomize cities on a canvas, watch every candidate
route as brute force enumerates them, then step the GA through each evolution
phase (fitness → selection → crossover → mutation) and compare its best tour —
and its fitness history — against the known optimum.

## Stack

- **Backend**: Python 3 (developed on 3.14), Flask 3.1.3, python-dotenv 1.2.2, DEAP 1.4.1
- **Frontend**: semantic HTML (Jinja2 template), modular CSS, JavaScript ES6+ modules
- **Template engine**: Jinja2 (Flask default)
- **Evolutionary computing**: DEAP (Distributed Evolutionary Algorithms in Python)
- **Tests**: Python standard-library `unittest`
- No JavaScript dependencies and no build step

## File structure

```text
.
├── config/
│   ├── .env                       # Environment variables (local only, never committed)
│   └── .env.example               # Committed template with all keys, no values
├── data/                          # Data files (currently empty)
├── docs/                          # Project documentation (ga_learning_guide.html)
├── src/
│   ├── config.py                  # Sole reader of config/.env; exports typed constants
│   ├── routes/
│   │   ├── page_routes.py         # Serves the single page, injects UI config
│   │   ├── ga_routes.py           # /api/ga/* — one endpoint per evolution stage
│   │   └── bruteforce_routes.py   # /api/bruteforce — NDJSON event stream
│   ├── services/
│   │   ├── ga_service.py          # GA logic: OX crossover, swap mutation, selection
│   │   └── bruteforce_service.py  # Heap's-algorithm enumeration as an event generator
│   ├── models/
│   │   └── ga_params.py           # SelectionParams dataclass
│   ├── utils/
│   │   └── tsp_math.py            # Pure geometry: distance matrix, route/tour length
│   ├── static/
│   │   ├── css/                   # One stylesheet per component (base, tabs, controls, …)
│   │   ├── js/                    # One module per concern (api, views, chart, events, …)
│   │   └── assets/                # Images, fonts, icons (currently empty)
│   └── templates/
│       └── index.html             # Jinja2 single-page shell
├── tests/                         # Mirrors src/ (models, services, utils)
├── main.py                        # App entry point — wiring only
└── requirements.txt               # Pinned Python dependencies
```

## How to run

Requires Python 3 and pip. From the project root:

```bash
# 1. Install pinned dependencies
pip install -r requirements.txt

# 2. (Optional) Configure — defaults work out of the box
#    Copy config/.env.example to config/.env and fill in values to override
#    host, port, debug mode, or solver tuning knobs.

# 3. Start the server (serves both the API and the frontend)
python main.py

# 4. Open http://localhost:8000 in a modern browser
```

The app must be served by Flask — opening the template as a file will not work
(ES modules and backend calls both require HTTP).

## API

The frontend holds the population between steps and calls one endpoint per
evolution stage:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/ga/init` | Build the initial random population |
| `POST /api/ga/evaluate` | Compute each tour's distance (fitness) |
| `POST /api/ga/select` | Pick parent pairs (tournament / roulette) + elite |
| `POST /api/ga/crossover` | Order Crossover (OX) breeding, with per-genome trace |
| `POST /api/ga/mutate` | Swap mutation, with per-genome trace |
| `POST /api/bruteforce` | Stream every route + running best (NDJSON); client abort cancels |

## Technical details

**Genetic algorithm** — implemented with DEAP framework; permutation encoding;
tournament (configurable size) or roulette-wheel selection; Order Crossover (OX),
which preserves relative city order; swap mutation; optional elitism. Fitness is
the closed-tour distance (minimized). Evolution is split into discrete stages
(init, evaluate, select, crossover, mutate) so the frontend can step through
and visualize each one.

**Brute force** — enumerates permutations via Heap's algorithm with the first
city fixed and mirror-image routes skipped, exploring exactly **(n−1)!/2**
distinct routes. Progress streams to the browser as newline-delimited JSON;
stopping the run aborts the request and the server halts enumeration.

## Tests

```bash
python -m unittest discover -s tests -t . -v
```

Covers the geometry utilities, every GA stage (permutation validity, elitism,
selection strategies, rate edge cases), the SelectionParams model, and the
brute-force solver — including a check against an independent exhaustive
search that it finds the true optimum.

## Tips

- **3–12 cities**: run brute force for the global optimum, then compare the GA
- **13+ cities**: use the GA only (brute force grows factorially)
- Tuning: higher mutation for exploration, higher crossover to exploit good
  solutions, smaller tournaments (3–5) for diversity, elitism on to never lose
  the best tour
