from __future__ import annotations

from datetime import datetime, timedelta

from app.models.governance_config import GovernanceConfig
from app.models.roadmap_plan_item import RoadmapPlanItem

ROLE_KEYS = ("fe", "be", "ai", "pm", "fs")
PORTFOLIOS = ("client", "internal", "rnd")
WARNING_UTILIZATION_THRESHOLD = 85.0
EPSILON = 1e-9


def _norm_portfolio(value: str) -> str:
    low = (value or "").strip().lower()
    # Support legacy "rnd" as "rnd" portfolio
    if low in ("rnd", "research", "research & development"):
        return "rnd"
    return low if low in PORTFOLIOS else "internal"


def _safe_non_negative(value: float | None) -> float:
    return max(0.0, float(value or 0.0))


def _week_key(dt: datetime) -> str:
    iso = dt.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _week_keys_between(start: datetime, end: datetime) -> list[str]:
    cursor = start - timedelta(days=start.weekday())
    last = end - timedelta(days=end.weekday())
    keys: list[str] = []
    while cursor <= last:
        keys.append(_week_key(cursor))
        cursor += timedelta(days=7)
    return keys


def _parse_plan_dates(start_date: str, end_date: str) -> tuple[datetime, datetime] | None:
    if not start_date or not end_date:
        return None
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    except Exception:
        return None
    if end < start:
        return None
    return start, end


def _weekly_capacity(cfg: GovernanceConfig) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {"client": {}, "internal": {}, "rnd": {}}

    # Calculate FS capacity once (can be used for both FE and BE)
    fs_team = float(getattr(cfg, "team_fs") or 0.0)
    fs_efficiency = float(getattr(cfg, "efficiency_fs") or 0.0)
    fs_base_capacity = fs_team * fs_efficiency

    for portfolio in PORTFOLIOS:
        for role in ROLE_KEYS:
            team = float(getattr(cfg, f"team_{role}") or 0.0)
            efficiency = float(getattr(cfg, f"efficiency_{role}") or 0.0)
            base_capacity = team * efficiency

            # FS engineers can work on both FE and BE tasks, so add FS capacity to both
            if role in ("fe", "be"):
                # Use per-role quota for FS if available, otherwise fall back to legacy global quota
                fs_quota_attr = f"quota_fs_{portfolio}"
                if hasattr(cfg, fs_quota_attr):
                    fs_quota = float(getattr(cfg, fs_quota_attr) or 0.0)
                else:
                    if portfolio == "client":
                        fs_quota = float(cfg.quota_client)
                    elif portfolio == "internal":
                        fs_quota = float(cfg.quota_internal)
                    else:  # rnd
                        fs_quota = 0.0
                total_capacity = base_capacity + (fs_base_capacity * fs_quota)
            else:
                total_capacity = base_capacity

            # Use per-role quota if available, otherwise fall back to legacy global quota
            quota_attr = f"quota_{role}_{portfolio}"
            if hasattr(cfg, quota_attr):
                quota = float(getattr(cfg, quota_attr) or 0.0)
            else:
                # Legacy fallback: use global quota
                if portfolio == "client":
                    quota = float(cfg.quota_client)
                elif portfolio == "internal":
                    quota = float(cfg.quota_internal)
                else:  # rnd
                    quota = 0.0
            out[portfolio][role] = max(0.0, total_capacity * quota)
    return out


def _weekly_usage(plans: list[RoadmapPlanItem]) -> tuple[dict[str, dict[str, dict[str, float]]], int]:
    usage: dict[str, dict[str, dict[str, float]]] = {"client": {}, "internal": {}, "rnd": {}}
    unscheduled_demand_items = 0
    for plan in plans:
        role_values = {
            "fe": _safe_non_negative(plan.fe_fte),
            "be": _safe_non_negative(plan.be_fte),
            "ai": _safe_non_negative(plan.ai_fte),
            "pm": _safe_non_negative(plan.pm_fte),
            "fs": _safe_non_negative(plan.fs_fte),
        }
        has_demand = any(v > EPSILON for v in role_values.values())
        parsed = _parse_plan_dates(plan.planned_start_date, plan.planned_end_date)
        if not parsed:
            if has_demand:
                unscheduled_demand_items += 1
            continue
        start, end = parsed
        portfolio = _norm_portfolio(plan.project_context)
        for wk in _week_keys_between(start, end):
            slot = usage[portfolio].setdefault(wk, {"fe": 0.0, "be": 0.0, "ai": 0.0, "pm": 0.0, "fs": 0.0})
            for role in ROLE_KEYS:
                slot[role] += role_values[role]
    return usage, unscheduled_demand_items


