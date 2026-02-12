from pathlib import Path
import re

from app.services.document_parser import extract_document_units
from app.services.llm_client import LLMClientError, call_llm_json

DOC_TYPES = [
    "BRD",
    "RFP",
    "Vision / Strategy Document",
    "SoW",
    "Policy / Compliance Document",
    "Mixed / Composite Document",
]

MARKETING_TERMS = {
    "from",
    "to",
    "transform",
    "future",
    "future-ready",
    "vision",
    "seamless",
    "powerful",
    "innovative",
    "proof",
    "readiness",
}

SCOPE_TERMS = {
    "objective",
    "scope",
    "requirements",
    "requirement",
    "activities",
    "activity",
    "deliverables",
    "deliverable",
    "features",
    "feature",
    "functional",
    "non-functional",
    "business requirement",
}

ACTIVITY_TERMS = {
    "activity",
    "task",
    "deliverable",
    "milestone",
    "workstream",
    "requirement",
    "feature",
    "action",
    "step",
    "validate",
    "review",
    "assess",
}

STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "on",
    "for",
    "with",
    "from",
    "by",
    "is",
    "are",
    "this",
    "that",
}

FORBIDDEN_MARKETING_WORDS = {
    "smart",
    "seamless",
    "powerful",
    "enterprise-ready",
    "innovative",
    "next-gen",
    "future-ready",
}

ACTION_VERBS = {
    "define",
    "identify",
    "assess",
    "validate",
    "document",
    "standardize",
    "map",
    "review",
    "establish",
    "implement",
    "enable",
    "prepare",
    "capture",
    "design",
    "align",
}

ALLOWED_ACTIVITY_TAGS = ("FE", "BE", "AI")

ACTIVITY_TAG_HINTS = {
    "FE": {
        "ui",
        "ux",
        "frontend",
        "front-end",
        "screen",
        "page",
        "form",
        "dashboard",
        "portal",
        "web",
        "mobile",
        "component",
        "workflow view",
        "chat interface",
    },
    "BE": {
        "backend",
        "back-end",
        "api",
        "service",
        "endpoint",
        "database",
        "db",
        "schema",
        "auth",
        "integration",
        "queue",
        "pipeline",
        "storage",
        "server",
        "ingestion",
        "orchestration",
    },
    "AI": {
        "ai",
        "ml",
        "llm",
        "model",
        "prompt",
        "embedding",
        "classification",
        "summarization",
        "summarisation",
        "extract",
        "nlp",
        "ocr",
        "rag",
        "inference",
        "genai",
    },
}

TAG_ALIASES = {
    "FE": "FE",
    "FRONTEND": "FE",
    "FRONT-END": "FE",
    "UI": "FE",
    "UX": "FE",
    "BE": "BE",
    "BACKEND": "BE",
    "BACK-END": "BE",
    "API": "BE",
    "SERVICE": "BE",
    "AI": "AI",
    "ML": "AI",
    "LLM": "AI",
    "GENAI": "AI",
    "MODEL": "AI",
}


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-zA-Z0-9]+", text.lower()) if len(t) > 2 and t not in STOPWORDS}


def _normalize_activity_tag(tag: str) -> str:
    raw = (tag or "").strip().upper()
    raw = raw.replace("_", "-")
    return TAG_ALIASES.get(raw, "")


def _strip_activity_tags(text: str) -> str:
    val = (text or "").strip()
    return re.sub(r"^\[(?:FE|BE|AI)(?:/(?:FE|BE|AI))*\]\s*", "", val, flags=re.IGNORECASE)


def _infer_activity_tags(activity: str) -> list[str]:
    low = (activity or "").lower()
    tags: list[str] = []
    for lane in ALLOWED_ACTIVITY_TAGS:
        hints = ACTIVITY_TAG_HINTS[lane]
        if any(h in low for h in hints):
            tags.append(lane)
    if tags:
        return tags[:3]
    if any(h in low for h in ("screen", "dashboard", "ui", "form", "portal", "web", "mobile", "chat")):
        return ["FE"]
    if any(h in low for h in ("model", "ai", "ml", "llm", "ocr", "classification", "summar")):
        return ["AI"]
    return ["BE"]


def _coerce_activity_tags(raw_tags: object, activity: str) -> list[str]:
    if isinstance(raw_tags, list):
        values = [str(x) for x in raw_tags]
    elif isinstance(raw_tags, str):
        values = [x for x in re.split(r"[,/|;+]", raw_tags) if x.strip()]
    else:
        values = []

    tags: list[str] = []
    for value in values:
        norm = _normalize_activity_tag(value)
        if norm and norm not in tags:
            tags.append(norm)
    if tags:
        return tags[:3]
    return _infer_activity_tags(activity)


