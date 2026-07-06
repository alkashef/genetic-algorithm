"""
src/api/ga_routes.py

HTTP endpoints for the genetic algorithm — one endpoint per evolution stage.
Request parsing and response shaping only; all algorithm logic is delegated
to src/solvers/ga/ga_service.py.
"""

from flask import Blueprint, jsonify, request

from src.solvers.ga import ga_service
from src.solvers.ga.ga_params import SelectionParams

ga_bp = Blueprint("ga", __name__, url_prefix="/api/ga")


@ga_bp.post("/init")
def init():
    """
    Create the initial random population.

    Returns:
        Response: JSON {"population": [[int, ...], ...]}.
    """
    data = request.get_json()
    population = ga_service.init_population(data["popSize"], data["numCities"])
    return jsonify({"population": population})


@ga_bp.post("/evaluate")
def evaluate():
    """
    Compute each individual's closed-tour distance.

    Returns:
        Response: JSON {"distances": [float, ...]}.
    """
    data = request.get_json()
    distances = ga_service.evaluate_population(data["population"], data["cities"])
    return jsonify({"distances": distances})


@ga_bp.post("/select")
def select():
    """
    Pick parent pairs (and elites, if enabled) for breeding.

    Returns:
        Response: JSON {"pairs": [[int, int], ...], "eliteIndices": [int, ...]}.
    """
    data = request.get_json()
    params = SelectionParams.from_dict(data["params"])
    pairs, elite_indices = ga_service.select_parents(data["population"], data["distances"], params)
    return jsonify({"pairs": pairs, "eliteIndices": elite_indices})


@ga_bp.post("/crossover")
def crossover():
    """
    Breed the selected parent pairs with order crossover.

    Returns:
        Response: JSON {"children": [...], "trace": [...]}.
    """
    data = request.get_json()
    children, trace = ga_service.crossover_stage(
        data["population"], data["pairs"], data["eliteIndices"], data["crossoverRate"]
    )
    return jsonify({"children": children, "trace": trace})


@ga_bp.post("/mutate")
def mutate():
    """
    Swap-mutate the children produced by the crossover stage.

    Returns:
        Response: JSON {"children": [...], "trace": [...]}.
    """
    data = request.get_json()
    children, trace = ga_service.mutate_stage(
        data["children"], data["trace"], data["mutationRate"]
    )
    return jsonify({"children": children, "trace": trace})
