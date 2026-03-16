"""add address fields to users

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-03-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "c3d4e5f6g7h8"
down_revision = "b2c3d4e5f6g7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("users")]

    if "street_address" not in columns:
        op.add_column(
            "users",
            sa.Column("street_address", sa.String(200), nullable=True),
        )

    # city, postal_code, latitude, longitude were added in the initial migration.
    # Guard clauses are included here for safety in case the schema diverges.
    if "city" not in columns:
        op.add_column(
            "users",
            sa.Column("city", sa.String(100), nullable=True),
        )

    if "postal_code" not in columns:
        op.add_column(
            "users",
            sa.Column("postal_code", sa.String(20), nullable=True),
        )

    if "latitude" not in columns:
        op.add_column(
            "users",
            sa.Column("latitude", sa.Numeric(10, 8), nullable=True),
        )

    if "longitude" not in columns:
        op.add_column(
            "users",
            sa.Column("longitude", sa.Numeric(11, 8), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("users", "street_address")
