"""
src/api/bruteforce_routes.py

HTTP endpoint for the brute-force solver. Streams solver events to the
browser as newline-delimited JSON; serialization is the only work done here —
the enumeration itself lives in src/solvers/bruteforce/bruteforce_service.py.
"""

import json

from flask import Blueprint, Response, request

from src.config import DEFAULT_STEP_DELAY_SECONDS
from src.solvers.bruteforce import bruteforce_service

bruteforce_bp = Blueprint("bruteforce", __name__, url_prefix="/api/bruteforce")


@bruteforce_bp.post("")
def solve():
    """
    Stream brute-force solver events for the posted cities.

    Returns:
        Response: application/x-ndjson stream of solver events. Closing the
            connection client-side cancels the enumeration.
    """
    data = request.get_json()
    cities = data["cities"]
    step_delay = float(data.get("stepDelay", DEFAULT_STEP_DELAY_SECONDS))
    if not cities:
        return Response("cities must not be empty", status=400)
    events = bruteforce_service.solve(cities, step_delay)
    ndjson = (json.dumps(event) + "\n" for event in events)
    return Response(ndjson, mimetype="application/x-ndjson")
