from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: int
    project_id: int | None
    uploaded_by: int
    file_name: str
    file_type: str
    file_path: str
    notes: str

    model_config = {"from_attributes": True}
