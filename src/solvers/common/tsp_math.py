"""
src/solvers/common/tsp_math.py

Pure geometry helpers for the Traveling Salesman Problem, shared by every
solver. Cities are dicts {"x": float, "y": float} in normalized [0, 1] space
so the same set renders at correct relative positions on any canvas size.
Does NOT contain solver logic — see src/solvers/ga/ and src/solvers/bruteforce/.
"""

import math


def distance(a: dict, b: dict) -> float:
    """
    Euclidean distance between two cities in normalized space.

    Args:
        a (dict): City with "x" and "y" floats.
        b (dict): City with "x" and "y" floats.

    Returns:
        float: The straight-line distance.
    """
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def build_distance_matrix(cities: list) -> list:
    """
    Build a symmetric n×n matrix of pairwise city distances.

    Args:
        cities (list): List of city dicts.

    Returns:
        list: n×n list-of-lists where matrix[i][j] is distance(city i, city j).
    """
    n = len(cities)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = distance(cities[i], cities[j])
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


def route_distance(route: list, matrix: list) -> float:
    """
    Total distance of an explicit path (start city repeated at the end).

    Args:
        route (list): City indices, e.g. [0, 2, 1, 0].
        matrix (list): Distance matrix from build_distance_matrix().

    Returns:
        float: Sum of consecutive leg distances.
    """
    total = 0.0
    for i in range(len(route) - 1):
        total += matrix[route[i]][route[i + 1]]
    return total


def tour_distance(order: list, matrix: list) -> float:
    """
    Closed-tour distance for a permutation that does not repeat the start.

    Args:
        order (list): Permutation of city indices, e.g. [0, 2, 1].
        matrix (list): Distance matrix from build_distance_matrix().

    Returns:
        float: Tour length including the final leg back to the start.
    """
    total = 0.0
    n = len(order)
    for i in range(n):
        total += matrix[order[i]][order[(i + 1) % n]]
    return total