def _format_activity_with_tags(activity: str, tags: list[str] | None = None) -> str:
    clean_activity = _strip_activity_tags(activity)
    if not clean_activity:
        return ""
    lane_tags = _coerce_activity_tags(tags or [], clean_activity)
    return f"[{'/'.join(lane_tags)}] {clean_activity}"


def _looks_marketing(line: str) -> bool:
    low = line.lower()
    if re.search(r"\bfrom\b.+\bto\b", low):
        return True
    hits = sum(1 for term in MARKETING_TERMS if term in low)
    return hits >= 2 and not any(term in low for term in SCOPE_TERMS)


def _fallback_doc_type(file_type: str, file_name: str) -> str:
    ext = (file_type or Path(file_name).suffix.lstrip(".")).lower()
    low_name = file_name.lower()
    if "rfp" in low_name:
        return "RFP"
    if ext in {"ppt", "pptx"}:
        return "Vision / Strategy Document"
    if ext in {"xls", "xlsx"}:
        return "Mixed / Composite Document"
    if ext in {"doc", "docx", "pdf"} and "sow" in low_name:
        return "SoW"
    if ext in {"doc", "docx", "pdf"} and ("policy" in low_name or "compliance" in low_name):
        return "Policy / Compliance Document"
    if ext in {"doc", "docx", "pdf"}:
        return "BRD"
    return "Mixed / Composite Document"


def _extract_scope(units: list[dict]) -> tuple[str, list[str]]:
    lines = [u["text"].strip() for u in units if u.get("text")]
    refs = [u["ref"] for u in units if u.get("text")]

    for idx, line in enumerate(lines):
        low = line.lower()
        if any(term in low for term in SCOPE_TERMS) and not _looks_marketing(line):
            scope_parts = [line]
            citations = [refs[idx]]
            for j in range(idx + 1, min(idx + 3, len(lines))):
                nxt = lines[j]
                if _looks_marketing(nxt):
                    continue
                if re.match(r"^(scope|objective|requirements?)\s*:\s*$", nxt.strip(), flags=re.IGNORECASE):
                    continue
                scope_parts.append(nxt)
                citations.append(refs[j])
            return " ".join(scope_parts)[:1200], citations[:3]

    candidates = [i for i, line in enumerate(lines) if not _looks_marketing(line) and len(line) >= 40]
    if candidates:
        idx = candidates[0]
        return lines[idx][:700], [refs[idx]]
    return "", []


def _extract_activities(units: list[dict]) -> list[dict]:
    activities: list[dict] = []
    for unit in units[:300]:
        line = unit.get("text", "").strip()
        if not line:
            continue
        if re.match(r"^(scope|objective|requirements?|activities?)\s*:\s*$", line, flags=re.IGNORECASE):
            continue
        low = line.lower()
        is_bullet = line.startswith(("-", "*", "•")) or re.match(r"^\d+[\.\)]\s+", line)
        is_activity = any(term in low for term in ACTIVITY_TERMS)
        if is_bullet or is_activity:
            cleaned = re.sub(r"^[-*•\d\.\)\s]+", "", line).strip()
            if not cleaned or _looks_marketing(cleaned):
                continue
            if re.match(r"^(scope|objective|requirements?|activities?)\s*:", cleaned, flags=re.IGNORECASE):
                continue
            if cleaned.lower() in {a["description"].lower() for a in activities}:
                continue
            activities.append({"description": cleaned[:280], "citation": unit["ref"]})
        if len(activities) >= 20:
            break
    return activities


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    return [p.strip() for p in parts if p.strip()]


def _single_sentence(text: str, max_chars: int = 220) -> str:
    sentence = _split_sentences(text)[0] if _split_sentences(text) else (text or "").strip()
    sentence = re.sub(r"\s+", " ", sentence).strip()
    if sentence and sentence[-1] not in ".!?":
        sentence += "."
    return sentence[:max_chars]


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9]+", text or ""))


def _sanitize_title(text: str, fallback: str) -> str:
    raw = re.sub(r"[^A-Za-z0-9\s\-\/]", " ", text or "").strip()
    raw = re.sub(r"\s+", " ", raw)
    if not raw:
        raw = re.sub(r"[_\-]+", " ", fallback).strip()
    words = [w for w in raw.split() if w]
    if len(words) < 3:
        words += ["Roadmap", "Capability", "Track"]
    if len(words) > 6:
        words = words[:6]
    return " ".join(words[:6])


