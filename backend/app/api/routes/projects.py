from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Project).order_by(Project.id.desc()).all()


@router.post("", response_model=ProjectOut)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.PM)),
):
    owner_id = payload.owner_id or current_user.id
    owner = db.get(User, owner_id)
    if not owner:
        raise HTTPException(status_code=404, detail="Owner user not found")

    project = Project(**payload.model_dump(exclude={"owner_id"}), owner_id=owner_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.PM, UserRole.BA)),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(project, key, value)

    db.add(project)
    db.commit()
    db.refresh(project)
    return project
