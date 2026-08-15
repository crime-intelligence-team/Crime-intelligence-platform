"""Real TOTP enrollment columns for officers (Phase 7 follow-up, approved).

Adds the shared TOTP secret (base32, RFC 4648 — the same value the
officer's authenticator app holds; the server MUST keep it to verify
codes) and the enrollment timestamp. Real secrets cannot be backfilled
for existing rows (they are generated at enrollment with the officer's
authenticator), so the honest handling for legacy rows is: the gate is
now mfa_enabled == 1 AND totp_secret IS NOT NULL, and this migration
corrects the flag for rows that would have been "enabled with no
secret" — a state that can never satisfy the gate and would otherwise
leak into the login challenge path. The UPDATE is expected to be a
no-op against current fixture data (all seeded officers are
mfa_enabled=0); the row count is printed below for proof, not
assumed.

Down: drops ONLY the two new columns. Prior mfa_enabled values are
not restored (they were correct as stored; the flag's meaning simply
changed).

Revision ID: 5e3a9b8c1d4f
Revises: 7d2c1e4f9b3a
"""

from alembic import op
import sqlalchemy as sa

revision = "5e3a9b8c1d4f"
down_revision = "7d2c1e4f9b3a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("officers", sa.Column("totp_secret", sa.String(), nullable=True))
    op.add_column(
        "officers",
        sa.Column("totp_enrolled_at", sa.DateTime(timezone=True), nullable=True),
    )

    bind = op.get_bind()
    would_affect = bind.execute(
        sa.text(
            "SELECT count(*) FROM officers "
            "WHERE mfa_enabled = 1 AND totp_secret IS NULL"
        )
    ).scalar()
    result = bind.execute(
        sa.text(
            "UPDATE officers SET mfa_enabled = 0 "
            "WHERE totp_secret IS NULL"
        )
    )
    print(
        f"[migration 5e3a9b8c1d4f] mfa_enabled=1 with no secret before backfill: "
        f"{would_affect}; rows actually updated: {result.rowcount}"
    )


def downgrade() -> None:
    op.drop_column("officers", "totp_enrolled_at")
    op.drop_column("officers", "totp_secret")
