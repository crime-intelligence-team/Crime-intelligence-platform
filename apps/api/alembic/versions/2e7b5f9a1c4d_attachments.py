"""attachments — case-scoped file uploads (006 §1 / 999 §2.12)

Closes 006 §1 / 999 §2.12: the attachment endpoint was a stub
(`{"_stub": True}`) pending a storage decision. Decision: local disk, no
new service (S3/MinIO) — files live under settings.ATTACHMENT_STORAGE_PATH
addressed by this table's own id, never by the caller-supplied filename
(stored for display/Content-Disposition only). No PRD occurrence ever
proposed a shape for this, so the row is deliberately minimal: the same
fields any of this codebase's classification-gated case-scoped child
records already carry (see notes), nothing else.

Revision ID: 2e7b5f9a1c4d
Revises: 6a1e8c4d2f9b
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM


# revision identifiers, used by Alembic.
revision = "2e7b5f9a1c4d"
down_revision = "6a1e8c4d2f9b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("case_id", sa.UUID(), nullable=False),
        sa.Column("uploaded_by_id", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column(
            "classification",
            ENUM(
                "OPEN_OPERATIONAL", "RESTRICTED_OPERATIONAL", "PROTECTED", "SEALED",
                name="classification_level",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"]),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["officers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("attachments")
