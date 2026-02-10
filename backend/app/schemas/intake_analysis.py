from pydantic import BaseModel


class IntakeAnalysisOut(BaseModel):
    intake_item_id: int
    primary_type: str
    confidence: str
    output_json: dict

    model_config = {"from_attributes": True}
