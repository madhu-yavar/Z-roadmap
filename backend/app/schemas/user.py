from pydantic import BaseModel

from app.models.enums import UserRole


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: UserRole


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole

    model_config = {"from_attributes": True}
