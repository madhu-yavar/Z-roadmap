from __future__ import annotations

import json
import re
from datetime import datetime

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.intake_analysis import IntakeAnalysis
from app.models.intake_item import IntakeItem
from app.models.llm_config import LLMConfig
from app.services.document_parser import extract_document_units
from app.services.intake_agent import generate_intake_analysis_v2
from app.services.llm_client import call_llm_json
from app.services.versioning import log_intake_version

UNCLEAR_INTENT = "Document intent is unclear."


def _normalize_actions(actions: list[str]) -> list[str]:
    out: list[str] = []
    for action in actions:
        val = " ".join(str(action).split()).strip()
        if not val:
            continue
        if val in out:
            continue
        out.append(val)
        if len(out) >= 6:
            break
    return out


def _context_evidence_ids(context: dict) -> list[str]:
    return [
        f"intake:{context.get('intake_item_id')}",
        f"document:{context.get('document_id')}",
        f"analysis:intake:{context.get('intake_item_id')}",
    ]


def _is_resolve_request(question: str) -> bool:
    q = (question or "").lower()
    triggers = [
        "understand the document",
        "can you understand",
        "now can you understand",
        "understand this document",
        "generate activities",
        "create activities",
        "apply this",
        "update understanding",
        "resolve intake",
        "move to candidate",
        "resolve this",
        "fix this",
        "intent is clear",
        "is intent clear",
        "now clear",
        "any doubts now",
        "go ahead",
        "proceed",
        "approve understanding",
        "generate candidate",
        "move ahead",
    ]
    if any(t in q for t in triggers):
        return True
    if ("understand" in q and "activit" in q) or ("generate" in q and "activit" in q):
        return True
    return ("doubt" in q and ("now" in q or "clear" in q))


def _intent_is_clear(understanding: dict | None) -> bool:
    data = understanding or {}
    primary = " ".join(str(data.get("Primary intent (1 sentence)") or "").split()).strip()
    return bool(primary) and primary != UNCLEAR_INTENT


def _support_state(item: IntakeItem, understanding: dict | None, support_applied: bool = False) -> tuple[str, bool, str]:
    intent_clear = _intent_is_clear(understanding)
    if intent_clear:
        if item.status == "understanding_pending":
            return ("resolved" if support_applied else "ready_for_approval", True, "approve_understanding")
        if item.status == "draft":
            return ("candidate_ready", True, "review_candidate")
        return ("clear", True, "none")
    return ("blocked_unclear_intent", False, "resolve_intent")


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


def _derive_rca(context: dict) -> tuple[list[str], list[str]]:
    causes: list[str] = []
    actions: list[str] = []

    file_type = str(context.get("file_type") or "").lower()
    parser_units = int(context.get("parser_units") or 0)
    parser_pages = context.get("parser_pages") or []
    llm_error = str(context.get("llm_error") or "")
    llm_success = bool(context.get("llm_success"))
    confidence = str(context.get("confidence") or "").lower()

    low_error = llm_error.lower()
    if "429" in low_error or "quota" in low_error or "rate limit" in low_error:
        causes.append("Active provider hit quota/rate-limit during understanding run.")
        actions.extend(
            [
                "Open Settings and switch provider/model (or wait for quota reset).",
                "Test provider in Settings before re-running understanding.",
            ]
        )
    elif "404" in low_error:
        causes.append("Provider endpoint/base URL is invalid for the selected provider.")
        actions.append("Correct Base URL/model mapping in Settings and test connection.")
    elif any(x in low_error for x in ["401", "403", "unauthorized", "permission"]):
        causes.append("Provider credentials/permissions are invalid for current model.")
        actions.append("Update API key/token or service-account permissions, then retest.")
    elif llm_error:
        causes.append("Provider call failed, so fallback extraction was used.")
        actions.append("Validate provider health in Settings and retry understanding.")

    if file_type in {"xls", "xlsx"}:
        causes.append("Spreadsheet content is often tabular and lacks explicit objective/scope language.")
        actions.extend(
            [
                "Use Manual Entry to set objective/scope while keeping spreadsheet as evidence.",
                "Attach a BRD/RFP summary sheet or notes with explicit intent/outcomes.",
            ]
        )
    if file_type in {"ppt", "pptx"} and parser_units < 10:
        causes.append("Presentation text coverage is low; slides may be image-heavy or sparse.")
        actions.append("Upload a companion BRD/RFP section with explicit objective/scope.")

    if parser_units < 6:
        causes.append("Very low parser text coverage from uploaded file.")
        actions.append("Preview the file using eye icon and verify readable text was extracted.")
    elif parser_pages and len(parser_pages) <= 1 and file_type == "pdf":
        causes.append("Only limited PDF page text was parsed for intent extraction.")
        actions.append("Upload a clearer PDF export with selectable text (not scanned image only).")

    if not llm_success and not llm_error:
        causes.append("Model did not return a reliable structured response.")
        actions.append("Switch to a stronger model and rerun understanding.")

    if confidence == "low":
        causes.append("Document does not clearly state business intent/outcomes in extractable sections.")
        actions.append("Add a short note in upload metadata with objective and expected outcomes.")

    if not causes:
        causes.append("Primary intent is ambiguous in current document text.")
    if not actions:
        actions.extend(
            [
                "Preview extracted content and verify objective/scope sections are present.",
                "Adjust provider/model in Settings and rerun understanding.",
                "Use Manual Entry if document is non-narrative (e.g., spreadsheet-first).",
            ]
        )

    return causes[:5], _normalize_actions(actions)


