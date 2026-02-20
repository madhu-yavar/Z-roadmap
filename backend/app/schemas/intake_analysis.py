from pydantic import BaseModel


class IntakeAnalysisOut(BaseModel):
    intake_item_id: int
    primary_type: str
    confidence: str
    output_json: dict
    intake_item_version_no: int | None = None

    model_config = {"from_attributes": True}
