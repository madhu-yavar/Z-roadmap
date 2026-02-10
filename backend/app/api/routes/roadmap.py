from datetime import datetime
from io import BytesIO
import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from openpyxl import Workbook

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.intake_item import IntakeItem
from app.models.roadmap_plan_item import RoadmapPlanItem
from app.models.roadmap_item import RoadmapItem
from app.models.roadmap_redundancy_decision import RoadmapRedundancyDecision
from app.models.roadmap_item_version import RoadmapItemVersion
from app.models.user import User
from app.schemas.common import BulkDeleteOut, BulkIdsIn
from app.schemas.history import VersionOut
from app.schemas.roadmap import (
    RoadmapItemOut,
    RoadmapItemUpdateIn,
    RoadmapMoveIn,
    RoadmapMoveOut,
    RoadmapPlanOut,
    RoadmapPlanUpdateIn,
    RoadmapRedundancyDecisionIn,
    RoadmapRedundancyDecisionOut,
    RoadmapRedundancyOut,
    RedundancyMatchOut,
    RoadmapUnlockOut,
)
from app.services.versioning import log_roadmap_version

router = APIRouter(prefix="/roadmap", tags=["roadmap"])

SIMILARITY_FLAG_THRESHOLD = 0.62
SIMILARITY_MATCH_THRESHOLD = 0.55

STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "into",
    "your",
    "our",
    "new",
}

GENERIC_TERMS = {
    "project",
    "system",
    "platform",
    "solution",
    "program",
    "initiative",
    "modernization",
    "development",
}


