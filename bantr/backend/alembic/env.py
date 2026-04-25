import asyncio
import pathlib
import ssl
import sys
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Add backend/ to path so 'app' is importable
sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models import Base  # noqa: F401 — registers all models with metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

db_url = str(settings.ASYNC_DATABASE_URI)


def run_migrations_offline() -> None:
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    connect_args = {}
    if settings.DATABASE_HOST not in ("localhost", "127.0.0.1"):
        ssl_context = ssl.create_default_context()
        connect_args["ssl"] = ssl_context

    connectable = create_async_engine(db_url, connect_args=connect_args)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
