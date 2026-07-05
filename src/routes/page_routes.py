"""
src/routes/page_routes.py

Serves the application's single HTML page.
Does NOT expose solver endpoints — see ga_routes.py and bruteforce_routes.py.
"""

from flask import Blueprint, render_template

from src.config import DEFAULT_STEP_DELAY_SECONDS, GENOME_RENDER_CAP, MIN_CITIES

page_bp = Blueprint("pages", __name__)


@page_bp.get("/")
def index():
    """
    Render the single-page application shell, passing the UI configuration
    values the frontend reads from the body's data attributes and the
    step-delay inputs' initial value.

    Returns:
        str: The rendered index.html template.
    """
    return render_template(
        "index.html",
        genome_render_cap=GENOME_RENDER_CAP,
        min_cities=MIN_CITIES,
        default_step_delay=DEFAULT_STEP_DELAY_SECONDS,
    )
