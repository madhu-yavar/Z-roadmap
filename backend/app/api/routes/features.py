from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.feature import Feature
from app.models.project import Project
from app.schemas.feature import FeatureCreate, FeatureOut, FeatureUpdate

router = APIRouter(prefix="/features", tags=["features"])


@router.get("", response_model=list[FeatureOut])
def list_features(project_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    query = db.query(Feature)
    if project_id is not None:
        query = query.filter(Feature.project_id == project_id)
    return query.order_by(Feature.id.desc()).all()


@router.post("", response_model=FeatureOut)
def create_feature(
    payload: FeatureCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.PM, UserRole.BA)),
):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    feature = Feature(**payload.model_dump())
    db.add(feature)
    db.commit()
    db.refresh(feature)
    return feature


@router.patch("/{feature_id}", response_model=FeatureOut)
def update_feature(
    feature_id: int,
    payload: FeatureUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.PM, UserRole.BA)),
):
    feature = db.get(Feature, feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(feature, key, value)

    db.add(feature)
    db.commit()
    db.refresh(feature)
    return feature
