from pydantic import BaseModel


class ChatInput(BaseModel):
    question: str


class IntakeSupportInput(BaseModel):
    intake_item_id: int
    question: str = ""


class ChatOut(BaseModel):
    answer: str
    evidence: list[str] = []
    actions: list[str] = []
    support_applied: bool = False
    intake_item_id: int | None = None
    support_state: str = "general"
    intent_clear: bool | None = None
    next_action: str = "none"
