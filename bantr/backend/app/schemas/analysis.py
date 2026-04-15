import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AnalysisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    debate_id: uuid.UUID
    argument_strength: dict[str, Any]
    logical_fallacies: list[dict[str, Any]]
    persuasiveness: dict[str, Any]
    key_moments: list[dict[str, Any]]
    improvement_areas: list[dict[str, Any]]
    overall_summary: str
    winner: str | None
    created_at: datetime