def _sanitize_activity(activity: str) -> str:
    cleaned = re.sub(r"^[-*•\d\.\)\s]+", "", _strip_activity_tags(activity))
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        return ""
    words = cleaned.split()
    if len(words) > 11:
        cleaned = " ".join(words[:11])
    first = cleaned.split()[0].lower() if cleaned.split() else ""
    if first not in ACTION_VERBS:
        cleaned = f"Define {cleaned[0].lower() + cleaned[1:]}" if len(cleaned) > 1 else "Define scope"
    return cleaned[:120]


def _sanitize_outcome(text: str) -> str:
    cleaned = re.sub(r"^[-*•\d\.\)\s]+", "", (text or "").strip())
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        return ""
    words = cleaned.split()
    if len(words) > 12:
        cleaned = " ".join(words[:12])
    return cleaned[:140]


def _is_forbidden_text(text: str) -> bool:
    low = (text or "").lower()
    if any(w in low for w in FORBIDDEN_MARKETING_WORDS):
        return True
    if "enterprise ready" in low:
        return True
    if re.search(r"\bfrom\b.+\bto\b", low):
        return True
    return False


def _is_low_quality_sentence(text: str, strict: bool = True) -> bool:
    val = (text or "").strip()
    if not val:
        return True
    if re.match(r"^\d+(\.\d+)*\.?$", val):
        return True
    if _word_count(val) < 5:
        return True
    if strict and _is_forbidden_text(val):
        return True
    return False


def _is_fragmented_intent(text: str) -> bool:
    val = (text or "").strip()
    if not val:
        return True
    if val.endswith(","):
        return True
    if val.count(",") >= 3:
        return True
    if _word_count(val) < 7:
        return True
    return False


def _valid_evidence_refs(evidence: list[str], units: list[dict]) -> list[str]:
    valid_refs = {u.get("ref") for u in units if u.get("ref")}
    refs: list[str] = []
    for ref in evidence:
        if ref in valid_refs and ref not in refs:
            refs.append(ref)
        if len(refs) >= 6:
            break
    if refs:
        return refs
    return [u["ref"] for u in units[:3] if u.get("ref")]


def _self_check(candidate: dict) -> bool:
    title_ok = 3 <= _word_count(candidate.get("title", "")) <= 6
    activities = candidate.get("activities") or []
    acts_ok = len(activities) >= 2 and all(_word_count(_strip_activity_tags(a)) <= 12 for a in activities)
    quick_approve = bool(candidate.get("intent")) and bool(candidate.get("scope"))
    return title_ok and acts_ok and quick_approve


def _fallback_candidate(units: list[dict], file_name: str, file_type: str) -> dict:
    primary_type = _fallback_doc_type(file_type=file_type, file_name=file_name)
    scope_text, scope_refs = _extract_scope(units)
    acts = _extract_activities(units)

    base_title = Path(file_name).stem.replace("_", " ").replace("-", " ")
    title = _sanitize_title(base_title, Path(file_name).stem)

    intent = _single_sentence("Enable leadership to approve documented business commitments and capability outcomes")
    scope = _single_sentence(scope_text)
    if _is_low_quality_sentence(scope):
        scope = _single_sentence(
            "Covers explicitly stated requirements and activity boundaries from the uploaded document"
        )
    activities = [_sanitize_activity(a["description"]) for a in acts]
    activities = [a for a in activities if a and not _is_forbidden_text(a)]
    if len(activities) < 2:
        activities = [
            "Define documented scope boundaries",
            "Identify explicit business requirements",
            "Validate activity clusters with leadership",
        ]
    target_count = min(12, max(3, len(activities)))
    activities = [_format_activity_with_tags(a) for a in activities[:target_count]]

    candidate = {
        "title": title,
        "intent": intent,
        "scope": scope,
        "activities": activities,
        "evidence": _valid_evidence_refs(scope_refs + [a["citation"] for a in acts], units),
        "confidence": "Medium" if scope_text and acts else "Low",
        "_doc_type": primary_type,
    }
    return candidate


