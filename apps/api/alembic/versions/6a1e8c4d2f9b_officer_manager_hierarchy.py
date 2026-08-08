"""officer manager hierarchy — real supervisory_chain ancestry (999 §2.3)

Closes 006 §4 / 999 §2.3: the supervisory_chain note-visibility tier was
a role-collapse (`officer.role in (SUPERVISOR, ADMINISTRATOR)`), flagged
in 006 §4 as "explicitly weaker than 'chain' implies (a chain is
per-officer ancestry, not a global role check)." No design was ever
proposed for the deferred manager_id — this is a deliberate, minimal
one: a plain self-referential nullable FK, no separate org table (an
officer's own row already carries role/unit).

ON DELETE SET NULL: removing (or reassigning away) a manager frees
their reports rather than cascade-deleting them.

Revision ID: 6a1e8c4d2f9b
Revises: 9c2d4f7a1b3e
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6a1e8c4d2f9b"
down_revision = "9c2d4f7a1b3e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("officers", sa.Column("manager_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_officers_manager_id_officers",
        "officers",
        "officers",
        ["manager_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_officers_manager_id_officers", "officers", type_="foreignkey")
    op.drop_column("officers", "manager_id")
