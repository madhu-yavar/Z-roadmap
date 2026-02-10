from pydantic import BaseModel


class LLMConfigIn(BaseModel):
    provider: str
    model: str
    base_url: str = ""
    api_key: str = ""


class LLMConfigOut(BaseModel):
    id: int
    provider: str
    model: str
    base_url: str
    is_active: bool

    model_config = {"from_attributes": True}


class LLMTestOut(BaseModel):
    ok: bool
    provider: str
    model: str
    message: str
