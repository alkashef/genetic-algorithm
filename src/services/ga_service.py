"""
src/services/ga_service.py

Genetic-algorithm business logic for TSP: permutation encoding, order
crossover (OX), swap mutation, tournament / roulette-wheel selection, and
optional elitism. Evolution is split into discrete stages (init, evaluate,
select, crossover, mutate) so the frontend can step through and visualize
each one. Every stage returns plain JSON-serializable data, including the
per-genome trace used to highlight crossover segments and mutation swaps.
Does NOT handle HTTP — see src/routes/ga_routes.py.
"""

import bisect
import random

from src.config import ROULETTE_EPSILON
from src.models.ga_params import SelectionParams
from src.utils.tsp_math import build_distance_matrix, tour_distance


def init_population(size: int, num_cities: int) -> list:
    """
    Create a population of random tours.

    Args:
        size (int): Number of individuals.
        num_cities (int): Number of cities; genes are indices 0..num_cities-1.

    Returns:
        list: List of random permutations of the city indices.
    """
    city_indices = list(range(num_cities))
    return [random.sample(city_indices, num_cities) for _ in range(size)]


def evaluate_population(population: list, cities: list) -> list:
    """
    Compute the closed-tour distance (fitness) of every individual.

    Args:
        population (list): List of city-index permutations.
        cities (list): City dicts used to build the distance matrix.

    Returns:
        list: Tour distance per individual, in population order.
    """
    matrix = build_distance_matrix(cities)
    return [tour_distance(order, matrix) for order in population]


def select_parents(population: list, distances: list, params: SelectionParams) -> tuple:
    """
    Choose the parent-index pairs that breed the next generation.

    Args:
        population (list): Current population (used for its size).
        distances (list): Tour distance per individual.
        params (SelectionParams): Selection strategy configuration.

    Returns:
        tuple: (pairs, elite_idx) where pairs is a list of [a_idx, b_idx]
            and elite_idx is the surviving individual's index or None.
    """
    elite_idx = _find_elite_index(distances) if params.elitism else None
    pick_idx = _make_picker(distances, params)
    pair_count = len(population) - (1 if params.elitism else 0)
    pairs = [[pick_idx(), pick_idx()] for _ in range(pair_count)]
    return pairs, elite_idx


def crossover_stage(population: list, pairs: list, elite_idx, crossover_rate: float) -> tuple:
    """
    Breed each parent pair with order crossover (subject to crossover_rate).

    Args:
        population (list): Current population.
        pairs (list): Parent index pairs from select_parents().
        elite_idx (int | None): Index of the elite individual, or None.
        crossover_rate (float): Probability in [0, 1] that a pair breeds.

    Returns:
        tuple: (children, trace) where trace[k] is
            {"elite": bool, "crossover": {"start", "end"} | None, "mutation": None}.
    """
    children, trace = [], []
    if elite_idx is not None:
        children.append(list(population[elite_idx]))
        trace.append({"elite": True, "crossover": None, "mutation": None})
    for ai, bi in pairs:
        child, segment = _breed(population[ai], population[bi], crossover_rate)
        children.append(child)
        trace.append({"elite": False, "crossover": segment, "mutation": None})
    return children, trace


def mutate_stage(children: list, trace: list, mutation_rate: float) -> tuple:
    """
    Swap-mutate each child (subject to mutation_rate), skipping the elite.

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
            mutated, a, b = _swap_mutate(children[k])
            children[k] = mutated
            trace[k]["mutation"] = {"a": a, "b": b}
    return children, trace


def _find_elite_index(distances: list) -> int:
    """
    Locate the individual with the shortest tour.

    Args:
        distances (list): Tour distance per individual.

    Returns:
        int: Index of the minimum distance.
    """
    elite_idx = 0
    for i in range(1, len(distances)):
        if distances[i] < distances[elite_idx]:
            elite_idx = i
    return elite_idx


def _make_picker(distances: list, params: SelectionParams):
    """
    Build the parent-picking function for the configured strategy.

    Args:
        distances (list): Tour distance per individual.
        params (SelectionParams): Selection strategy configuration.

    Returns:
        callable: Zero-argument function returning a population index.
    """
    if params.selection == "roulette":
        cumulative, total = _build_roulette_weights(distances)
        return lambda: _roulette_select_idx(cumulative, total)
    return lambda: _tournament_select_idx(distances, params.tournament_size)


def _tournament_select_idx(distances: list, k: int) -> int:
    """
    Pick the best of k uniformly sampled individuals.

    Args:
        distances (list): Tour distance per individual.
        k (int): Tournament size.

    Returns:
        int: Index of the tournament winner.
    """
    best_idx = 0
    best_dist = float("inf")
    for _ in range(k):
        idx = random.randrange(len(distances))
        if distances[idx] < best_dist:
            best_dist = distances[idx]
            best_idx = idx
    return best_idx


def _build_roulette_weights(distances: list) -> tuple:
    """
    Build cumulative fitness-proportionate weights (inverse distance).

    Args:
        distances (list): Tour distance per individual.

    Returns:
        tuple: (cumulative, total) for binary-search sampling.
    """
    cumulative = []
    total = 0.0
    for d in distances:
        total += 1.0 / (d + ROULETTE_EPSILON)
        cumulative.append(total)
    return cumulative, total


def _roulette_select_idx(cumulative: list, total: float) -> int:
    """
    Sample an index proportionally to fitness via binary search.

    Args:
        cumulative (list): Cumulative weights from _build_roulette_weights().
        total (float): Sum of all weights.

    Returns:
        int: The sampled population index.
    """
    return bisect.bisect_left(cumulative, random.random() * total)


def _breed(parent_a: list, parent_b: list, crossover_rate: float) -> tuple:
    """
    Produce one child from two parents, crossing over with given probability.

    Args:
        parent_a (list): First parent tour (copied verbatim if no crossover).
        parent_b (list): Second parent tour.
        crossover_rate (float): Probability in [0, 1] of applying OX.

    Returns:
        tuple: (child, segment) where segment is {"start", "end"} or None.
    """
    if random.random() < crossover_rate:
        child, start, end = _order_crossover(parent_a, parent_b)
        return child, {"start": start, "end": end}
    return list(parent_a), None


def _order_crossover(parent_a: list, parent_b: list) -> tuple:
    """
    Order Crossover (OX): copy a random segment of parent_a, then fill the
    remaining positions with parent_b's genes in their relative order.

    Args:
        parent_a (list): Segment donor.
        parent_b (list): Order donor.

    Returns:
        tuple: (child, start, end) — the copied segment bounds are returned
            so the frontend can visualize them.
    """
    n = len(parent_a)
    i, j = sorted((random.randrange(n), random.randrange(n)))
    child = [None] * n
    used = set(parent_a[i:j + 1])
    child[i:j + 1] = parent_a[i:j + 1]
    pos = (j + 1) % n
    for k in range(n):
        gene = parent_b[(j + 1 + k) % n]
        if gene not in used:
            child[pos] = gene
            used.add(gene)
            pos = (pos + 1) % n
    return child, i, j


def _swap_mutate(route: list) -> tuple:
    """
    Swap two random positions in a tour.

    Args:
        route (list): The tour to mutate (not modified).

    Returns:
        tuple: (mutated, a, b) — the new tour and the two swapped indices.
    """
    a = random.randrange(len(route))
    b = random.randrange(len(route))
    mutated = list(route)
    mutated[a], mutated[b] = mutated[b], mutated[a]
    return mutated, a, b
