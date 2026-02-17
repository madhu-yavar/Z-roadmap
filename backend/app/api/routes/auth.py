from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_current_user_optional
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import ChangePasswordInput, ChangePasswordOut, LoginInput, TokenOut
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_count = db.query(User).count()
    admin_exists = db.query(User).filter(User.role == UserRole.ADMIN).first() is not None
    if user_count == 0:
        if payload.role != UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="First account must be ADMIN")
    else:
        if not admin_exists:
            if not current_user or current_user.role != UserRole.CEO or payload.role != UserRole.ADMIN:
                raise HTTPException(
                    status_code=403,
                    detail="No ADMIN exists. Login as CEO and create an ADMIN account first.",
                )
        elif not current_user or current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only ADMIN can register users")

    user = User(
        full_name=payload.full_name,
        email=payload.email.lower(),
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        force_password_change=user_count > 0,
        password_changed_at=None if user_count > 0 else datetime.utcnow(),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenOut)
def login(payload: LoginInput, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive. Contact ADMIN.")

    return TokenOut(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", response_model=ChangePasswordOut)
def change_password(
    payload: ChangePasswordInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    current_user.password_hash = get_password_hash(payload.new_password)
    current_user.force_password_change = False
    current_user.password_changed_at = datetime.utcnow()
    db.add(current_user)
    db.commit()
    return ChangePasswordOut()