def _build_deterministic_answer(context: dict, causes: list[str], actions: list[str]) -> str:
    title = str(context.get("title") or "").strip() or f"Intake #{context.get('intake_item_id')}"
    file_name = str(context.get("file_name") or "-")
    file_type = str(context.get("file_type") or "-").upper()
    model_run = f"{context.get('llm_provider') or '-'} / {context.get('llm_model') or '-'}"
    parser_units = int(context.get("parser_units") or 0)

    cause_lines = "\n".join([f"- {c}" for c in causes])
    action_lines = "\n".join([f"{i + 1}. {a}" for i, a in enumerate(actions)])
    return (
        f"Intake support check for \"{title}\" ({file_name}, {file_type}).\n"
        f"Understanding is blocked because intent is unclear.\n\n"
        f"Likely RCA:\n{cause_lines}\n\n"
        f"Recommended next steps:\n{action_lines}\n\n"
        f"Run details: model={model_run}, parser_units={parser_units}, checked_at={datetime.utcnow().isoformat()}."
    )


def _question_tokens(question: str) -> set[str]:
    return {x for x in re.findall(r"[a-zA-Z0-9]+", (question or "").lower()) if len(x) > 2}


def _rank_relevant_units(units: list[dict], question: str) -> list[dict]:
    if not units:
        return []
    q = (question or "").lower()
    tokens = _question_tokens(question)
    scored: list[tuple[int, dict]] = []
    for unit in units[:420]:
        text = str(unit.get("text") or "").strip()
        if not text:
            continue
        low = text.lower()
        score = 0
        if "business context" in low and ("business context" in q or ("business" in tokens and "context" in tokens)):
            score += 8
        if "need for ai" in low and ("need" in tokens and "ai" in tokens):
            score += 8
        for token in tokens:
            if token in low:
                score += 2
        if text.endswith(":"):
            score += 1
        if score > 0:
            scored.append((score, {"ref": unit.get("ref", ""), "text": text}))
    scored.sort(key=lambda x: x[0], reverse=True)

    out: list[dict] = []
    seen_refs: set[str] = set()
    for _, unit in scored:
        ref = str(unit.get("ref") or "")
        if ref in seen_refs:
            continue
        seen_refs.add(ref)
        out.append(unit)
        if len(out) >= 14:
            break
    return out


