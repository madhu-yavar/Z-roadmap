from datetime import datetime

from pydantic import BaseModel


class VersionOut(BaseModel):
    id: int
    action: str
    changed_by: int | None
    changed_by_email: str | None
    changed_fields: list[str]
    before_data: dict
    after_data: dict
    created_at: datetime

    model_config = {"from_attributes": True}
