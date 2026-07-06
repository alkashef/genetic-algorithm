"""
tests/test_ga_service.py

Unit tests for the genetic-algorithm stages in src/solvers/ga/ga_service.py.
Each stage is verified to preserve valid tours (permutations) and to honor
its parameters (elitism, selection strategy, rates). The operator engine
these stages delegate to (src/solvers/ga/ga_pipeline.py) is exercised
indirectly through this same public stage API.
"""

import random
import unittest

from src.solvers.ga import ga_service
from src.solvers.ga.ga_params import SelectionParams


def _make_cities(n, seed=1):
    """
    Build n deterministic random cities in normalized space.

    Args:
        n (int): Number of cities.
        seed (int): RNG seed for reproducibility.

    Returns:
        list: City dicts.
    """
    rng = random.Random(seed)
    return [{"x": rng.random(), "y": rng.random()} for _ in range(n)]


class TestInitPopulation(unittest.TestCase):
    """Tests for initial population creation."""

    def test_size_and_validity(self):
        """Every individual is a permutation of all city indices."""
        population = ga_service.init_population(10, 7)
        self.assertEqual(len(population), 10)
        for individual in population:
            self.assertEqual(sorted(individual), list(range(7)))


class TestEvaluatePopulation(unittest.TestCase):
    """Tests for fitness evaluation."""

    def test_distances_positive_and_aligned(self):
        """One positive distance is produced per individual."""
        cities = _make_cities(6)
        population = ga_service.init_population(8, len(cities))
        distances = ga_service.evaluate_population(population, cities)
        self.assertEqual(len(distances), len(population))
        for dist in distances:
            self.assertGreater(dist, 0.0)

    def test_identical_tours_get_identical_distances(self):
        """Rotations aside, the same permutation scores the same."""
        cities = _make_cities(5)
        tour = list(range(5))
        distances = ga_service.evaluate_population([tour, list(tour)], cities)
        self.assertAlmostEqual(distances[0], distances[1])


class TestSelectParents(unittest.TestCase):
    """Tests for the selection stage."""

    def setUp(self):
        """A small population with known distances."""
        self.population = ga_service.init_population(10, 6)
        self.distances = [5.0, 3.0, 8.0, 1.0, 9.0, 2.0, 7.0, 4.0, 6.0, 10.0]

    def test_tournament_with_elitism(self):
        """Elitism reserves one slot and returns the best individual."""
        params = SelectionParams(selection="tournament", tournament_size=3, elite_count=1)
        pairs, elite_indices = ga_service.select_parents(self.population, self.distances, params)
        self.assertEqual(elite_indices, [3])  # index of min distance 1.0
        self.assertEqual(len(pairs), len(self.population) - 1)

    def test_tournament_with_multiple_elites(self):
        """Elite count > 1 reserves that many slots, best distances first."""
        params = SelectionParams(selection="tournament", tournament_size=3, elite_count=3)
        pairs, elite_indices = ga_service.select_parents(self.population, self.distances, params)
        self.assertEqual(elite_indices, [3, 5, 1])  # distances 1.0, 2.0, 3.0
        self.assertEqual(len(pairs), len(self.population) - 3)

    def test_tournament_without_elitism(self):
        """With elite_count 0 there are no elites and a full set of pairs."""
        params = SelectionParams(selection="tournament", tournament_size=3, elite_count=0)
        pairs, elite_indices = ga_service.select_parents(self.population, self.distances, params)
        self.assertEqual(elite_indices, [])
        self.assertEqual(len(pairs), len(self.population))

    def test_roulette_indices_in_range(self):
        """Roulette selection only produces valid population indices."""
        params = SelectionParams(selection="roulette", tournament_size=3, elite_count=0)
        pairs, _ = ga_service.select_parents(self.population, self.distances, params)
        for a, b in pairs:
            self.assertIn(a, range(len(self.population)))
            self.assertIn(b, range(len(self.population)))


class TestCrossoverStage(unittest.TestCase):
    """Tests for the crossover stage."""

    def setUp(self):
        """A population plus an all-breed selection."""
        self.population = ga_service.init_population(10, 8)
        self.pairs = [[i, (i + 1) % 10] for i in range(9)]

    def test_children_are_valid_permutations(self):
        """Order crossover must never duplicate or drop a gene."""
        children, _ = ga_service.crossover_stage(self.population, self.pairs, [0], 1.0)
        for child in children:
            self.assertEqual(sorted(child), list(range(8)))

    def test_elite_copied_first_with_trace(self):
        """The elite is child zero and its trace row is marked elite."""
        children, trace = ga_service.crossover_stage(self.population, self.pairs, [4], 0.5)
        self.assertEqual(children[0], self.population[4])
        self.assertTrue(trace[0]["elite"])
        self.assertIsNone(trace[0]["crossover"])

    def test_multiple_elites_copied_first_in_order(self):
        """Every elite index is copied first, in the given order, before any bred child."""
        children, trace = ga_service.crossover_stage(self.population, self.pairs, [4, 2], 0.5)
        self.assertEqual(children[0], self.population[4])
        self.assertEqual(children[1], self.population[2])
        self.assertTrue(trace[0]["elite"])
        self.assertTrue(trace[1]["elite"])
        self.assertFalse(trace[2]["elite"])

    def test_zero_rate_copies_parent_a(self):
        """With crossover rate 0 every child is a copy of parent A."""
        children, trace = ga_service.crossover_stage(self.population, self.pairs, [], 0.0)
        for k, (ai, _) in enumerate(self.pairs):
            self.assertEqual(children[k], self.population[ai])
            self.assertIsNone(trace[k]["crossover"])


class TestMutateStage(unittest.TestCase):
    """Tests for the mutation stage."""

    def setUp(self):
        """Children and trace produced by a crossover with an elite."""
        self.population = ga_service.init_population(10, 8)
        pairs = [[i, (i + 1) % 10] for i in range(9)]
        self.children, self.trace = ga_service.crossover_stage(self.population, pairs, [0], 1.0)

    def test_elite_never_mutated(self):
        """Even at mutation rate 1 the elite child is untouched."""
        elite_before = list(self.children[0])
        children, trace = ga_service.mutate_stage(self.children, self.trace, 1.0)
        self.assertEqual(children[0], elite_before)
        self.assertIsNone(trace[0]["mutation"])

    def test_mutants_remain_valid_permutations(self):
        """Swap mutation must never duplicate or drop a gene."""
        children, _ = ga_service.mutate_stage(self.children, self.trace, 1.0)
        for child in children:
            self.assertEqual(sorted(child), list(range(8)))

    def test_zero_rate_changes_nothing(self):
        """With mutation rate 0 all children pass through unchanged."""
        before = [list(c) for c in self.children]
        children, trace = ga_service.mutate_stage(self.children, self.trace, 0.0)
        self.assertEqual(children, before)
        for row in trace:
            self.assertIsNone(row["mutation"])


if __name__ == "__main__":
    unittest.main()
