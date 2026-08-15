"""entity_resolution_events

Phase 6 component 5 (reduced scope): Postgres-side person merge with an
auditable resolution-event table and a reversible visibility pointer
(persons.merged_into_id). No kickoff stub existed for this component —
this is a genuine new table. Graph re-pointing is DEFERRED by decision
011; the relational data moved is only the person row itself (no other
table carries person_id references).

Revision ID: a9c4e8d2f1b5
Revises: f8a2b7d64c03
Create Date: 2026-08-01 17:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9c4e8d2f1b5'
down_revision = 'f8a2b7d64c03'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('entity_resolution_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('primary_entity_id', sa.UUID(), nullable=False),
        sa.Column('absorbed_entity_id', sa.UUID(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('performed_by_id', sa.UUID(), nullable=False),
        sa.Column('performed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reversed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['primary_entity_id'], ['persons.id']),
        sa.ForeignKeyConstraint(['absorbed_entity_id'], ['persons.id']),
        sa.ForeignKeyConstraint(['performed_by_id'], ['officers.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.add_column('persons', sa.Column('merged_into_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_persons_merged_into', 'persons', 'persons', ['merged_into_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_persons_merged_into', 'persons', type_='foreignkey')
    op.drop_column('persons', 'merged_into_id')
    op.drop_table('entity_resolution_events')
