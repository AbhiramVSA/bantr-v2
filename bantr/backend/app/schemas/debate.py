import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    status: str
    livekit_room_name: str
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime


class DebateStartResponse(BaseModel):
    status: str
    livekit_token: str
    livekit_url: str


class DebateEndResponse(BaseModel):
    status: str
