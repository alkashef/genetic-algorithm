"""
src/solvers/ga/ga_pipeline.py

The genetic algorithm's engine: every operator-level implementation
(elite-finding, tournament/roulette selection, Order Crossover, swap
mutation). src/solvers/ga/ga_service.py calls into this module for the
actual algorithmic work; this module has no HTTP or request-shape concerns
of its own.
"""

import random

from src.config import ROULETTE_EPSILON
from src.solvers.common.tsp_math import build_distance_matrix

_distance_matrix = None


def initialize(cities: list) -> None:
    """
    Build the distance matrix for a given city set. Must be called once
    before any GA operations on that city set.

    Args:
        cities (list): City dicts used to build the distance matrix.
    """
    global _distance_matrix
    _distance_matrix = build_distance_matrix(cities)


def is_initialized() -> bool:
    """
    Report whether initialize() has been called at least once.

    Returns:
        bool: True once a distance matrix has been built.
    """
    return _distance_matrix is not None


def get_distance_matrix() -> list:
    """
    Return the distance matrix built by the most recent initialize() call.

    Returns:
        list: n×n distance matrix.
    """
    return _distance_matrix


def find_elite_indices(distances: list, count: int) -> list:
    """
    Locate the individuals with the shortest tours.

    Args:
        distances (list): Tour distance per individual.
        count (int): Number of top individuals to return; 0 yields none.

    Returns:
        list: Indices of the `count` smallest distances, best first.
    """
    if count <= 0:
        return []
    return sorted(range(len(distances)), key=lambda i: distances[i])[:count]


def select_with_tournament(
    population: list, distances: list, count: int, tournament_size: int
) -> list:
    """
    Select parent pairs using tournament selection.

    Args:
        population (list): Current population.
        distances (list): Fitness (tour distances) per individual.
        count (int): Number of parent pairs to select.
        tournament_size (int): Tournament size.

    Returns:
        list: List of [parent_idx, parent_idx] pairs (count items).
    """
    individuals_with_fitness = [
        (list(population[i]), distances[i]) for i in range(len(population))
    ]

    pairs = []
    for _ in range(count):
        selected = _tournament_select(individuals_with_fitness, tournament_size, 2)
        pair = [population.index(list(s[0])) for s in selected]
        pairs.append(pair)

    return pairs


def select_with_roulette(population: list, distances: list, count: int) -> list:
    """
    Select parent pairs using fitness-proportionate (roulette) selection.

    Args:
        population (list): Current population.
        distances (list): Fitness (tour distances) per individual.
        count (int): Number of parent pairs to select.

    Returns:
        list: List of [parent_idx, parent_idx] pairs (count items).
    """
    pairs = []
    for _ in range(count):
        idx_a = _roulette_select_idx(distances)
        idx_b = _roulette_select_idx(distances)
        pairs.append([idx_a, idx_b])

    return pairs


def _tournament_select(individuals: list, tournament_size: int, k: int) -> list:
    """
    Select k best individuals from k random samples (tournament selection).

    Args:
        individuals (list): List of (tour, distance) tuples.
        tournament_size (int): Size of each tournament.
        k (int): Number of individuals to select.

    Returns:
        list: List of k selected (tour, distance) tuples.
    """
    selected = []
    for _ in range(k):
        tournament = [individuals[random.randrange(len(individuals))] for _ in range(tournament_size)]
        winner = min(tournament, key=lambda x: x[1])
        selected.append(winner)
    return selected


def _roulette_select_idx(distances: list) -> int:
    """
    Sample a population index via fitness-proportionate (roulette) selection.

    Args:
        distances (list): Tour distance per individual (fitness in minimization).

    Returns:
        int: The sampled population index.
    """
    total_fitness = sum(1.0 / (d + ROULETTE_EPSILON) for d in distances)
    spin = random.random() * total_fitness
    cumulative = 0.0
    for i, d in enumerate(distances):
        cumulative += 1.0 / (d + ROULETTE_EPSILON)
        if spin <= cumulative:
            return i
    return len(distances) - 1


def breed(parent_a: list, parent_b: list) -> tuple:
    """
    Apply order crossover and return the child with a segment trace.

    Args:
        parent_a (list): First parent tour.
        parent_b (list): Second parent tour.

    Returns:
        tuple: (child, segment) where segment is {"start", "end"}.
    """
    child, start, end = _order_crossover(parent_a, parent_b)
    return child, {"start": start, "end": end}


def _order_crossover(parent_a: list, parent_b: list) -> tuple:
    """
    Order Crossover (OX): copy a random segment of parent_a, then fill
    remaining positions with parent_b's genes in relative order.
    Returns segment bounds for visualization.

    Args:
        parent_a (list): Segment donor.
        parent_b (list): Order donor.

    Returns:
        tuple: (child, start, end) — the child and copied segment bounds.
    """
    n = len(parent_a)
    i, j = sorted((random.randrange(n), random.randrange(n)))

    child = [None] * n
    used = set(parent_a[i : j + 1])
    child[i : j + 1] = parent_a[i : j + 1]

    pos = (j + 1) % n
    for k in range(n):
        gene = parent_b[(j + 1 + k) % n]
        if gene not in used:
            child[pos] = gene
            used.add(gene)
            pos = (pos + 1) % n

    return child, i, j


def mutate(route: list) -> tuple:
    """
    Swap two random positions in a tour (swap mutation).

    Args:
        route (list): The tour to mutate.

    Returns:
        tuple: (mutated, a, b) — the mutated tour and swapped indices.
    """
    a = random.randrange(len(route))
    b = random.randrange(len(route))
    mutated = list(route)
    mutated[a], mutated[b] = mutated[b], mutated[a]
    return mutated, a, b
