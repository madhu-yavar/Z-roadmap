from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.deps import require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.document import Document
from app.models.enums import UserRole
from app.models.intake_analysis import IntakeAnalysis
from app.models.intake_item import IntakeItem
from app.models.intake_item_version import IntakeItemVersion
from app.models.llm_config import LLMConfig
from app.models.roadmap_item import RoadmapItem
from app.models.roadmap_plan_item import RoadmapPlanItem
from app.models.roadmap_item_version import RoadmapItemVersion
from app.models.user import User
from app.schemas.common import BulkDeleteOut, BulkIdsIn
from app.schemas.history import VersionOut
from app.schemas.intake_analysis import IntakeAnalysisOut
from app.schemas.intake import IntakeAnalyzeIn, IntakeAnalyzeOut, IntakeManualIn, IntakeOut, IntakeReviewIn
from app.services.intake_agent import generate_intake_analysis_v2, generate_roadmap_candidate_from_document
from app.services.versioning import log_intake_version, log_roadmap_version

router = APIRouter(prefix="/intake", tags=["intake"])


def _snapshot_intake(item: IntakeItem) -> dict:
    return {
        "document_class": item.document_class,
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
        "status": item.status,
        "roadmap_item_id": item.roadmap_item_id,
    }


def _snapshot_roadmap(item: RoadmapItem) -> dict:
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


def _with_vertex_fallback(
    db: Session,
    active_llm: LLMConfig | None,
    runner,
) -> tuple[dict, dict]:
    primary_output, primary_result = runner(active_llm)
    runtime = (primary_output or {}).get("llm_runtime") or {}
    if runtime.get("success") or (active_llm and active_llm.provider == "vertex_gemini"):
        return primary_output, primary_result

    active_id = active_llm.id if active_llm else None
    fallback_query = db.query(LLMConfig).filter(LLMConfig.provider == "vertex_gemini")
    if active_id:
        fallback_query = fallback_query.filter(LLMConfig.id != active_id)
    fallback_llm = fallback_query.order_by(desc(LLMConfig.id)).first()
    if not fallback_llm:
        return primary_output, primary_result

    fallback_output, fallback_result = runner(fallback_llm)
    fb_runtime = (fallback_output or {}).get("llm_runtime") or {}
    if fb_runtime.get("success"):
        fb_runtime["fallback_from"] = {
            "provider": runtime.get("provider", ""),
            "model": runtime.get("model", ""),
            "error": runtime.get("error", ""),
        }
        fallback_output["llm_runtime"] = fb_runtime
        return fallback_output, fallback_result

    runtime["fallback_attempted"] = {
        "provider": fallback_llm.provider,
        "model": fallback_llm.model,
        "success": False,
        "error": fb_runtime.get("error", ""),
    }
    primary_output["llm_runtime"] = runtime
    return primary_output, primary_result


def _intent_unclear(analysis_output: dict | None) -> bool:
    understanding = ((analysis_output or {}).get("document_understanding_check") or {})
    return understanding.get("Primary intent (1 sentence)") == "Document intent is unclear."


