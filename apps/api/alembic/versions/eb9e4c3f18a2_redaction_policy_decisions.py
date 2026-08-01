"""redaction_policy_decisions

Reshapes the Phase 6 kickoff STUB table (decision-record columns
target_type/target_id/granularity/is_automatic/...) into the approved
rule shape (entity_type/field/min_classification/decision/reason/active/
created_by_id). The stub table was created empty by the initial migration,
has zero rows and zero consumers — the approved design (decision 008,
signed off) supersedes the stub, so the table is dropped and recreated
in one migration. This is NOT a data migration: nothing was lost.

Revision ID: eb9e4c3f18a2
Revises: b3a7c11e4d92
Create Date: 2026-08-01 14:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM


# revision identifiers, used by Alembic.
revision = 'eb9e4c3f18a2'
down_revision = 'b3a7c11e4d92'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table('redaction_policy_decisions')
    op.create_table('redaction_policy_decisions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('field', sa.String(), nullable=False),
        sa.Column('min_classification', ENUM('OPEN_OPERATIONAL', 'RESTRICTED_OPERATIONAL', 'PROTECTED', 'SEALED', name='classification_level', create_type=False), nullable=False),
        sa.Column('decision', sa.String(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_by_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['officers.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('redaction_policy_decisions')
    op.create_table('redaction_policy_decisions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.String(), nullable=False),
        sa.Column('granularity', sa.String(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('is_full_concealment', sa.Boolean(), nullable=True),
        sa.Column('decided_by_id', sa.UUID(), nullable=True),
        sa.Column('is_automatic', sa.Boolean(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['decided_by_id'], ['officers.id']),
        sa.PrimaryKeyConstraint('id')
    )