def _deterministic_followup(
    context: dict,
    question: str,
    relevant_units: list[dict],
    actions: list[str],
) -> tuple[str, list[str], list[str]]:
    evidence = _context_evidence_ids(context)
    if relevant_units:
        quoted = relevant_units[:3]
        references = [str(u.get("ref") or "").strip() for u in quoted if str(u.get("ref") or "").strip()]
        snippets = [re.sub(r"\s+", " ", str(u.get("text") or "")).strip()[:160] for u in quoted]
        bullets = "\n".join([f"- {x}" for x in snippets if x])
        next_actions = _normalize_actions(
            [
                "Re-run understanding now (same intake item) after this guided section check.",
                "If this section is image/table-heavy, add objective/outcomes in upload notes.",
                *actions,
            ]
        )
        answer = (
            f'I checked your requested area for: "{question}".\n'
            f"Most relevant document references: {', '.join(references) if references else 'none'}.\n"
            f"Observed extracted lines:\n{bullets}\n\n"
            "If this reflects intent, re-run understanding now. If intent is still unclear, add a one-line objective + outcomes in notes."
        )
        evidence = references[:4] + evidence
        return answer, evidence[:6], next_actions

    next_actions = _normalize_actions(
        [
            "I could not find that section clearly in parsed text. Use eye preview and verify exact heading.",
            "Upload a clearer BRD/RFP excerpt for that section, or add notes with objective/outcomes.",
            *actions,
        ]
    )
    answer = (
        f'I could not confidently locate "{question}" in parsed document text.\n'
        "This usually means the section is image-heavy, tabular, or phrased differently than expected."
    )
    return answer, evidence, next_actions


def _run_with_vertex_fallback(
    db: Session,
    runner,
) -> tuple[dict, dict]:
    active = db.query(LLMConfig).filter(LLMConfig.is_active.is_(True)).first()
    primary_output, primary_result = runner(active)
    runtime = (primary_output or {}).get("llm_runtime") or {}
    if runtime.get("success") or (active and active.provider == "vertex_gemini"):
        return primary_output, primary_result

    active_id = active.id if active else None
    fallback_query = db.query(LLMConfig).filter(LLMConfig.provider == "vertex_gemini")
    if active_id:
        fallback_query = fallback_query.filter(LLMConfig.id != active_id)
    fallback = fallback_query.order_by(desc(LLMConfig.id)).first()
    if not fallback:
        return primary_output, primary_result

    fallback_output, fallback_result = runner(fallback)
    fb_runtime = (fallback_output or {}).get("llm_runtime") or {}
    if fb_runtime.get("success"):
        return fallback_output, fallback_result
    return primary_output, primary_result


def _apply_support_resolution(
    db: Session,
    item: IntakeItem,
    doc: Document | None,
    question: str,
    changed_by: int | None,
) -> tuple[bool, str]:
    if not doc:
        return False, "Source document not found for intake item."

    guidance = (question or "").strip()

    def _run_understanding(cfg: LLMConfig | None):
        return generate_intake_analysis_v2(
            file_path=doc.file_path,
            file_type=doc.file_type,
            file_name=doc.file_name,
            provider=cfg.provider if cfg else "",
            model=cfg.model if cfg else "",
            api_key=cfg.api_key if cfg else "",
            base_url=cfg.base_url if cfg else "",
            guidance=guidance,
        )

    analysis_output, flat = _run_with_vertex_fallback(db, _run_understanding)
    understanding = (analysis_output.get("document_understanding_check") or {}) if isinstance(analysis_output, dict) else {}
    primary_intent = str(understanding.get("Primary intent (1 sentence)") or "").strip()
    if not primary_intent or primary_intent == UNCLEAR_INTENT:
        return False, "Understanding remains unclear after guided reprocessing."

    before_data = _snapshot_intake(item)
    # Keep intake in understanding stage. User should explicitly approve understanding
    # before candidate generation, preserving governance flow.
    item.title = str(flat.get("title") or item.title or "").strip()
    item.scope = str(flat.get("scope") or item.scope or "").strip()
    incoming_activities = [str(x).strip() for x in (flat.get("activities") or []) if str(x).strip()]
    if incoming_activities:
        item.activities = incoming_activities
    item.document_class = str(flat.get("document_class") or item.document_class or "other")
    evidence = understanding.get("Evidence") or []
    if isinstance(evidence, list):
        item.source_quotes = [str(x) for x in evidence if str(x).strip()][:8]
    item.status = "understanding_pending"
    db.add(item)
    db.flush()

    analysis = db.query(IntakeAnalysis).filter(IntakeAnalysis.intake_item_id == item.id).first()
    if not analysis:
        analysis = IntakeAnalysis(intake_item_id=item.id)
    merged = dict(analysis.output_json or {})
    merged.update(analysis_output or {})
    merged["support_resolution"] = {
        "applied": True,
        "applied_at": datetime.utcnow().isoformat(),
        "question": guidance,
        "intent_clear": True,
        "next_step": "approve_understanding",
    }
    analysis.output_json = merged
    analysis.primary_type = str(flat.get("primary_type") or analysis.primary_type or "Mixed / Composite Document")
    analysis.confidence = str(flat.get("confidence") or understanding.get("Confidence") or analysis.confidence or "Medium")
    db.add(analysis)

    log_intake_version(
        db=db,
        intake_item_id=item.id,
        action="support_resolve",
        changed_by=changed_by,
        before_data=before_data,
        after_data=_snapshot_intake(item),
    )
    db.commit()
    return True, "Understanding was updated from support flow."