def _snapshot(item: RoadmapItem) -> dict:
    return {
        "title": item.title,
        "scope": item.scope,
        "activities": item.activities,
        "priority": item.priority,
        "project_context": item.project_context,
        "initiative_type": item.initiative_type,
        "delivery_mode": item.delivery_mode,
        "rnd_hypothesis": item.rnd_hypothesis,
        "rnd_experiment_goal": item.rnd_experiment_goal,
        "rnd_success_criteria": item.rnd_success_criteria,
        "rnd_timebox_weeks": item.rnd_timebox_weeks,
        "rnd_decision_date": item.rnd_decision_date,
        "rnd_next_gate": item.rnd_next_gate,
        "rnd_risk_level": item.rnd_risk_level,
        "accountable_person": item.accountable_person,
        "picked_up": item.picked_up,
    }


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return [w for w in words if len(w) > 2 and w not in STOPWORDS and w not in GENERIC_TERMS]


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def _containment(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return max(inter / len(a), inter / len(b))


def _similarity(a: RoadmapItem, b: RoadmapItem) -> float:
    a_title_tokens = _tokens(a.title)
    b_title_tokens = _tokens(b.title)
    title_a = " ".join(a_title_tokens)
    title_b = " ".join(b_title_tokens)
    title_ratio = SequenceMatcher(None, title_a, title_b).ratio() if title_a and title_b else 0.0
    title_jaccard = _jaccard(set(a_title_tokens), set(b_title_tokens))
    title_containment = _containment(set(a_title_tokens), set(b_title_tokens))
    title_score = 0.45 * title_ratio + 0.35 * title_jaccard + 0.20 * title_containment

    a_scope = re.sub(r"\s+", " ", (a.scope or "").lower())[:450]
    b_scope = re.sub(r"\s+", " ", (b.scope or "").lower())[:450]
    scope_score = SequenceMatcher(None, a_scope, b_scope).ratio() if a_scope and b_scope else 0.0

    a_acts = " ".join(_tokens(" ".join((a.activities or [])[:10])))
    b_acts = " ".join(_tokens(" ".join((b.activities or [])[:10])))
    acts_ratio = SequenceMatcher(None, a_acts, b_acts).ratio() if a_acts and b_acts else 0.0
    acts_jaccard = _jaccard(set(a_acts.split()), set(b_acts.split())) if a_acts and b_acts else 0.0
    acts_score = 0.6 * acts_ratio + 0.4 * acts_jaccard

    combined = 0.50 * title_score + 0.25 * scope_score + 0.25 * acts_score
    return max(0.0, min(1.0, combined))


def _pair(a_id: int, b_id: int) -> tuple[int, int]:
    return (a_id, b_id) if a_id < b_id else (b_id, a_id)


def _merge_scope(scope_a: str, scope_b: str) -> str:
    a = (scope_a or "").strip()
    b = (scope_b or "").strip()
    if not a:
        return b
    if not b:
        return a
    low_a, low_b = a.lower(), b.lower()
    if low_b in low_a:
        return a
    if low_a in low_b:
        return b
    return f"{a}\n{b}".strip()


def _quarter_from_plan_item(item: RoadmapPlanItem) -> str:
    if item.planned_start_date:
        try:
            d = datetime.fromisoformat(item.planned_start_date)
            return f"Q{(d.month - 1) // 3 + 1}"
        except Exception:
            pass
    p = f"{item.pickup_period} {item.completion_period}".upper()
    for q in ("Q1", "Q2", "Q3", "Q4"):
        if q in p:
            return q
    return ""


def _month_marks(item: RoadmapPlanItem, year: int) -> list[str]:
    marks = [""] * 12
    if item.planned_start_date and item.planned_end_date:
        try:
            start = datetime.fromisoformat(item.planned_start_date)
            end = datetime.fromisoformat(item.planned_end_date)
            if end < start:
                start, end = end, start
            start_month = 1 if start.year < year else start.month if start.year == year else 13
            end_month = 12 if end.year > year else end.month if end.year == year else 0
            if start_month <= end_month:
                for idx in range(start_month - 1, end_month):
                    marks[idx] = "X"
                return marks
        except Exception:
            pass

    q = _quarter_from_plan_item(item)
    if q == "Q1":
        for idx in range(0, 3):
            marks[idx] = "~"
    elif q == "Q2":
        for idx in range(3, 6):
            marks[idx] = "~"
    elif q == "Q3":
        for idx in range(6, 9):
            marks[idx] = "~"
    elif q == "Q4":
        for idx in range(9, 12):
            marks[idx] = "~"
    return marks


@router.get("/items", response_model=list[RoadmapItemOut])
def list_roadmap_items(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(RoadmapItem).order_by(RoadmapItem.id.desc()).all()


@router.get("/items/redundancy", response_model=list[RoadmapRedundancyOut])
def list_roadmap_redundancy(db: Session = Depends(get_db), _=Depends(get_current_user)):
    items = db.query(RoadmapItem).order_by(RoadmapItem.id.desc()).all()
    decisions = db.query(RoadmapRedundancyDecision).all()
    decision_map = {
        (d.left_item_id, d.right_item_id): d.decision
        for d in decisions
    }
    output: list[RoadmapRedundancyOut] = []
    for item in items:
        matches: list[RedundancyMatchOut] = []
        resolved_by = ""
        for other in items:
            if other.id == item.id:
                continue
            score = round(_similarity(item, other), 3)
            pair = _pair(item.id, other.id)
            decision = decision_map.get(pair, "")
            if decision in {"keep_both", "intentional_overlap"}:
                if score >= SIMILARITY_MATCH_THRESHOLD and not resolved_by:
                    resolved_by = decision
                continue
            if score >= SIMILARITY_MATCH_THRESHOLD:
                matches.append(
                    RedundancyMatchOut(item_id=other.id, title=other.title, score=score)
                )
        matches = sorted(matches, key=lambda x: x.score, reverse=True)[:3]
        best = matches[0] if matches else None
        output.append(
            RoadmapRedundancyOut(
                item_id=item.id,
                is_redundant=bool(best and best.score >= SIMILARITY_FLAG_THRESHOLD),
                best_score=best.score if best else 0.0,
                best_match_id=best.item_id if best else None,
                best_match_title=best.title if best else "",
                resolved_by_decision=resolved_by,
                matches=matches,
            )
        )
    return output


@router.post("/items/{item_id}/redundancy-decision", response_model=RoadmapRedundancyDecisionOut)
def apply_redundancy_decision(
    item_id: int,
    payload: RoadmapRedundancyDecisionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP)),
):
    primary = db.get(RoadmapItem, item_id)
    if not primary:
        raise HTTPException(status_code=404, detail="Primary roadmap item not found")

    other = db.get(RoadmapItem, payload.other_item_id)
    if not other:
        raise HTTPException(status_code=404, detail="Other roadmap item not found")
    if other.id == primary.id:
        raise HTTPException(status_code=400, detail="Cannot apply redundancy decision on same item")

    action = (payload.action or "").strip().lower()
    if action not in {"merge", "keep_both", "intentional_overlap"}:
        raise HTTPException(status_code=400, detail="Unsupported action")

    left_id, right_id = _pair(primary.id, other.id)
    decision = (
        db.query(RoadmapRedundancyDecision)
        .filter(
            RoadmapRedundancyDecision.left_item_id == left_id,
            RoadmapRedundancyDecision.right_item_id == right_id,
        )
        .first()
    )
    if not decision:
        decision = RoadmapRedundancyDecision(
            left_item_id=left_id,
            right_item_id=right_id,
        )
    decision.decision = action
    decision.decided_by = current_user.id
    db.add(decision)

    if action in {"keep_both", "intentional_overlap"}:
        db.commit()
        return RoadmapRedundancyDecisionOut(
            ok=True,
            action=action,
            primary_item_id=primary.id,
            other_item_id=other.id,
            message="Decision saved. Pair will be treated as resolved.",
        )

    # action == merge
    primary_before = _snapshot(primary)
    other_before = _snapshot(other)

    merged_scope = _merge_scope(primary.scope, other.scope)
    merged_activities: list[str] = []
    seen = set()
    for act in (primary.activities or []) + (other.activities or []):
        clean = (act or "").strip()
        if not clean:
            continue
        key = clean.lower()
        if key in seen:
            continue
        seen.add(key)
        merged_activities.append(clean)
        if len(merged_activities) >= 20:
            break

    primary.scope = merged_scope
    primary.activities = merged_activities
    if not primary.accountable_person and other.accountable_person:
        primary.accountable_person = other.accountable_person
    primary.picked_up = primary.picked_up or other.picked_up
    if not primary.source_document_id and other.source_document_id:
        primary.source_document_id = other.source_document_id
    db.add(primary)

    other_plan = db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id == other.id).first()
    primary_plan = db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id == primary.id).first()
    if other_plan and not primary_plan:
        other_plan.bucket_item_id = primary.id
        other_plan.title = primary.title
        other_plan.scope = primary.scope
        other_plan.activities = primary.activities
        other_plan.priority = primary.priority
        other_plan.project_context = primary.project_context
        other_plan.initiative_type = primary.initiative_type
        other_plan.delivery_mode = primary.delivery_mode
        other_plan.accountable_person = primary.accountable_person
        db.add(other_plan)
    elif other_plan and primary_plan:
        db.delete(other_plan)

    db.query(IntakeItem).filter(IntakeItem.roadmap_item_id == other.id).update(
        {"roadmap_item_id": primary.id},
        synchronize_session=False,
    )
    db.query(RoadmapItemVersion).filter(RoadmapItemVersion.roadmap_item_id == other.id).delete(
        synchronize_session=False
    )
    db.delete(other)

    db.flush()

    log_roadmap_version(
        db=db,
        roadmap_item_id=primary.id,
        action="merged_duplicate",
        changed_by=current_user.id,
        before_data=primary_before,
        after_data=_snapshot(primary),
    )
    # trace for the removed record as well (if needed for audit trail)
    log_roadmap_version(
        db=db,
        roadmap_item_id=primary.id,
        action=f"merged_from_item_{other.id}",
        changed_by=current_user.id,
        before_data=other_before,
        after_data={},
    )

    db.commit()
    return RoadmapRedundancyDecisionOut(
        ok=True,
        action=action,
        primary_item_id=primary.id,
        other_item_id=other.id,
        message="Items merged. Duplicate was removed and references were reassigned.",
    )


