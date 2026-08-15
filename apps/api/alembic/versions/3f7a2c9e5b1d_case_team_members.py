"""case_team_members — real case-team membership

Closes the documented gap in decisions 006 §4 / 999 §2.2: note
visibility's case_team tier could only check lead_officer_id or the
note's own author, since no membership table existed ("multiple
assigned officers need a case_team table"). No wider design was ever
specified (no role-on-team vocabulary, no invite workflow) — this is a
deliberate, minimal design: a plain (case, officer) link, soft-removed
via removed_at rather than deleted, so history survives (same idiom as
persons.merged_into_id / entity_resolution_events.reversed_at).

The partial unique index enforces at most one ACTIVE membership row per
(case_id, officer_id) — re-adding a previously-removed officer inserts a
fresh row (a new auditable event) rather than reviving the old one.

Revision ID: 3f7a2c9e5b1d
Revises: 5e3a9b8c1d4f
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3f7a2c9e5b1d"
down_revision = "5e3a9b8c1d4f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "case_team_members",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("case_id", sa.UUID(), nullable=False),
        sa.Column("officer_id", sa.UUID(), nullable=False),
        sa.Column("added_by_id", sa.UUID(), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.ForeignKeyConstraint(["officer_id"], ["officers.id"]),
        sa.ForeignKeyConstraint(["added_by_id"], ["officers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_case_team_members_active",
        "case_team_members",
        ["case_id", "officer_id"],
        unique=True,
        postgresql_where=sa.text("removed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_case_team_members_active",
        table_name="case_team_members",
        postgresql_where=sa.text("removed_at IS NULL"),
    )
    op.drop_table("case_team_members")
