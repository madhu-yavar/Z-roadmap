from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoadmapMovementRequest(Base):
    __tablename__ = "roadmap_movement_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plan_item_id: Mapped[int] = mapped_column(ForeignKey("roadmap_plan_items.id"), nullable=False, index=True)
    bucket_item_id: Mapped[int] = mapped_column(ForeignKey("roadmap_items.id"), nullable=False, index=True)
    request_type: Mapped[str] = mapped_column(String(24), default="request", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)
    from_start_date: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    from_end_date: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    to_start_date: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    to_end_date: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    blocker: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    decision_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