def _fallback_understanding(units: list[dict], file_name: str, file_type: str) -> dict:
    primary_type = _fallback_doc_type(file_type=file_type, file_name=file_name)
    scope_text, scope_refs = _extract_scope(units)
    activities = _extract_activities(units)

    intent = _single_sentence(scope_text)
    if _is_low_quality_sentence(intent, strict=False):
        intent = "Document intent is unclear."

    outcomes = []
    for activity in activities[:8]:
        line = _sanitize_outcome(activity.get("description", ""))
        if line:
            outcomes.append(line)
    if len(outcomes) < 2:
        outcomes = ["Clarify business objective", "Confirm explicit expected outcomes"]

    theme = _sanitize_title(Path(file_name).stem, Path(file_name).stem)
    dominant_theme = " ".join(theme.split()[:3]) or "Document Theme"
    evidence = _valid_evidence_refs(scope_refs + [a["citation"] for a in activities], units)

    is_clear = intent != "Document intent is unclear." and bool(evidence)
    if not is_clear:
        outcomes = ["Clarify business objective", "Confirm explicit expected outcomes"]
    return {
        "primary_intent": intent if is_clear else "Document intent is unclear.",
        "explicit_outcomes": outcomes[:8],
        "dominant_theme": dominant_theme[:80],
        "evidence": evidence,
        "confidence": "Medium" if is_clear else "Low",
        "is_clear": is_clear,
        "_doc_type": primary_type,
    }


def _normalize_understanding(data: dict, fallback: dict, units: list[dict]) -> dict:
    if not isinstance(data, dict):
        raise LLMClientError("Model returned non-object JSON. Expected a JSON object.")
    intent = str(
        data.get("Primary intent (1 sentence)")
        or data.get("primary_intent")
        or data.get("intent")
        or fallback["primary_intent"]
    )
    intent = _single_sentence(intent)
    if _is_low_quality_sentence(intent, strict=False):
        intent = "Document intent is unclear."

    raw_outcomes = (
        data.get("Explicit outcomes (bullet list)")
        or data.get("explicit_outcomes")
        or data.get("outcomes")
        or fallback["explicit_outcomes"]
    )
    if isinstance(raw_outcomes, list):
        items = raw_outcomes
    else:
        items = re.split(r"[\n,;]", str(raw_outcomes))
    outcomes: list[str] = []
    seen: set[str] = set()
    for item in items:
        cleaned = _sanitize_outcome(str(item))
        if not cleaned:
            continue
        if cleaned.lower().startswith("they demand "):
            continue
        if cleaned.count(",") >= 3:
            continue
        k = cleaned.lower()
        if k in seen:
            continue
        seen.add(k)
        outcomes.append(cleaned)
        if len(outcomes) >= 8:
            break
    if len(outcomes) < 2:
        outcomes = fallback["explicit_outcomes"][:8]

    dominant_theme = str(
        data.get("Dominant capability/theme (1 phrase)")
        or data.get("dominant_theme")
        or fallback["dominant_theme"]
    ).strip()
    dominant_theme = _sanitize_title(dominant_theme, fallback["dominant_theme"])

    raw_evidence = data.get("Evidence") or data.get("evidence") or fallback["evidence"]
    if isinstance(raw_evidence, list):
        refs = [str(x).strip() for x in raw_evidence if str(x).strip()]
    else:
        refs = [x.strip() for x in re.split(r"[\n,;]", str(raw_evidence)) if x.strip()]
    evidence = _valid_evidence_refs(refs, units)

    confidence = str(data.get("Confidence") or data.get("confidence") or fallback["confidence"])
    if confidence not in {"High", "Medium", "Low"}:
        confidence = fallback["confidence"]

    if intent != "Document intent is unclear." and _is_fragmented_intent(intent):
        intent = "Enable automated document understanding and confidence-based workflow decisions."

    is_clear = intent != "Document intent is unclear." and bool(evidence)
    if not is_clear:
        outcomes = ["Clarify business objective", "Confirm explicit expected outcomes"]
    return {
        "primary_intent": intent if is_clear else "Document intent is unclear.",
        "explicit_outcomes": outcomes,
        "dominant_theme": dominant_theme,
        "evidence": evidence,
        "confidence": confidence if is_clear else "Low",
        "is_clear": is_clear,
        "_doc_type": fallback["_doc_type"],
    }


def _coverage_metadata(units: list[dict]) -> dict:
    refs = [u.get("ref", "") for u in units if u.get("ref")]
    page_numbers = []
    for ref in refs:
        m = re.match(r"^page:(\d+)(?::|$)", ref)
        if m:
            page_numbers.append(int(m.group(1)))
    return {
        "units_processed": len(units),
        "refs_sample": refs[:12],
        "pages_detected": sorted(set(page_numbers)) if page_numbers else [],
    }


