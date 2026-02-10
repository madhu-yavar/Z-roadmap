from pydantic import BaseModel

from app.models.enums import ProjectStatus


class FeatureCreate(BaseModel):
    project_id: int
    name: str
    status: ProjectStatus
    progress_pct: int = 0
    notes: str = ""


class FeatureUpdate(BaseModel):
    name: str | None = None
    status: ProjectStatus | None = None
    progress_pct: int | None = None
    notes: str | None = None


class FeatureOut(BaseModel):
    id: int
    project_id: int
    name: str
    status: ProjectStatus
    progress_pct: int
    notes: str

    model_config = {"from_attributes": True}
