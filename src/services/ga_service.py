"""
src/services/ga_service.py

Genetic-algorithm business logic for TSP using DEAP framework: permutation
encoding, order crossover (OX), swap mutation, tournament / roulette-wheel
selection, and optional elitism. Evolution is split into discrete stages
(init, evaluate, select, crossover, mutate) so the frontend can step through
and visualize each one. DEAP's Toolbox is configured once per session and
reused across generations. Every stage returns plain JSON-serializable data,
including per-genome trace for highlighting crossover segments and mutations.
Does NOT handle HTTP — see src/routes/ga_routes.py.
"""

import random
from deap import base, creator, tools

from src.config import ROULETTE_EPSILON
from src.models.ga_params import SelectionParams
from src.utils.tsp_math import build_distance_matrix, tour_distance

_toolbox = None
_distance_matrix = None
_trace_data = {}


def init_toolbox(cities: list) -> None:
    """
    Initialize the DEAP Toolbox with TSP-specific operators and fitness.
    Must be called once before any GA operations on a given city set.

    Args:
        cities (list): City dicts used to build the distance matrix.
    """
    global _toolbox, _distance_matrix, _trace_data

    _distance_matrix = build_distance_matrix(cities)
    _trace_data = {}

    if _toolbox is not None:
        return

    _toolbox = base.Toolbox()

    if "FitnessMin" not in dir(creator):
        creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
    if "Individual" not in dir(creator):
        creator.create("Individual", list, fitness=creator.FitnessMin)

    def _evaluate_tour(individual: list) -> tuple:
        distance = tour_distance(list(individual), _distance_matrix)
        return (distance,)

    _toolbox.register("evaluate", _evaluate_tour)
    _toolbox.register("mate", _order_crossover_deap)
    _toolbox.register("mutate", _swap_mutate_deap)
    _toolbox.register(
        "select_tournament",
        tools.selTournament,
        tournsize=3,
    )
    _toolbox.register(
        "select_roulette",
        tools.selRoulette,
    )


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
        cities (list): City dicts; used to initialize toolbox if needed.

    Returns:
        list: Tour distance per individual, in population order.
    """
    if _toolbox is None:
        init_toolbox(cities)

    matrix = _distance_matrix
    return [tour_distance(order, matrix) for order in population]


def select_parents(population: list, distances: list, params: SelectionParams) -> tuple:
    """
    Choose parent-index pairs that breed the next generation using DEAP.

    Args:
        population (list): Current population (used for its size).
        distances (list): Tour distance per individual.
        params (SelectionParams): Selection strategy configuration.

    Returns:
        tuple: (pairs, elite_indices) where pairs is a list of [a_idx, b_idx]
            and elite_indices is the list of surviving individuals' indices
            (empty when params.elite_count is 0).
    """
    elite_indices = _find_elite_indices(distances, params.elite_count)
    pair_count = len(population) - len(elite_indices)

    if params.selection == "roulette":
        selected_pairs = _select_with_roulette(population, distances, pair_count)
    else:
        selected_pairs = _select_with_tournament(
            population, distances, pair_count, params.tournament_size
        )

    pairs = [[selected_pairs[i][0], selected_pairs[i][1]] for i in range(pair_count)]
    return pairs, elite_indices


def crossover_stage(population: list, pairs: list, elite_indices: list, crossover_rate: float) -> tuple:
    """
    Breed each parent pair with DEAP's order crossover (subject to crossover_rate).

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
            child, segment = _breed_with_deap(parent_a, parent_b)
            children.append(child)
            trace.append({"elite": False, "crossover": segment, "mutation": None})
        else:
            children.append(list(population[ai]))
            trace.append({"elite": False, "crossover": None, "mutation": None})

    return children, trace


def mutate_stage(children: list, trace: list, mutation_rate: float) -> tuple:
    """
    Swap-mutate each child using DEAP (subject to mutation_rate), skipping elite.

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
            mutated, a, b = _mutate_with_deap(children[k])
            children[k] = mutated
            trace[k]["mutation"] = {"a": a, "b": b}

    return children, trace


def _find_elite_indices(distances: list, count: int) -> list:
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


def _select_with_tournament(
    population: list, distances: list, count: int, tournament_size: int
) -> list:
    """
    Select parent pairs using tournament selection via DEAP.

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


def _select_with_roulette(population: list, distances: list, count: int) -> list:
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


def _breed_with_deap(parent_a: list, parent_b: list) -> tuple:
    """
    Apply DEAP's order crossover and return child with segment trace.

    Args:
        parent_a (list): First parent tour.
        parent_b (list): Second parent tour.

    Returns:
        tuple: (child, segment) where segment is {"start", "end"}.
    """
    child, start, end = _order_crossover_deap(parent_a, parent_b)
    return child, {"start": start, "end": end}


def _order_crossover_deap(parent_a: list, parent_b: list) -> tuple:
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


def _mutate_with_deap(route: list) -> tuple:
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


def _swap_mutate_deap(individual: list) -> tuple:
    """
    DEAP-compatible swap mutation wrapper (in-place mutation).

    Args:
        individual (list): The tour to mutate in place.

    Returns:
        tuple: (mutated,) for DEAP compatibility.
    """
    a = random.randrange(len(individual))
    b = random.randrange(len(individual))
    individual[a], individual[b] = individual[b], individual[a]
    return (individual,)
