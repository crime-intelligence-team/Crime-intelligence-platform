"""retention_policies — flag-only retention-eligibility policies

Closes a real gap: no purge/archive/retention mechanism existed for any
case/entity/note data. This table is deliberately flag-only — it never
deletes or archives a record. Eligibility (age past retention_days, plus
status == closed for cases) is computed inline at read time by
retention_service, the same "compare against now, no background job"
idiom as AccessExceptionRequest.expires_at.

Revision ID: f4a1c8e6b3d9
Revises: e7c3a9f5d2b8
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f4a1c8e6b3d9"
down_revision = "e7c3a9f5d2b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "retention_policies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("retention_days", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_by_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["officers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("retention_policies")
