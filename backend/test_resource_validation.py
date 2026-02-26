#!/usr/bin/env python3
"""Test script to verify activity parsing with complexity."""

import sys
sys.path.insert(0, '.')

from app.services.resource_validation import _parse_activities, analyze_resource_allocation

# Test activities matching user's scenario (35 activities: 26 BE, 6 AI, 3 FE, all Medium)
test_activities = [
    "[BE] Implement authentication system | Medium",
    "[BE] Build REST API endpoints | Medium",
    "[BE] Database schema design | Medium",
    "[BE] Handle invalid parser JSON with clear error responses | Medium",
    "[BE] Set up PostgreSQL database | Medium",
    "[BE] Write database migrations | Medium",
    "[BE] Implement data validation | Medium",
    "[BE] Build backend business logic | Medium",
    "[BE] Set up API authentication | Medium",
    "[BE] Implement error handling | Medium",
    "[BE] Build logging system | Medium",
    "[BE] Set up monitoring | Medium",
    "[BE] Performance optimization | Medium",
    "[BE] Database indexing | Medium",
    "[BE] Build caching layer | Medium",
    "[BE] Implement rate limiting | Medium",
    "[BE] Set up CORS | Medium",
    "[BE] Build webhook system | Medium",
    "[BE] Implement background jobs | Medium",
    "[BE] Set up task queue | Medium",
    "[BE] Build email service | Medium",
    "[BE] Implement file upload | Medium",
    "[BE] Set up CDN | Medium",
    "[BE] Build notification system | Medium",
    "[BE] Implement search functionality | Medium",
    "[BE] Set up backup system | Medium",
    "[AI] Build ML model | Medium",
    "[AI] Train model | Medium",
    "[AI] Model evaluation | Medium",
    "[AI] Feature engineering | Medium",
    "[AI] Data preprocessing | Medium",
    "[AI] Model deployment | Medium",
    "[FE] Build UI components | Medium",
    "[FE] Implement responsive design | Medium",
    "[FE] Build dashboard | Medium",
]

def test_parsing():
    """Test activity parsing."""
    result = _parse_activities(test_activities)

    print("=== Activity Parsing Test ===")
    print(f"Total activities: {len(test_activities)}")
    print(f"\nRole counts:")
    for role, count in result["role_counts"].items():
        print(f"  {role}: {count}")

    print(f"\nComplexity counts:")
    for complexity, count in result["complexity_counts"].items():
        print(f"  {complexity}: {count}")

    # Verify expected values
    assert result["role_counts"]["BE"] == 26, f"Expected 26 BE activities, got {result['role_counts']['BE']}"
    assert result["role_counts"]["AI"] == 6, f"Expected 6 AI activities, got {result['role_counts']['AI']}"
    assert result["role_counts"]["FE"] == 3, f"Expected 3 FE activities, got {result['role_counts']['FE']}"
    assert result["complexity_counts"]["Medium"] == 35, f"Expected 35 Medium activities, got {result['complexity_counts']['Medium']}"

    print("\n✅ All parsing tests passed!")

def test_fte_calculation():
    """Test FTE calculation with proposed allocation."""
    # Proposed FTE allocation (from user's screenshot)
    proposed_allocation = {
        "fe_fte": 0.5,
        "be_fte": 1.0,
        "ai_fte": 0.5,
        "pm_fte": 0.2,
        "fs_fte": 0.5,
    }

    tentative_duration_weeks = 6

    result = analyze_resource_allocation(
        activities=test_activities,
        proposed_allocation=proposed_allocation,
        tentative_duration_weeks=tentative_duration_weeks,
    )

    print("\n=== FTE Calculation Test ===")
    print(f"Duration: {tentative_duration_weeks} weeks")
    print(f"\nProposed FTE:")
    for role, fte in proposed_allocation.items():
        print(f"  {role}: {fte}")

    print(f"\nActivity Analysis:")
    print(f"  Total activities: {result.activity_analysis.total_activities}")
    print(f"  By role: {result.activity_analysis.by_role}")
    print(f"  By complexity: {result.activity_analysis.by_complexity}")

    print(f"\nFTE Gap Analysis:")
    for gap in result.fte_gap_analysis:
        print(f"  {gap.role}:")
        print(f"    Activities: {gap.activities}")
        print(f"    Proposed FTE: {gap.proposed_fte}")
        print(f"    Required FTE: {gap.required_fte}")
        print(f"    Gap: {gap.gap}")
        print(f"    Severity: {gap.severity}")

    # Expected calculations:
    # All activities are Medium (8 hours each)
    # Total hours per role:
    #   BE: 26 × 8 = 208 hours
    #   AI: 6 × 8 = 48 hours
    #   FE: 3 × 8 = 24 hours
    #
    # Required FTE = total_hours / (40 × weeks)
    #   BE: 208 / (40 × 6) = 208 / 240 = 0.87
    #   AI: 48 / (40 × 6) = 48 / 240 = 0.20
    #   FE: 24 / (40 × 6) = 24 / 240 = 0.10

    be_gap = next(g for g in result.fte_gap_analysis if g.role == "BE")
    ai_gap = next(g for g in result.fte_gap_analysis if g.role == "AI")
    fe_gap = next(g for g in result.fte_gap_analysis if g.role == "FE")

    print(f"\n✅ Expected vs Actual:")
    print(f"  BE required: {0.87:.2f} vs actual: {be_gap.required_fte:.2f}")
    print(f"  AI required: {0.20:.2f} vs actual: {ai_gap.required_fte:.2f}")
    print(f"  FE required: {0.10:.2f} vs actual: {fe_gap.required_fte:.2f}")

    # Allow small rounding differences
    assert abs(be_gap.required_fte - 0.87) < 0.01, f"BE FTE calculation incorrect: {be_gap.required_fte}"
    assert abs(ai_gap.required_fte - 0.20) < 0.01, f"AI FTE calculation incorrect: {ai_gap.required_fte}"
    assert abs(fe_gap.required_fte - 0.10) < 0.01, f"FE FTE calculation incorrect: {fe_gap.required_fte}"

    print("\n✅ All FTE calculation tests passed!")

if __name__ == "__main__":
    test_parsing()
    test_fte_calculation()
    print("\n🎉 All tests passed!")
