from datetime import date

from pydantic import BaseModel

from app.models.enums import ProjectStatus, ProjectType


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    project_type: ProjectType
    status: ProjectStatus
    progress_pct: int = 0
    target_date: date | None = None
    owner_id: int | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    project_type: ProjectType | None = None
    status: ProjectStatus | None = None
    progress_pct: int | None = None
    target_date: date | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    project_type: ProjectType
    status: ProjectStatus
    progress_pct: int
    target_date: date | None
    owner_id: int

    model_config = {"from_attributes": True}