def _try_llm_rewrite(
    db: Session,
    context: dict,
    causes: list[str],
    actions: list[str],
    question: str = "",
    relevant_units: list[dict] | None = None,
) -> tuple[str, list[str], list[str]] | None:
    active = db.query(LLMConfig).filter(LLMConfig.is_active.is_(True)).first()
    if not active:
        return None

    evidence_ids = _context_evidence_ids(context)
    if relevant_units:
        for unit in relevant_units:
            ref = str(unit.get("ref") or "").strip()
            if ref and ref not in evidence_ids:
                evidence_ids.append(ref)
    followup_mode = bool((question or "").strip())

    def _run(cfg: LLMConfig) -> dict:
        if followup_mode:
            prompt = f"""
You are an Intake Support Agent for enterprise roadmap intake.
Stay in the same intake context. Do not answer with generic pipeline summaries.

Context JSON:
{json.dumps(context, ensure_ascii=True)}

User follow-up question:
{question}

Relevant extracted document units (reference + text):
{json.dumps((relevant_units or [])[:14], ensure_ascii=True)}

Detected root causes:
{json.dumps(causes, ensure_ascii=True)}

Base recovery actions:
{json.dumps(actions, ensure_ascii=True)}

Return STRICT JSON:
- answer: specific to this intake item and question (max 8 lines)
- actions: ordered list (max 6)
- evidence: IDs ONLY, choose from {json.dumps(evidence_ids)}
""".strip()
        else:
            prompt = f"""
You are an Intake Support Agent for enterprise roadmap intake.
Your goal is to help a business user resolve "intent unclear" blocks quickly.

Context JSON:
{json.dumps(context, ensure_ascii=True)}

Detected root causes:
{json.dumps(causes, ensure_ascii=True)}

Recommended actions:
{json.dumps(actions, ensure_ascii=True)}

Return STRICT JSON:
- answer: concise and actionable (max 8 lines)
- actions: ordered list (max 6)
- evidence: IDs ONLY, choose from {json.dumps(evidence_ids)}
""".strip()
        return call_llm_json(
            provider=cfg.provider,
            model=cfg.model,
            api_key=cfg.api_key,
            base_url=cfg.base_url,
            prompt=prompt,
        )

    data: dict | None = None
    try:
        data = _run(active)
    except Exception:
        if active.provider != "vertex_gemini":
            fallback = (
                db.query(LLMConfig)
                .filter(LLMConfig.provider == "vertex_gemini", LLMConfig.id != active.id)
                .order_by(desc(LLMConfig.id))
                .first()
            )
            if fallback:
                try:
                    data = _run(fallback)
                except Exception:
                    data = None

    if not isinstance(data, dict):
        return None
    answer = " ".join(str(data.get("answer") or "").split()).strip()
    if not answer:
        return None
    out_actions = _normalize_actions([str(x) for x in (data.get("actions") or [])])
    out_evidence_raw = [str(x).strip() for x in (data.get("evidence") or []) if str(x).strip()]
    allowed = set(evidence_ids)
    out_evidence = [ev for ev in out_evidence_raw if ev in allowed][:5]
    if not out_evidence:
        out_evidence = evidence_ids[:3]
    return answer, out_evidence, out_actions


