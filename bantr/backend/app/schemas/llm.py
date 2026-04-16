from typing import Literal

from pydantic import BaseModel, Field

Speaker = Literal["user", "agent"]
Winner = Literal["user", "agent", "draw"]


class ArgumentStrength(BaseModel):
    user_score: int = Field(ge=1, le=10)
    agent_score: int = Field(ge=1, le=10)
    reasoning: str = Field(min_length=1)


class LogicalFallacy(BaseModel):
    speaker: Speaker
    fallacy: str = Field(min_length=1)
    quote: str = Field(min_length=1)


class Persuasiveness(BaseModel):
    user_rating: int = Field(ge=1, le=10)
    agent_rating: int = Field(ge=1, le=10)
    summary: str = Field(min_length=1)


class KeyMoment(BaseModel):
    description: str = Field(min_length=1)
    speaker: Speaker
    impact: str = Field(min_length=1)


class ImprovementArea(BaseModel):
    area: str = Field(min_length=1)
    suggestion: str = Field(min_length=1)


class DebateAnalysisOutput(BaseModel):
    argument_strength: ArgumentStrength
    logical_fallacies: list[LogicalFallacy]
    persuasiveness: Persuasiveness
    key_moments: list[KeyMoment]
    improvement_areas: list[ImprovementArea]
    overall_summary: str = Field(min_length=1)
    winner: Winner | None = None


class ChatCoachOutput(BaseModel):
    response: str = Field(min_length=1, max_length=2500)


class WorkerPlanOutput(BaseModel):
    refined_system_prompt: str = Field(min_length=1)
    opening_statement: str = Field(min_length=1)
