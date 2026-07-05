"""
tests/test_tsp_math.py

Unit tests for the pure TSP geometry helpers in src/utils/tsp_math.py.
"""

import unittest

from src.utils.tsp_math import build_distance_matrix, distance, route_distance, tour_distance


class TestDistance(unittest.TestCase):
    """Tests for the pairwise distance function."""

    def test_known_distance(self):
        """A 3-4-5 triangle has hypotenuse 5 (scaled to 0.3/0.4/0.5)."""
        a = {"x": 0.0, "y": 0.0}
        b = {"x": 0.3, "y": 0.4}
        self.assertAlmostEqual(distance(a, b), 0.5)

    def test_zero_distance_to_self(self):
        """A city is at distance zero from itself."""
        a = {"x": 0.7, "y": 0.2}
        self.assertEqual(distance(a, a), 0.0)


class TestBuildDistanceMatrix(unittest.TestCase):
    """Tests for the pairwise distance matrix builder."""

    def setUp(self):
        """Three cities forming a right triangle."""
        self.cities = [
            {"x": 0.0, "y": 0.0},
            {"x": 0.3, "y": 0.0},
            {"x": 0.0, "y": 0.4},
        ]
        self.matrix = build_distance_matrix(self.cities)

    def test_symmetric(self):
        """matrix[i][j] equals matrix[j][i] for every pair."""
        n = len(self.cities)
        for i in range(n):
            for j in range(n):
                self.assertAlmostEqual(self.matrix[i][j], self.matrix[j][i])

    def test_zero_diagonal(self):
        """Every city is at distance zero from itself."""
        for i in range(len(self.cities)):
            self.assertEqual(self.matrix[i][i], 0.0)

    def test_known_values(self):
        """Legs are 0.3 and 0.4; hypotenuse is 0.5."""
        self.assertAlmostEqual(self.matrix[0][1], 0.3)
        self.assertAlmostEqual(self.matrix[0][2], 0.4)
        self.assertAlmostEqual(self.matrix[1][2], 0.5)


class TestRouteAndTourDistance(unittest.TestCase):
    """Tests for path and closed-tour distance."""

    def setUp(self):
        """Right triangle with perimeter 1.2."""
        self.matrix = build_distance_matrix([
            {"x": 0.0, "y": 0.0},
            {"x": 0.3, "y": 0.0},
            {"x": 0.0, "y": 0.4},
        ])

    def test_route_distance_explicit_return(self):
        """A route that repeats the start sums every listed leg."""
        self.assertAlmostEqual(route_distance([0, 1, 2, 0], self.matrix), 1.2)

    def test_tour_distance_implicit_return(self):
        """A permutation tour adds the closing leg automatically."""
        self.assertAlmostEqual(tour_distance([0, 1, 2], self.matrix), 1.2)

    def test_route_and_tour_agree(self):
        """route_distance of the closed route equals tour_distance."""
        self.assertAlmostEqual(
            route_distance([1, 2, 0, 1], self.matrix),
            tour_distance([1, 2, 0], self.matrix),
        )


if __name__ == "__main__":
    unittest.main()
