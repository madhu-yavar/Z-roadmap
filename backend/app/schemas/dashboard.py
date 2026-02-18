from pydantic import BaseModel


class CapacityRoleAlertOut(BaseModel):
    role: str
    status: str
    portfolio: str
    peak_week: str
    peak_demand_fte: float
    capacity_fte: float
    required_extra_fte: float
    peak_utilization_pct: float | None = None


class CapacityGovernanceAlertOut(BaseModel):
    status: str
    message: str
    shortage_roles: list[str]
    warning_roles: list[str]
    unscheduled_demand_items: int
    role_alerts: list[CapacityRoleAlertOut]


class DashboardOut(BaseModel):
    intake_total: int
    intake_understanding_pending: int
    intake_draft: int
    rnd_intake_total: int
    ai_intake_total: int
    commitments_total: int
    commitments_ready: int
    commitments_locked: int
    rnd_commitments_total: int
    ai_commitments_total: int
    roadmap_total: int
    rnd_roadmap_total: int
    ai_roadmap_total: int
    roadmap_movement_pending: int
    roadmap_movement_approved: int
    roadmap_movement_rejected: int
    roadmap_movement_total: int
    intake_by_context: dict[str, int]
    commitments_by_context: dict[str, int]
    roadmap_by_context: dict[str, int]
    intake_by_mode: dict[str, int]
    commitments_by_mode: dict[str, int]
    roadmap_by_mode: dict[str, int]
    commitments_by_priority: dict[str, int]
    roadmap_by_priority: dict[str, int]
    capacity_governance_alert: CapacityGovernanceAlertOut
