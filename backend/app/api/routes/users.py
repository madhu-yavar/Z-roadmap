from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import RolePolicyOut, UserCreate, UserOut, UserUpdateIn

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN)),
):
    return db.query(User).order_by(User.id.asc()).all()


@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN)),
):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name cannot be empty")
    user = User(
        full_name=full_name,
        email=payload.email.lower(),
        password_hash=get_password_hash(payload.password),
        role=payload.role,
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
    _=Depends(require_roles(UserRole.ADMIN)),
):
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
    if payload.is_active is not None:
        user.is_active = payload.is_active
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


@router.get("/roles-matrix", response_model=list[RolePolicyOut])
def list_role_matrix(_=Depends(require_roles(UserRole.ADMIN, UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM, UserRole.PO))):
    return [
        RolePolicyOut(
            role=UserRole.ADMIN,
            can_create_users=True,
            scope="Platform administration only",
            responsibilities=[
                "Create, update, activate, or deactivate users",
                "Enforce role boundaries and account hygiene",
                "No default authority over roadmap business decisions",
            ],
        ),
        RolePolicyOut(
            role=UserRole.CEO,
            can_create_users=False,
            scope="Enterprise governance and approvals",
            responsibilities=[
                "Configure total team size and baseline efficiency",
                "Approve key commitments and governance policy",
                "Own strategic prioritization across portfolios",
            ],
        ),
        RolePolicyOut(
            role=UserRole.VP,
            can_create_users=False,
            scope="Portfolio capacity and delivery balancing",
            responsibilities=[
                "Allocate portfolio quotas (client/internal)",
                "Review commitment feasibility against capacity",
                "Escalate conflicts and sequence portfolio plans",
            ],
        ),
        RolePolicyOut(
            role=UserRole.BA,
            can_create_users=False,
            scope="Intake and requirement shaping",
            responsibilities=[
                "Prepare intake with scope and activity decomposition",
                "Maintain requirement quality and traceability",
                "Hand-off commitment candidates to PO/PM",
            ],
        ),
        RolePolicyOut(
            role=UserRole.PM,
            can_create_users=False,
            scope="Commitment execution planning",
            responsibilities=[
                "Refine commitment scope and resource assignment",
                "Set roadmap timelines within capacity limits",
                "Track status, confidence, and dependencies",
            ],
        ),
        RolePolicyOut(
            role=UserRole.PO,
            can_create_users=False,
            scope="Commitment ownership and prioritization",
            responsibilities=[
                "Own business acceptance and commitment decisions",
                "Prioritize roadmap outcomes with PM",
                "Ensure scope aligns with product objectives",
            ],
        ),
    ]
