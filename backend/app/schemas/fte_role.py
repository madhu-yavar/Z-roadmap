from datetime import datetime

from pydantic import BaseModel


class FteRoleOut(BaseModel):
    id: int
    name: str
    abbreviation: str
    description: str
    category: str
    default_efficiency_factor: float
    is_active: bool
    display_order: int
    color_code: str
    created_by: int | None = None
    updated_by: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FteRoleIn(BaseModel):
    name: str
    abbreviation: str
    description: str = ""
    category: str = "full_time"
    default_efficiency_factor: float = 1.0
    is_active: bool = True
    display_order: int = 0
    color_code: str = "#3B82F6"


class FteRoleUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    default_efficiency_factor: float | None = None
    is_active: bool | None = None
    display_order: int | None = None
    color_code: str | None = None


class FteAllocationOut(BaseModel):
    fte_role_id: int
    fte_role_name: str
    fte_role_abbreviation: str
    fte_value: float


class GovernanceConfigFteOut(BaseModel):
    fte_role_id: int
    fte_role_name: str
    fte_role_abbreviation: str
    fte_role_category: str
    team_size: int
    efficiency_factor: float


class GovernanceConfigFteIn(BaseModel):
    fte_role_id: int
    team_size: int = 0
    efficiency_factor: float = 1.0