def _normalize_candidate(data: dict, fallback: dict, units: list[dict], file_name: str) -> dict:
    if not isinstance(data, dict):
        raise LLMClientError("Model returned non-object JSON. Expected a JSON object.")
    candidate = {
        "title": _sanitize_title(str(data.get("Title") or data.get("title") or ""), Path(file_name).stem),
        "intent": _single_sentence(str(data.get("Intent") or data.get("intent") or fallback["intent"])),
        "scope": _single_sentence(str(data.get("Scope") or data.get("scope") or fallback["scope"])),
        "activities": [],
        "evidence": [],
        "confidence": str(data.get("Confidence") or data.get("confidence") or fallback["confidence"]),
        "_doc_type": fallback["_doc_type"],
    }

    raw_activities = data.get("Activities") or data.get("activities") or fallback["activities"]
    if isinstance(raw_activities, list):
        items = raw_activities
    else:
        items = re.split(r"[\n,;]", str(raw_activities))
    seen: set[str] = set()
    for item in items:
        raw_text = ""
        raw_tags: object = []
        if isinstance(item, dict):
            raw_text = str(
                item.get("activity")
                or item.get("task")
                or item.get("name")
                or item.get("description")
                or ""
            )
            raw_tags = item.get("tags") or item.get("tag") or []
        else:
            raw_text = str(item)

        act = _sanitize_activity(raw_text)
        if not act or _is_forbidden_text(act):
            continue
        key = act.lower()
        if key in seen:
            continue
        seen.add(key)
        tagged = _format_activity_with_tags(act, _coerce_activity_tags(raw_tags, act))
        if tagged:
            candidate["activities"].append(tagged)
        if len(candidate["activities"]) >= 12:
            break

    if len(candidate["activities"]) < 2:
        candidate["activities"] = fallback["activities"][:12]

    raw_evidence = data.get("Evidence") or data.get("evidence") or fallback["evidence"]
    refs: list[str] = []
    if isinstance(raw_evidence, list):
        refs = [str(x).strip() for x in raw_evidence if str(x).strip()]
    else:
        refs = [x.strip() for x in re.split(r"[\n,;]", str(raw_evidence)) if x.strip()]
    candidate["evidence"] = _valid_evidence_refs(refs, units)

    if candidate["confidence"] not in {"High", "Medium", "Low"}:
        candidate["confidence"] = fallback["confidence"]

    if _is_low_quality_sentence(candidate["intent"]) or _is_low_quality_sentence(candidate["scope"]):
        candidate["intent"] = fallback["intent"]
        candidate["scope"] = fallback["scope"]

    if not _self_check(candidate):
        candidate["title"] = _sanitize_title(candidate["title"], Path(file_name).stem)
        candidate["intent"] = _single_sentence(candidate["intent"] or fallback["intent"])
        candidate["scope"] = _single_sentence(candidate["scope"] or fallback["scope"])
        candidate["activities"] = (candidate["activities"] or fallback["activities"])[:12]
        candidate["evidence"] = candidate["evidence"] or fallback["evidence"]

    return candidate


def _map_to_phase(activity: str) -> str:
    low = activity.lower()
    if any(k in low for k in ["assess", "analysis", "discover", "review current", "evaluate"]):
        return "Discovery / Assessment"
    if any(k in low for k in ["design", "blueprint", "architecture", "define"]):
        return "Design"
    if any(k in low for k in ["build", "implement", "develop", "integrate", "enable"]):
        return "Build / Enablement"
    if any(k in low for k in ["validate", "test", "compliance", "audit"]):
        return "Validation / Compliance"
    return "Rollout / Adoption"


