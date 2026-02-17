from pydantic import BaseModel


class DashboardOut(BaseModel):
    intake_total: int
    intake_understanding_pending: int
    intake_draft: int
    commitments_total: int
    commitments_ready: int
    commitments_locked: int
    roadmap_total: int
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
