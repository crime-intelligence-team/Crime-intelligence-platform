"""Audit log role/jurisdiction/module/outcome context (PRD security §9 gap).

Closes a real correctness gap, not just a missing field: AuditLogEntry
previously stored only actor_id, so every read resolved "the actor's
role and jurisdiction" via a live join to the officers table — meaning
a later role change or district reassignment silently rewrote what
OLD audit entries appeared to say about the actor at the time of the
action. actor_role/actor_district_id are now stamped onto the row at
write time instead, so they are immutable snapshots.

Also adds module (which UI/API area the action occurred in) and
success (explicit outcome, replacing the ad-hoc "_failed" suffix
convention on action strings) — both required by the PRD's audit
section and previously absent.

Backfill for existing rows:
  - success: derived from the existing "_failed" suffix convention
    (the only outcome signal that already existed in the data).
  - module: derived from each row's action string via the same
    module map the application now uses going forward.
  - actor_role / actor_district_id: NOT backfilled. The actor's role
    and district AT THE TIME of a historical action cannot be
    reconstructed from data that only ever stored the current state;
    backfilling from the officers table today would just reintroduce
    the exact bug this migration fixes. Left NULL for pre-existing
    rows; populated for every row written from here on.

Revision ID: c1f4a8e6b2d7
Revises: 2e7b5f9a1c4d
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c1f4a8e6b2d7"
down_revision = "2e7b5f9a1c4d"
branch_labels = None
depends_on = None

_AUTH_ACTIONS = (
    "login", "login_failed", "logout",
    "mfa_challenge_issued", "mfa_verified", "mfa_verification_failed",
    "step_up", "step_up_failed",
    "mfa_enroll_initiated", "mfa_enroll_failed",
    "mfa_confirm_failed", "mfa_enrolled",
    "mfa_disable_failed", "mfa_disabled",
)
_CASES_ACTIONS = (
    "export", "case_status_changed", "case_team_member_added",
    "case_team_member_removed", "attachment_downloaded",
    "note_list_redaction", "export_redaction",
)
_NETWORK_ACTIONS = ("entity_redaction",)
_GOVERNANCE_ACTIONS = (
    "officer_manager_changed",
    "redaction_policy_created", "redaction_policy_deactivated",
    "confidence_review_submitted", "confidence_review_accepted", "confidence_review_rejected",
    "entity_merge_performed", "entity_merge_reversed",
    "exception_requested", "exception_approved", "exception_denied", "exception_revoked",
)


def upgrade() -> None:
    officer_role = postgresql.ENUM(
        "DISTRICT_OFFICER", "DETECTIVE", "ANALYST", "SUPERVISOR", "ADMINISTRATOR",
        name="officer_role", create_type=False,
    )
    op.add_column("audit_log_entries", sa.Column("actor_role", officer_role, nullable=True))
    op.add_column(
        "audit_log_entries",
        sa.Column("actor_district_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_audit_log_entries_actor_district_id_districts",
        "audit_log_entries", "districts", ["actor_district_id"], ["id"],
    )
    op.add_column("audit_log_entries", sa.Column("module", sa.String(), nullable=True))
    op.add_column(
        "audit_log_entries",
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    bind = op.get_bind()

    failed = bind.execute(
        sa.text("UPDATE audit_log_entries SET success = FALSE WHERE action LIKE '%\\_failed' ESCAPE '\\'")
    )

    def _tag(actions: tuple[str, ...], module: str) -> int:
        result = bind.execute(
            sa.text("UPDATE audit_log_entries SET module = :module WHERE action = ANY(:actions)"),
            {"module": module, "actions": list(actions)},
        )
        return result.rowcount

    auth_n = _tag(_AUTH_ACTIONS, "auth")
    cases_n = _tag(_CASES_ACTIONS, "cases")
    network_n = _tag(_NETWORK_ACTIONS, "network")
    governance_n = _tag(_GOVERNANCE_ACTIONS, "governance")

    print(
        f"[migration c1f4a8e6b2d7] backfilled: success=FALSE for {failed.rowcount} rows; "
        f"module: auth={auth_n} cases={cases_n} network={network_n} governance={governance_n}"
    )


def downgrade() -> None:
    op.drop_column("audit_log_entries", "success")
    op.drop_column("audit_log_entries", "module")
    op.drop_constraint(
        "fk_audit_log_entries_actor_district_id_districts",
        "audit_log_entries", type_="foreignkey",
    )
    op.drop_column("audit_log_entries", "actor_district_id")
    op.drop_column("audit_log_entries", "actor_role")