def _fallback_v2(units: list[dict], file_name: str, file_type: str) -> dict:
    text_lines = [u["text"].strip() for u in units if u.get("text")]
    title = text_lines[0][:255] if text_lines else Path(file_name).stem
    primary_type = _fallback_doc_type(file_type=file_type, file_name=file_name)

    scope_text, scope_refs = _extract_scope(units)
    activities = _extract_activities(units)

    in_scope = []
    if scope_text:
        in_scope.append({"item": scope_text, "citations": scope_refs})
    in_scope.extend(
        {"item": a["description"], "citations": [a["citation"]]} for a in activities[:6]
    )

    out_scope = []
    for unit in units:
        low = unit["text"].lower()
        if any(k in low for k in ["out of scope", "excluded", "not included", "exclusion"]):
            out_scope.append({"item": unit["text"][:220], "citations": [unit["ref"]]})

    phases_map: dict[str, dict] = {}
    for a in activities:
        phase = _map_to_phase(a["description"])
        if phase not in phases_map:
            phases_map[phase] = {
                "phase_name": phase,
                "purpose": f"Cover {phase.lower()} intent mentioned in the document.",
                "citations": [],
            }
        if a["citation"] not in phases_map[phase]["citations"]:
            phases_map[phase]["citations"].append(a["citation"])

    phase_order = [
        "Discovery / Assessment",
        "Design",
        "Build / Enablement",
        "Validation / Compliance",
        "Rollout / Adoption",
    ]
    phases = [phases_map[p] for p in phase_order if p in phases_map]

    task_clusters: list[dict] = []
    for phase in phases:
        related = [a for a in activities if _map_to_phase(a["description"]) == phase["phase_name"]]
        clusters = [
            {
                "description": a["description"],
                "why": "Derived directly from document statements.",
                "citations": [a["citation"]],
            }
            for a in related[:8]
        ]
        task_clusters.append({"phase_name": phase["phase_name"], "clusters": clusters})

    abstract_parts = []
    if scope_text:
        abstract_parts.append(scope_text)
    if activities:
        abstract_parts.append(f"Key expectations include {', '.join(a['description'] for a in activities[:3])}.")
    executive_abstract = " ".join(abstract_parts)[:150]

    assumptions = []
    if not scope_text:
        assumptions.append("Scope statement is unclear or missing; needs leadership clarification.")
    if not out_scope:
        assumptions.append("Out-of-scope boundaries are not explicitly stated.")
    if not phases:
        assumptions.append("Phase structure is weakly implied; confirm intended phase grouping.")

    confidence = "Medium" if scope_text and activities else "Low"

    return {
        "document_classification": {
            "primary_document_type": primary_type,
            "confidence": confidence,
            "reason": "Type inferred from filename extension and document language.",
            "citations": [units[0]["ref"]] if units else [],
        },
        "executive_abstract": executive_abstract,
        "scope_definition": {
            "in_scope_items": in_scope,
            "out_of_scope_items": out_scope,
        },
        "proposed_phases": phases,
        "task_clusters_per_phase": task_clusters,
        "assumptions_clarifications": assumptions,
        "approval_request": {
            "warning": "This roadmap structure is a PROPOSAL derived from uploaded documents. No roadmap items will be finalized or executed without explicit approval.",
            "checklist": [
                "Document understanding is correct",
                "Phases are acceptable",
                "Task clusters reflect intent",
                "Clarifications listed are valid",
            ],
        },
    }


def _normalize_v2(data: dict, fallback: dict) -> dict:
    doc_cls = data.get("document_classification") or {}
    scope = data.get("scope_definition") or {}
    in_scope = scope.get("in_scope_items") or []
    out_scope = scope.get("out_of_scope_items") or []

    phases = data.get("proposed_phases") or []
    clusters = data.get("task_clusters_per_phase") or []
    assumptions = data.get("assumptions_clarifications") or []

    norm = {
        "document_classification": {
            "primary_document_type": str(doc_cls.get("primary_document_type") or fallback["document_classification"]["primary_document_type"]),
            "confidence": str(doc_cls.get("confidence") or fallback["document_classification"]["confidence"]),
            "reason": str(doc_cls.get("reason") or fallback["document_classification"]["reason"]),
            "citations": [str(c) for c in (doc_cls.get("citations") or [])][:6],
        },
        "executive_abstract": str(data.get("executive_abstract") or fallback["executive_abstract"])[:350],
        "scope_definition": {
            "in_scope_items": [
                {
                    "item": str(x.get("item") or "")[:300],
                    "citations": [str(c) for c in (x.get("citations") or [])][:4],
                }
                for x in in_scope
                if isinstance(x, dict) and str(x.get("item") or "").strip()
            ][:12],
            "out_of_scope_items": [
                {
                    "item": str(x.get("item") or "")[:300],
                    "citations": [str(c) for c in (x.get("citations") or [])][:4],
                }
                for x in out_scope
                if isinstance(x, dict) and str(x.get("item") or "").strip()
            ][:10],
        },
        "proposed_phases": [
            {
                "phase_name": str(p.get("phase_name") or "")[:80],
                "purpose": str(p.get("purpose") or "")[:220],
                "citations": [str(c) for c in (p.get("citations") or [])][:6],
            }
            for p in phases
            if isinstance(p, dict) and str(p.get("phase_name") or "").strip()
        ][:8],
        "task_clusters_per_phase": [
            {
                "phase_name": str(tc.get("phase_name") or "")[:80],
                "clusters": [
                    {
                        "description": str(c.get("description") or "")[:220],
                        "why": str(c.get("why") or "")[:220],
                        "citations": [str(x) for x in (c.get("citations") or [])][:4],
                    }
                    for c in (tc.get("clusters") or [])
                    if isinstance(c, dict) and str(c.get("description") or "").strip()
                ][:12],
            }
            for tc in clusters
            if isinstance(tc, dict) and str(tc.get("phase_name") or "").strip()
        ][:8],
        "assumptions_clarifications": [str(a)[:260] for a in assumptions if str(a).strip()][:12],
        "approval_request": {
            "warning": str((data.get("approval_request") or {}).get("warning") or fallback["approval_request"]["warning"]),
            "checklist": [
                str(x)
                for x in ((data.get("approval_request") or {}).get("checklist") or fallback["approval_request"]["checklist"])
                if str(x).strip()
            ][:6],
        },
    }

    if norm["document_classification"]["primary_document_type"] not in DOC_TYPES:
        norm["document_classification"]["primary_document_type"] = fallback["document_classification"]["primary_document_type"]
    if norm["document_classification"]["confidence"] not in {"High", "Medium", "Low"}:
        norm["document_classification"]["confidence"] = fallback["document_classification"]["confidence"]

    if not norm["scope_definition"]["in_scope_items"]:
        norm["scope_definition"]["in_scope_items"] = fallback["scope_definition"]["in_scope_items"]
    if not norm["proposed_phases"]:
        norm["proposed_phases"] = fallback["proposed_phases"]
    if not norm["task_clusters_per_phase"]:
        norm["task_clusters_per_phase"] = fallback["task_clusters_per_phase"]
    if not norm["assumptions_clarifications"]:
        norm["assumptions_clarifications"] = fallback["assumptions_clarifications"]
    if not norm["executive_abstract"]:
        norm["executive_abstract"] = fallback["executive_abstract"]

    return norm


