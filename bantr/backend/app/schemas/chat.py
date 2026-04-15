import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)


class ChatContextDebate(BaseModel):
    id: uuid.UUID
    title: str


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    created_at: datetime


class ChatResponse(BaseModel):
    message: ChatMessageRead
    context_debates: list[ChatContextDebate]


class LiveKitTokenRequest(BaseModel):
    debate_id: uuid.UUID


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