def build_capacity_governance_alert(
    cfg: GovernanceConfig | None,
    plans: list[RoadmapPlanItem],
) -> dict:
    if not cfg:
        return {
            "status": "CRITICAL",
            "message": "Governance configuration missing. CEO/VP must configure team capacity and portfolio quotas.",
            "shortage_roles": [],
            "warning_roles": [],
            "unscheduled_demand_items": 0,
            "role_alerts": [],
        }

    usage, unscheduled_demand_items = _weekly_usage(plans)
    capacity = _weekly_capacity(cfg)
    all_weeks = sorted({wk for p in PORTFOLIOS for wk in usage[p].keys()})

    role_alerts: list[dict] = []
    shortage_roles: list[str] = []
    warning_roles: list[str] = []

    for role in ROLE_KEYS:
        role_upper = role.upper()
        best_shortage = {
            "required_extra_fte": 0.0,
            "portfolio": "internal",
            "peak_week": "",
            "peak_demand_fte": 0.0,
            "capacity_fte": 0.0,
            "peak_utilization_pct": 0.0,
        }
        best_warning = {
            "portfolio": "internal",
            "peak_week": "",
            "peak_demand_fte": 0.0,
            "capacity_fte": 0.0,
            "peak_utilization_pct": 0.0,
        }

        for portfolio in PORTFOLIOS:
            cap = capacity[portfolio][role]
            weeks = sorted(usage[portfolio].keys())
            for wk in weeks:
                demand = usage[portfolio][wk][role]
                util_pct: float | None
                if cap <= EPSILON:
                    util_pct = None if demand > EPSILON else 0.0
                    required = demand if demand > EPSILON else 0.0
                else:
                    util_pct = (demand / cap) * 100.0
                    required = max(0.0, demand - cap)

                if required > best_shortage["required_extra_fte"] + EPSILON:
                    best_shortage = {
                        "required_extra_fte": required,
                        "portfolio": portfolio,
                        "peak_week": wk,
                        "peak_demand_fte": demand,
                        "capacity_fte": cap,
                        "peak_utilization_pct": util_pct or 0.0,
                    }

                if util_pct is not None and util_pct > best_warning["peak_utilization_pct"] + EPSILON:
                    best_warning = {
                        "portfolio": portfolio,
                        "peak_week": wk,
                        "peak_demand_fte": demand,
                        "capacity_fte": cap,
                        "peak_utilization_pct": util_pct,
                    }

        if best_shortage["required_extra_fte"] > EPSILON:
            shortage_roles.append(role_upper)
            role_alerts.append(
                {
                    "role": role_upper,
                    "status": "CRITICAL",
                    "portfolio": best_shortage["portfolio"],
                    "peak_week": best_shortage["peak_week"],
                    "peak_demand_fte": best_shortage["peak_demand_fte"],
                    "capacity_fte": best_shortage["capacity_fte"],
                    "required_extra_fte": best_shortage["required_extra_fte"],
                    "peak_utilization_pct": best_shortage["peak_utilization_pct"]
                    if best_shortage["capacity_fte"] > EPSILON
                    else None,
                }
            )
        elif best_warning["peak_utilization_pct"] >= WARNING_UTILIZATION_THRESHOLD - EPSILON:
            warning_roles.append(role_upper)
            role_alerts.append(
                {
                    "role": role_upper,
                    "status": "WARNING",
                    "portfolio": best_warning["portfolio"],
                    "peak_week": best_warning["peak_week"],
                    "peak_demand_fte": best_warning["peak_demand_fte"],
                    "capacity_fte": best_warning["capacity_fte"],
                    "required_extra_fte": 0.0,
                    "peak_utilization_pct": best_warning["peak_utilization_pct"],
                }
            )
        else:
            role_alerts.append(
                {
                    "role": role_upper,
                    "status": "OK",
                    "portfolio": "",
                    "peak_week": all_weeks[-1] if all_weeks else "",
                    "peak_demand_fte": 0.0,
                    "capacity_fte": 0.0,
                    "required_extra_fte": 0.0,
                    "peak_utilization_pct": 0.0,
                }
            )

    if shortage_roles:
        detail = ", ".join(
            f"{alert['role']} (+{alert['required_extra_fte']} FTE)"
            for alert in role_alerts
            if alert["status"] == "CRITICAL"
        )
        message = f"Additional resources required for roadmap commitments: {detail}."
        status = "CRITICAL"
    elif warning_roles:
        detail = ", ".join(
            f"{alert['role']} ({alert['peak_utilization_pct']}%)"
            for alert in role_alerts
            if alert["status"] == "WARNING"
        )
        message = f"Capacity risk nearing limit (>= {WARNING_UTILIZATION_THRESHOLD}%): {detail}."
        status = "WARNING"
    else:
        message = "Roadmap demand is within configured capacity limits."
        status = "OK"

    if unscheduled_demand_items > 0:
        message = f"{message} Unscheduled demand items: {unscheduled_demand_items}."

    return {
        "status": status,
        "message": message,
        "shortage_roles": shortage_roles,
        "warning_roles": warning_roles,
        "unscheduled_demand_items": unscheduled_demand_items,
        "role_alerts": role_alerts,
    }
