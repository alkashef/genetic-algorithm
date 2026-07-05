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
        elitism (bool): Whether the best individual survives unchanged.
    """

    selection: str
    tournament_size: int
    elitism: bool

    @classmethod
    def from_dict(cls, data: dict) -> "SelectionParams":
        """
        Build a SelectionParams from a request-payload dict.

        Args:
            data (dict): Keys "selection", "tournamentSize", "elitism"
                (missing keys fall back to tournament selection defaults).

        Returns:
            SelectionParams: The typed, immutable parameter object.
        """
        return cls(
            selection=data.get("selection", "tournament"),
            tournament_size=int(data.get("tournamentSize", 3)),
            elitism=bool(data.get("elitism", False)),
        )
