from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import UserRole


class CustomRole(Base):
    __tablename__ = "custom_roles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    base_role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    scope: Mapped[str] = mapped_column(Text, nullable=False, default="")
    responsibilities: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    can_create_users: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_configure_team_capacity: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_allocate_portfolio_quotas: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_submit_commitment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_edit_roadmap: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_manage_settings: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
