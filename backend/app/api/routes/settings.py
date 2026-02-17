import re
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
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
from app.services.project_document_builder import (
    generate_enterprise_project_document,
    generate_master_governance_doctrine,
    render_project_document_pdf,
)

router = APIRouter(prefix="/settings", tags=["settings"])

EFFICIENCY_MIN = 0.1
EFFICIENCY_MAX = 1.0
LOCK_WINDOW_HOURS = 3


def _get_or_create_governance(db: Session) -> GovernanceConfig:
    cfg = db.query(GovernanceConfig).order_by(GovernanceConfig.id.asc()).first()
    if cfg:
        return cfg
    cfg = GovernanceConfig()
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


def _safe_filename_part(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", (value or "").strip())
    return cleaned.strip("-") or "1.0"


def _is_locked(locked_until: datetime | None) -> bool:
    return bool(locked_until and locked_until > datetime.utcnow())


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
    cfg = _get_or_create_governance(db)
    if _is_locked(cfg.team_locked_until):
        raise HTTPException(
            status_code=423,
            detail=f"Team capacity is locked until {cfg.team_locked_until.isoformat()}",
        )
    if min(payload.team_fe, payload.team_be, payload.team_ai, payload.team_pm) < 0:
        raise HTTPException(status_code=400, detail="Team size cannot be negative")
    if min(payload.efficiency_fe, payload.efficiency_be, payload.efficiency_ai, payload.efficiency_pm) < EFFICIENCY_MIN:
        raise HTTPException(
            status_code=400,
            detail=f"Efficiency must be between {EFFICIENCY_MIN:.2f} and {EFFICIENCY_MAX:.2f}",
        )
    if max(payload.efficiency_fe, payload.efficiency_be, payload.efficiency_ai, payload.efficiency_pm) > EFFICIENCY_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"Efficiency must be between {EFFICIENCY_MIN:.2f} and {EFFICIENCY_MAX:.2f}",
        )

    cfg.team_fe = payload.team_fe
    cfg.team_be = payload.team_be
    cfg.team_ai = payload.team_ai
    cfg.team_pm = payload.team_pm
    cfg.efficiency_fe = payload.efficiency_fe
    cfg.efficiency_be = payload.efficiency_be
    cfg.efficiency_ai = payload.efficiency_ai
    cfg.efficiency_pm = payload.efficiency_pm
    cfg.team_locked_until = datetime.utcnow() + timedelta(hours=LOCK_WINDOW_HOURS)
    cfg.team_locked_by = current_user.id
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
    cfg = _get_or_create_governance(db)
    if _is_locked(cfg.quota_locked_until):
        raise HTTPException(
            status_code=423,
            detail=f"Portfolio quotas are locked until {cfg.quota_locked_until.isoformat()}",
        )
    if payload.quota_client < 0 or payload.quota_internal < 0:
        raise HTTPException(status_code=400, detail="Quota cannot be negative")
    if payload.quota_client + payload.quota_internal > 1.0 + 1e-9:
        raise HTTPException(status_code=400, detail="Portfolio quotas cannot exceed 1.0 combined")

    cfg.quota_client = payload.quota_client
    cfg.quota_internal = payload.quota_internal
    cfg.quota_locked_until = datetime.utcnow() + timedelta(hours=LOCK_WINDOW_HOURS)
    cfg.quota_locked_by = current_user.id
    cfg.updated_by = current_user.id
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.get("/project-document/download")
def download_project_document(
    prepared_by: str | None = Query(default=None, max_length=160),
    approved_by: str | None = Query(default=None, max_length=160),
    version: str = Query(default="1.0", max_length=40),
    level: Literal["l1", "l2"] = Query(default="l1"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    cfg = _get_or_create_governance(db)
    prepared = (prepared_by or "").strip() or (current_user.full_name or current_user.email)
    approved = (approved_by or "").strip() or "CEO (Pending Approval)"
    doc_version = version.strip() or "1.0"
    today = date.today()
    if level == "l2":
        content = generate_master_governance_doctrine(
            prepared_by=prepared,
            approved_by=approved,
            effective_date=today,
            cfg=cfg,
            version=doc_version,
        )
        title = "Enterprise Capacity Governance Doctrine (L2)"
        subtitle = "Deterministic Resource Commitment and Capacity Governance Charter"
        filename_base = "enterprise_capacity_governance_doctrine"
    else:
        content = generate_enterprise_project_document(
            prepared_by=prepared,
            approved_by=approved,
            effective_date=today,
            cfg=cfg,
            version=doc_version,
        )
        title = "Resource Commitment and Capacity Governance Specification (L1)"
        subtitle = "Controlled Enterprise Project Governance Document"
        filename_base = "resource_commitment_capacity_governance"

    pdf_bytes = render_project_document_pdf(content, title=title, subtitle=subtitle)
    version_part = _safe_filename_part(doc_version)
    filename = f"{filename_base}_v{version_part}_{today.isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
