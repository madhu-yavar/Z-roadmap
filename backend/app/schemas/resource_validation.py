from pydantic import BaseModel


class ResourceValidationRequest(BaseModel):
    activities: list[str]  # List of activity strings to validate
    proposed_allocation: dict[str, float]  # fe_fte, be_fte, ai_fte, pm_fte, fs_fte
    tentative_duration_weeks: int
    start_date: str
    end_date: str


class ActivityAnalysis(BaseModel):
    total_activities: int
    by_role: dict[str, int]
    by_complexity: dict[str, int]


class FTEGapAnalysis(BaseModel):
    role: str
    activities: int
    proposed_fte: float
    estimated_weeks: int
    required_fte: float
    gap: float  # negative = shortage, positive = surplus
    severity: str  # LOW, MEDIUM, HIGH


class FSSubstitutionOpportunity(BaseModel):
    from_role: str
    to_role: str
    available_fte: float
    shortage_fte: float
    recommendation: str


class ResourceValidationResponse(BaseModel):
    validation_id: str
    activity_analysis: ActivityAnalysis
    fte_gap_analysis: list[FTEGapAnalysis]
    fs_substitution_opportunities: list[FSSubstitutionOpportunity]
    agent_message: str
    confidence_score: float
