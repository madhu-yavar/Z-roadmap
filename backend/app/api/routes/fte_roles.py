from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_user
from app.models.fte_role import FteRole
from app.models.user import User
from app.schemas.fte_role import (
    FteAllocationOut,
    FteRoleIn,
    FteRoleOut,
    FteRoleUpdateIn,
    GovernanceConfigFteIn,
    GovernanceConfigFteOut,
)

router = APIRouter()


@router.get("/active", response_model=list[FteRoleOut])
def list_active_fte_roles(
    db: Session = Depends(lambda db: None),
) -> list[FteRole]:
    """List all active FTE roles ordered by display order."""
    return (
        db.query(FteRole)
        .filter(FteRole.is_active == True)
        .order_by(FteRole.display_order, FteRole.name)
        .all()
    )


@router.get("/", response_model=list[FteRoleOut])
def list_all_fte_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(lambda db: None),
) -> list[FteRole]:
    """List all FTE roles (including inactive)."""
    return db.query(FteRole).order_by(FteRole.display_order, FteRole.name).all()


@router.get("/{role_id}", response_model=FteRoleOut)
def get_fte_role(
    role_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(lambda db: None),
) -> FteRole:
    """Get a specific FTE role by ID."""
    role = db.query(FteRole).filter(FteRole.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"FTE role with ID {role_id} not found",
        )
    return role


@router.post("/", response_model=FteRoleOut, status_code=status.HTTP_201_CREATED)
def create_fte_role(
    role_in: FteRoleIn,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(lambda db: None),
) -> FteRole:
    """Create a new FTE role (Admin only)."""
    # Check if abbreviation already exists
    existing = db.query(FteRole).filter(FteRole.abbreviation == role_in.abbreviation).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FTE role with abbreviation '{role_in.abbreviation}' already exists",
        )

    # Check if name already exists
    existing = db.query(FteRole).filter(FteRole.name == role_in.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FTE role with name '{role_in.name}' already exists",
        )

    role = FteRole(
        **role_in.model_dump(),
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.patch("/{role_id}", response_model=FteRoleOut)
def update_fte_role(
    role_id: int,
    role_update: FteRoleUpdateIn,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(lambda db: None),
) -> FteRole:
    """Update an FTE role (Admin only)."""
    role = db.query(FteRole).filter(FteRole.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"FTE role with ID {role_id} not found",
        )

    # Update fields that are provided
    update_data = role_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)

    role.updated_by = current_user.id
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}", response_model=FteRoleOut)
def delete_fte_role(
    role_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(lambda db: None),
) -> FteRole:
    """Deactivate an FTE role (Admin only)."""
    role = db.query(FteRole).filter(FteRole.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"FTE role with ID {role_id} not found",
        )

    # Soft delete by deactivating
    role.is_active = False
    role.updated_by = current_user.id
    db.commit()
    db.refresh(role)
    return role
