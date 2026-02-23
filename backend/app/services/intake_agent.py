from pathlib import Path
import re
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph
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

BASE_ACTIVITY_VERBS = ACTION_VERBS | {
    "build",
    "create",
    "configure",
    "develop",
    "refine",
    "optimize",
    "enforce",
}

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

ACTION_LINE_VERBS = {
    "build",
    "implement",
    "validate",
    "normalize",
    "classify",
    "parse",
    "extract",
    "generate",
    "render",
    "enforce",
    "import",
    "export",
    "map",
    "bind",
    "route",
    "store",
    "upload",
    "compute",
    "log",
    "track",
    "detect",
    "fix",
}

TECHNICAL_HEADING_HINTS = {
    "schema",
    "contract",
    "parser",
    "normalizer",
    "workflow",
    "state",
    "validation",
    "enforcement",
    "audit",
    "logging",
    "agent",
    "risk",
    "architecture",
    "pipeline",
    "classification",
    "import",
    "export",
    "persistence",
    "layout",
}

HIGH_VALUE_ACTION_HINTS = TECHNICAL_HEADING_HINTS | {
    "workflow",
    "json",
    "node",
    "edge",
    "approval",
    "connectivity",
    "branch",
    "state machine",
    "traceability",
}

METADATA_LINE_HINTS = {
    "generated:",
    "prepared for:",
    "status:",
    "end of phase",
}

CONCRETE_ACTIVITY_HINTS = {
    "api",
    "endpoint",
    "schema",
    "validator",
    "capacity",
    "quota",
    "audit",
    "dashboard",
    "workflow",
    "roadmap",
    "commitment",
    "intake",
    "notification",
    "policy",
    "approval",
    "timeline",
    "resource",
    "service",
    "parser",
    "normalizer",
    "state",
    "history",
    "rbac",
    "jwt",
}

GENERIC_ACTIVITY_WORDS = {
    "core",
    "node",
    "module",
    "system",
    "platform",
    "process",
    "workflow",
    "support",
    "enablement",
    "improvement",
    "optimization",
    "framework",
    "structure",
    "model",
    "schema",
    "capability",
    "solution",
}

ACTIVITY_ACRONYMS = {"API", "UI", "UX", "JSON", "RBAC", "JWT", "FTE", "LLM", "AI", "ML", "NLP", "OCR"}
NOISY_ACTIVITY_WORDS = {"requires", "require", "should", "must", "would", "could", "may"}
ACTIVITY_REWRITE_THRESHOLD = 70

TABULAR_ACTIVITY_FIELD_HINTS = (
    "activity",
    "task",
    "work item",
    "workstream",
    "description",
    "feature",
    "deliverable",
    "story",
    "action",
)

TABULAR_TAG_FIELD_HINTS = (
    "owner",
    "role",
    "lane",
    "stream",
    "team",
    "function",
    "squad",
    "discipline",
)

ACTIVITY_TAG_RE = re.compile(r"^\[(FE|BE|AI)(?:/(FE|BE|AI))*\]\s*", flags=re.IGNORECASE)
ACTION_LINE_RE = re.compile(r"\b(" + "|".join(ACTION_LINE_VERBS) + r")\w*\b", flags=re.IGNORECASE)


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


def _activity_verb(activity: str) -> str:
    plain = _strip_activity_tags(activity).strip()
    if not plain:
        return ""
    first = plain.split()[0].lower()
    return re.sub(r"[^a-z]", "", first)


def _activity_quality_score(activity: str) -> int:
    plain = _strip_activity_tags(activity).strip()
    if not plain:
        return 0
    words = re.findall(r"[A-Za-z0-9\-]+", plain)
    if not words:
        return 0
    low_words = [w.lower() for w in words]
    score = 0

    if _activity_verb(plain) in BASE_ACTIVITY_VERBS or _activity_verb(plain) in ACTION_LINE_VERBS:
        score += 25

    wc = len(words)
    if 4 <= wc <= 12:
        score += 20
    elif 3 <= wc <= 14:
        score += 10

    tags = _activity_tags(activity)
    if tags:
        score += 10

    if any(h in " ".join(low_words) for h in CONCRETE_ACTIVITY_HINTS):
        score += 25

    if any(tok in low_words for tok in ("for", "with", "to")):
        score += 5

    if _is_forbidden_text(plain):
        score -= 20

    if plain.count(",") >= 2 or " is " in f" {plain.lower()} ":
        score -= 15

    if any(x in plain.lower() for x in ("pre-existing", "conforming to", "etc", "and/or")):
        score -= 10
    if any(w in plain.lower().split() for w in NOISY_ACTIVITY_WORDS):
        score -= 10

    non_stop = [w for w in low_words if len(w) > 2 and w not in STOPWORDS]
    if non_stop:
        generic_hits = sum(1 for w in non_stop if w in GENERIC_ACTIVITY_WORDS)
        generic_ratio = generic_hits / max(1, len(non_stop))
        if generic_ratio >= 0.75:
            score -= 20
        elif generic_ratio >= 0.5:
            score -= 10

    return max(0, min(100, score))


