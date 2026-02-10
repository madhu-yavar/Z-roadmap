from pydantic import BaseModel


class ChatInput(BaseModel):
    question: str


class ChatOut(BaseModel):
    answer: str
    evidence: list[str] = []
