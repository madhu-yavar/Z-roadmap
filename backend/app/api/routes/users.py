from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import ensure_custom_role_permission, require_roles
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.custom_role import CustomRole
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import (
    CustomRoleCreateIn,
    CustomRoleOut,
    CustomRoleUpdateIn,
    RolePolicyOut,
    UserCreate,
    UserOut,
    UserUpdateIn,
)

router = APIRouter(prefix="/users", tags=["users"])
SYSTEM_ROLE_NAMES = {str(UserRole.ADMIN), str(UserRole.CEO), str(UserRole.VP), str(UserRole.BA), str(UserRole.PM), str(UserRole.PO)}


def _get_custom_role_or_error(db: Session, custom_role_id: int) -> CustomRole:
    role = db.get(CustomRole, custom_role_id)
    if not role:
        raise HTTPException(status_code=400, detail="Custom role not found")
    if not role.is_active:
        raise HTTPException(status_code=400, detail="Custom role is inactive")
    return role


def _assert_custom_role_matches_base(custom_role: CustomRole, base_role: UserRole) -> None:
    if custom_role.base_role != base_role:
        raise HTTPException(
            status_code=400,
            detail=f"Custom role '{custom_role.name}' requires base role {custom_role.base_role}",
        )


def _system_role_policies() -> list[RolePolicyOut]:
    return [
        RolePolicyOut(
            role=str(UserRole.ADMIN),
            role_kind="system",
            base_role=UserRole.ADMIN,
            can_create_users=True,
            can_manage_settings=True,
            scope="Platform administration only",
            responsibilities=[
                "Create, update, activate, or deactivate users",
                "Manage custom user types and rights",
                "Maintain account governance and control hygiene",
            ],
        ),
        RolePolicyOut(
            role=str(UserRole.CEO),
            role_kind="system",
            base_role=UserRole.CEO,
            can_configure_team_capacity=True,
            can_allocate_portfolio_quotas=True,
            can_manage_settings=True,
            scope="Enterprise governance and approvals",
            responsibilities=[
                "Configure total team size and baseline efficiency",
                "Approve key commitments and governance policy",
                "Own strategic prioritization across portfolios",
            ],
        ),
        RolePolicyOut(
            role=str(UserRole.VP),
            role_kind="system",
            base_role=UserRole.VP,
            can_allocate_portfolio_quotas=True,
            can_manage_settings=True,
            scope="Portfolio capacity and delivery balancing",
            responsibilities=[
                "Allocate portfolio quotas (client/internal)",
                "Review commitment feasibility against capacity",
                "Escalate conflicts and sequence portfolio plans",
            ],
        ),
        RolePolicyOut(
            role=str(UserRole.BA),
            role_kind="system",
            base_role=UserRole.BA,
            can_submit_commitment=True,
            can_manage_settings=True,
            scope="Intake and requirement shaping",
            responsibilities=[
                "Prepare intake with scope and activity decomposition",
                "Maintain requirement quality and traceability",
                "Hand-off commitment candidates to PO/PM",
            ],
        ),
        RolePolicyOut(
            role=str(UserRole.PM),
            role_kind="system",
            base_role=UserRole.PM,
            can_submit_commitment=True,
            can_edit_roadmap=True,
            can_manage_settings=True,
            scope="Commitment execution planning",
            responsibilities=[
                "Refine commitment scope and resource assignment",
                "Set roadmap timelines within capacity limits",
                "Track status, confidence, and dependencies",
            ],
        ),
        RolePolicyOut(
            role=str(UserRole.PO),
            role_kind="system",
            base_role=UserRole.PO,
            can_submit_commitment=True,
            can_edit_roadmap=True,
            can_manage_settings=True,
            scope="Commitment ownership and prioritization",
            responsibilities=[
                "Own business acceptance and commitment decisions",
                "Prioritize roadmap outcomes with PM",
                "Ensure scope aligns with product objectives",
            ],
        ),
    ]


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    ensure_custom_role_permission(current_user, "can_create_users", "manage users")
    return db.query(User).order_by(User.id.asc()).all()


@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    ensure_custom_role_permission(current_user, "can_create_users", "manage users")
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name cannot be empty")

    custom_role_id: int | None = None
    if payload.custom_role_id is not None:
        custom_role = _get_custom_role_or_error(db, payload.custom_role_id)
        _assert_custom_role_matches_base(custom_role, payload.role)
        custom_role_id = custom_role.id

    user = User(
        full_name=full_name,
        email=payload.email.lower(),
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        custom_role_id=custom_role_id,
        force_password_change=True,
        password_changed_at=None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/id/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    ensure_custom_role_permission(current_user, "can_create_users", "manage users")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    previous_role = user.role
    previous_active = user.is_active

    if payload.full_name is not None:
        cleaned = payload.full_name.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Full name cannot be empty")
        user.full_name = cleaned
    if payload.role is not None:
        user.role = payload.role
    if payload.password is not None:
        user.password_hash = get_password_hash(payload.password)
        user.force_password_change = True
        user.password_changed_at = None
    if payload.is_active is not None:
        user.is_active = payload.is_active

    custom_role_id_was_set = "custom_role_id" in payload.model_fields_set
    if custom_role_id_was_set:
        if payload.custom_role_id is None:
            user.custom_role_id = None
        else:
            custom_role = _get_custom_role_or_error(db, payload.custom_role_id)
            _assert_custom_role_matches_base(custom_role, user.role)
            user.custom_role_id = custom_role.id
    elif user.custom_role_id is not None:
        custom_role = db.get(CustomRole, user.custom_role_id)
        if not custom_role or custom_role.base_role != user.role or not custom_role.is_active:
            user.custom_role_id = None

    is_admin_before = previous_role == UserRole.ADMIN and previous_active
    is_admin_after = user.role == UserRole.ADMIN and user.is_active
    if is_admin_before and not is_admin_after:
        other_admin = (
            db.query(User)
            .filter(
                User.id != user.id,
                User.role == UserRole.ADMIN,
                User.is_active.is_(True),
            )
            .first()
        )
        if not other_admin:
            raise HTTPException(status_code=400, detail="Cannot remove or deactivate the last active ADMIN user")

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/custom-roles", response_model=list[CustomRoleOut])
def list_custom_roles(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM, UserRole.PO)),
):
    return db.query(CustomRole).order_by(CustomRole.name.asc()).all()


