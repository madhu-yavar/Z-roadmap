from datetime import datetime
import uuid

from app.schemas.resource_validation import (
    ResourceValidationResponse,
    ActivityAnalysis,
    FTEGapAnalysis,
    FSSubstitutionOpportunity,
)


# Complexity weight in hours
COMPLEXITY_HOURS = {
    "Simple": 4,    # 0.5 day
    "Medium": 8,    # 1 day
    "Complex": 16,  # 2 days
}

# Weekly work hours
WEEKLY_HOURS = 40


def _parse_activities(activities: list[str]) -> dict:
    """Parse activities and extract role tags and complexity.

    Supports format: "[TAG] Activity text | Complexity"
    Examples:
    - "[BE] Implement API | Medium"
    - "[FE/BE] Build dashboard | Complex"
    - "[AI] Train model | Simple"
    """
    role_counts = {"FE": 0, "BE": 0, "AI": 0, "PM": 0, "FS": 0}
    complexity_counts = {"Simple": 0, "Medium": 0, "Complex": 0}

    for activity in activities:
        # Default to Medium complexity
        complexity = "Medium"

        # Extract role tags from format like "[FE/BE] Activity text | Complexity"
        tags = []
        if "[" in activity and "]" in activity:
            tag_part = activity.split("]")[0].replace("[", "")
            tags = [t.strip().upper() for t in tag_part.split("/") if t.strip()]

            # Extract complexity from the part after the closing bracket
            after_bracket = activity.split("]", 1)[1].strip()
            # Check for complexity suffix like "| Medium", "| Complex", "| Simple"
            for comp in ["Simple", "Medium", "Complex"]:
                if f"| {comp}" in after_bracket or f"|{comp}" in after_bracket:
                    complexity = comp
                    break

        # Count by role
        for tag in tags:
            if tag in role_counts:
                role_counts[tag] += 1

        # If no tags found, check if activity has complexity suffix (legacy format)
        if not tags:
            for comp in ["Simple", "Medium", "Complex"]:
                if f"| {comp}" in activity or f"|{comp}" in activity:
                    complexity = comp
                    break

        complexity_counts[complexity] += 1

    return {
        "role_counts": role_counts,
        "complexity_counts": complexity_counts,
    }


def _calculate_required_fte(
    activity_count: int,
    avg_complexity_hours: float,
    weeks: int,
) -> float:
    """Calculate required FTE based on activities and duration."""
    if weeks <= 0:
        return 0.0

    total_hours = activity_count * avg_complexity_hours
    weekly_fte = total_hours / WEEKLY_HOURS
    required_fte = weekly_fte / weeks

    return round(required_fte, 2)


def _calculate_avg_complexity_hours(complexity_counts: dict[str, int]) -> float:
    """Calculate weighted average hours per activity based on complexity distribution."""
    total_activities = sum(complexity_counts.values())
    if total_activities == 0:
        return COMPLEXITY_HOURS["Medium"]  # Default to Medium

    weighted_hours = sum(
        count * COMPLEXITY_HOURS.get(comp, COMPLEXITY_HOURS["Medium"])
        for comp, count in complexity_counts.items()
    )

    return weighted_hours / total_activities


def _determine_severity(gap_pct: float) -> str:
    """Determine severity level based on gap percentage."""
    if gap_pct <= -50:
        return "HIGH"
    elif gap_pct <= -20:
        return "MEDIUM"
    elif gap_pct < 0:
        return "LOW"
    else:
        return "NONE"


