from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.governance_config import GovernanceConfig
from app.models.llm_config import LLMConfig
from app.models.user import User
from app.schemas.settings import (
    GovernanceOut,
    GovernanceQuotaIn,
    GovernanceTeamIn,
    LLMConfigIn,
    LLMConfigOut,
    LLMTestOut,
)
from app.services.llm_client import test_llm_connection

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_governance(db: Session) -> GovernanceConfig:
    cfg = db.query(GovernanceConfig).order_by(GovernanceConfig.id.asc()).first()
    if cfg:
        return cfg
    cfg = GovernanceConfig()
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


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


@router.get("/governance", response_model=GovernanceOut)
def get_governance_config(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    return _get_or_create_governance(db)


@router.post("/governance/team-config", response_model=GovernanceOut)
def update_governance_team_config(
    payload: GovernanceTeamIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO)),
):
    if min(payload.team_fe, payload.team_be, payload.team_ai, payload.team_pm) < 0:
        raise HTTPException(status_code=400, detail="Team size cannot be negative")
    if min(payload.efficiency_fe, payload.efficiency_be, payload.efficiency_ai, payload.efficiency_pm) < 0:
        raise HTTPException(status_code=400, detail="Efficiency cannot be negative")

    cfg = _get_or_create_governance(db)
    cfg.team_fe = payload.team_fe
    cfg.team_be = payload.team_be
    cfg.team_ai = payload.team_ai
    cfg.team_pm = payload.team_pm
    cfg.efficiency_fe = payload.efficiency_fe
    cfg.efficiency_be = payload.efficiency_be
    cfg.efficiency_ai = payload.efficiency_ai
    cfg.efficiency_pm = payload.efficiency_pm
    cfg.updated_by = current_user.id
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.post("/governance/portfolio-quotas", response_model=GovernanceOut)
def update_governance_quotas(
    payload: GovernanceQuotaIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP)),
):
    if payload.quota_client < 0 or payload.quota_internal < 0:
        raise HTTPException(status_code=400, detail="Quota cannot be negative")
    if payload.quota_client + payload.quota_internal > 1.0 + 1e-9:
        raise HTTPException(status_code=400, detail="Portfolio quotas cannot exceed 1.0 combined")

    cfg = _get_or_create_governance(db)
    cfg.quota_client = payload.quota_client
    cfg.quota_internal = payload.quota_internal
    cfg.updated_by = current_user.id
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg
