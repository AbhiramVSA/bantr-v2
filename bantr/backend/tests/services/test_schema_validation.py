import pytest
from pydantic import ValidationError

from app.schemas.chat import ChatRequest
from app.schemas.debate import DebateCreate


def test_debate_create_rejects_whitespace_only_required_fields():
    with pytest.raises(ValidationError):
        DebateCreate(
            title="   ",
            topic="Resolved: tests matter",
            agent_prompt="Argue clearly.",
            agent_voice_id="demo-voice",
        )


def test_debate_create_strips_valid_input_and_enforces_prompt_length():
    debate = DebateCreate(
        title="  Finals  ",
        topic="  Resolved: tests matter  ",
        agent_prompt=" Argue clearly. ",
        agent_voice_id=" demo-voice ",
    )

    assert debate.title == "Finals"
    assert debate.topic == "Resolved: tests matter"
    assert debate.agent_prompt == "Argue clearly."
    assert debate.agent_voice_id == "demo-voice"

    with pytest.raises(ValidationError):
        DebateCreate(
            title="Finals",
            topic="Resolved: tests matter",
            agent_prompt="x" * 4001,
            agent_voice_id="demo-voice",
        )


def test_chat_request_rejects_blank_and_too_long_messages():
    with pytest.raises(ValidationError):
        ChatRequest(message="  ")

    with pytest.raises(ValidationError):
        ChatRequest(message="x" * 4001)

    assert ChatRequest(message="  hello  ").message == "hello"