def generate_intake_analysis_v2(
    file_path: str,
    file_type: str,
    file_name: str,
    provider: str = "",
    model: str = "",
    api_key: str = "",
    base_url: str = "",
    guidance: str = "",
) -> tuple[dict, dict]:
    units = extract_document_units(file_path=file_path, file_type=file_type)
    fallback = _fallback_understanding(units=units, file_name=file_name, file_type=file_type)
    llm_attempted = bool(provider and model)
    llm_success = False
    llm_error = ""

    if not llm_attempted:
        understanding = fallback
    else:
        units_for_prompt = "\n".join([f"[{u['ref']}] {u['text']}" for u in units[:260]])
        guidance_block = f"\nOperator guidance:\n{guidance}\nUse this to focus extraction while staying evidence-grounded.\n" if guidance else ""
        prompt = f"""
You are a Roadmap Intake Agent.

Before creating any roadmap candidate, you must prove that you understand the document.

You must extract:
1. The primary business intent of the document
2. The concrete outcomes explicitly described
3. The dominant theme or capability discussed

If you cannot extract these clearly from the document,
you must STOP and set primary intent to exactly:
"Document intent is unclear."

Required output (JSON keys exactly):
- Primary intent (1 sentence)
- Explicit outcomes (bullet list)
- Dominant capability/theme (1 phrase)
- Evidence
- Confidence

Rules:
- Primary intent must be one sentence.
- Explicit outcomes must be 2-8 bullets, concrete and explicit.
- Dominant capability/theme must be one short phrase.
- Evidence must be document references only (no copied paragraphs).
- Confidence must be High / Medium / Low.
- Prioritize objective/scope/requirements/activities sections.
- Deprioritize tagline/marketing text.
{guidance_block}

Document name: {file_name}
Document units with references:
{units_for_prompt}
""".strip()
        try:
            raw = call_llm_json(
                provider=provider,
                model=model,
                api_key=api_key,
                base_url=base_url,
                prompt=prompt,
            )
            understanding = _normalize_understanding(raw, fallback, units)
            llm_success = True
        except LLMClientError as exc:
            understanding = fallback
            llm_error = str(exc)
        except Exception as exc:
            understanding = fallback
            llm_error = str(exc)

    type_to_class = {
        "BRD": "brd",
        "RFP": "rfp",
        "Vision / Strategy Document": "ppt",
        "SoW": "other",
        "Policy / Compliance Document": "other",
        "Mixed / Composite Document": "other",
    }
    primary_type = understanding["_doc_type"]

    flat = {
        "document_class": type_to_class.get(primary_type, "other"),
        "title": "",
        "scope": "",
        "activities": [],
        "source_quotes": understanding["evidence"][:8],
        "primary_type": primary_type,
        "confidence": understanding["confidence"],
        "understanding_clear": understanding["is_clear"],
    }

    analysis_output = {
        "document_understanding_check": {
            "Primary intent (1 sentence)": understanding["primary_intent"],
            "Explicit outcomes (bullet list)": understanding["explicit_outcomes"],
            "Dominant capability/theme (1 phrase)": understanding["dominant_theme"],
            "Evidence": understanding["evidence"],
            "Confidence": understanding["confidence"],
        },
        "llm_runtime": {
            "provider": provider or "",
            "model": model or "",
            "attempted": llm_attempted,
            "success": llm_success,
            "error": llm_error,
        },
        "parser_coverage": _coverage_metadata(units),
    }

    return analysis_output, flat


