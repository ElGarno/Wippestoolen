"""Add tool_photos table

Revision ID: 27e841b4e154
Revises: 6b4f4bec3d4d
Create Date: 2025-09-10 17:21:38.771156

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '27e841b4e154'
down_revision: Union[str, Sequence[str], None] = '6b4f4bec3d4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create tool_photos table."""
    op.create_table('tool_photos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tool_id', sa.UUID(), nullable=False),
        sa.Column('original_url', sa.String(length=500), nullable=False),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
        sa.Column('medium_url', sa.String(length=500), nullable=True),
        sa.Column('large_url', sa.String(length=500), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['tool_id'], ['tools.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index('ix_tool_photos_tool_id', 'tool_photos', ['tool_id'])
    op.create_index('ix_tool_photos_is_primary', 'tool_photos', ['is_primary'])
    op.create_index('ix_tool_photos_is_active', 'tool_photos', ['is_active'])


def downgrade() -> None:
    """Drop tool_photos table."""
    op.drop_index('ix_tool_photos_is_active', 'tool_photos')
    op.drop_index('ix_tool_photos_is_primary', 'tool_photos')
    op.drop_index('ix_tool_photos_tool_id', 'tool_photos')
    op.drop_table('tool_photos')
