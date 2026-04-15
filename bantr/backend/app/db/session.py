import ssl as _ssl
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_is_remote = settings.DATABASE_HOST not in ("localhost", "127.0.0.1")

_connect_args: dict = {}
if _is_remote:
    _connect_args["ssl"] = _ssl.create_default_context()
    # Disable prepared statement caching for PgBouncer-based poolers (e.g. Neon)
    _connect_args["statement_cache_size"] = 0
    _connect_args["prepared_statement_cache_size"] = 0

engine = create_async_engine(
    settings.ASYNC_DATABASE_URI,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
