"""case_pins — per-officer case pinning

Backs the Case Workspace's pin control, which previously had no
backend concept at all (a bare icon with no onClick, no field, no
endpoint). Pinning is personal organization, not a collaborative
record like case_team_members, so this is a plain (case, officer)
link with a hard delete on unpin — no removed_at history needed.

Revision ID: d4b8f2a9c6e1
Revises: c1f4a8e6b2d7
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4b8f2a9c6e1"
down_revision = "c1f4a8e6b2d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "case_pins",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("case_id", sa.UUID(), nullable=False),
        sa.Column("officer_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.ForeignKeyConstraint(["officer_id"], ["officers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_unique_constraint(
        "uq_case_pins_case_officer", "case_pins", ["case_id", "officer_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_case_pins_case_officer", "case_pins", type_="unique")
    op.drop_table("case_pins")
