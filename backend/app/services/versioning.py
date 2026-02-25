from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.intake_item_version import IntakeItemVersion
from app.models.roadmap_item_version import RoadmapItemVersion


TRACKED_KEYS = [
    "document_class",
    "title",
    "scope",
    "activities",
    "priority",
    "project_context",
    "initiative_type",
    "delivery_mode",
    "rnd_hypothesis",
    "rnd_experiment_goal",
    "rnd_success_criteria",
    "rnd_timebox_weeks",
    "rnd_decision_date",
    "rnd_next_gate",
    "rnd_risk_level",
    "status",
    "roadmap_item_id",
]
ROADMAP_KEYS = [
    "title",
    "scope",
    "activities",
    "priority",
    "project_context",
    "initiative_type",
    "delivery_mode",
    "rnd_hypothesis",
    "rnd_experiment_goal",
    "rnd_success_criteria",
    "rnd_timebox_weeks",
    "rnd_decision_date",
    "rnd_next_gate",
    "rnd_risk_level",
    "fe_fte",
    "be_fte",
    "ai_fte",
    "pm_fte",
    "fs_fte",
    "accountable_person",
    "picked_up",
]


def _diff_keys(before: dict, after: dict, keys: Iterable[str]) -> list[str]:
    changed: list[str] = []
    for key in keys:
        if before.get(key) != after.get(key):
            changed.append(key)
    return changed


def log_intake_version(
    db: Session,
    intake_item_id: int,
    action: str,
    changed_by: int | None,
    before_data: dict,
    after_data: dict,
) -> None:
    changed_fields = _diff_keys(before_data, after_data, TRACKED_KEYS)
    version = IntakeItemVersion(
        intake_item_id=intake_item_id,
        action=action,
        changed_by=changed_by,
        changed_fields=changed_fields,
        before_data=before_data,
        after_data=after_data,
    )
    db.add(version)


def log_roadmap_version(
    db: Session,
    roadmap_item_id: int,
    action: str,
    changed_by: int | None,
    before_data: dict,
    after_data: dict,
) -> None:
    changed_fields = _diff_keys(before_data, after_data, ROADMAP_KEYS)
    version = RoadmapItemVersion(
        roadmap_item_id=roadmap_item_id,
        action=action,
        changed_by=changed_by,
        changed_fields=changed_fields,
        before_data=before_data,
        after_data=after_data,
    )
    db.add(version)
