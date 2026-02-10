from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoadmapPlanItem(Base):
    __tablename__ = "roadmap_plan_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bucket_item_id: Mapped[int] = mapped_column(ForeignKey("roadmap_items.id"), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    scope: Mapped[str] = mapped_column(String(4000), default="", nullable=False)
    activities: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
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
    accountable_person: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    entered_roadmap_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    planned_start_date: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    planned_end_date: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    resource_count: Mapped[int | None] = mapped_column(nullable=True)
    effort_person_weeks: Mapped[int | None] = mapped_column(nullable=True)
    planning_status: Mapped[str] = mapped_column(String(20), default="not_started", nullable=False)
    confidence: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    dependency_ids: Mapped[list[int]] = mapped_column(JSON, default=list, nullable=False)
    tentative_duration_weeks: Mapped[int | None] = mapped_column(nullable=True)
    pickup_period: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    completion_period: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