def analyze_resource_allocation(
    activities: list[str],
    proposed_allocation: dict[str, float],
    tentative_duration_weeks: int,
) -> ResourceValidationResponse:
    """
    Analyze resource allocation and identify gaps.

    Args:
        activities: List of activity strings with role tags
        proposed_allocation: Dict of {fe_fte, be_fte, ai_fte, pm_fte, fs_fte}
        tentative_duration_weeks: Duration in weeks

    Returns:
        ResourceValidationResponse with gap analysis and recommendations
    """
    # Parse activities
    parsed = _parse_activities(activities)
    role_counts = parsed["role_counts"]
    complexity_counts = parsed["complexity_counts"]

    # Calculate average hours per activity
    avg_hours = _calculate_avg_complexity_hours(complexity_counts)

    # Analyze gaps per role
    gap_analysis = []
    role_mapping = {
        "fe_fte": "FE",
        "be_fte": "BE",
        "ai_fte": "AI",
        "pm_fte": "PM",
        "fs_fte": "FS",
    }

    for fte_field, role in role_mapping.items():
        activity_count = role_counts.get(role, 0)
        proposed_fte = proposed_allocation.get(fte_field, 0.0)

        if activity_count == 0 and proposed_fte == 0:
            continue

        required_fte = _calculate_required_fte(activity_count, avg_hours, tentative_duration_weeks)
        gap = proposed_fte - required_fte
        gap_pct = (gap / required_fte * 100) if required_fte > 0 else 0

        severity = _determine_severity(gap_pct)

        if activity_count > 0 or proposed_fte > 0:
            gap_analysis.append(
                FTEGapAnalysis(
                    role=role,
                    activities=activity_count,
                    proposed_fte=round(proposed_fte, 2),
                    estimated_weeks=tentative_duration_weeks,
                    required_fte=required_fte,
                    gap=round(gap, 2),
                    severity=severity,
                )
            )

    # Check for FS substitution opportunities (50/50 split for FE/BE)
    fs_opportunities = []
    available_fs = proposed_allocation.get("fs_fte", 0.0)

    if available_fs > 0:
        fe_shortage = 0.0
        be_shortage = 0.0

        for gap in gap_analysis:
            if gap.role == "FE" and gap.gap < 0:
                fe_shortage = abs(gap.gap)
            elif gap.role == "BE" and gap.gap < 0:
                be_shortage = abs(gap.gap)

        # FS can cover 50% for FE and 50% for BE
        fs_for_fe = min(available_fs * 0.5, fe_shortage)
        fs_for_be = min(available_fs * 0.5, be_shortage)

        if fs_for_fe > 0:
            fs_opportunities.append(
                FSSubstitutionOpportunity(
                    from_role="FS",
                    to_role="FE",
                    available_fte=round(available_fs, 2),
                    shortage_fte=round(fe_shortage, 2),
                    recommendation=f"Allocate {round(fs_for_fe, 2)} FS FTE to cover FE shortage (50% of available FS)",
                )
            )

        if fs_for_be > 0:
            fs_opportunities.append(
                FSSubstitutionOpportunity(
                    from_role="FS",
                    to_role="BE",
                    available_fte=round(available_fs, 2),
                    shortage_fte=round(be_shortage, 2),
                    recommendation=f"Allocate {round(fs_for_be, 2)} FS FTE to cover BE shortage (50% of available FS)",
                )
            )

    # Generate agent message
    message_parts = []
    high_gaps = [g for g in gap_analysis if g.severity == "HIGH"]
    medium_gaps = [g for g in gap_analysis if g.severity == "MEDIUM"]

    if high_gaps:
        gaps_str = ", ".join([f"{g.role} ({g.activities} activities, need {g.required_fte} FTE, proposed {g.proposed_fte} FTE)" for g in high_gaps])
        message_parts.append(f"⚠️ **Critical gaps detected**: {gaps_str}")

    if medium_gaps:
        gaps_str = ", ".join([f"{g.role} ({g.activities} activities)" for g in medium_gaps])
        message_parts.append(f"⚡ **Moderate gaps**: {gaps_str}")

    if fs_opportunities:
        message_parts.append(f"💡 **FS Substitution**: Full Stack engineers can cover {len(fs_opportunities)} role shortage(s)")

    if not message_parts:
        message_parts.append("✅ **Resource allocation looks balanced** based on activity count and complexity.")

    agent_message = "\n".join(message_parts) if message_parts else "No analysis available."

    # Calculate confidence score
    total_activities = sum(role_counts.values())
    confidence_score = min(1.0, total_activities / 10.0)  # More activities = higher confidence

    return ResourceValidationResponse(
        validation_id=str(uuid.uuid4()),
        activity_analysis=ActivityAnalysis(
            total_activities=total_activities,
            by_role=role_counts,
            by_complexity=complexity_counts,
        ),
        fte_gap_analysis=gap_analysis,
        fs_substitution_opportunities=fs_opportunities,
        agent_message=agent_message,
        confidence_score=round(confidence_score, 2),
    )
