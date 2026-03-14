"""add push_tokens table

Revision ID: a1b2c3d4e5f6
Revises: 27e841b4e154
Create Date: 2026-03-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '27e841b4e154'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create push_tokens table."""
    op.create_table(
        'push_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token', sa.String(length=500), nullable=False),
        sa.Column('platform', sa.String(length=10), nullable=False),
        sa.Column('device_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token', name='uq_push_tokens_token'),
    )

    op.create_index('ix_push_tokens_user_id', 'push_tokens', ['user_id'])
    op.create_index('ix_push_tokens_is_active', 'push_tokens', ['is_active'])


def downgrade() -> None:
    """Drop push_tokens table."""
    op.drop_index('ix_push_tokens_is_active', 'push_tokens')
    op.drop_index('ix_push_tokens_user_id', 'push_tokens')
    op.drop_table('push_tokens')
