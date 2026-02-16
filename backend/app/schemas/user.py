from pydantic import BaseModel, Field, field_validator

from app.models.enums import UserRole


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: UserRole

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Email is required")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value or "") < 8:
            raise ValueError("Password must be at least 8 characters")
        return value


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class UserUpdateIn(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    password: str | None = None
    is_active: bool | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is not None and len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        return value


class RolePolicyOut(BaseModel):
    role: UserRole
    can_create_users: bool = False
    scope: str
    responsibilities: list[str] = Field(default_factory=list)
