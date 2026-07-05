"""
tests/test_ga_params.py

Unit tests for the SelectionParams data model in src/models/ga_params.py.
"""

import unittest

from src.models.ga_params import SelectionParams


class TestSelectionParamsFromDict(unittest.TestCase):
    """Tests for building SelectionParams from request payloads."""

    def test_full_payload(self):
        """All keys present map onto the typed fields."""
        params = SelectionParams.from_dict(
            {"selection": "roulette", "tournamentSize": 7, "elitism": True}
        )
        self.assertEqual(params.selection, "roulette")
        self.assertEqual(params.tournament_size, 7)
        self.assertTrue(params.elitism)

    def test_defaults_for_missing_keys(self):
        """Missing keys fall back to tournament selection defaults."""
        params = SelectionParams.from_dict({})
        self.assertEqual(params.selection, "tournament")
        self.assertEqual(params.tournament_size, 3)
        self.assertFalse(params.elitism)

    def test_immutable(self):
        """The dataclass is frozen — fields cannot be reassigned."""
        params = SelectionParams.from_dict({})
        with self.assertRaises(AttributeError):
            params.selection = "roulette"


if __name__ == "__main__":
    unittest.main()
