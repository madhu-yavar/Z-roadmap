from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.security import validate_password_policy
from app.models.enums import UserRole


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: UserRole
    custom_role_id: int | None = None

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
        return validate_password_policy(value)


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    role_label: str
    custom_role_id: int | None = None
    custom_role_name: str | None = None
    is_active: bool
    force_password_change: bool
    password_changed_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserUpdateIn(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    custom_role_id: int | None = None
    password: str | None = None
    is_active: bool | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is not None:
            return validate_password_policy(value)
        return value


class RolePolicyOut(BaseModel):
    role: str
    role_kind: str = "system"
    base_role: UserRole
    can_create_users: bool = False
    can_configure_team_capacity: bool = False
    can_allocate_portfolio_quotas: bool = False
    can_submit_commitment: bool = False
    can_edit_roadmap: bool = False
    can_manage_settings: bool = False
    scope: str
    responsibilities: list[str] = Field(default_factory=list)


class CustomRoleBase(BaseModel):
    name: str
    base_role: UserRole
    scope: str = ""
    responsibilities: list[str] = Field(default_factory=list)
    can_create_users: bool = False
    can_configure_team_capacity: bool = False
    can_allocate_portfolio_quotas: bool = False
    can_submit_commitment: bool = False
    can_edit_roadmap: bool = False
    can_manage_settings: bool = False
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Role name is required")
        if len(normalized) > 80:
            raise ValueError("Role name must be 80 characters or less")
        return normalized

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, value: str) -> str:
        return (value or "").strip()

    @field_validator("responsibilities")
    @classmethod
    def validate_responsibilities(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for raw in value or []:
            item = (raw or "").strip()
            if item and item not in cleaned:
                cleaned.append(item)
        return cleaned


class CustomRoleCreateIn(CustomRoleBase):
    pass


class CustomRoleUpdateIn(BaseModel):
    name: str | None = None
    base_role: UserRole | None = None
    scope: str | None = None
    responsibilities: list[str] | None = None
    can_create_users: bool | None = None
    can_configure_team_capacity: bool | None = None
    can_allocate_portfolio_quotas: bool | None = None
    can_submit_commitment: bool | None = None
    can_edit_roadmap: bool | None = None
    can_manage_settings: bool | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Role name cannot be empty")
        if len(normalized) > 80:
            raise ValueError("Role name must be 80 characters or less")
        return normalized

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("responsibilities")
    @classmethod
    def validate_responsibilities(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned: list[str] = []
        for raw in value:
            item = (raw or "").strip()
            if item and item not in cleaned:
                cleaned.append(item)
        return cleaned


class CustomRoleOut(BaseModel):
    id: int
    name: str
    base_role: UserRole
    scope: str
    responsibilities: list[str]
    can_create_users: bool
    can_configure_team_capacity: bool
    can_allocate_portfolio_quotas: bool
    can_submit_commitment: bool
    can_edit_roadmap: bool
    can_manage_settings: bool
    is_active: bool

    model_config = {"from_attributes": True}
