from datetime import datetime

from pydantic import BaseModel


class RoadmapItemOut(BaseModel):
    id: int
    title: str
    scope: str
    activities: list[str]
    priority: str
    project_context: str
    initiative_type: str
    delivery_mode: str
    rnd_hypothesis: str
    rnd_experiment_goal: str
    rnd_success_criteria: str
    rnd_timebox_weeks: int | None
    rnd_decision_date: str
    rnd_next_gate: str
    rnd_risk_level: str
    fe_fte: float | None
    be_fte: float | None
    ai_fte: float | None
    pm_fte: float | None
    accountable_person: str
    picked_up: bool
    source_document_id: int | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class RoadmapItemUpdateIn(BaseModel):
    title: str
    scope: str
    activities: list[str]
    priority: str
    project_context: str
    initiative_type: str
    delivery_mode: str
    rnd_hypothesis: str
    rnd_experiment_goal: str
    rnd_success_criteria: str
    rnd_timebox_weeks: int | None
    rnd_decision_date: str
    rnd_next_gate: str
    rnd_risk_level: str
    fe_fte: float | None
    be_fte: float | None
    ai_fte: float | None
    pm_fte: float | None
    accountable_person: str
    picked_up: bool


class RoadmapMoveIn(BaseModel):
    ids: list[int]
    tentative_duration_weeks: int | None = None
    pickup_period: str = ""
    completion_period: str = ""


class RoadmapMoveOut(BaseModel):
    moved: int


class RoadmapUnlockOut(BaseModel):
    unlocked: bool


class RoadmapPlanOut(BaseModel):
    id: int
    bucket_item_id: int
    title: str
    scope: str
    activities: list[str]
    priority: str
    project_context: str
    initiative_type: str
    delivery_mode: str
    rnd_hypothesis: str
    rnd_experiment_goal: str
    rnd_success_criteria: str
    rnd_timebox_weeks: int | None
    rnd_decision_date: str
    rnd_next_gate: str
    rnd_risk_level: str
    fe_fte: float | None
    be_fte: float | None
    ai_fte: float | None
    pm_fte: float | None
    accountable_person: str
    entered_roadmap_at: datetime
    planned_start_date: str
    planned_end_date: str
    resource_count: int | None
    effort_person_weeks: int | None
    planning_status: str
    confidence: str
    dependency_ids: list[int]
    tentative_duration_weeks: int | None
    pickup_period: str
    completion_period: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RoadmapPlanUpdateIn(BaseModel):
    planned_start_date: str = ""
    planned_end_date: str = ""
    resource_count: int | None = None
    effort_person_weeks: int | None = None
    planning_status: str = "not_started"
    confidence: str = "medium"
    dependency_ids: list[int] = []
    change_reason: str = ""


class CapacityValidateIn(BaseModel):
    project_context: str = "internal"
    tentative_duration_weeks: int = 1
    planned_start_date: str = ""
    planned_end_date: str = ""
    fe_fte: float = 0.0
    be_fte: float = 0.0
    ai_fte: float = 0.0
    pm_fte: float = 0.0
    exclude_bucket_item_id: int | None = None


class CapacityValidateOut(BaseModel):
    status: str
    breach_roles: list[str]
    utilization_percentage: dict[str, str]
    reason: str


class RoadmapGovernanceLockIn(BaseModel):
    roadmap_locked: bool
    note: str = ""


class RoadmapGovernanceLockOut(BaseModel):
    roadmap_locked: bool
    roadmap_locked_at: datetime | None = None
    roadmap_locked_by: int | None = None
    roadmap_lock_note: str = ""


class RoadmapMovementRequestIn(BaseModel):
    proposed_start_date: str
    proposed_end_date: str
    reason: str
    blocker: str = ""


class RoadmapMovementDecisionIn(BaseModel):
    decision: str
    decision_reason: str = ""


class RoadmapMovementCEOIn(BaseModel):
    proposed_start_date: str
    proposed_end_date: str
    reason: str
    blocker: str = ""


class RoadmapMovementRequestOut(BaseModel):
    id: int
    plan_item_id: int
    bucket_item_id: int
    request_type: str
    status: str
    from_start_date: str
    from_end_date: str
    to_start_date: str
    to_end_date: str
    reason: str
    blocker: str
    decision_reason: str
    requested_by: int | None
    decided_by: int | None
    requested_at: datetime
    decided_at: datetime | None = None
    executed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RedundancyMatchOut(BaseModel):
    item_id: int
    title: str
    score: float


class RoadmapRedundancyOut(BaseModel):
    item_id: int
    is_redundant: bool
    best_score: float
    best_match_id: int | None = None
    best_match_title: str = ""
    resolved_by_decision: str = ""
    matches: list[RedundancyMatchOut] = []


class RoadmapRedundancyDecisionIn(BaseModel):
    action: str
    other_item_id: int


class RoadmapRedundancyDecisionOut(BaseModel):
    ok: bool
    action: str
    primary_item_id: int
    other_item_id: int
    message: str = ""
