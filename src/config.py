"""
src/config.py

Single source of configuration for the entire application.
This is the ONLY module allowed to read environment variables; every other
module imports the typed constants defined here. Values are loaded from
config/.env via python-dotenv, with safe defaults so a fresh clone (which has
no .env yet) still runs.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parent.parent / "config" / ".env"
load_dotenv(_ENV_PATH)

# --- Flask server ---
FLASK_HOST: str = os.environ.get("FLASK_HOST", "127.0.0.1")
FLASK_PORT: int = int(os.environ.get("FLASK_PORT", "8000"))
FLASK_DEBUG: bool = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

# --- Brute-force solver ---
# Minimum wall-clock seconds between streamed progress frames.
BF_PROGRESS_INTERVAL_SECONDS: float = float(
    os.environ.get("BF_PROGRESS_INTERVAL_SECONDS", "0.025")
)
# Pause between visualized steps when the client does not specify one.
# Also the initial value shown in the brute-force and GA step-delay inputs.
DEFAULT_STEP_DELAY_SECONDS: float = float(
    os.environ.get("DEFAULT_STEP_DELAY_SECONDS", "0.5")
)

# --- Genetic algorithm ---
# Guards against division by zero when converting distance to fitness weight.
ROULETTE_EPSILON: float = float(os.environ.get("ROULETTE_EPSILON", "1e-9"))

# --- Frontend (injected into the page template) ---
# Maximum genome rows rendered in the population list.
GENOME_RENDER_CAP: int = int(os.environ.get("GENOME_RENDER_CAP", "400"))
# Minimum cities required before the solvers can run.
MIN_CITIES: int = int(os.environ.get("MIN_CITIES", "3"))
