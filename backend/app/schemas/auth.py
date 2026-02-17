from pydantic import BaseModel, field_validator

from app.core.security import validate_password_policy


class LoginInput(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_policy(value)


class ChangePasswordOut(BaseModel):
    ok: bool = True
    message: str = "Password updated successfully"
