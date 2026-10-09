"""add edited flag to messages

Revision ID: 3c1f8a2d9b47
Revises: 92b7727050e6
Create Date: 2026-10-09 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3c1f8a2d9b47'
down_revision = '92b7727050e6'
branch_labels = None
depends_on = None


def upgrade():
    # the server default fills in false for all the messages that already exist
    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('edited', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade():
    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.drop_column('edited')
