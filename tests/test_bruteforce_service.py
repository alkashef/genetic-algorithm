"""
tests/test_bruteforce_service.py

Unit tests for the brute-force solver in
src/solvers/bruteforce/bruteforce_service.py. Verifies the route count, the
event protocol, and — against an independent itertools enumeration — that
the reported best route is the true optimum.
"""

import itertools
import random
import unittest

from src.solvers.bruteforce import bruteforce_service
from src.solvers.common.tsp_math import build_distance_matrix, route_distance, tour_distance


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


class TestCountRoutes(unittest.TestCase):
    """Tests for the distinct-route count."""

    def test_small_counts(self):
        """(n-1)!/2 for n > 2; degenerate cases return 1."""
        self.assertEqual(bruteforce_service.count_routes(1), 1)
        self.assertEqual(bruteforce_service.count_routes(2), 1)
        self.assertEqual(bruteforce_service.count_routes(3), 1)
        self.assertEqual(bruteforce_service.count_routes(5), 12)
        self.assertEqual(bruteforce_service.count_routes(7), 360)


class TestSolve(unittest.TestCase):
    """Tests for the full enumeration."""

    def setUp(self):
        """Solve 7 cities with no pacing delay and collect all events."""
        self.cities = _make_cities(7)
        self.matrix = build_distance_matrix(self.cities)
        self.events = list(bruteforce_service.solve(self.cities, step_delay=0))

    def test_event_protocol(self):
        """The stream starts with a total and ends with a done event."""
        self.assertEqual(self.events[0]["type"], "total")
        self.assertEqual(self.events[-1]["type"], "done")

    def test_explores_every_distinct_route(self):
        """The done count matches (n-1)!/2."""
        done = self.events[-1]
        self.assertEqual(done["count"], bruteforce_service.count_routes(len(self.cities)))

    def test_finds_true_optimum(self):
        """The best route matches an independent exhaustive search."""
        done = self.events[-1]
        indices = list(range(len(self.cities)))
        expected = min(
            tour_distance([0] + list(p), self.matrix)
            for p in itertools.permutations(indices[1:])
        )
        self.assertAlmostEqual(route_distance(done["route"], self.matrix), expected)

    def test_route_closes_at_fixed_start(self):
        """The winning route starts and ends at city 0."""
        done = self.events[-1]
        self.assertEqual(done["route"][0], 0)
        self.assertEqual(done["route"][-1], 0)

    def test_best_distances_decrease(self):
        """Each streamed best event improves on the previous one."""
        bests = [e["dist"] for e in self.events if e["type"] == "best"]
        for earlier, later in zip(bests, bests[1:]):
            self.assertLess(later, earlier)


if __name__ == "__main__":
    unittest.main()
