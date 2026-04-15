from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError
from app.crud.debate import get_user_debate
from app.models.user import User
from app.schemas.chat import LiveKitTokenRequest, LiveKitTokenResponse
from app.services.debate_service import generate_join_token

router = APIRouter()


@router.post("/token", response_model=LiveKitTokenResponse)
async def get_livekit_token(
    body: LiveKitTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debate = await get_user_debate(db, body.debate_id, user.id)
    if not debate:
        raise NotFoundError("DEBATE_NOT_FOUND", "Debate not found")
    if debate.status != "active":
        raise ConflictError("DEBATE_NOT_ACTIVE", "Debate is not active")

    token = generate_join_token(debate.livekit_room_name, str(user.id))
    return LiveKitTokenResponse(token=token, url=settings.LIVEKIT_URL)
