from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IntakeItemVersion(Base):
    __tablename__ = "intake_item_versions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    intake_item_id: Mapped[int] = mapped_column(ForeignKey("intake_items.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    changed_fields: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    before_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    after_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
