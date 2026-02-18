from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.document import Document
from app.models.enums import UserRole
from app.models.intake_item import IntakeItem
from app.models.intake_item_version import IntakeItemVersion
from app.models.roadmap_item import RoadmapItem
from app.models.roadmap_item_version import RoadmapItemVersion
from app.models.roadmap_movement_request import RoadmapMovementRequest
from app.models.roadmap_plan_item import RoadmapPlanItem
from app.models.user import User
from app.schemas.audit import (
    AuditCenterOut,
    AuditDocumentRowOut,
    AuditIntakeChangeRowOut,
    AuditMovementRowOut,
    AuditRoadmapChangeRowOut,
    AuditSummaryOut,
)

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/center", response_model=AuditCenterOut)
def get_audit_center(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.CEO, UserRole.VP)),
):
    user_rows = db.query(User).all()
    users = {u.id: u.email for u in user_rows}
    user_roles = {u.id: str(u.role) for u in user_rows}

    intake_items = db.query(IntakeItem).all()
    intake_by_doc = {item.document_id: item for item in intake_items}
    intake_by_id = {item.id: item for item in intake_items}

    roadmap_items = db.query(RoadmapItem).all()
    roadmap_by_id = {item.id: item for item in roadmap_items}
    plan_items = db.query(RoadmapPlanItem).all()
    plan_by_bucket = {item.bucket_item_id: item for item in plan_items}
    plan_by_id = {item.id: item for item in plan_items}

    documents = db.query(Document).order_by(Document.id.desc()).all()
    document_rows: list[AuditDocumentRowOut] = []
    for doc in documents:
        intake = intake_by_doc.get(doc.id)
        roadmap = roadmap_by_id.get(intake.roadmap_item_id) if intake and intake.roadmap_item_id else None
        plan = plan_by_bucket.get(roadmap.id) if roadmap else None
        project_context = (
            (plan.project_context if plan else "")
            or (roadmap.project_context if roadmap else "")
            or (intake.project_context if intake else "")
        )
        document_rows.append(
            AuditDocumentRowOut(
                document_id=doc.id,
                file_name=doc.file_name or "",
                file_type=doc.file_type or "",
                file_hash=doc.file_hash or "",
                notes=doc.notes or "",
                uploaded_by=doc.uploaded_by,
                uploaded_by_email=users.get(doc.uploaded_by),
                uploaded_by_role=user_roles.get(doc.uploaded_by),
                created_at=doc.created_at,
                intake_item_id=intake.id if intake else None,
                intake_status=intake.status if intake else "",
                roadmap_item_id=roadmap.id if roadmap else None,
                roadmap_plan_item_id=plan.id if plan else None,
                roadmap_planning_status=plan.planning_status if plan else "",
                project_context=project_context or "",
            )
        )

    intake_versions = db.query(IntakeItemVersion).order_by(IntakeItemVersion.id.desc()).all()
    intake_rows: list[AuditIntakeChangeRowOut] = []
    for version in intake_versions:
        intake = intake_by_id.get(version.intake_item_id)
        intake_rows.append(
            AuditIntakeChangeRowOut(
                event_id=version.id,
                intake_item_id=version.intake_item_id,
                document_id=intake.document_id if intake else None,
                title=(intake.title if intake else f"Intake #{version.intake_item_id}") or "",
                action=version.action or "",
                status=(intake.status if intake else "") or "",
                project_context=(intake.project_context if intake else "") or "",
                changed_by=version.changed_by,
                changed_by_email=users.get(version.changed_by),
                changed_by_role=user_roles.get(version.changed_by),
                changed_fields=version.changed_fields or [],
                created_at=version.created_at,
            )
        )

    roadmap_versions = db.query(RoadmapItemVersion).order_by(RoadmapItemVersion.id.desc()).all()
    roadmap_rows: list[AuditRoadmapChangeRowOut] = []
    for version in roadmap_versions:
        roadmap = roadmap_by_id.get(version.roadmap_item_id)
        title = (roadmap.title if roadmap else f"Roadmap #{version.roadmap_item_id}") or ""
        project_context = (roadmap.project_context if roadmap else "") or ""
        roadmap_rows.append(
            AuditRoadmapChangeRowOut(
                event_id=version.id,
                roadmap_item_id=version.roadmap_item_id,
                title=title,
                action=version.action or "",
                project_context=project_context,
                changed_by=version.changed_by,
                changed_by_email=users.get(version.changed_by),
                changed_by_role=user_roles.get(version.changed_by),
                changed_fields=version.changed_fields or [],
                created_at=version.created_at,
            )
        )

    movement_records = db.query(RoadmapMovementRequest).order_by(RoadmapMovementRequest.id.desc()).all()
    movement_rows: list[AuditMovementRowOut] = []
    for movement in movement_records:
        plan = plan_by_id.get(movement.plan_item_id)
        roadmap = roadmap_by_id.get(movement.bucket_item_id)
        title = (plan.title if plan else "") or (roadmap.title if roadmap else "") or f"Roadmap #{movement.bucket_item_id}"
        project_context = (
            (plan.project_context if plan else "")
            or (roadmap.project_context if roadmap else "")
            or ""
        )
        movement_rows.append(
            AuditMovementRowOut(
                request_id=movement.id,
                plan_item_id=movement.plan_item_id,
                bucket_item_id=movement.bucket_item_id,
                title=title,
                status=movement.status or "",
                request_type=movement.request_type or "",
                project_context=project_context,
                from_start_date=movement.from_start_date or "",
                from_end_date=movement.from_end_date or "",
                to_start_date=movement.to_start_date or "",
                to_end_date=movement.to_end_date or "",
                reason=movement.reason or "",
                blocker=movement.blocker or "",
                decision_reason=movement.decision_reason or "",
                requested_by=movement.requested_by,
                requested_by_email=users.get(movement.requested_by),
                requested_by_role=user_roles.get(movement.requested_by),
                decided_by=movement.decided_by,
                decided_by_email=users.get(movement.decided_by),
                decided_by_role=user_roles.get(movement.decided_by),
                requested_at=movement.requested_at,
                decided_at=movement.decided_at,
                executed_at=movement.executed_at,
            )
        )

    return AuditCenterOut(
        generated_at=datetime.utcnow(),
        summary=AuditSummaryOut(
            documents_total=len(document_rows),
            intake_changes_total=len(intake_rows),
            roadmap_changes_total=len(roadmap_rows),
            movement_total=len(movement_rows),
        ),
        documents=document_rows,
        intake_changes=intake_rows,
        roadmap_changes=roadmap_rows,
        movement_events=movement_rows,
    )
