"""add profile picture field

Revision ID: add_profile_picture
Create Date: 2025-10-03

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_profile_picture'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('profile_picture_url', sa.String(), nullable=True))

def downgrade():
    op.drop_column('users', 'profile_picture_url')