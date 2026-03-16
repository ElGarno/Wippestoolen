"""add notification tables and fix column types

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-03-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "d4e5f6g7h8i9"
down_revision = "c3d4e5f6g7h8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    # Create notification_preferences table
    if "notification_preferences" not in existing_tables:
        op.create_table(
            "notification_preferences",
            sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("in_app_enabled", sa.Boolean(), server_default=sa.text("true")),
            sa.Column("email_enabled", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("push_enabled", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("booking_notifications", sa.Boolean(), server_default=sa.text("true")),
            sa.Column("review_notifications", sa.Boolean(), server_default=sa.text("true")),
            sa.Column("system_notifications", sa.Boolean(), server_default=sa.text("true")),
            sa.Column("quiet_hours_start", sa.Integer(), nullable=True),
            sa.Column("quiet_hours_end", sa.Integer(), nullable=True),
            sa.Column("timezone", sa.String(50), server_default="Europe/Berlin"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        )
    else:
        # Fix quiet_hours columns if they are TIME instead of INTEGER
        columns = {c["name"]: c for c in inspector.get_columns("notification_preferences")}
        if "quiet_hours_start" in columns:
            col_type = str(columns["quiet_hours_start"]["type"])
            if "TIME" in col_type.upper() or "time" in col_type:
                op.alter_column("notification_preferences", "quiet_hours_start",
                                type_=sa.Integer(), postgresql_using="NULL")
                op.alter_column("notification_preferences", "quiet_hours_end",
                                type_=sa.Integer(), postgresql_using="NULL")


def downgrade() -> None:
    op.drop_table("notification_preferences")
