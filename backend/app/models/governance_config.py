from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GovernanceConfig(Base):
    __tablename__ = "governance_configs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    team_fe: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    team_be: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    team_ai: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    team_pm: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    efficiency_fe: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    efficiency_be: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    efficiency_ai: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    efficiency_pm: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    quota_client: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    quota_internal: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    team_locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    team_locked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    quota_locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    quota_locked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    efficiency_confirmed_ceo_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    efficiency_confirmed_ceo_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    efficiency_confirmed_vp_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    efficiency_confirmed_vp_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