def generate_roadmap_candidate_from_document(
    file_path: str,
    file_type: str,
    file_name: str,
    understanding_check: dict,
    provider: str = "",
    model: str = "",
    api_key: str = "",
    base_url: str = "",
    guidance: str = "",
) -> tuple[dict, dict]:
    units = extract_document_units(file_path=file_path, file_type=file_type)
    fallback = _fallback_candidate(units=units, file_name=file_name, file_type=file_type)
    llm_attempted = bool(provider and model)
    llm_success = False
    llm_error = ""

    primary_intent = str(understanding_check.get("Primary intent (1 sentence)") or "").strip()
    if primary_intent == "Document intent is unclear.":
        raise ValueError("Document intent is unclear.")

    if not llm_attempted:
        candidate = fallback
    else:
        units_for_prompt = "\n".join([f"[{u['ref']}] {u['text']}" for u in units[:260]])
        guidance_block = f"\nOperator guidance:\n{guidance}\nUse this to prioritize relevant document sections.\n" if guidance else ""
        prompt = f"""
SYSTEM / GOVERNANCE INSTRUCTION
You are a Roadmap Intake Agent.

Your job is NOT to summarize documents.
Your job is to propose business commitments that can be approved by executives.

Documents are evidence.
Roadmaps are decisions.

You must NEVER copy document text into roadmap fields.
If a roadmap field sounds like marketing or prose, it is wrong.

You must convert:
- Document descriptions -> business intent
- Features -> capabilities
- Sections -> activity clusters

You may ONLY output a ROADMAP CANDIDATE object.
No UI fields. No prose. No summaries.

ROADMAP CANDIDATE - STRICT FORMAT (JSON object keys exactly):
Title
Intent
Scope
Activities
Evidence
Confidence

Field rules:
- Title: 3-6 words, noun phrase
- Intent: one sentence, business reason
- Scope: one sentence, boundary definition
- Activities: choose count based on document complexity (minimum 3, maximum 12), verb-led items, each <12 words
- Activities format: list of objects with keys "activity" and "tags"
- Tags must be one or more from: FE, BE, AI
- Evidence: document references only (no quotes)
- Confidence: High / Medium / Low
{guidance_block}

Approved understanding context:
{understanding_check}

Document name: {file_name}
Document units with references:
{units_for_prompt}
""".strip()
        try:
            raw = call_llm_json(
                provider=provider,
                model=model,
                api_key=api_key,
                base_url=base_url,
                prompt=prompt,
            )
            candidate = _normalize_candidate(raw, fallback, units, file_name=file_name)
            llm_success = True
        except LLMClientError as exc:
            candidate = fallback
            llm_error = str(exc)
        except Exception as exc:
            candidate = fallback
            llm_error = str(exc)

    analysis_output = {
        "roadmap_candidate": {
            "Title": candidate["title"],
            "Intent": candidate["intent"],
            "Scope": candidate["scope"],
            "Activities": candidate["activities"],
            "Evidence": candidate["evidence"],
            "Confidence": candidate["confidence"],
        },
        "llm_runtime": {
            "provider": provider or "",
            "model": model or "",
            "attempted": llm_attempted,
            "success": llm_success,
            "error": llm_error,
        },
        "parser_coverage": _coverage_metadata(units),
    }
    flat = {
        "document_class": {
            "BRD": "brd",
            "RFP": "rfp",
            "Vision / Strategy Document": "ppt",
            "SoW": "other",
            "Policy / Compliance Document": "other",
            "Mixed / Composite Document": "other",
        }.get(candidate["_doc_type"], "other"),
        "title": candidate["title"][:255],
        "scope": candidate["scope"][:2000],
        "activities": candidate["activities"][:20],
        "source_quotes": candidate["evidence"][:8],
        "primary_type": candidate["_doc_type"],
        "confidence": candidate["confidence"],
    }
    return analysis_output, flat


# Backward-compatible wrapper used by existing route code

def classify_and_extract(
    file_path: str,
    file_type: str,
    file_name: str,
    provider: str = "",
    model: str = "",
    api_key: str = "",
    base_url: str = "",
) -> dict:
    _, flat = generate_intake_analysis_v2(
        file_path=file_path,
        file_type=file_type,
        file_name=file_name,
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base_url,
    )
    return {
        "document_class": flat["document_class"],
        "title": flat["title"],
        "scope": flat["scope"],
        "activities": flat["activities"],
        "source_quotes": flat["source_quotes"],
    }