def run_intake_support_agent(
    intake_item_id: int,
    db: Session,
    role: str = "",
    question: str = "",
    changed_by: int | None = None,
) -> tuple[str, list[str], list[str], bool, int, str, bool | None, str]:
    item = db.get(IntakeItem, intake_item_id)
    if not item:
        raise ValueError("Intake item not found")

    doc = db.get(Document, item.document_id)
    analysis = db.query(IntakeAnalysis).filter(IntakeAnalysis.intake_item_id == item.id).first()

    output = (analysis.output_json if analysis else {}) or {}
    understanding = (output.get("document_understanding_check") or {}) if isinstance(output, dict) else {}
    llm_runtime = (output.get("llm_runtime") or {}) if isinstance(output, dict) else {}
    parser = (output.get("parser_coverage") or {}) if isinstance(output, dict) else {}
    units: list[dict] = []
    if doc:
        try:
            units = extract_document_units(file_path=doc.file_path, file_type=doc.file_type)
        except Exception:
            units = []

    context = {
        "intake_item_id": item.id,
        "document_id": item.document_id,
        "title": item.title,
        "status": item.status,
        "role": role,
        "file_name": doc.file_name if doc else "",
        "file_type": (doc.file_type if doc else "").lower(),
        "primary_intent": understanding.get("Primary intent (1 sentence)", ""),
        "confidence": understanding.get("Confidence", analysis.confidence if analysis else ""),
        "llm_provider": llm_runtime.get("provider", ""),
        "llm_model": llm_runtime.get("model", ""),
        "llm_success": llm_runtime.get("success", False),
        "llm_error": llm_runtime.get("error", ""),
        "parser_units": parser.get("units_processed", 0),
        "parser_pages": parser.get("pages_detected", []) if isinstance(parser.get("pages_detected", []), list) else [],
    }

    q = (question or "").strip()
    current_state, current_intent_clear, current_next_action = _support_state(item, understanding, support_applied=False)
    if current_intent_clear and not q:
        answer = "Understanding is already clear for this intake item. Continue in Understanding Review and approve when ready."
        actions = ["Open Understanding Review and click 'Approve Understanding and Generate Candidate'."]
        return answer, _context_evidence_ids(context), actions, False, item.id, current_state, True, current_next_action

    relevant_units = _rank_relevant_units(units, q) if q else []
    if q and _is_resolve_request(q):
        guidance = q
        if relevant_units:
            refs = [str(u.get("ref") or "").strip() for u in relevant_units[:8] if str(u.get("ref") or "").strip()]
            snippets = [re.sub(r"\s+", " ", str(u.get("text") or "")).strip()[:140] for u in relevant_units[:4]]
            guidance = (
                f"{q}\n"
                f"Prioritize these references: {', '.join(refs)}.\n"
                f"Section clues: {' | '.join(snippets)}"
            )
        applied, message = _apply_support_resolution(
            db=db,
            item=item,
            doc=doc,
            question=guidance,
            changed_by=changed_by,
        )
        if applied:
            refreshed_analysis = db.query(IntakeAnalysis).filter(IntakeAnalysis.intake_item_id == item.id).first()
            refreshed_output = (refreshed_analysis.output_json if refreshed_analysis else {}) or {}
            refreshed_understanding = (refreshed_output.get("document_understanding_check") or {}) if isinstance(refreshed_output, dict) else {}
            support_state, intent_clear, next_action = _support_state(item, refreshed_understanding, support_applied=True)
            answer = (
                f"{message} You can now click 'Approve Understanding and Generate Candidate' in Understanding Review."
            )
            return (
                answer,
                _context_evidence_ids(context),
                ["Approve understanding, then review candidate and move to commitments."],
                True,
                item.id,
                support_state,
                intent_clear,
                next_action,
            )

    causes, actions = _derive_rca(context)
    llm_result = _try_llm_rewrite(
        db=db,
        context=context,
        causes=causes,
        actions=actions,
        question=q,
        relevant_units=relevant_units,
    )
    if llm_result:
        answer, evidence, llm_actions = llm_result
        support_state, intent_clear, next_action = _support_state(item, understanding, support_applied=False)
        return answer, evidence, llm_actions, False, item.id, support_state, intent_clear, next_action

    if q:
        answer, evidence, followup_actions = _deterministic_followup(
            context=context,
            question=q,
            relevant_units=relevant_units,
            actions=actions,
        )
        support_state, intent_clear, next_action = _support_state(item, understanding, support_applied=False)
        return answer, evidence, followup_actions, False, item.id, support_state, intent_clear, next_action

    answer = _build_deterministic_answer(context, causes, actions)
    evidence = _context_evidence_ids(context)
    support_state, intent_clear, next_action = _support_state(item, understanding, support_applied=False)
    return answer, evidence, actions, False, item.id, support_state, intent_clear, next_action
