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
    team_fs: int
    efficiency_fe: float
    efficiency_be: float
    efficiency_ai: float
    efficiency_pm: float
    efficiency_fs: float
    quota_client: float
    quota_internal: float
    # Per-role quotas
    quota_fe_client: float = 0.5
    quota_fe_internal: float = 0.5
    quota_fe_rnd: float = 0.0
    quota_be_client: float = 0.5
    quota_be_internal: float = 0.5
    quota_be_rnd: float = 0.0
    quota_ai_client: float = 0.5
    quota_ai_internal: float = 0.5
    quota_ai_rnd: float = 0.0
    quota_pm_client: float = 0.5
    quota_pm_internal: float = 0.5
    quota_pm_rnd: float = 0.0
    quota_fs_client: float = 0.3
    quota_fs_internal: float = 0.7
    quota_fs_rnd: float = 0.0
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
    team_fs: int = 0
    efficiency_fe: float = 1.0
    efficiency_be: float = 1.0
    efficiency_ai: float = 1.0
    efficiency_pm: float = 1.0
    efficiency_fs: float = 1.0


class GovernanceQuotaIn(BaseModel):
    # Per-role portfolio quotas (supports 3-way split)
    quota_fe_client: float = 0.5
    quota_fe_internal: float = 0.5
    quota_fe_rnd: float = 0.0
    quota_be_client: float = 0.5
    quota_be_internal: float = 0.5
    quota_be_rnd: float = 0.0
    quota_ai_client: float = 0.5
    quota_ai_internal: float = 0.5
    quota_ai_rnd: float = 0.0
    quota_pm_client: float = 0.5
    quota_pm_internal: float = 0.5
    quota_pm_rnd: float = 0.0
    quota_fs_client: float = 0.3
    quota_fs_internal: float = 0.7
    quota_fs_rnd: float = 0.0
