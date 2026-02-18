from datetime import datetime

from pydantic import BaseModel


class AuditSummaryOut(BaseModel):
    documents_total: int
    intake_changes_total: int
    roadmap_changes_total: int
    movement_total: int


class AuditDocumentRowOut(BaseModel):
    document_id: int
    file_name: str
    file_type: str
    file_hash: str
    notes: str
    uploaded_by: int
    uploaded_by_email: str | None = None
    uploaded_by_role: str | None = None
    created_at: datetime
    intake_item_id: int | None = None
    intake_status: str = ""
    roadmap_item_id: int | None = None
    roadmap_plan_item_id: int | None = None
    roadmap_planning_status: str = ""
    project_context: str = ""


class AuditIntakeChangeRowOut(BaseModel):
    event_id: int
    intake_item_id: int
    document_id: int | None = None
    title: str
    action: str
    status: str
    project_context: str
    changed_by: int | None = None
    changed_by_email: str | None = None
    changed_by_role: str | None = None
    changed_fields: list[str]
    created_at: datetime


class AuditRoadmapChangeRowOut(BaseModel):
    event_id: int
    roadmap_item_id: int
    title: str
    action: str
    project_context: str
    changed_by: int | None = None
    changed_by_email: str | None = None
    changed_by_role: str | None = None
    changed_fields: list[str]
    created_at: datetime


class AuditMovementRowOut(BaseModel):
    request_id: int
    plan_item_id: int
    bucket_item_id: int
    title: str
    status: str
    request_type: str
    project_context: str
    from_start_date: str
    from_end_date: str
    to_start_date: str
    to_end_date: str
    reason: str
    blocker: str
    decision_reason: str
    requested_by: int | None = None
    requested_by_email: str | None = None
    requested_by_role: str | None = None
    decided_by: int | None = None
    decided_by_email: str | None = None
    decided_by_role: str | None = None
    requested_at: datetime
    decided_at: datetime | None = None
    executed_at: datetime | None = None


class AuditCenterOut(BaseModel):
    generated_at: datetime
    summary: AuditSummaryOut
    documents: list[AuditDocumentRowOut]
    intake_changes: list[AuditIntakeChangeRowOut]
    roadmap_changes: list[AuditRoadmapChangeRowOut]
    movement_events: list[AuditMovementRowOut]
