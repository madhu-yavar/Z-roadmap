from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ALGORITHM
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = db.get(User, int(user_id))
    if not user:
        raise credentials_exception
    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme_optional),
) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    user = db.get(User, int(user_id))
    return user


def require_roles(*allowed_roles: UserRole) -> Callable:
    def checker(current_user: User = Depends(get_current_user)) -> User:
        # PM and PO are treated as equivalent execution roles.
        pm_po_alias = {
            UserRole.PM: UserRole.PO,
            UserRole.PO: UserRole.PM,
        }
        if current_user.role in allowed_roles:
            return current_user
        if pm_po_alias.get(current_user.role) in allowed_roles:
            return current_user
        if current_user.role == UserRole.ADMIN and UserRole.ADMIN in allowed_roles:
            return current_user
        if current_user.role != UserRole.ADMIN and UserRole.ADMIN in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient role permission")
        if current_user.role == UserRole.ADMIN and UserRole.ADMIN not in allowed_roles:
            raise HTTPException(status_code=403, detail="Admin scope does not include this business action")
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient role permission")
        return current_user

    return checker
