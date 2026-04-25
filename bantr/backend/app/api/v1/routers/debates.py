import uuid
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.errors import ConflictError, NotFoundError
from app.crud.debate import (
    get_user_debate,
    get_user_debate_for_update,
    list_user_debates,
)
from app.crud.debate_analysis import get_analysis_by_debate_id
from app.crud.transcript import get_transcript_by_debate_id
from app.models.user import User
from app.schemas.analysis import AnalysisRead
from app.schemas.debate import (
    DebateCreate,
    DebateEndResponse,
    DebateRead,
    DebateStartResponse,
    DebateStatus,
)
from app.schemas.transcript import TranscriptRead
from app.services.analysis_service import analyze_debate, schedule_embedding
from app.services.debate_service import create_new_debate, end_debate, start_debate

router = APIRouter()
TERMINAL_STATUSES = {"completed", "failed"}


def _get_debate_or_404(debate):
    if not debate:
        raise NotFoundError("DEBATE_NOT_FOUND", "Debate not found")
    return debate


@router.post("", response_model=DebateRead, status_code=201)
async def create_debate_endpoint(
    body: DebateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debate = await create_new_debate(db, user.id, body)
    await db.commit()
    return debate


@router.get("", response_model=list[DebateRead])
async def list_debates(
    status: DebateStatus | None = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_user_debates(db, user.id, status=status, skip=skip, limit=limit)


@router.get("/{debate_id}", response_model=DebateRead)
async def get_debate(
    debate_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debate = await get_user_debate(db, debate_id, user.id)
    return _get_debate_or_404(debate)


@router.post("/{debate_id}/start", response_model=DebateStartResponse)
async def start_debate_endpoint(
    debate_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debate = _get_debate_or_404(await get_user_debate_for_update(db, debate_id, user.id))
    token, url = await start_debate(db, debate, user.id)
    await db.commit()
    return DebateStartResponse(
        status="active",
        livekit_token=token,
        livekit_url=url,
        livekit_room_name=debate.livekit_room_name,
    )


@router.post("/{debate_id}/end", response_model=DebateEndResponse)
async def end_debate_endpoint(
    debate_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debate = _get_debate_or_404(await get_user_debate_for_update(db, debate_id, user.id))
    await end_debate(db, debate)
    await db.commit()
    return DebateEndResponse(status=cast(DebateStatus, debate.status))


@router.delete("/{debate_id}")
async def delete_debate_endpoint(
    debate_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debate = _get_debate_or_404(await get_user_debate(db, debate_id, user.id))
    if debate.status not in TERMINAL_STATUSES:
        raise ConflictError(
            "DEBATE_NOT_TERMINAL",
            "Debate can only be deleted after reaching a terminal state",
        )
    await db.delete(debate)
    await db.flush()
    await db.commit()
    return {"status": "deleted", "debate_id": str(debate_id)}


@router.get("/{debate_id}/transcript", response_model=TranscriptRead)
async def get_transcript(
    debate_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _get_debate_or_404(await get_user_debate(db, debate_id, user.id))
    transcript = await get_transcript_by_debate_id(db, debate_id)
    if not transcript:
        raise NotFoundError("TRANSCRIPT_NOT_FOUND", "Transcript not found")
    return transcript


@router.post("/{debate_id}/analyze", response_model=AnalysisRead, status_code=201)
async def analyze_debate_endpoint(
    debate_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debate = _get_debate_or_404(await get_user_debate_for_update(db, debate_id, user.id))
    analysis = await analyze_debate(db, debate)
    await db.commit()
    schedule_embedding(debate.id)
    return analysis


@router.get("/{debate_id}/analysis", response_model=AnalysisRead)
async def get_analysis(
    debate_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _get_debate_or_404(await get_user_debate(db, debate_id, user.id))
    analysis = await get_analysis_by_debate_id(db, debate_id)
    if not analysis:
        raise NotFoundError("ANALYSIS_NOT_FOUND", "Analysis not found")
    return analysis
