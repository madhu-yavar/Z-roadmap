from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IntakeItem(Base):
    __tablename__ = "intake_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True, unique=True)
    document_class: Mapped[str] = mapped_column(String(40), default="other", nullable=False)
    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    scope: Mapped[str] = mapped_column(String(4000), default="", nullable=False)
    activities: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    source_quotes: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    project_context: Mapped[str] = mapped_column(String(30), default="client", nullable=False)
    initiative_type: Mapped[str] = mapped_column(String(30), default="new_feature", nullable=False)
    delivery_mode: Mapped[str] = mapped_column(String(20), default="standard", nullable=False)
    rnd_hypothesis: Mapped[str] = mapped_column(String(2000), default="", nullable=False)
    rnd_experiment_goal: Mapped[str] = mapped_column(String(2000), default="", nullable=False)
    rnd_success_criteria: Mapped[str] = mapped_column(String(2000), default="", nullable=False)
    rnd_timebox_weeks: Mapped[int | None] = mapped_column(nullable=True)
    rnd_decision_date: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    rnd_next_gate: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    rnd_risk_level: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    roadmap_item_id: Mapped[int | None] = mapped_column(ForeignKey("roadmap_items.id"), nullable=True)
    version_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
