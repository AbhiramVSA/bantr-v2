from fastapi import APIRouter, Depends

from app.api.deps import validate_csrf
from app.api.v1.routers import auth, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(validate_csrf)],
)
