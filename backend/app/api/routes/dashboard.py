from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.intake_item import IntakeItem
from app.models.roadmap_movement_request import RoadmapMovementRequest
from app.models.roadmap_item import RoadmapItem
from app.models.roadmap_plan_item import RoadmapPlanItem
from app.schemas.dashboard import DashboardOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardOut)
def get_dashboard_summary(db: Session = Depends(get_db), _=Depends(get_current_user)):
    intake_total = (
        db.query(func.count(IntakeItem.id))
        .filter(IntakeItem.status != "approved")
        .scalar()
        or 0
    )
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

    commitments_total = db.query(func.count(RoadmapItem.id)).scalar() or 0
    commitments_ready = db.query(func.count(RoadmapItem.id)).filter(RoadmapItem.picked_up.is_(True)).scalar() or 0
    commitments_locked = db.query(func.count(RoadmapPlanItem.id)).scalar() or 0
    roadmap_total = commitments_locked
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

    def _to_dict(rows):
        return {str(k or "unknown"): int(v or 0) for k, v in rows}

    return DashboardOut(
        intake_total=int(intake_total),
        intake_understanding_pending=int(intake_understanding_pending),
        intake_draft=int(intake_draft),
        commitments_total=int(commitments_total),
        commitments_ready=int(commitments_ready),
        commitments_locked=int(commitments_locked),
        roadmap_total=int(roadmap_total),
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
    )
