from pydantic import BaseModel


class IntakeAnalyzeOut(BaseModel):
    id: int
    document_id: int
    document_class: str
    title: str
    scope: str
    activities: list[str]
    source_quotes: list[str]
    priority: str
    project_context: str
    initiative_type: str
    delivery_mode: str
    rnd_hypothesis: str
    rnd_experiment_goal: str
    rnd_success_criteria: str
    rnd_timebox_weeks: int | None
    rnd_decision_date: str
    rnd_next_gate: str
    rnd_risk_level: str
    status: str

    model_config = {"from_attributes": True}


class IntakeReviewIn(BaseModel):
    title: str
    scope: str
    activities: list[str]
    status: str = "approved"


class UnderstandingApprovalIn(BaseModel):
    primary_intent: str = ""
    explicit_outcomes: list[str] = []
    dominant_theme: str = ""
    confidence: str = "medium"


class IntakeOut(BaseModel):
    id: int
    document_id: int
    document_class: str
    title: str
    scope: str
    activities: list[str]
    source_quotes: list[str]
    priority: str
    project_context: str
    initiative_type: str
    delivery_mode: str
    rnd_hypothesis: str
    rnd_experiment_goal: str
    rnd_success_criteria: str
    rnd_timebox_weeks: int | None
    rnd_decision_date: str
    rnd_next_gate: str
    rnd_risk_level: str
    status: str
    roadmap_item_id: int | None

    model_config = {"from_attributes": True}


class IntakeAnalyzeIn(BaseModel):
    priority: str = "medium"
    project_context: str = "client"
    initiative_type: str = "new_feature"
    delivery_mode: str = "standard"
    rnd_hypothesis: str = ""
    rnd_experiment_goal: str = ""
    rnd_success_criteria: str = ""
    rnd_timebox_weeks: int | None = None
    rnd_decision_date: str = ""
    rnd_next_gate: str = ""
    rnd_risk_level: str = ""


class IntakeManualIn(BaseModel):
    title: str
    scope: str = ""
    activities: list[str] = []
    priority: str = "medium"
    project_context: str = "client"
    initiative_type: str = "new_feature"
    delivery_mode: str = "standard"
    rnd_hypothesis: str = ""
    rnd_experiment_goal: str = ""
    rnd_success_criteria: str = ""
    rnd_timebox_weeks: int | None = None
    rnd_decision_date: str = ""
    rnd_next_gate: str = ""
    rnd_risk_level: str = ""
