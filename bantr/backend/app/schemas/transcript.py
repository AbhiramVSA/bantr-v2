import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class TranscriptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    debate_id: uuid.UUID
    full_text: str
    speaker_segments: list[dict[str, Any]]
    created_at: datetime