def _evaluate_activity_set(activities: list[str]) -> dict[str, Any]:
    scored = [{"activity": a, "score": _activity_quality_score(a)} for a in activities]
    weak = [x["activity"] for x in scored if x["score"] < ACTIVITY_REWRITE_THRESHOLD]
    avg = round(sum(x["score"] for x in scored) / len(scored), 1) if scored else 0.0
    return {
        "average_score": avg,
        "weak_count": len(weak),
        "weak_activities": weak[:8],
        "total": len(scored),
    }


def _promote_best_activities(primary: list[str], pool: list[str], target: int) -> list[str]:
    seen: set[str] = set()
    ranked = sorted(
        [a for a in primary if a],
        key=lambda x: (_activity_quality_score(x), -len(_strip_activity_tags(x))),
        reverse=True,
    )
    out: list[str] = []
    for act in ranked:
        k = act.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(act)

    if len(out) < target:
        pool_ranked = sorted(
            [a for a in pool if a],
            key=lambda x: (_activity_quality_score(x), -len(_strip_activity_tags(x))),
            reverse=True,
        )
        for act in pool_ranked:
            if len(out) >= target:
                break
            k = act.lower()
            if k in seen:
                continue
            seen.add(k)
            out.append(act)
    return out[:target]


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


def _parse_page_no(ref: str) -> int:
    m = re.search(r"page:(\d+)", ref or "")
    if not m:
        return 0
    return int(m.group(1))


def _extract_numbered_heading_text(line: str) -> str:
    text = re.sub(r"^\d+(?:\.\d+)+\s+", "", (line or "").strip())
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _is_numbered_heading(line: str) -> bool:
    return bool(re.match(r"^\d+(?:\.\d+)+\s+", (line or "").strip()))


def _has_activity_signal(line: str) -> bool:
    low = (line or "").lower()
    if low.startswith("yavar.ai phase"):
        return False
    if any(h in low for h in METADATA_LINE_HINTS):
        return False
    if line.startswith(("-", "*", "•")) or re.match(r"^\d+[\.\)]\s+", line):
        return True
    return bool(ACTION_LINE_RE.search(low))


def _is_high_value_action_line(line: str) -> bool:
    low = (line or "").lower()
    if any(x in low for x in ("does not", "not do", "cannot", "can't", "prepared for")):
        return False
    if not _has_activity_signal(line):
        return False
    return any(k in low for k in HIGH_VALUE_ACTION_HINTS)


def _activity_tags(activity: str) -> list[str]:
    m = ACTIVITY_TAG_RE.match(activity or "")
    if not m:
        return _infer_activity_tags(activity)
    text = m.group(0).strip()[1:-1]
    tags = []
    for raw in text.split("/"):
        norm = _normalize_activity_tag(raw)
        if norm and norm not in tags:
            tags.append(norm)
    return tags or _infer_activity_tags(activity)


def _lane_counts(activities: list[str]) -> dict[str, int]:
    counts = {"FE": 0, "BE": 0, "AI": 0}
    for act in activities:
        for tag in _activity_tags(act):
            counts[tag] += 1
    return counts


def _doc_complexity_profile(units: list[dict], file_name: str, file_type: str) -> dict[str, Any]:
    pages = sorted({_parse_page_no(u.get("ref", "")) for u in units if _parse_page_no(u.get("ref", "")) > 0})
    page_count = len(pages)
    heading_count = sum(1 for u in units if _is_numbered_heading(str(u.get("text") or "").strip()))
    activity_signal_count = sum(1 for u in units[:1200] if _has_activity_signal(str(u.get("text") or "").strip()))
    ai_signal_count = sum(
        1 for u in units[:1200] if any(k in str(u.get("text") or "").lower() for k in (" ai ", "llm", "model", "nlp", "agent"))
    )
    fe_signal_count = sum(
        1
        for u in units[:1200]
        if any(k in str(u.get("text") or "").lower() for k in ("ui", "ux", "canvas", "render", "react", "frontend"))
    )
    doc_type = _fallback_doc_type(file_type=file_type, file_name=file_name)

    score = 0
    if page_count >= 12:
        score += 2
    elif page_count >= 6:
        score += 1
    if heading_count >= 25:
        score += 2
    elif heading_count >= 10:
        score += 1
    if activity_signal_count >= 40:
        score += 2
    elif activity_signal_count >= 20:
        score += 1

    if score >= 4:
        level = "high"
        commitment_target = 16
        commitment_min = 10
        commitment_max = 20
        implementation_target = 32
        implementation_max = 40
        understanding_outcomes_max = 12
        prompt_units_understanding = 420
        prompt_units_candidate = 420
    elif score >= 2:
        level = "medium"
        commitment_target = 12
        commitment_min = 8
        commitment_max = 16
        implementation_target = 24
        implementation_max = 30
        understanding_outcomes_max = 10
        prompt_units_understanding = 340
        prompt_units_candidate = 340
    else:
        level = "low"
        commitment_target = 8
        commitment_min = 5
        commitment_max = 12
        implementation_target = 16
        implementation_max = 20
        understanding_outcomes_max = 8
        prompt_units_understanding = 260
        prompt_units_candidate = 260

    lane_minimums = {
        "FE": 4 if fe_signal_count >= 8 and level == "high" else 2,
        "BE": 6 if level == "high" else 4,
        "AI": 3 if ai_signal_count >= 6 and level == "high" else (2 if ai_signal_count >= 3 else 1),
    }

    return {
        "doc_type": doc_type,
        "level": level,
        "score": score,
        "page_count": page_count,
        "heading_count": heading_count,
        "activity_signal_count": activity_signal_count,
        "ai_signal_count": ai_signal_count,
        "fe_signal_count": fe_signal_count,
        "commitment_target": commitment_target,
        "commitment_min": commitment_min,
        "commitment_max": commitment_max,
        "implementation_target": implementation_target,
        "implementation_max": implementation_max,
        "understanding_outcomes_max": understanding_outcomes_max,
        "prompt_units_understanding": prompt_units_understanding,
        "prompt_units_candidate": prompt_units_candidate,
        "lane_minimums": lane_minimums,
    }


