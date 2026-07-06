"""
src/models/ga_params.py

Data model for genetic-algorithm selection parameters.
Defines the structure only — validation/clamping of raw user input is the
frontend's concern, and business logic lives in src/services/ga_service.py.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class SelectionParams:
    """
    Parameters that control the GA parent-selection stage.

    Attributes:
        selection (str): Selection strategy, "tournament" or "roulette".
        tournament_size (int): Candidates drawn per tournament round.
        elite_count (int): Number of top individuals that survive unchanged
            into the next generation; 0 disables elitism.
    """

    selection: str
    tournament_size: int
    elite_count: int

    @classmethod
    def from_dict(cls, data: dict) -> "SelectionParams":
        """
        Build a SelectionParams from a request-payload dict.

        Args:
            data (dict): Keys "selection", "tournamentSize", "eliteCount"
                (missing keys fall back to tournament selection defaults).

        Returns:
            SelectionParams: The typed, immutable parameter object.
        """
        return cls(
            selection=data.get("selection", "tournament"),
            tournament_size=int(data.get("tournamentSize", 3)),
            elite_count=int(data.get("eliteCount", 0)),
        )