@router.post("/custom-roles", response_model=CustomRoleOut)
def create_custom_role(
    payload: CustomRoleCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    ensure_custom_role_permission(current_user, "can_create_users", "manage users")
    if payload.name.strip().upper() in SYSTEM_ROLE_NAMES:
        raise HTTPException(status_code=400, detail="Custom role name conflicts with a system role")
    existing = db.query(CustomRole).filter(func.lower(CustomRole.name) == payload.name.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Custom role name already exists")
    role = CustomRole(
        name=payload.name,
        base_role=payload.base_role,
        scope=payload.scope,
        responsibilities=payload.responsibilities,
        can_create_users=payload.can_create_users,
        can_configure_team_capacity=payload.can_configure_team_capacity,
        can_allocate_portfolio_quotas=payload.can_allocate_portfolio_quotas,
        can_submit_commitment=payload.can_submit_commitment,
        can_edit_roadmap=payload.can_edit_roadmap,
        can_manage_settings=payload.can_manage_settings,
        is_active=payload.is_active,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.patch("/custom-roles/{custom_role_id}", response_model=CustomRoleOut)
def update_custom_role(
    custom_role_id: int,
    payload: CustomRoleUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    ensure_custom_role_permission(current_user, "can_create_users", "manage users")
    role = db.get(CustomRole, custom_role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Custom role not found")

    if payload.name is not None and payload.name.lower() != role.name.lower():
        if payload.name.strip().upper() in SYSTEM_ROLE_NAMES:
            raise HTTPException(status_code=400, detail="Custom role name conflicts with a system role")
        duplicate = db.query(CustomRole).filter(func.lower(CustomRole.name) == payload.name.lower()).first()
        if duplicate and duplicate.id != role.id:
            raise HTTPException(status_code=400, detail="Custom role name already exists")
        role.name = payload.name
    if payload.base_role is not None and payload.base_role != role.base_role:
        assigned_count = db.query(User).filter(User.custom_role_id == role.id).count()
        if assigned_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot change base role while users are assigned to this custom role",
            )
        role.base_role = payload.base_role
    if payload.scope is not None:
        role.scope = payload.scope
    if payload.responsibilities is not None:
        role.responsibilities = payload.responsibilities
    if payload.can_create_users is not None:
        role.can_create_users = payload.can_create_users
    if payload.can_configure_team_capacity is not None:
        role.can_configure_team_capacity = payload.can_configure_team_capacity
    if payload.can_allocate_portfolio_quotas is not None:
        role.can_allocate_portfolio_quotas = payload.can_allocate_portfolio_quotas
    if payload.can_submit_commitment is not None:
        role.can_submit_commitment = payload.can_submit_commitment
    if payload.can_edit_roadmap is not None:
        role.can_edit_roadmap = payload.can_edit_roadmap
    if payload.can_manage_settings is not None:
        role.can_manage_settings = payload.can_manage_settings
    if payload.is_active is not None:
        role.is_active = payload.is_active
        if not role.is_active:
            db.query(User).filter(User.custom_role_id == role.id).update({"custom_role_id": None})

    role.updated_by = current_user.id
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get("/roles-matrix", response_model=list[RolePolicyOut])
def list_role_matrix(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM, UserRole.PO)),
):
    system_roles = _system_role_policies()
    custom_roles = db.query(CustomRole).order_by(CustomRole.name.asc()).all()
    custom_policies = [
        RolePolicyOut(
            role=custom.name,
            role_kind="custom",
            base_role=custom.base_role,
            can_create_users=custom.can_create_users,
            can_configure_team_capacity=custom.can_configure_team_capacity,
            can_allocate_portfolio_quotas=custom.can_allocate_portfolio_quotas,
            can_submit_commitment=custom.can_submit_commitment,
            can_edit_roadmap=custom.can_edit_roadmap,
            can_manage_settings=custom.can_manage_settings,
            scope=custom.scope or f"Custom role mapped to {custom.base_role}",
            responsibilities=custom.responsibilities or [],
        )
        for custom in custom_roles
    ]
    return [*system_roles, *custom_policies]
