from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.llm_config import LLMConfig
from app.schemas.settings import LLMConfigIn, LLMConfigOut, LLMTestOut
from app.services.llm_client import test_llm_connection

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/llm", response_model=list[LLMConfigOut])
def list_llm_configs(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    return db.query(LLMConfig).order_by(LLMConfig.id.desc()).all()


@router.post("/llm/active", response_model=LLMConfigOut)
def set_active_llm(
    payload: LLMConfigIn,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    db.query(LLMConfig).update({"is_active": False})

    config = LLMConfig(
        provider=payload.provider.strip().lower(),
        model=payload.model.strip(),
        base_url=payload.base_url.strip(),
        api_key=payload.api_key.strip(),
        is_active=True,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.post("/llm/test", response_model=LLMTestOut)
def test_llm(
    payload: LLMConfigIn,
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    ok, message = test_llm_connection(
        provider=payload.provider.strip().lower(),
        model=payload.model.strip(),
        api_key=payload.api_key.strip(),
        base_url=payload.base_url.strip(),
    )
    return LLMTestOut(
        ok=ok,
        provider=payload.provider.strip().lower(),
        model=payload.model.strip(),
        message=message,
    )
