"""
main.py

Application entry point — wiring only, no logic.
Creates the Flask app, registers every blueprint, and starts the server
using the configuration constants from src/config.py.
"""

from flask import Flask

from src.api.bruteforce_routes import bruteforce_bp
from src.api.ga_routes import ga_bp
from src.api.page_routes import page_bp
from src.config import FLASK_DEBUG, FLASK_HOST, FLASK_PORT


def create_app() -> Flask:
    """
    Build the Flask application with all blueprints registered.

    Returns:
        Flask: The configured application instance.
    """
    app = Flask(
        __name__,
        static_folder="src/frontend/static",
        template_folder="src/frontend/templates",
    )
    app.register_blueprint(page_bp)
    app.register_blueprint(ga_bp)
    app.register_blueprint(bruteforce_bp)
    return app


if __name__ == "__main__":
    # threaded=True so a long-running brute-force stream never blocks the
    # GA endpoints (and vice versa).
    create_app().run(host=FLASK_HOST, port=FLASK_PORT, debug=FLASK_DEBUG, threaded=True)
