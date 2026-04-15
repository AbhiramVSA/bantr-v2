import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.crud.chat_message import delete_user_chat_history, list_chat_messages
from app.models.user import User
from app.schemas.chat import (
    ChatContextDebate,
    ChatMessageRead,
    ChatRequest,
    ChatResponse,
)
from app.services.chat_service import handle_chat_message

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def send_chat_message(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    assistant_msg, context_debates = await handle_chat_message(db, user.id, body.message)
    return ChatResponse(
        message=ChatMessageRead(
            id=assistant_msg.id,
            role=assistant_msg.role,
            content=assistant_msg.content,
            created_at=assistant_msg.created_at,
        ),
        context_debates=[
            ChatContextDebate(id=uuid.UUID(d["id"]), title=d["title"])
            for d in context_debates
        ],
    )


@router.get("/history", response_model=list[ChatMessageRead])
async def get_chat_history(
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    messages = await list_chat_messages(db, user.id, skip=skip, limit=limit)
    return messages


@router.delete("/history")
async def clear_chat_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_user_chat_history(db, user.id)
    return {"status": "cleared"}