@router.post("/analyze/{document_id}", response_model=IntakeAnalyzeOut)
def analyze_document(
    document_id: int,
    payload: IntakeAnalyzeIn | None = None,
    force: bool = Query(False, description="Force reprocessing even if analysis exists"),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    active_llm = db.query(LLMConfig).filter(LLMConfig.is_active.is_(True)).first()
    def _run(config: LLMConfig | None):
        return generate_intake_analysis_v2(
            file_path=document.file_path,
            file_type=document.file_type,
            file_name=document.file_name,
            provider=config.provider if config else "",
            model=config.model if config else "",
            api_key=config.api_key if config else "",
            base_url=config.base_url if config else "",
        )

    analysis_output, result = _with_vertex_fallback(db=db, active_llm=active_llm, runner=_run)
    runtime = (analysis_output or {}).get("llm_runtime") or {}

    # Quality fallback: if analysis succeeded but intent is still unclear, try latest saved Vertex config.
    if _intent_unclear(analysis_output) and (not active_llm or active_llm.provider != "vertex_gemini"):
        active_id = active_llm.id if active_llm else None
        fallback_query = db.query(LLMConfig).filter(LLMConfig.provider == "vertex_gemini")
        if active_id:
            fallback_query = fallback_query.filter(LLMConfig.id != active_id)
        vertex_llm = fallback_query.order_by(desc(LLMConfig.id)).first()
        if vertex_llm:
            vertex_output, vertex_result = _run(vertex_llm)
            vertex_runtime = (vertex_output or {}).get("llm_runtime") or {}
            if not _intent_unclear(vertex_output):
                vertex_runtime["quality_fallback_from"] = {
                    "provider": runtime.get("provider", ""),
                    "model": runtime.get("model", ""),
                    "error": runtime.get("error", ""),
                }
                vertex_output["llm_runtime"] = vertex_runtime
                analysis_output, result = vertex_output, vertex_result
            else:
                runtime["quality_fallback_attempted"] = {
                    "provider": vertex_llm.provider,
                    "model": vertex_llm.model,
                    "success": False,
                    "error": vertex_runtime.get("error", ""),
                }
                analysis_output["llm_runtime"] = runtime

    # Trace each run so UI can confirm reprocessing happened.
    analysis_output["analysis_run"] = {
        "run_at": datetime.utcnow().isoformat(),
        "run_id": uuid4().hex[:12],
        "forced": bool(force),
    }

    item = db.query(IntakeItem).filter(IntakeItem.document_id == document.id).first()
    if not item:
        item = IntakeItem(document_id=document.id)
        before_data = {}
    else:
        before_data = _snapshot_intake(item)

    item.document_class = result["document_class"]
    item.title = result["title"]
    item.scope = result["scope"]
    item.activities = result["activities"]
    item.source_quotes = result["source_quotes"]
    if payload:
        item.priority = (payload.priority or "medium").strip().lower()
        item.project_context = (payload.project_context or "client").strip().lower()
        item.initiative_type = (payload.initiative_type or "new_feature").strip().lower()
        item.delivery_mode = (payload.delivery_mode or "standard").strip().lower()
        item.rnd_hypothesis = (payload.rnd_hypothesis or "").strip()
        item.rnd_experiment_goal = (payload.rnd_experiment_goal or "").strip()
        item.rnd_success_criteria = (payload.rnd_success_criteria or "").strip()
        item.rnd_timebox_weeks = payload.rnd_timebox_weeks
        item.rnd_decision_date = (payload.rnd_decision_date or "").strip()
        item.rnd_next_gate = (payload.rnd_next_gate or "").strip().lower()
        item.rnd_risk_level = (payload.rnd_risk_level or "").strip().lower()
    item.status = "understanding_pending"

    db.add(item)
    db.flush()

    analysis = db.query(IntakeAnalysis).filter(IntakeAnalysis.intake_item_id == item.id).first()
    if not analysis:
        analysis = IntakeAnalysis(intake_item_id=item.id)
    analysis.primary_type = result["primary_type"]
    analysis.confidence = result["confidence"]
    analysis.output_json = analysis_output
    db.add(analysis)

    log_intake_version(
        db=db,
        intake_item_id=item.id,
        action="agent_analyze",
        changed_by=None,
        before_data=before_data,
        after_data=_snapshot_intake(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.post("/manual-create", response_model=IntakeOut)
def manual_create_intake_item(
    payload: IntakeManualIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    storage_dir = Path(settings.FILE_STORAGE_PATH)
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"manual-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}.txt"
    file_path = storage_dir / file_name
    manual_text = "\n".join(
        [
            f"Title: {payload.title.strip()}",
            f"Scope: {payload.scope.strip()}",
            f"Delivery Mode: {payload.delivery_mode.strip().lower()}",
            f"R&D Hypothesis: {payload.rnd_hypothesis.strip()}",
            f"R&D Experiment Goal: {payload.rnd_experiment_goal.strip()}",
            f"R&D Success Criteria: {payload.rnd_success_criteria.strip()}",
            f"R&D Timebox (weeks): {payload.rnd_timebox_weeks if payload.rnd_timebox_weeks is not None else ''}",
            f"R&D Decision Date: {payload.rnd_decision_date.strip()}",
            f"R&D Next Gate: {payload.rnd_next_gate.strip().lower()}",
            f"R&D Risk Level: {payload.rnd_risk_level.strip().lower()}",
            "Activities:",
            *[f"- {x.strip()}" for x in payload.activities if x.strip()],
        ]
    )
    file_path.write_text(manual_text, encoding="utf-8")

    doc = Document(
        project_id=None,
        uploaded_by=current_user.id,
        file_name=file_name,
        file_type="manual",
        file_path=str(file_path),
        notes="manual intake entry",
    )
    db.add(doc)
    db.flush()

    item = IntakeItem(
        document_id=doc.id,
        document_class="manual",
        title=payload.title.strip(),
        scope=payload.scope.strip(),
        activities=[x.strip() for x in payload.activities if x.strip()],
        source_quotes=[],
        priority=payload.priority.strip().lower(),
        project_context=payload.project_context.strip().lower(),
        initiative_type=payload.initiative_type.strip().lower(),
        delivery_mode=payload.delivery_mode.strip().lower(),
        rnd_hypothesis=payload.rnd_hypothesis.strip(),
        rnd_experiment_goal=payload.rnd_experiment_goal.strip(),
        rnd_success_criteria=payload.rnd_success_criteria.strip(),
        rnd_timebox_weeks=payload.rnd_timebox_weeks,
        rnd_decision_date=payload.rnd_decision_date.strip(),
        rnd_next_gate=payload.rnd_next_gate.strip().lower(),
        rnd_risk_level=payload.rnd_risk_level.strip().lower(),
        status="draft",
        reviewed_by=current_user.id,
    )
    db.add(item)
    db.flush()

    log_intake_version(
        db=db,
        intake_item_id=item.id,
        action="manual_create",
        changed_by=current_user.id,
        before_data={},
        after_data=_snapshot_intake(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.post("/items/{item_id}/approve-understanding", response_model=IntakeAnalyzeOut)
def approve_understanding_and_generate_candidate(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    item = db.get(IntakeItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Intake item not found")

    document = db.get(Document, item.document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    analysis = db.query(IntakeAnalysis).filter(IntakeAnalysis.intake_item_id == item.id).first()
    if not analysis:
        raise HTTPException(status_code=400, detail="Run document understanding first")

    understanding = (analysis.output_json or {}).get("document_understanding_check") or {}
    if understanding.get("Primary intent (1 sentence)") == "Document intent is unclear.":
        raise HTTPException(status_code=400, detail="Document intent is unclear.")

    active_llm = db.query(LLMConfig).filter(LLMConfig.is_active.is_(True)).first()
    def _run_candidate(config: LLMConfig | None):
        return generate_roadmap_candidate_from_document(
            file_path=document.file_path,
            file_type=document.file_type,
            file_name=document.file_name,
            understanding_check=understanding,
            provider=config.provider if config else "",
            model=config.model if config else "",
            api_key=config.api_key if config else "",
            base_url=config.base_url if config else "",
        )

    candidate_json, result = _with_vertex_fallback(db=db, active_llm=active_llm, runner=_run_candidate)

    before_data = _snapshot_intake(item)
    item.document_class = result["document_class"]
    item.title = result["title"]
    item.scope = result["scope"]
    item.activities = result["activities"]
    item.source_quotes = result["source_quotes"]
    item.status = "draft"
    db.add(item)
    db.flush()

    merged = dict(analysis.output_json or {})
    merged["roadmap_candidate"] = candidate_json["roadmap_candidate"]
    analysis.output_json = merged
    analysis.primary_type = result["primary_type"]
    analysis.confidence = result["confidence"]
    db.add(analysis)

    log_intake_version(
        db=db,
        intake_item_id=item.id,
        action="understanding_approved",
        changed_by=current_user.id,
        before_data=before_data,
        after_data=_snapshot_intake(item),
    )

    db.commit()
    db.refresh(item)
    return item


@router.get("/items/{item_id}/analysis", response_model=IntakeAnalysisOut)
def intake_analysis(
    item_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    analysis = db.query(IntakeAnalysis).filter(IntakeAnalysis.intake_item_id == item_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found for intake item")
    return analysis


@router.get("/items", response_model=list[IntakeOut])
def list_intake_items(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    return (
        db.query(IntakeItem)
        .filter(IntakeItem.status != "approved")
        .order_by(IntakeItem.id.desc())
        .all()
    )


@router.get("/items/{item_id}/history", response_model=list[VersionOut])
def intake_history(
    item_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    versions = (
        db.query(IntakeItemVersion)
        .filter(IntakeItemVersion.intake_item_id == item_id)
        .order_by(IntakeItemVersion.id.desc())
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


@router.patch("/items/{item_id}", response_model=IntakeOut)
def review_intake_item(
    item_id: int,
    payload: IntakeReviewIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    item = db.get(IntakeItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Intake item not found")

    before_data = _snapshot_intake(item)

    item.title = payload.title.strip()
    item.scope = payload.scope.strip()
    item.activities = [x.strip() for x in payload.activities if x.strip()]
    item.status = payload.status
    item.reviewed_by = current_user.id

    roadmap_action: str | None = None
    roadmap_before: dict = {}
    roadmap_after: dict = {}

    if payload.status == "approved":
        if not item.roadmap_item_id:
            roadmap_item = RoadmapItem(
                title=item.title,
                scope=item.scope,
                activities=item.activities,
                priority=item.priority,
                project_context=item.project_context,
                initiative_type=item.initiative_type,
                delivery_mode=item.delivery_mode,
                rnd_hypothesis=item.rnd_hypothesis,
                rnd_experiment_goal=item.rnd_experiment_goal,
                rnd_success_criteria=item.rnd_success_criteria,
                rnd_timebox_weeks=item.rnd_timebox_weeks,
                rnd_decision_date=item.rnd_decision_date,
                rnd_next_gate=item.rnd_next_gate,
                rnd_risk_level=item.rnd_risk_level,
                source_document_id=item.document_id,
                created_from_intake_id=item.id,
            )
            db.add(roadmap_item)
            db.flush()
            item.roadmap_item_id = roadmap_item.id
            roadmap_action = "created_from_intake"
            roadmap_after = _snapshot_roadmap(roadmap_item)
        else:
            roadmap_item = db.get(RoadmapItem, item.roadmap_item_id)
            if roadmap_item:
                roadmap_before = _snapshot_roadmap(roadmap_item)
                roadmap_item.title = item.title
                roadmap_item.scope = item.scope
                roadmap_item.activities = item.activities
                roadmap_item.priority = item.priority
                roadmap_item.project_context = item.project_context
                roadmap_item.initiative_type = item.initiative_type
                roadmap_item.delivery_mode = item.delivery_mode
                roadmap_item.rnd_hypothesis = item.rnd_hypothesis
                roadmap_item.rnd_experiment_goal = item.rnd_experiment_goal
                roadmap_item.rnd_success_criteria = item.rnd_success_criteria
                roadmap_item.rnd_timebox_weeks = item.rnd_timebox_weeks
                roadmap_item.rnd_decision_date = item.rnd_decision_date
                roadmap_item.rnd_next_gate = item.rnd_next_gate
                roadmap_item.rnd_risk_level = item.rnd_risk_level
                roadmap_action = "updated_from_intake"
                roadmap_after = _snapshot_roadmap(roadmap_item)
                db.add(roadmap_item)

    db.add(item)
    db.flush()

    log_intake_version(
        db=db,
        intake_item_id=item.id,
        action="manual_review" if payload.status != "approved" else "approved",
        changed_by=current_user.id,
        before_data=before_data,
        after_data=_snapshot_intake(item),
    )

    if roadmap_action and item.roadmap_item_id:
        log_roadmap_version(
            db=db,
            roadmap_item_id=item.roadmap_item_id,
            action=roadmap_action,
            changed_by=current_user.id,
            before_data=roadmap_before,
            after_data=roadmap_after,
        )

    db.commit()
    db.refresh(item)
    return item


@router.post("/items/bulk-delete", response_model=BulkDeleteOut)
def bulk_delete_intake_items(
    payload: BulkIdsIn,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO)),
):
    ids = sorted(set(payload.ids))
    if not ids:
        return BulkDeleteOut(deleted=0)

    items = db.query(IntakeItem).filter(IntakeItem.id.in_(ids)).all()
    roadmap_ids = [item.roadmap_item_id for item in items if item.roadmap_item_id]
    deleted = 0
    for item in items:
        db.query(IntakeAnalysis).filter(IntakeAnalysis.intake_item_id == item.id).delete(synchronize_session=False)
        db.query(IntakeItemVersion).filter(IntakeItemVersion.intake_item_id == item.id).delete(
            synchronize_session=False
        )
        db.query(IntakeItem).filter(IntakeItem.id == item.id).delete(synchronize_session=False)
        deleted += 1

    if roadmap_ids:
        db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id.in_(roadmap_ids)).delete(
            synchronize_session=False
        )
        db.query(RoadmapItemVersion).filter(RoadmapItemVersion.roadmap_item_id.in_(roadmap_ids)).delete(
            synchronize_session=False
        )
        db.query(RoadmapItem).filter(RoadmapItem.id.in_(roadmap_ids)).delete(synchronize_session=False)

    db.commit()
    return BulkDeleteOut(deleted=deleted)
