from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
import re

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.governance_config import GovernanceConfig
from app.models.intake_item import IntakeItem
from app.models.roadmap_movement_request import RoadmapMovementRequest
from app.models.roadmap_item import RoadmapItem
from app.models.roadmap_plan_item import RoadmapPlanItem
from app.schemas.dashboard import DashboardOut
from app.services.capacity_governance import build_capacity_governance_alert

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _is_rnd_mode(value: str | None) -> bool:
    return (value or "").strip().lower() == "rnd"


def _has_ai_tagged_activity(items: list[str] | None) -> bool:
    activities = items or []
    for item in activities:
        text = str(item or "").strip().upper()
        if not text.startswith("["):
            continue
        match = re.match(r"^\[([A-Z/]+)\]", text)
        if not match:
            continue
        tags = {part.strip() for part in match.group(1).split("/") if part.strip()}
        if "AI" in tags:
            return True
    return False


def _is_ai_intake(item: IntakeItem) -> bool:
    return _has_ai_tagged_activity(item.activities)


def _is_ai_roadmap_item(item: RoadmapItem) -> bool:
    return (item.ai_fte or 0) > 0 or _has_ai_tagged_activity(item.activities)


def _is_ai_plan_item(item: RoadmapPlanItem) -> bool:
    return (item.ai_fte or 0) > 0 or _has_ai_tagged_activity(item.activities)


@router.get("/summary", response_model=DashboardOut)
def get_dashboard_summary(db: Session = Depends(get_db), _=Depends(get_current_user)):
    intake_open_items = db.query(IntakeItem).filter(IntakeItem.status != "approved").all()
    intake_total = len(intake_open_items)
    intake_understanding_pending = (
        db.query(func.count(IntakeItem.id))
        .filter(IntakeItem.status == "understanding_pending")
        .scalar()
        or 0
    )
    intake_draft = (
        db.query(func.count(IntakeItem.id))
        .filter(IntakeItem.status == "draft")
        .scalar()
        or 0
    )

    rnd_intake_total = sum(1 for item in intake_open_items if _is_rnd_mode(item.delivery_mode))
    ai_intake_total = sum(1 for item in intake_open_items if _is_ai_intake(item))

    commitment_items = db.query(RoadmapItem).all()
    commitments_total = len(commitment_items)
    commitments_ready = sum(1 for item in commitment_items if bool(item.picked_up))
    rnd_commitments_total = sum(1 for item in commitment_items if _is_rnd_mode(item.delivery_mode))
    ai_commitments_total = sum(1 for item in commitment_items if _is_ai_roadmap_item(item))

    commitments_locked = db.query(func.count(RoadmapPlanItem.id)).scalar() or 0
    roadmap_total = commitments_locked

    all_plan_items = db.query(RoadmapPlanItem).all()
    rnd_roadmap_total = sum(1 for item in all_plan_items if _is_rnd_mode(item.delivery_mode))
    ai_roadmap_total = sum(1 for item in all_plan_items if _is_ai_plan_item(item))

    roadmap_movement_pending = db.query(func.count(RoadmapMovementRequest.id)).filter(RoadmapMovementRequest.status == "pending").scalar() or 0
    roadmap_movement_approved = db.query(func.count(RoadmapMovementRequest.id)).filter(RoadmapMovementRequest.status == "approved").scalar() or 0
    roadmap_movement_rejected = db.query(func.count(RoadmapMovementRequest.id)).filter(RoadmapMovementRequest.status == "rejected").scalar() or 0
    roadmap_movement_total = db.query(func.count(RoadmapMovementRequest.id)).scalar() or 0

    intake_context_rows = (
        db.query(IntakeItem.project_context, func.count(IntakeItem.id))
        .filter(IntakeItem.status != "approved")
        .group_by(IntakeItem.project_context)
        .all()
    )
    commitments_context_rows = db.query(RoadmapItem.project_context, func.count(RoadmapItem.id)).group_by(
        RoadmapItem.project_context
    ).all()
    roadmap_context_rows = db.query(RoadmapPlanItem.project_context, func.count(RoadmapPlanItem.id)).group_by(
        RoadmapPlanItem.project_context
    ).all()

    intake_mode_rows = (
        db.query(IntakeItem.delivery_mode, func.count(IntakeItem.id))
        .filter(IntakeItem.status != "approved")
        .group_by(IntakeItem.delivery_mode)
        .all()
    )
    commitments_mode_rows = db.query(RoadmapItem.delivery_mode, func.count(RoadmapItem.id)).group_by(
        RoadmapItem.delivery_mode
    ).all()
    roadmap_mode_rows = db.query(RoadmapPlanItem.delivery_mode, func.count(RoadmapPlanItem.id)).group_by(
        RoadmapPlanItem.delivery_mode
    ).all()

    commitments_priority_rows = db.query(RoadmapItem.priority, func.count(RoadmapItem.id)).group_by(
        RoadmapItem.priority
    ).all()
    roadmap_priority_rows = db.query(RoadmapPlanItem.priority, func.count(RoadmapPlanItem.id)).group_by(
        RoadmapPlanItem.priority
    ).all()
    governance = db.query(GovernanceConfig).order_by(GovernanceConfig.id.asc()).first()
    capacity_governance_alert = build_capacity_governance_alert(governance, all_plan_items)

    def _to_dict(rows):
        return {str(k or "unknown"): int(v or 0) for k, v in rows}

    return DashboardOut(
        intake_total=int(intake_total),
        intake_understanding_pending=int(intake_understanding_pending),
        intake_draft=int(intake_draft),
        rnd_intake_total=int(rnd_intake_total),
        ai_intake_total=int(ai_intake_total),
        commitments_total=int(commitments_total),
        commitments_ready=int(commitments_ready),
        commitments_locked=int(commitments_locked),
        rnd_commitments_total=int(rnd_commitments_total),
        ai_commitments_total=int(ai_commitments_total),
        roadmap_total=int(roadmap_total),
        rnd_roadmap_total=int(rnd_roadmap_total),
        ai_roadmap_total=int(ai_roadmap_total),
        roadmap_movement_pending=int(roadmap_movement_pending),
        roadmap_movement_approved=int(roadmap_movement_approved),
        roadmap_movement_rejected=int(roadmap_movement_rejected),
        roadmap_movement_total=int(roadmap_movement_total),
        intake_by_context=_to_dict(intake_context_rows),
        commitments_by_context=_to_dict(commitments_context_rows),
        roadmap_by_context=_to_dict(roadmap_context_rows),
        intake_by_mode=_to_dict(intake_mode_rows),
        commitments_by_mode=_to_dict(commitments_mode_rows),
        roadmap_by_mode=_to_dict(roadmap_mode_rows),
        commitments_by_priority=_to_dict(commitments_priority_rows),
        roadmap_by_priority=_to_dict(roadmap_priority_rows),
        capacity_governance_alert=capacity_governance_alert,
    )
