"""add_alerts

Revision ID: b3a7c11e4d92
Revises: d8b860383935
Create Date: 2026-08-01 11:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM


# revision identifiers, used by Alembic.
revision = 'b3a7c11e4d92'
down_revision = 'd8b860383935'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('alerts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=True),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('district_id', sa.UUID(), nullable=True),
        sa.Column('classification', ENUM('OPEN_OPERATIONAL', 'RESTRICTED_OPERATIONAL', 'PROTECTED', 'SEALED', name='classification_level', create_type=False), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['district_id'], ['districts.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('alerts')