@router.get("/plan/items", response_model=list[RoadmapPlanOut])
def list_roadmap_plan_items(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(RoadmapPlanItem).order_by(RoadmapPlanItem.id.desc()).all()


@router.get("/plan/export")
def export_roadmap_plan_excel(
    year: int = Query(default=datetime.utcnow().year, ge=2020, le=2100),
    priority: str = Query(default="all"),
    context: str = Query(default="all"),
    mode: str = Query(default="all"),
    period: str = Query(default="all"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    items = db.query(RoadmapPlanItem).order_by(RoadmapPlanItem.title.asc()).all()

    def _ok(item: RoadmapPlanItem) -> bool:
        p_ok = priority == "all" or (item.priority or "").lower() == priority.lower()
        c_ok = context == "all" or (item.project_context or "").lower() == context.lower()
        m_ok = mode == "all" or (item.delivery_mode or "").lower() == mode.lower()
        q = _quarter_from_plan_item(item)
        pr_ok = period == "all" or q == period.upper()
        return p_ok and c_ok and m_ok and pr_ok

    filtered = [x for x in items if _ok(x)]

    wb = Workbook()
    ws = wb.active
    ws.title = "Roadmap Gantt"

    headers = [
        "Plan ID",
        "Title",
        "Priority",
        "Context",
        "Mode",
        "Owner",
        "Status",
        "Confidence",
        "Planned Start",
        "Planned End",
        "Pickup Period",
        "Completion Period",
        "Resources",
        "Effort (PW)",
        "Dependencies",
        "Entered Roadmap At",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]
    ws.append(headers)

    for item in filtered:
        marks = _month_marks(item, year)
        ws.append(
            [
                item.id,
                item.title,
                item.priority,
                item.project_context,
                item.delivery_mode,
                item.accountable_person,
                item.planning_status,
                item.confidence,
                item.planned_start_date,
                item.planned_end_date,
                item.pickup_period,
                item.completion_period,
                item.resource_count,
                item.effort_person_weeks,
                ", ".join(str(x) for x in (item.dependency_ids or [])),
                item.entered_roadmap_at.isoformat() if item.entered_roadmap_at else "",
                *marks,
            ]
        )

    widths = {
        "A": 10,
        "B": 44,
        "C": 10,
        "D": 12,
        "E": 10,
        "F": 20,
        "G": 12,
        "H": 12,
        "I": 14,
        "J": 14,
        "K": 14,
        "L": 16,
        "M": 10,
        "N": 12,
        "O": 18,
        "P": 22,
    }
    for col, width in widths.items():
        ws.column_dimensions[col].width = width
    for col in ["Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB"]:
        ws.column_dimensions[col].width = 7

    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    filename = f"roadmap_gantt_{year}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/plan/items/{item_id}", response_model=RoadmapPlanOut)
def update_roadmap_plan_item(
    item_id: int,
    payload: RoadmapPlanUpdateIn,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    item = db.get(RoadmapPlanItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap plan item not found")

    item.planned_start_date = payload.planned_start_date.strip()
    item.planned_end_date = payload.planned_end_date.strip()
    item.resource_count = payload.resource_count
    item.effort_person_weeks = payload.effort_person_weeks
    item.planning_status = payload.planning_status.strip().lower()
    item.confidence = payload.confidence.strip().lower()
    item.dependency_ids = sorted(set(payload.dependency_ids))

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=RoadmapItemOut)
def update_roadmap_item(
    item_id: int,
    payload: RoadmapItemUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    item = db.get(RoadmapItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    locked_plan = db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id == item.id).first()
    if locked_plan:
        raise HTTPException(
            status_code=409,
            detail="This commitment is locked after roadmap commitment. Unlock it before editing.",
        )

    before_data = _snapshot(item)
    item.title = payload.title.strip()
    item.scope = payload.scope.strip()
    item.activities = [x.strip() for x in payload.activities if x.strip()]
    item.priority = payload.priority.strip().lower()
    item.project_context = payload.project_context.strip().lower()
    item.initiative_type = payload.initiative_type.strip().lower()
    item.delivery_mode = payload.delivery_mode.strip().lower()
    item.rnd_hypothesis = payload.rnd_hypothesis.strip()
    item.rnd_experiment_goal = payload.rnd_experiment_goal.strip()
    item.rnd_success_criteria = payload.rnd_success_criteria.strip()
    item.rnd_timebox_weeks = payload.rnd_timebox_weeks
    item.rnd_decision_date = payload.rnd_decision_date.strip()
    item.rnd_next_gate = payload.rnd_next_gate.strip().lower()
    item.rnd_risk_level = payload.rnd_risk_level.strip().lower()
    item.accountable_person = payload.accountable_person.strip()
    item.picked_up = payload.picked_up

    db.add(item)
    db.flush()

    log_roadmap_version(
        db=db,
        roadmap_item_id=item.id,
        action="manual_update",
        changed_by=current_user.id,
        before_data=before_data,
        after_data=_snapshot(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.post("/items/{item_id}/unlock", response_model=RoadmapUnlockOut)
def unlock_roadmap_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP)),
):
    item = db.get(RoadmapItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    locked_plan = db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id == item.id).first()
    if not locked_plan:
        return RoadmapUnlockOut(unlocked=False)

    before_data = _snapshot(item)
    db.delete(locked_plan)
    item.picked_up = False
    db.add(item)
    db.flush()

    log_roadmap_version(
        db=db,
        roadmap_item_id=item.id,
        action="unlock_for_edit",
        changed_by=current_user.id,
        before_data=before_data,
        after_data=_snapshot(item),
    )

    db.commit()
    return RoadmapUnlockOut(unlocked=True)


@router.get("/items/{item_id}/history", response_model=list[VersionOut])
def roadmap_history(
    item_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    versions = (
        db.query(RoadmapItemVersion)
        .filter(RoadmapItemVersion.roadmap_item_id == item_id)
        .order_by(RoadmapItemVersion.id.desc())
        .all()
    )
    users = {u.id: u.email for u in db.query(User).all()}

    return [
        VersionOut(
            id=v.id,
            action=v.action,
            changed_by=v.changed_by,
            changed_by_email=users.get(v.changed_by),
            changed_fields=v.changed_fields,
            before_data=v.before_data,
            after_data=v.after_data,
            created_at=v.created_at,
        )
        for v in versions
    ]


@router.post("/items/bulk-delete", response_model=BulkDeleteOut)
def bulk_delete_roadmap_items(
    payload: BulkIdsIn,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO)),
):
    ids = sorted(set(payload.ids))
    if not ids:
        return BulkDeleteOut(deleted=0)

    db.query(IntakeItem).filter(IntakeItem.roadmap_item_id.in_(ids)).update(
        {"roadmap_item_id": None, "status": "draft"},
        synchronize_session=False,
    )
    db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id.in_(ids)).delete(
        synchronize_session=False
    )
    db.query(RoadmapItemVersion).filter(RoadmapItemVersion.roadmap_item_id.in_(ids)).delete(
        synchronize_session=False
    )
    deleted = db.query(RoadmapItem).filter(RoadmapItem.id.in_(ids)).delete(synchronize_session=False) or 0
    db.commit()
    return BulkDeleteOut(deleted=deleted)


@router.post("/plan/move", response_model=RoadmapMoveOut)
def move_bucket_items_to_roadmap(
    payload: RoadmapMoveIn,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP)),
):
    ids = sorted(set(payload.ids))
    if not ids:
        return RoadmapMoveOut(moved=0)

    bucket_items = db.query(RoadmapItem).filter(RoadmapItem.id.in_(ids)).all()
    moved = 0
    for bucket in bucket_items:
        if not bucket.picked_up:
            continue
        existing = db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id == bucket.id).first()
        if existing:
            existing.title = bucket.title
            existing.scope = bucket.scope
            existing.activities = bucket.activities
            existing.priority = bucket.priority
            existing.project_context = bucket.project_context
            existing.initiative_type = bucket.initiative_type
            existing.delivery_mode = bucket.delivery_mode
            existing.rnd_hypothesis = bucket.rnd_hypothesis
            existing.rnd_experiment_goal = bucket.rnd_experiment_goal
            existing.rnd_success_criteria = bucket.rnd_success_criteria
            existing.rnd_timebox_weeks = bucket.rnd_timebox_weeks
            existing.rnd_decision_date = bucket.rnd_decision_date
            existing.rnd_next_gate = bucket.rnd_next_gate
            existing.rnd_risk_level = bucket.rnd_risk_level
            existing.accountable_person = bucket.accountable_person
            existing.tentative_duration_weeks = payload.tentative_duration_weeks
            existing.pickup_period = payload.pickup_period.strip()
            existing.completion_period = payload.completion_period.strip()
            db.add(existing)
            moved += 1
            continue

        plan = RoadmapPlanItem(
            bucket_item_id=bucket.id,
            title=bucket.title,
            scope=bucket.scope,
            activities=bucket.activities,
            priority=bucket.priority,
            project_context=bucket.project_context,
            initiative_type=bucket.initiative_type,
            delivery_mode=bucket.delivery_mode,
            rnd_hypothesis=bucket.rnd_hypothesis,
            rnd_experiment_goal=bucket.rnd_experiment_goal,
            rnd_success_criteria=bucket.rnd_success_criteria,
            rnd_timebox_weeks=bucket.rnd_timebox_weeks,
            rnd_decision_date=bucket.rnd_decision_date,
            rnd_next_gate=bucket.rnd_next_gate,
            rnd_risk_level=bucket.rnd_risk_level,
            accountable_person=bucket.accountable_person,
            tentative_duration_weeks=payload.tentative_duration_weeks,
            pickup_period=payload.pickup_period.strip(),
            completion_period=payload.completion_period.strip(),
        )
        db.add(plan)
        moved += 1

    db.commit()
    return RoadmapMoveOut(moved=moved)
