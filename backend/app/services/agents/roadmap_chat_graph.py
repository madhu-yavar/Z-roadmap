from datetime import datetime
import json
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.intake_item import IntakeItem
from app.models.llm_config import LLMConfig
from app.models.roadmap_item import RoadmapItem
from app.models.roadmap_plan_item import RoadmapPlanItem
from app.services.llm_client import LLMClientError, call_llm_json


class ChatState(TypedDict):
    question: str
    role: str
    answer: str
    evidence: list[str]
    context_json: str
    evidence_catalog: list[str]


def _build_context(db: Session) -> tuple[dict, list[str]]:
    # Summary counts must be full-table and stage-disjoint.
    intake_open_total = (
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

    committed_bucket_ids = {
        x
        for (x,) in db.query(RoadmapPlanItem.bucket_item_id).all()
        if x is not None
    }
    commitment_candidates_q = db.query(RoadmapItem)
    if committed_bucket_ids:
        commitment_candidates_q = commitment_candidates_q.filter(~RoadmapItem.id.in_(committed_bucket_ids))
    commitments_candidates_total = commitment_candidates_q.count()
    commitments_ready_total = commitment_candidates_q.filter(RoadmapItem.picked_up.is_(True)).count()

    roadmap_total = db.query(func.count(RoadmapPlanItem.id)).scalar() or 0
    roadmap_at_risk = (
        db.query(func.count(RoadmapPlanItem.id))
        .filter(RoadmapPlanItem.planning_status == "at_risk")
        .scalar()
        or 0
    )

    # Sample rows for conversational detail (bounded).
    intake_items = (
        db.query(IntakeItem)
        .filter(IntakeItem.status != "approved")
        .order_by(IntakeItem.updated_at.desc())
        .limit(120)
        .all()
    )
    commitments = commitment_candidates_q.order_by(RoadmapItem.created_at.desc()).limit(120).all()
    roadmap_items = db.query(RoadmapPlanItem).order_by(RoadmapPlanItem.created_at.desc()).limit(120).all()

    context = {
        "snapshot_at": datetime.utcnow().isoformat(),
        "definitions": {
            "pipeline": "Pipeline means pre-roadmap stages only: Intake (open) + Commitment candidates (not yet committed to roadmap).",
            "commitments": "Commitment candidates are roadmap_items that do not yet have a roadmap_plan_item.",
            "roadmap": "Roadmap means roadmap_plan_items only.",
        },
        "summary": {
            "intake_total": int(intake_open_total),
            "intake_understanding_pending": int(intake_understanding_pending),
            "intake_draft": int(intake_draft),
            "commitments_total": int(commitments_candidates_total),
            "commitments_ready": int(commitments_ready_total),
            "roadmap_total": int(roadmap_total),
            "roadmap_at_risk": int(roadmap_at_risk),
            "pipeline_total": int(intake_open_total + commitments_candidates_total),
        },
        "intake_items": [
            {
                "id": i.id,
                "title": i.title,
                "status": i.status,
                "priority": i.priority,
                "project_context": i.project_context,
                "delivery_mode": i.delivery_mode,
                "updated_at": i.updated_at.isoformat() if i.updated_at else "",
            }
            for i in intake_items
        ],
        "commitments": [
            {
                "id": c.id,
                "title": c.title,
                "picked_up": c.picked_up,
                "priority": c.priority,
                "project_context": c.project_context,
                "delivery_mode": c.delivery_mode,
                "accountable_person": c.accountable_person,
                "created_at": c.created_at.isoformat() if c.created_at else "",
            }
            for c in commitments
        ],
        "roadmap_items": [
            {
                "id": r.id,
                "bucket_item_id": r.bucket_item_id,
                "title": r.title,
                "planning_status": r.planning_status,
                "confidence": r.confidence,
                "planned_start_date": r.planned_start_date,
                "planned_end_date": r.planned_end_date,
                "pickup_period": r.pickup_period,
                "completion_period": r.completion_period,
                "resource_count": r.resource_count,
                "effort_person_weeks": r.effort_person_weeks,
                "entered_roadmap_at": r.entered_roadmap_at.isoformat() if r.entered_roadmap_at else "",
            }
            for r in roadmap_items
        ],
    }
    evidence_catalog = (
        [f"intake:{i.id}" for i in intake_items]
        + [f"commitment:{c.id}" for c in commitments]
        + [f"roadmap:{r.id}" for r in roadmap_items]
        + ["summary:intake", "summary:commitments", "summary:roadmap"]
    )
    return context, evidence_catalog


def _sanitize_evidence(raw: object, catalog: list[str]) -> list[str]:
    valid = set(catalog)
    out: list[str] = []
    if isinstance(raw, list):
        candidates = [str(x).strip() for x in raw if str(x).strip()]
    else:
        candidates = [x.strip() for x in str(raw or "").split(",") if x.strip()]
    for ev in candidates:
        if ev in valid and ev not in out:
            out.append(ev)
        if len(out) >= 8:
            break
    return out or ["summary:intake", "summary:commitments", "summary:roadmap"]


def _deterministic_count_answer(question: str, context: dict) -> tuple[str, list[str]] | None:
    q = (question or "").lower()
    summary = context.get("summary") or {}
    ask_count = any(x in q for x in ["how many", "count", "total", "number of"])
    if not ask_count:
        return None

    if "pipeline" in q:
        return (
            f"There are {summary.get('pipeline_total', 0)} projects in the pipeline "
            f"({summary.get('intake_total', 0)} in intake and {summary.get('commitments_total', 0)} in commitments).",
            ["summary:intake", "summary:commitments"],
        )
    if "intake" in q:
        return (f"There are {summary.get('intake_total', 0)} projects in intake.", ["summary:intake"])
    if "commitment" in q:
        return (f"There are {summary.get('commitments_total', 0)} projects in commitments.", ["summary:commitments"])
    if "roadmap" in q:
        return (f"There are {summary.get('roadmap_total', 0)} projects on roadmap.", ["summary:roadmap"])
    if "risk" in q or "at risk" in q:
        return (f"There are {summary.get('roadmap_at_risk', 0)} roadmap projects at risk.", ["summary:roadmap"])
    return None


def _fallback_answer(question: str, context: dict) -> tuple[str, list[str]]:
    deterministic = _deterministic_count_answer(question, context)
    if deterministic:
        return deterministic
    q = (question or "").lower()
    summary = context.get("summary") or {}
    if "pending" in q or "understanding" in q:
        val = summary.get("intake_understanding_pending", 0)
        return f"There are {val} intake items in understanding_pending.", ["summary:intake"]
    if "pipeline" in q:
        return (
            f"There are {summary.get('pipeline_total', 0)} items in pipeline "
            f"({summary.get('intake_total', 0)} in intake and {summary.get('commitments_total', 0)} in commitments). "
            f"Roadmap items ({summary.get('roadmap_total', 0)}) are tracked separately.",
            ["summary:intake", "summary:commitments", "summary:roadmap"],
        )
    if "risk" in q or "at risk" in q:
        val = summary.get("roadmap_at_risk", 0)
        return f"There are {val} roadmap items marked at_risk.", ["summary:roadmap"]
    if "roadmap" in q and ("count" in q or "how many" in q):
        val = summary.get("roadmap_total", 0)
        return f"There are {val} items currently in roadmap planning.", ["summary:roadmap"]
    if "commit" in q and ("count" in q or "how many" in q):
        val = summary.get("commitments_total", 0)
        return f"There are {val} commitment candidates in pre-roadmap planning.", ["summary:commitments"]
    if "intake" in q and ("count" in q or "how many" in q):
        val = summary.get("intake_total", 0)
        return f"There are {val} items in intake.", ["summary:intake"]
    return (
        "I can answer intake, commitments, and roadmap questions from current system data. "
        "Ask about status, counts, priorities, owners, risks, or timelines.",
        ["summary:intake", "summary:commitments", "summary:roadmap"],
    )


def _resolve_with_llm_factory(db: Session):
    context, evidence_catalog = _build_context(db)
    context_json = json.dumps(context, ensure_ascii=True, default=str)

    active_llm = db.query(LLMConfig).filter(LLMConfig.is_active.is_(True)).first()

    def _run_with(config: LLMConfig | None, prompt: str) -> dict:
        if not config:
            raise LLMClientError("No active provider configuration")
        return call_llm_json(
            provider=config.provider,
            model=config.model,
            api_key=config.api_key,
            base_url=config.base_url,
            prompt=prompt,
        )

    def _resolve_with_llm(state: ChatState) -> ChatState:
        deterministic = _deterministic_count_answer(state["question"], context)
        if deterministic:
            state["answer"], state["evidence"] = deterministic
            state["context_json"] = context_json
            state["evidence_catalog"] = evidence_catalog
            return state

        prompt = f"""
You are an enterprise roadmap assistant.
Answer ONLY from the provided system context. Do not hallucinate.

User role: {state['role']}
User question: {state['question']}

Important stage rules:
- "Pipeline" means pre-roadmap only: Intake + Commitment candidates.
- Do NOT add roadmap count into pipeline count unless user explicitly asks to include roadmap.
- Commitments are candidates not yet committed to roadmap.

Context JSON:
{context_json}

Return STRICT JSON with keys:
- answer (string, concise, business-friendly)
- evidence (array of IDs only from this catalog)

Evidence catalog:
{json.dumps(evidence_catalog)}
""".strip()
        data = None
        try:
            data = _run_with(active_llm, prompt)
        except Exception:
            # Provider fallback to latest saved vertex config when active is not vertex.
            if active_llm and active_llm.provider != "vertex_gemini":
                fallback = (
                    db.query(LLMConfig)
                    .filter(LLMConfig.provider == "vertex_gemini", LLMConfig.id != active_llm.id)
                    .order_by(LLMConfig.id.desc())
                    .first()
                )
                if fallback:
                    try:
                        data = _run_with(fallback, prompt)
                    except Exception:
                        data = None

        if isinstance(data, dict) and str(data.get("answer", "")).strip():
            state["answer"] = str(data.get("answer")).strip()
            state["evidence"] = _sanitize_evidence(data.get("evidence"), evidence_catalog)
            state["context_json"] = context_json
            state["evidence_catalog"] = evidence_catalog
            return state

        answer, evidence = _fallback_answer(state["question"], context)
        state["answer"] = answer
        state["evidence"] = evidence
        state["context_json"] = context_json
        state["evidence_catalog"] = evidence_catalog
        return state

    return _resolve_with_llm

def run_chat_graph(question: str, db: Session, role: str = "") -> tuple[str, list[str]]:
    graph = StateGraph(ChatState)
    graph.add_node("resolve_with_llm", _resolve_with_llm_factory(db))

    graph.set_entry_point("resolve_with_llm")
    graph.add_edge("resolve_with_llm", END)

    app = graph.compile()
    output = app.invoke(
        {"question": question, "role": role, "answer": "", "evidence": [], "context_json": "", "evidence_catalog": []}
    )
    return output["answer"], output["evidence"]
