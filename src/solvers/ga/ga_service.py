"""
src/solvers/ga/ga_service.py

Genetic-algorithm business logic for TSP: the public, request-shaped stage
API that src/api/ga_routes.py calls — one function per evolution stage
(init, evaluate, select, crossover, mutate). Permutation encoding, Order
Crossover (OX), swap mutation, tournament / roulette-wheel selection, and
elitism are all implemented in src/solvers/ga/ga_pipeline.py; this module
only orchestrates those calls and shapes plain JSON-serializable results,
including per-genome trace for highlighting crossover segments and mutations.
Does NOT handle HTTP — see src/api/ga_routes.py.
"""

import random

from src.solvers.common.tsp_math import tour_distance
from src.solvers.ga import ga_pipeline
from src.solvers.ga.ga_params import SelectionParams


def init_population(size: int, num_cities: int) -> list:
    """
    Create a population of random tours (plain list format for serialization).

    Args:
        size (int): Number of individuals.
        num_cities (int): Number of cities; genes are indices 0..num_cities-1.

    Returns:
        list: List of random permutations as plain lists.
    """
    city_indices = list(range(num_cities))
    return [random.sample(city_indices, num_cities) for _ in range(size)]


def evaluate_population(population: list, cities: list) -> list:
    """
    Compute the closed-tour distance (fitness) of every individual.

    Args:
        population (list): List of city-index permutations.
        cities (list): City dicts; used to initialize the pipeline if needed.

    Returns:
        list: Tour distance per individual, in population order.
    """
    if not ga_pipeline.is_initialized():
        ga_pipeline.initialize(cities)

    matrix = ga_pipeline.get_distance_matrix()
    return [tour_distance(order, matrix) for order in population]


def select_parents(population: list, distances: list, params: SelectionParams) -> tuple:
    """
    Choose parent-index pairs that breed the next generation.

    Args:
        population (list): Current population (used for its size).
        distances (list): Tour distance per individual.
        params (SelectionParams): Selection strategy configuration.

    Returns:
        tuple: (pairs, elite_indices) where pairs is a list of [a_idx, b_idx]
            and elite_indices is the list of surviving individuals' indices
            (empty when params.elite_count is 0).
    """
    elite_indices = ga_pipeline.find_elite_indices(distances, params.elite_count)
    pair_count = len(population) - len(elite_indices)

    if params.selection == "roulette":
        selected_pairs = ga_pipeline.select_with_roulette(population, distances, pair_count)
    else:
        selected_pairs = ga_pipeline.select_with_tournament(
            population, distances, pair_count, params.tournament_size
        )

    pairs = [[selected_pairs[i][0], selected_pairs[i][1]] for i in range(pair_count)]
    return pairs, elite_indices


def crossover_stage(population: list, pairs: list, elite_indices: list, crossover_rate: float) -> tuple:
    """
    Breed each parent pair with order crossover (subject to crossover_rate).

    Args:
        population (list): Current population.
        pairs (list): Parent index pairs from select_parents().
        elite_indices (list): Indices of the elite individuals, in survival order.
        crossover_rate (float): Probability in [0, 1] that a pair breeds.

    Returns:
        tuple: (children, trace) where trace[k] is
            {"elite": bool, "crossover": {"start", "end"} | None, "mutation": None}.
    """
    children, trace = [], []
    for idx in elite_indices or []:
        children.append(list(population[idx]))
        trace.append({"elite": True, "crossover": None, "mutation": None})

    for ai, bi in pairs:
        if random.random() < crossover_rate:
            parent_a = list(population[ai])
            parent_b = list(population[bi])
            child, segment = ga_pipeline.breed(parent_a, parent_b)
            children.append(child)
            trace.append({"elite": False, "crossover": segment, "mutation": None})
        else:
            children.append(list(population[ai]))
            trace.append({"elite": False, "crossover": None, "mutation": None})

    return children, trace


def mutate_stage(children: list, trace: list, mutation_rate: float) -> tuple:
    """
    Swap-mutate each child (subject to mutation_rate), skipping elite.

    Args:
        children (list): Children from crossover_stage(); mutated in place.
        trace (list): Per-child trace; mutation info is recorded in place.
        mutation_rate (float): Probability in [0, 1] that a child mutates.

    Returns:
        tuple: The updated (children, trace).
    """
    for k in range(len(children)):
        if trace[k]["elite"]:
            continue
        if random.random() < mutation_rate:
            mutated, a, b = ga_pipeline.mutate(children[k])
            children[k] = mutated
            trace[k]["mutation"] = {"a": a, "b": b}

    return children, trace
