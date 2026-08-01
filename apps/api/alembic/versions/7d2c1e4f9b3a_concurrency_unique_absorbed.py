"""Concurrency guard: one active merge per absorbed person.

Phase 7 component 2 finding: two concurrent merges of the same absorbed
person both succeeded (read-check-write race in
entity_resolution_service.merge_entities). The row lock on the Person
rows serializes the check; this partial unique index is the hard
backstop — an absorbed person can have at most one active (not reversed)
merge event. Reversal clears the pointer and frees the row for a future
re-merge, so the index predicates on reversed_at, not on a status column
(the model derives merged/reversed from reversed_at; see 011).

Revision ID: 7d2c1e4f9b3a
Revises: a9c4e8d2f1b5
"""

from alembic import op
import sqlalchemy as sa

revision = "7d2c1e4f9b3a"
down_revision = "a9c4e8d2f1b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_entity_resolution_events_active_absorbed",
        "entity_resolution_events",
        ["absorbed_entity_id"],
        unique=True,
        postgresql_where=sa.text("reversed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_entity_resolution_events_active_absorbed",
        table_name="entity_resolution_events",
        postgresql_where=sa.text("reversed_at IS NULL"),
    )
