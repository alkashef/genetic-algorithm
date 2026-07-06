"""
src/solvers/bruteforce/bruteforce_service.py

Brute-force TSP solver: enumerates every distinct route via Heap's algorithm.
The start city is fixed and mirror-image routes are skipped, so the number of
routes explored is (n-1)!/2. Runs as a generator yielding event dicts so the
route layer can stream progress to the browser; iteration stops cleanly (via
GeneratorExit) when the client disconnects.
Does NOT handle HTTP — see src/api/bruteforce_routes.py.
"""

import math
import time

from src.config import BF_PROGRESS_INTERVAL_SECONDS
from src.solvers.common.tsp_math import build_distance_matrix, route_distance


def count_routes(n: int) -> int:
    """
    Number of distinct routes for n cities (fixed start, mirrors skipped).

    Args:
        n (int): City count.

    Returns:
        int: (n-1)!/2 for n > 2, else 1.
    """
    if n <= 2:
        return 1
    return math.factorial(n - 1) // 2


def solve(cities: list, step_delay: float):
    """
    Explore every distinct route, yielding solver events as they happen.

    Args:
        cities (list): City dicts; the distance matrix is built internally.
        step_delay (float): Seconds to pause between visualized progress frames.

    Yields:
        dict: Events of shape {"type": "total" | "progress" | "best" | "done", ...}.
    """
    matrix = build_distance_matrix(cities)
    indices = list(range(len(cities)))
    yield {"type": "total", "total": count_routes(len(indices))}
    if len(indices) < 2:
        yield from _trivial_result(indices, matrix)
        return
    yield from _enumerate_routes(indices, matrix, step_delay)


def _trivial_result(indices: list, matrix: list):
    """
    Emit best/done events for the degenerate single-city case.

    Args:
        indices (list): City indices (length 1).
        matrix (list): Distance matrix.

    Yields:
        dict: A "best" then a "done" event for the only possible route.
    """
    route = [indices[0], indices[0]]
    dist = route_distance(route, matrix)
    yield {"type": "best", "route": route, "dist": dist, "count": 1}
    yield {"type": "done", "route": route, "dist": dist, "count": 1}


def _enumerate_routes(indices: list, matrix: list, step_delay: float):
    """
    Enumerate all non-mirrored routes with a fixed start city.

    Args:
        indices (list): All city indices; indices[0] is the fixed start.
        matrix (list): Distance matrix.
        step_delay (float): Pause between visualized progress frames.

    Yields:
        dict: "best", throttled "progress", and a final "done" event.
    """
    start, rest = indices[0], indices[1:]
    count, best_route, best_dist = 0, None, float("inf")
    last_update = time.monotonic()
    for perm in _heap_permutations(rest):
        if len(perm) > 1 and perm[0] > perm[-1]:
            continue  # mirror-image duplicate of an already-counted route
        count += 1
        route = [start] + perm + [start]
        dist = route_distance(route, matrix)
        if dist < best_dist:
            best_route, best_dist = list(route), dist
            yield {"type": "best", "route": best_route, "dist": best_dist, "count": count}
        now = time.monotonic()
        if count == 1 or now - last_update > BF_PROGRESS_INTERVAL_SECONDS:
            yield {"type": "progress", "route": list(route), "dist": dist, "count": count}
            last_update = now
            if step_delay > 0:
                time.sleep(step_delay)
    yield {"type": "done", "route": best_route, "dist": best_dist, "count": count}


def _heap_permutations(arr: list):
    """
    Yield permutations of arr in place via Heap's algorithm.

    Args:
        arr (list): The list to permute; mutated during iteration.

    Yields:
        list: The same list object in a new permutation — copy to keep it.
    """
    n = len(arr)
    c = [0] * n
    yield arr
    i = 0
    while i < n:
        if c[i] < i:
            swap_index = 0 if i % 2 == 0 else c[i]
            arr[swap_index], arr[i] = arr[i], arr[swap_index]
            yield arr
            c[i] += 1
            i = 0
        else:
            c[i] = 0
            i += 1
