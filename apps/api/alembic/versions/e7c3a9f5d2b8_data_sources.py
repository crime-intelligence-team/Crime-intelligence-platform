"""data_sources — provenance source registry

Closes a real gap: every ingested record (Address/Person/Organization/
Vehicle/Device/Case, via ProvenanceMixin) already stamps a free-text
source_name at ingestion (brief section 4's provenance requirement), but
nothing governs what those strings are — no registry of known sources,
no owner/cadence/status metadata, no admin visibility into what's
actively feeding the platform.

Deliberately NOT a FK retrofit onto the six ProvenanceMixin tables —
source_name stays free-text on those tables; this is a standalone
admin-managed catalog, reconciled to ingested records by name match at
read time (data_source_service), not by foreign key.

Revision ID: e7c3a9f5d2b8
Revises: d4b8f2a9c6e1
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e7c3a9f5d2b8"
down_revision = "d4b8f2a9c6e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "data_sources",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("owner", sa.String(), nullable=False),
        sa.Column("cadence", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_by_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["officers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_data_sources_name"),
    )


def downgrade() -> None:
    op.drop_table("data_sources")
