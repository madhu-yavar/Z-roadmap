from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IntakeAnalysis(Base):
    __tablename__ = "intake_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    intake_item_id: Mapped[int] = mapped_column(ForeignKey("intake_items.id"), nullable=False, unique=True, index=True)
    primary_type: Mapped[str] = mapped_column(String(40), default="Mixed / Composite Document", nullable=False)
    confidence: Mapped[str] = mapped_column(String(10), default="Low", nullable=False)
    output_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