def _select_units_for_prompt(units: list[dict], mode: str, max_units: int) -> list[dict]:
    if len(units) <= max_units:
        return units

    term_map = {
        "understanding": (
            "objective",
            "scope",
            "requirements",
            "purpose",
            "problem statement",
            "business",
            "outcomes",
            "phase",
        ),
        "candidate": (
            "schema",
            "workflow",
            "parser",
            "normalizer",
            "state",
            "validation",
            "audit",
            "log",
            "agent",
            "build",
            "implement",
            "activity",
            "task",
            "workstream",
            "owner",
            "role",
            "lane",
            "effort",
            "dependency",
        ),
    }
    terms = term_map.get(mode, term_map["candidate"])
    picks: list[int] = []
    seen = set()

    def _add(idx: int) -> None:
        if idx < 0 or idx >= len(units) or idx in seen:
            return
        picks.append(idx)
        seen.add(idx)

    # Keep early context and final summary pages.
    for idx in range(min(40, len(units))):
        _add(idx)
    for idx in range(max(0, len(units) - 20), len(units)):
        _add(idx)

    # Prefer numbered sections and activity lines.
    for idx, unit in enumerate(units):
        text = str(unit.get("text") or "").strip()
        low = text.lower()
        if _is_numbered_heading(text):
            _add(idx)
            _add(idx + 1)
            continue
        if any(t in low for t in terms) and (_has_activity_signal(text) or len(text) >= 28):
            _add(idx)

    # Uniform coverage across entire document.
    if len(picks) < max_units:
        step = max(1, len(units) // max_units)
        for idx in range(0, len(units), step):
            _add(idx)
            if len(picks) >= max_units:
                break

    ordered = [units[idx] for idx in sorted(picks)]
    return ordered[:max_units]


def _deterministic_activity_candidates(units: list[dict], max_items: int = 80) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    def _add(raw_text: str, force_verb: str = "") -> None:
        text = re.sub(r"\s+", " ", (raw_text or "").strip()).strip(" .")
        text = re.split(r"[.;]", text)[0].strip()
        low = text.lower()
        if not text or len(text) < 16:
            return
        if low.startswith("yavar.ai phase") or any(h in low for h in METADATA_LINE_HINTS):
            return
        if any(x in low for x in ("does not", "not do", "cannot", "can't")):
            return
        if text.count(",") >= 3:
            return
        if _is_forbidden_text(text):
            return
        candidate = text
        if force_verb:
            candidate = f"{force_verb} {candidate}"
        candidate = _sanitize_activity(candidate)
        if not candidate:
            return
        if _word_count(candidate) < 3:
            return
        tagged = _format_activity_with_tags(candidate)
        key = tagged.lower()
        if key in seen:
            return
        seen.add(key)
        out.append(tagged)

    for unit in units:
        line = str(unit.get("text") or "").strip()
        if not line:
            continue
        if _is_numbered_heading(line):
            heading = _extract_numbered_heading_text(line)
            hlow = heading.lower()
            if any(k in hlow for k in TECHNICAL_HEADING_HINTS):
                if any(k in hlow for k in ("schema", "contract")):
                    _add(heading, "Define")
                elif any(k in hlow for k in ("validation", "normalizer", "parser", "enforcement")):
                    _add(heading, "Implement")
                elif any(k in hlow for k in ("audit", "logging", "trace")):
                    _add(heading, "Establish")
                else:
                    _add(heading, "Implement")
        elif _is_high_value_action_line(line):
            cleaned = re.sub(r"^[-*•\d\.\)\s]+", "", line).strip()
            _add(cleaned)
        if len(out) >= max_items:
            break

    return out


def _extract_structured_activity_candidates(units: list[dict], max_items: int = 100) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    for unit in units:
        ref = str(unit.get("ref") or "").lower()
        if not (ref.startswith("sheet:") or ref.startswith("csv:")):
            continue
        text = str(unit.get("text") or "").strip()
        if not text:
            continue
        low = text.lower()
        if "header" in ref and any(h in low for h in TABULAR_ACTIVITY_FIELD_HINTS):
            continue

        # Parse "key: value | key: value" rows from spreadsheet/csv parser.
        field_pairs: list[tuple[str, str]] = []
        for part in [p.strip() for p in text.split("|") if p.strip()]:
            if ":" not in part:
                continue
            key, val = part.split(":", 1)
            k = key.strip().lower()
            v = val.strip()
            if k and v:
                field_pairs.append((k, v))
        fields = {k: v for k, v in field_pairs}

        raw_activity = ""
        for hint in TABULAR_ACTIVITY_FIELD_HINTS:
            for key, value in field_pairs:
                if hint in key and value:
                    raw_activity = value
                    break
            if raw_activity:
                break
        if not raw_activity and len(fields) == 1:
            raw_activity = next(iter(fields.values()))
        if not raw_activity:
            # Fallback for plain table lines.
            first_segment = text.split("|", 1)[0].strip()
            if _has_activity_signal(first_segment) or any(h in first_segment.lower() for h in ACTIVITY_TERMS):
                raw_activity = first_segment
        if not raw_activity:
            continue

        inferred_tags: list[str] = []
        for hint in TABULAR_TAG_FIELD_HINTS:
            for key, value in field_pairs:
                if hint in key:
                    for token in re.split(r"[,/|;+ ]", value):
                        norm = _normalize_activity_tag(token)
                        if norm and norm not in inferred_tags:
                            inferred_tags.append(norm)
        if not inferred_tags:
            inferred_tags = _infer_activity_tags(raw_activity)

        sanitized = _sanitize_activity(raw_activity)
        if not sanitized or _word_count(sanitized) < 3:
            continue
        tagged = _format_activity_with_tags(sanitized, inferred_tags)
        key = tagged.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(tagged)
        if len(out) >= max_items:
            break

    return out


def _ensure_lane_coverage(activities: list[str], candidate_pool: list[str], lane_minimums: dict[str, int], hard_max: int) -> list[str]:
    out = list(activities)
    counts = _lane_counts(out)
    for lane in ("FE", "BE", "AI"):
        needed = max(0, int(lane_minimums.get(lane, 0)) - counts.get(lane, 0))
        if needed <= 0:
            continue
        for cand in candidate_pool:
            if len(out) >= hard_max or needed <= 0:
                break
            tags = _activity_tags(cand)
            if lane not in tags:
                continue
            if cand in out:
                continue
            out.append(cand)
            needed -= 1
    return out


def _merge_activity_sets(
    llm_activities: list[str],
    deterministic_activities: list[str],
    profile: dict[str, Any],
) -> tuple[list[str], list[str]]:
    merged: list[str] = []
    seen: set[str] = set()
    for item in llm_activities + deterministic_activities:
        tagged = _format_activity_with_tags(_strip_activity_tags(item))
        if not tagged:
            continue
        key = tagged.lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(tagged)

    merged = sorted(
        merged,
        key=lambda x: (_activity_quality_score(x), -len(_strip_activity_tags(x))),
        reverse=True,
    )

    merged = _ensure_lane_coverage(
        activities=merged,
        candidate_pool=deterministic_activities,
        lane_minimums=profile.get("lane_minimums", {}),
        hard_max=int(profile.get("implementation_max", 30)),
    )

    commitment_target = int(profile.get("commitment_target", 12))
    commitment_min = int(profile.get("commitment_min", 6))
    commitment_max = int(profile.get("commitment_max", 16))
    implementation_target = int(profile.get("implementation_target", 24))
    implementation_max = int(profile.get("implementation_max", 30))

    commitment_count = min(commitment_max, max(commitment_min, commitment_target))
    commitment = _promote_best_activities(
        primary=merged,
        pool=deterministic_activities,
        target=commitment_count,
    )
    if len(commitment) < commitment_min:
        commitment = _promote_best_activities(
            primary=commitment + merged,
            pool=deterministic_activities,
            target=max(commitment_min, len(commitment)),
        )

    implementation_count = min(implementation_max, max(len(commitment), implementation_target))
    implementation = _promote_best_activities(
        primary=merged,
        pool=deterministic_activities,
        target=implementation_count,
    )
    return commitment, implementation


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
    cleaned = cleaned.replace("_", " ")
    cleaned = cleaned.replace("/", " ")
    cleaned = re.sub(r"\([^)]*\)", "", cleaned)
    cleaned = re.split(r"\s[—-]\s|:\s|;\s|\.\s", cleaned)[0]
    cleaned = re.sub(r"[^A-Za-z0-9\-\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        return ""
    while True:
        parts = cleaned.split()
        if not parts:
            break
        tail = parts[-1].lower()
        if tail in {"is", "are", "was", "were", "to", "for", "with", "and", "or", "of"}:
            cleaned = " ".join(parts[:-1]).strip()
            continue
        break
    if not cleaned:
        return ""
    words = cleaned.split()
    normalized_words: list[str] = []
    for idx, token in enumerate(words):
        plain = re.sub(r"[^A-Za-z0-9\-]", "", token).strip()
        if not plain:
            continue
        if idx > 0 and plain.lower() in NOISY_ACTIVITY_WORDS:
            continue
        upper = plain.upper()
        if upper in ACTIVITY_ACRONYMS:
            normalized_words.append(upper)
        else:
            normalized_words.append(plain.lower())
    words = normalized_words
    if not words:
        return ""
    if len(words) > 10:
        words = words[:10]
    cleaned = " ".join(words)
    first = cleaned.split()[0].lower() if cleaned.split() else ""
    if first not in ACTION_VERBS:
        cleaned = f"Define {cleaned[0].lower() + cleaned[1:]}" if len(cleaned) > 1 else "Define scope"
    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]
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


def _scope_has_boundaries(text: str) -> bool:
    low = (text or "").lower()
    has_include = "include" in low or "includes" in low or "in-scope" in low
    has_boundary = any(
        token in low
        for token in (
            "excluding",
            "exclude",
            "limited to",
            "does not include",
            "out of scope",
            "within documented",
        )
    )
    return has_include and has_boundary


def _compose_scope_from_understanding(
    understanding_check: dict | None,
    activities: list[str],
    fallback_scope: str,
) -> str:
    data = understanding_check or {}
    raw_intent = str(data.get("Primary intent (1 sentence)") or "").strip()
    raw_theme = str(data.get("Dominant capability/theme (1 phrase)") or "").strip()
    raw_outcomes = data.get("Explicit outcomes (bullet list)") or []

    if isinstance(raw_outcomes, list):
        outcome_items = [str(x) for x in raw_outcomes]
    else:
        outcome_items = re.split(r"[\n,;]", str(raw_outcomes))
    outcomes = [_sanitize_outcome(x) for x in outcome_items if _sanitize_outcome(x)]

    activity_items = [_strip_activity_tags(a) for a in activities if _strip_activity_tags(a)]

    theme = _sanitize_title(raw_theme, "Capability Scope")
    if theme.lower() in {"document intent is unclear", "capability scope"} and activity_items:
        theme = _sanitize_title(" ".join(activity_items[:3]), "Capability Scope")

    if raw_intent and raw_intent.lower() != "document intent is unclear.":
        target = _single_sentence(raw_intent, max_chars=140).rstrip(".")
    elif outcomes:
        target = f"deliver {outcomes[0].lower()}"
    elif activity_items:
        target = f"deliver {activity_items[0].lower()}"
    else:
        target = "deliver documented business outcomes"

    outcome_part = ""
    if outcomes:
        outcome_part = ", ".join(outcomes[:2]).lower()
    elif activity_items:
        outcome_part = ", ".join(activity_items[:2]).lower()
    else:
        outcome_part = "explicitly documented requirements"

    scope = (
        f"Scope includes {theme} to {target}, includes {outcome_part}, "
        "and is limited to documented requirements while excluding non-documented integrations, "
        "organization-wide change programs, and post-go-live support."
    )
    finalized = _single_sentence(scope, max_chars=320)
    if _is_low_quality_sentence(finalized, strict=False):
        return _single_sentence(fallback_scope, max_chars=320)
    return finalized


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
    quick_approve = bool(candidate.get("intent")) and bool(candidate.get("scope")) and _scope_has_boundaries(candidate.get("scope", ""))
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


def _normalize_understanding(data: dict, fallback: dict, units: list[dict], max_outcomes: int = 8) -> dict:
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
        if len(outcomes) >= max_outcomes:
            break
    if len(outcomes) < 2:
        outcomes = fallback["explicit_outcomes"][:max_outcomes]

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


def _normalize_candidate(
    data: dict,
    fallback: dict,
    units: list[dict],
    file_name: str,
    understanding_check: dict | None = None,
    max_activities: int = 12,
) -> dict:
    if not isinstance(data, dict):
        raise LLMClientError("Model returned non-object JSON. Expected a JSON object.")
    candidate = {
        "title": _sanitize_title(str(data.get("Title") or data.get("title") or ""), Path(file_name).stem),
        "intent": _single_sentence(str(data.get("Intent") or data.get("intent") or fallback["intent"])),
        "scope": _single_sentence(str(data.get("Scope") or data.get("scope") or fallback["scope"]), max_chars=320),
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
        if len(candidate["activities"]) >= max_activities:
            break

    if len(candidate["activities"]) < 2:
        candidate["activities"] = fallback["activities"][:max_activities]

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

    if _is_low_quality_sentence(candidate["scope"], strict=False) or not _scope_has_boundaries(candidate["scope"]):
        candidate["scope"] = _compose_scope_from_understanding(
            understanding_check=understanding_check,
            activities=candidate["activities"] or fallback["activities"],
            fallback_scope=fallback["scope"],
        )

    if not _self_check(candidate):
        candidate["title"] = _sanitize_title(candidate["title"], Path(file_name).stem)
        candidate["intent"] = _single_sentence(candidate["intent"] or fallback["intent"])
        candidate["scope"] = _compose_scope_from_understanding(
            understanding_check=understanding_check,
            activities=candidate["activities"] or fallback["activities"],
            fallback_scope=candidate["scope"] or fallback["scope"],
        )
        candidate["activities"] = (candidate["activities"] or fallback["activities"])[:max_activities]
        candidate["evidence"] = candidate["evidence"] or fallback["evidence"]

    return candidate


class CandidateGraphState(TypedDict, total=False):
    units: list[dict]
    file_name: str
    file_type: str
    understanding_check: dict
    provider: str
    model: str
    api_key: str
    base_url: str
    guidance: str
    profile: dict[str, Any]
    sampled_units: list[dict]
    fallback_candidate: dict
    llm_attempted: bool
    llm_success: bool
    llm_error: str
    llm_raw_candidate: dict
    candidate: dict
    commitment_activities: list[str]
    implementation_activities: list[str]
    deterministic_activities: list[str]
    structured_activities: list[str]
    commitment_quality: dict[str, Any]
    implementation_quality: dict[str, Any]
    rewrite_summary: dict[str, Any]


def _candidate_graph_prepare_node(state: CandidateGraphState) -> CandidateGraphState:
    units = state.get("units") or []
    file_name = state.get("file_name") or "document"
    file_type = state.get("file_type") or ""
    profile = _doc_complexity_profile(units=units, file_name=file_name, file_type=file_type)
    sampled_units = _select_units_for_prompt(
        units=units,
        mode="candidate",
        max_units=int(profile.get("prompt_units_candidate", 320)),
    )
    fallback_candidate = _fallback_candidate(units=units, file_name=file_name, file_type=file_type)
    return {
        "profile": profile,
        "sampled_units": sampled_units,
        "fallback_candidate": fallback_candidate,
        "llm_attempted": bool(state.get("provider") and state.get("model")),
        "llm_success": False,
        "llm_error": "",
        "llm_raw_candidate": {},
        "candidate": fallback_candidate,
    }


def _candidate_graph_llm_node(state: CandidateGraphState) -> CandidateGraphState:
    if not state.get("llm_attempted"):
        return {}
    sampled_units = state.get("sampled_units") or []
    units_for_prompt = "\n".join([f"[{u['ref']}] {u['text']}" for u in sampled_units])
    guidance = (state.get("guidance") or "").strip()
    guidance_block = (
        f"\nOperator guidance:\n{guidance}\nUse this to prioritize relevant document sections.\n"
        if guidance
        else ""
    )
    profile = state.get("profile") or {}
    min_acts = max(5, int(profile.get("commitment_min", 8)))
    max_acts = min(24, int(profile.get("commitment_max", 16)))

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
- Scope: one sentence (24-55 words), must include what is in-scope and what is excluded.
- Activities: choose count based on document complexity (minimum {min_acts}, maximum {max_acts}), verb-led items, each <12 words
- Activities format: list of objects with keys "activity" and "tags"
- Tags must be one or more from: FE, BE, AI
- Evidence: document references only (no quotes)
- Confidence: High / Medium / Low

Scope quality gates (mandatory):
- Must include the word "includes".
- Must contain one boundary phrase: "excluding" or "limited to" or "does not include".
- Must trace to approved outcomes and intent, not generic platform claims.
- Must avoid marketing language and vague terms (smart, seamless, innovative, future-ready).

Activity quality gates (mandatory):
- Every activity must map to at least one approved explicit outcome.
- Activities must be implementation-ready and non-duplicative.
- If a role tag cannot be inferred from evidence, default tag is BE.
{guidance_block}

Approved understanding context:
{state.get("understanding_check") or {}}

Document name: {state.get("file_name") or "document"}
Document units with references:
{units_for_prompt}
""".strip()
    try:
        raw = call_llm_json(
            provider=state.get("provider") or "",
            model=state.get("model") or "",
            api_key=state.get("api_key") or "",
            base_url=state.get("base_url") or "",
            prompt=prompt,
        )
        return {"llm_success": True, "llm_error": "", "llm_raw_candidate": raw}
    except LLMClientError as exc:
        return {"llm_success": False, "llm_error": str(exc), "llm_raw_candidate": {}}
    except Exception as exc:
        return {"llm_success": False, "llm_error": str(exc), "llm_raw_candidate": {}}


def _candidate_graph_refine_node(state: CandidateGraphState) -> CandidateGraphState:
    units = state.get("units") or []
    file_name = state.get("file_name") or "document"
    fallback_candidate = state.get("fallback_candidate") or _fallback_candidate(units, file_name, state.get("file_type") or "")
    profile = state.get("profile") or {}

    if state.get("llm_success") and state.get("llm_raw_candidate"):
        candidate = _normalize_candidate(
            data=state.get("llm_raw_candidate") or {},
            fallback=fallback_candidate,
            units=units,
            file_name=file_name,
            understanding_check=state.get("understanding_check") or {},
            max_activities=max(12, int(profile.get("commitment_max", 16))),
        )
    else:
        candidate = fallback_candidate

    structured_activities = _extract_structured_activity_candidates(
        units=units,
        max_items=max(40, int(profile.get("implementation_max", 30))),
    )
    deterministic_activities = _deterministic_activity_candidates(
        units=units,
        max_items=max(40, int(profile.get("implementation_max", 30))),
    )
    merged_deterministic = structured_activities + [a for a in deterministic_activities if a not in structured_activities]
    seed_activities = candidate.get("activities") or []
    if not state.get("llm_success"):
        # For non-LLM path, prioritize structured table activities first.
        seed_activities = structured_activities
    commitment_activities, implementation_activities = _merge_activity_sets(
        llm_activities=seed_activities,
        deterministic_activities=merged_deterministic,
        profile=profile,
    )
    candidate["activities"] = commitment_activities
    candidate["commitment_activities"] = commitment_activities
    candidate["implementation_activities"] = implementation_activities
    if not candidate.get("evidence"):
        candidate["evidence"] = fallback_candidate.get("evidence") or []
    return {
        "candidate": candidate,
        "commitment_activities": commitment_activities,
        "implementation_activities": implementation_activities,
        "deterministic_activities": merged_deterministic,
        "structured_activities": structured_activities,
    }


def _deterministic_rewrite_activity(activity: str) -> str:
    plain = _strip_activity_tags(activity)
    tokens = [w for w in re.findall(r"[A-Za-z0-9]+", plain) if w]
    if not tokens:
        return activity
    filtered = [w for w in tokens if w.lower() not in STOPWORDS and len(w) > 2]
    if len(filtered) > 7:
        filtered = filtered[:7]
    if not filtered:
        filtered = tokens[:5]
    phrase = " ".join(w.lower() for w in filtered)
    rewritten = _sanitize_activity(f"Implement {phrase}")
    return rewritten or activity


def _rewrite_weak_activities_with_llm(
    weak_items: list[dict[str, Any]],
    provider: str,
    model: str,
    api_key: str,
    base_url: str,
) -> dict[str, str]:
    if not (provider and model and weak_items):
        return {}
    payload = [
        {"id": str(item.get("id")), "activity": str(item.get("activity") or ""), "tags": item.get("tags") or []}
        for item in weak_items
    ]
    prompt = f"""
You are an Activity Critic and Rewriter for roadmap commitments.

Task:
- Rewrite only weak activities into implementation-ready, concrete tasks.
- Keep business meaning same.
- Keep under 10 words.
- Must start with a strong verb.
- No vague terms.
- Keep tags unchanged.

Return strict JSON object:
{{
  "rewrites": [
    {{"id": "", "activity": ""}}
  ]
}}

Weak activities:
{payload}
""".strip()
    try:
        raw = call_llm_json(
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
            prompt=prompt,
        )
    except Exception:
        return {}
    rows = raw.get("rewrites") if isinstance(raw, dict) else []
    out: dict[str, str] = {}
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        rid = str(row.get("id") or "").strip()
        act = str(row.get("activity") or "").strip()
        if not rid or not act:
            continue
        out[rid] = act
    return out


def _candidate_graph_critic_rewrite_node(state: CandidateGraphState) -> CandidateGraphState:
    commitment = list(state.get("commitment_activities") or [])
    implementation = list(state.get("implementation_activities") or [])
    if not commitment and not implementation:
        return {}

    def _rewrite_list(name: str, items: list[str]) -> tuple[list[str], int]:
        weak_rows: list[dict[str, Any]] = []
        for idx, item in enumerate(items):
            score = _activity_quality_score(item)
            if score >= ACTIVITY_REWRITE_THRESHOLD:
                continue
            weak_rows.append(
                {
                    "id": f"{name}:{idx}",
                    "index": idx,
                    "activity": _strip_activity_tags(item),
                    "tags": _activity_tags(item),
                    "score": score,
                }
            )
        if not weak_rows:
            return items, 0

        llm_rewrites = _rewrite_weak_activities_with_llm(
            weak_items=weak_rows,
            provider=state.get("provider") or "",
            model=state.get("model") or "",
            api_key=state.get("api_key") or "",
            base_url=state.get("base_url") or "",
        )

        out = list(items)
        rewritten = 0
        for row in weak_rows:
            idx = int(row["index"])
            old_item = out[idx]
            old_score = int(row["score"])
            candidate_text = llm_rewrites.get(str(row["id"])) or _deterministic_rewrite_activity(old_item)
            candidate_text = _sanitize_activity(candidate_text)
            if not candidate_text:
                continue
            new_item = _format_activity_with_tags(candidate_text, row.get("tags") or [])
            if _activity_quality_score(new_item) >= old_score and new_item != old_item:
                out[idx] = new_item
                rewritten += 1
        return out, rewritten

    commitment_rewritten, commitment_changed = _rewrite_list("c", commitment)
    implementation_rewritten, implementation_changed = _rewrite_list("i", implementation)
    commitment_quality = _evaluate_activity_set(commitment_rewritten)
    implementation_quality = _evaluate_activity_set(implementation_rewritten)

    candidate = dict(state.get("candidate") or {})
    candidate["activities"] = commitment_rewritten
    candidate["commitment_activities"] = commitment_rewritten
    candidate["implementation_activities"] = implementation_rewritten
    candidate["commitment_quality"] = commitment_quality
    candidate["implementation_quality"] = implementation_quality

    return {
        "candidate": candidate,
        "commitment_activities": commitment_rewritten,
        "implementation_activities": implementation_rewritten,
        "commitment_quality": commitment_quality,
        "implementation_quality": implementation_quality,
        "rewrite_summary": {
            "commitment_rewritten": commitment_changed,
            "implementation_rewritten": implementation_changed,
            "total_rewritten": commitment_changed + implementation_changed,
        },
    }


_CANDIDATE_GRAPH = None


def _candidate_graph():
    global _CANDIDATE_GRAPH
    if _CANDIDATE_GRAPH is not None:
        return _CANDIDATE_GRAPH
    graph = StateGraph(CandidateGraphState)
    graph.add_node("prepare", _candidate_graph_prepare_node)
    graph.add_node("llm_candidate", _candidate_graph_llm_node)
    graph.add_node("deterministic_refine", _candidate_graph_refine_node)
    graph.add_node("critic_rewrite", _candidate_graph_critic_rewrite_node)
    graph.set_entry_point("prepare")
    graph.add_edge("prepare", "llm_candidate")
    graph.add_edge("llm_candidate", "deterministic_refine")
    graph.add_edge("deterministic_refine", "critic_rewrite")
    graph.add_edge("critic_rewrite", END)
    _CANDIDATE_GRAPH = graph.compile()
    return _CANDIDATE_GRAPH


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
    profile = _doc_complexity_profile(units=units, file_name=file_name, file_type=file_type)
    fallback = _fallback_understanding(units=units, file_name=file_name, file_type=file_type)
    llm_attempted = bool(provider and model)
    llm_success = False
    llm_error = ""
    outcomes_max = int(profile.get("understanding_outcomes_max", 8))

    if not llm_attempted:
        understanding = fallback
    else:
        sampled_units = _select_units_for_prompt(
            units=units,
            mode="understanding",
            max_units=int(profile.get("prompt_units_understanding", 260)),
        )
        units_for_prompt = "\n".join([f"[{u['ref']}] {u['text']}" for u in sampled_units])
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
- Explicit outcomes must be 2-{outcomes_max} bullets, concrete and explicit.
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
            understanding = _normalize_understanding(raw, fallback, units, max_outcomes=outcomes_max)
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
        "complexity_profile": {
            "level": profile.get("level"),
            "score": profile.get("score"),
            "page_count": profile.get("page_count"),
            "heading_count": profile.get("heading_count"),
            "activity_signal_count": profile.get("activity_signal_count"),
            "understanding_outcomes_max": outcomes_max,
        },
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

    primary_intent = str(understanding_check.get("Primary intent (1 sentence)") or "").strip()
    if primary_intent == "Document intent is unclear.":
        raise ValueError("Document intent is unclear.")

    initial_state: CandidateGraphState = {
        "units": units,
        "file_name": file_name,
        "file_type": file_type,
        "understanding_check": understanding_check,
        "provider": provider,
        "model": model,
        "api_key": api_key,
        "base_url": base_url,
        "guidance": guidance,
    }
    state = _candidate_graph().invoke(initial_state)
    fallback = state.get("fallback_candidate") or _fallback_candidate(units=units, file_name=file_name, file_type=file_type)
    candidate = state.get("candidate") or fallback
    commitment_activities = state.get("commitment_activities") or candidate.get("activities") or []
    implementation_activities = state.get("implementation_activities") or commitment_activities
    commitment_quality = state.get("commitment_quality") or _evaluate_activity_set(commitment_activities)
    implementation_quality = state.get("implementation_quality") or _evaluate_activity_set(implementation_activities)
    rewrite_summary = state.get("rewrite_summary") or {"commitment_rewritten": 0, "implementation_rewritten": 0, "total_rewritten": 0}
    candidate["activities"] = commitment_activities
    llm_attempted = bool(state.get("llm_attempted"))
    llm_success = bool(state.get("llm_success"))
    llm_error = str(state.get("llm_error") or "")
    profile = state.get("profile") or _doc_complexity_profile(units=units, file_name=file_name, file_type=file_type)

    if _is_low_quality_sentence(candidate.get("scope", ""), strict=False) or not _scope_has_boundaries(candidate.get("scope", "")):
        candidate["scope"] = _compose_scope_from_understanding(
            understanding_check=understanding_check,
            activities=commitment_activities,
            fallback_scope=candidate.get("scope") or fallback.get("scope") or "",
        )

    analysis_output = {
        "roadmap_candidate": {
            "Title": candidate["title"],
            "Intent": candidate["intent"],
            "Scope": candidate["scope"],
            "Activities": commitment_activities,
            "CommitmentActivities": commitment_activities,
            "ImplementationActivities": implementation_activities,
            "CommitmentActivityQuality": commitment_quality,
            "ImplementationActivityQuality": implementation_quality,
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
        "complexity_profile": {
            "level": profile.get("level"),
            "score": profile.get("score"),
            "page_count": profile.get("page_count"),
            "heading_count": profile.get("heading_count"),
            "activity_signal_count": profile.get("activity_signal_count"),
            "commitment_target": profile.get("commitment_target"),
            "implementation_target": profile.get("implementation_target"),
        },
        "rewrite_summary": rewrite_summary,
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
        "activities": commitment_activities[:20],
        "implementation_activities": implementation_activities[:40],
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
