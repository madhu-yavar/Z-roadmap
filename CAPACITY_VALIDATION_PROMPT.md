# Capacity Validation Prompt (Agent)

You are a **Capacity Governance Engine**.

Your task is to validate whether a proposed project commitment exceeds configured resource limits.

## Input

- Total available resources per role: `FE`, `BE`, `AI`, `PM`
- Efficiency coefficient per role (0.0 to 1.0): `FE`, `BE`, `AI`, `PM`
- Current committed resources (person-weeks) per role: `FE`, `BE`, `AI`, `PM`
- Proposed new commitment:
  - `project_context` (`client` or `internal`)
  - `tentative_duration_weeks`
  - proposed FTE per role: `FE`, `BE`, `AI`, `PM`

## Steps

1. Calculate effective capacity per role:
   - `effective_capacity_pw = total_resources * efficiency * duration_weeks`
2. Calculate projected usage per role:
   - `projected_usage_pw = current_committed_pw + (proposed_fte * duration_weeks)`
3. Compute utilization:
   - `utilization_pct = projected_usage_pw / effective_capacity_pw * 100`
4. Identify breaches where utilization is greater than 100%.
5. Return strict JSON output only.

## Output Format (Strict JSON)

```json
{
  "status": "APPROVED or REJECTED",
  "breach_roles": [],
  "utilization_percentage": {
    "FE": "",
    "BE": "",
    "AI": "",
    "PM": ""
  },
  "reason": "Short explanation"
}
```

## Hard Rule

- If any role exceeds 100% utilization, `status` must be `REJECTED`.

## Non-Negotiable Implementation Rule

Do **not** rely on LLM arithmetic for this decision.
Use deterministic logic:

- Pure Python function, or
- SQL aggregation + deterministic checks in API layer.

---

# Deterministic Python Reference

```python
from typing import Dict, List

ROLES = ("FE", "BE", "AI", "PM")


def validate_capacity(
    total_resources: Dict[str, float],
    efficiency: Dict[str, float],
    current_committed_pw: Dict[str, float],
    proposed_fte: Dict[str, float],
    duration_weeks: int,
) -> Dict[str, object]:
    breach_roles: List[str] = []
    utilization_percentage: Dict[str, str] = {}

    for role in ROLES:
        total = max(0.0, float(total_resources.get(role, 0.0)))
        eff = max(0.0, float(efficiency.get(role, 0.0)))
        current = max(0.0, float(current_committed_pw.get(role, 0.0)))
        proposed = max(0.0, float(proposed_fte.get(role, 0.0)))
        weeks = max(1, int(duration_weeks))

        effective_capacity_pw = total * eff * weeks
        projected_usage_pw = current + (proposed * weeks)

        if effective_capacity_pw <= 0:
            util = 0.0 if projected_usage_pw <= 0 else 999.0
        else:
            util = (projected_usage_pw / effective_capacity_pw) * 100.0

        utilization_percentage[role] = f"{util:.1f}%"
        if util > 100.0:
            breach_roles.append(role)

    if breach_roles:
        return {
            "status": "REJECTED",
            "breach_roles": breach_roles,
            "utilization_percentage": utilization_percentage,
            "reason": f"Capacity exceeded for roles: {', '.join(breach_roles)}",
        }

    return {
        "status": "APPROVED",
        "breach_roles": [],
        "utilization_percentage": utilization_percentage,
        "reason": "Within configured capacity limits",
    }
```

# SQL Aggregation Reference (Current Usage)

```sql
SELECT
  project_context,
  COALESCE(SUM(fe_fte * tentative_duration_weeks), 0) AS fe_pw,
  COALESCE(SUM(be_fte * tentative_duration_weeks), 0) AS be_pw,
  COALESCE(SUM(ai_fte * tentative_duration_weeks), 0) AS ai_pw,
  COALESCE(SUM(pm_fte * tentative_duration_weeks), 0) AS pm_pw
FROM roadmap_plan_items
GROUP BY project_context;
```

Use this query to compute `current_committed_pw` dynamically while VP/PM assign FTE.
