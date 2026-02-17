from datetime import datetime

from pydantic import BaseModel


class LLMConfigIn(BaseModel):
    provider: str
    model: str
    base_url: str = ""
    api_key: str = ""


class LLMConfigOut(BaseModel):
    id: int
    provider: str
    model: str
    base_url: str
    is_active: bool

    model_config = {"from_attributes": True}


class LLMTestOut(BaseModel):
    ok: bool
    provider: str
    model: str
    message: str


class GovernanceOut(BaseModel):
    id: int
    team_fe: int
    team_be: int
    team_ai: int
    team_pm: int
    efficiency_fe: float
    efficiency_be: float
    efficiency_ai: float
    efficiency_pm: float
    quota_client: float
    quota_internal: float
    team_locked_until: datetime | None = None
    team_locked_by: int | None = None
    quota_locked_until: datetime | None = None
    quota_locked_by: int | None = None
    efficiency_confirmed_ceo_at: datetime | None = None
    efficiency_confirmed_ceo_by: int | None = None
    efficiency_confirmed_vp_at: datetime | None = None
    efficiency_confirmed_vp_by: int | None = None
    roadmap_locked: bool = False
    roadmap_locked_at: datetime | None = None
    roadmap_locked_by: int | None = None
    roadmap_lock_note: str = ""

    model_config = {"from_attributes": True}


class GovernanceTeamIn(BaseModel):
    team_fe: int = 0
    team_be: int = 0
    team_ai: int = 0
    team_pm: int = 0
    efficiency_fe: float = 1.0
    efficiency_be: float = 1.0
    efficiency_ai: float = 1.0
    efficiency_pm: float = 1.0


class GovernanceQuotaIn(BaseModel):
    quota_client: float = 0.5
    quota_internal: float = 0.5
