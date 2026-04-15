from fastapi import APIRouter, Depends

from app.api.deps import validate_csrf
from app.api.v1.routers import auth, chat, debates, livekit, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(validate_csrf)],
)
api_router.include_router(
    debates.router,
    prefix="/debates",
    tags=["debates"],
    dependencies=[Depends(validate_csrf)],
)
api_router.include_router(
    chat.router,
    prefix="/chat",
    tags=["chat"],
    dependencies=[Depends(validate_csrf)],
)
api_router.include_router(
    livekit.router,
    prefix="/livekit",
    tags=["livekit"],
    dependencies=[Depends(validate_csrf)],
)
