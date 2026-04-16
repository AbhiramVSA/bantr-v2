"""harden_debate_constraints

Revision ID: 7f3a1d6ce4b2
Revises: db2017486dcd
Create Date: 2026-04-15 23:55:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7f3a1d6ce4b2"
down_revision: Union[str, None] = "db2017486dcd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_debates_status_valid",
        "debates",
        "status IN ('pending', 'starting', 'active', 'ending', 'completed', 'failed')",
    )
    op.create_check_constraint(
        "ck_chat_messages_role_valid",
        "chat_messages",
        "role IN ('user', 'assistant')",
    )
    op.create_check_constraint(
        "ck_debate_embeddings_speaker_valid",
        "debate_embeddings",
        "speaker IN ('user', 'agent')",
    )
    op.create_unique_constraint(
        "uq_debate_embeddings_debate_chunk",
        "debate_embeddings",
        ["debate_id", "chunk_index"],
    )
    op.create_check_constraint(
        "ck_debate_analyses_winner_valid",
        "debate_analyses",
        "winner IS NULL OR winner IN ('user', 'agent', 'draw')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_debate_analyses_winner_valid", "debate_analyses", type_="check")
    op.drop_constraint(
        "uq_debate_embeddings_debate_chunk", "debate_embeddings", type_="unique"
    )
    op.drop_constraint(
        "ck_debate_embeddings_speaker_valid", "debate_embeddings", type_="check"
    )
    op.drop_constraint("ck_chat_messages_role_valid", "chat_messages", type_="check")
    op.drop_constraint("ck_debates_status_valid", "debates", type_="check")
