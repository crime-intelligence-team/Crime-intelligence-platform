"""case address link — case<->zone linkage (999 §2.1)

Closes the documented gap in 006 §3 / 999 §2.1: Case carried no
address_id column at all, and create_case never populated or depended
on one. No prior design was ever specified for this link (006 §3
explicitly left it open), so this is a deliberate, minimal design: a
plain nullable FK from cases to addresses.

The zone half of "case<->zone linkage" is deliberately NOT a stored
column. Zone is a spatial polygon and Address already carries a
geocoded point; case_service._resolve_zone_id answers "which zone
contains this case's address" at read time via ST_Contains — the same
spatial-containment primitive risk_service already uses for address
density. Storing a zone_id would drift the moment either geometry
changes; deriving it never can.

ON DELETE SET NULL: removing an address must never cascade-delete the
case that referenced it.

Revision ID: 9c2d4f7a1b3e
Revises: 3f7a2c9e5b1d
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9c2d4f7a1b3e"
down_revision = "3f7a2c9e5b1d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("address_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_cases_address_id_addresses",
        "cases",
        "addresses",
        ["address_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_cases_address_id_addresses", "cases", type_="foreignkey")
    op.drop_column("cases", "address_id")
