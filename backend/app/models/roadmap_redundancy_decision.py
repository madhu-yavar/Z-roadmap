from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoadmapRedundancyDecision(Base):
    __tablename__ = "roadmap_redundancy_decisions"
    __table_args__ = (UniqueConstraint("left_item_id", "right_item_id", name="uq_redundancy_pair"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    left_item_id: Mapped[int] = mapped_column(ForeignKey("roadmap_items.id"), nullable=False, index=True)
    right_item_id: Mapped[int] = mapped_column(ForeignKey("roadmap_items.id"), nullable=False, index=True)
    decision: Mapped[str] = mapped_column(String(32), nullable=False)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
