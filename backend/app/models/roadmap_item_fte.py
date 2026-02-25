from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoadmapItemFte(Base):
    __tablename__ = "roadmap_item_fte"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    roadmap_item_id: Mapped[int] = mapped_column(ForeignKey("roadmap_items.id"), nullable=False)
    fte_role_id: Mapped[int] = mapped_column(ForeignKey("fte_roles.id"), nullable=False)
    fte_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('roadmap_item_id', 'fte_role_id', name='uq_roadmap_item_fte'),
    )


class RoadmapPlanItemFte(Base):
    __tablename__ = "roadmap_plan_item_fte"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    roadmap_plan_item_id: Mapped[int] = mapped_column(ForeignKey("roadmap_plan_items.id"), nullable=False)
    fte_role_id: Mapped[int] = mapped_column(ForeignKey("fte_roles.id"), nullable=False)
    fte_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('roadmap_plan_item_id', 'fte_role_id', name='uq_roadmap_plan_item_fte'),
    )
