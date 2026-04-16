import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DebateStatus = Literal["pending", "starting", "active", "ending", "completed", "failed"]


class DebateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    topic: str = Field(min_length=1)
    agent_prompt: str = Field(min_length=1)
    agent_voice_id: str = Field(min_length=1, max_length=100)


class DebateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    topic: str
    agent_prompt: str
    agent_voice_id: str
    status: DebateStatus
    livekit_room_name: str
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime


class DebateStartResponse(BaseModel):
    status: DebateStatus
    livekit_token: str
    livekit_url: str
    livekit_room_name: str


class DebateEndResponse(BaseModel):
    status: DebateStatus
