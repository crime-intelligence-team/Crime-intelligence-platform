"""confidence_review_events

Reshapes the Phase 6 kickoff STUB table (String-typed scores, broad
target vocabulary) into the approved shape: Integer scores, supported
targets {edge, zone_score}. The stub table was created empty by the
initial migration and has zero rows/consumers — drop+recreate, same
precedent as eb9e4c3f18a2 (redaction_policy_decisions). Not a data
migration; nothing was lost.

Revision ID: f8a2b7d64c03
Revises: eb9e4c3f18a2
Create Date: 2026-08-01 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f8a2b7d64c03'
down_revision = 'eb9e4c3f18a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table('confidence_review_events')
    op.create_table('confidence_review_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('original_score', sa.Integer(), nullable=True),
        sa.Column('proposed_score', sa.Integer(), nullable=True),
        sa.Column('submitted_by_id', sa.UUID(), nullable=False),
        sa.Column('review_status', sa.String(), nullable=False),
        sa.Column('reviewed_by_id', sa.UUID(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['submitted_by_id'], ['officers.id']),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['officers.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('confidence_review_events')
    op.create_table('confidence_review_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('original_score', sa.String(), nullable=True),
        sa.Column('proposed_score', sa.String(), nullable=True),
        sa.Column('submitted_by_id', sa.UUID(), nullable=False),
        sa.Column('review_status', sa.String(), nullable=False),
        sa.Column('reviewed_by_id', sa.UUID(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['submitted_by_id'], ['officers.id']),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['officers.id']),
        sa.PrimaryKeyConstraint('id')
    )
