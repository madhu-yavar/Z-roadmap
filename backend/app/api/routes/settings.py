import re
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import ensure_custom_role_permission, require_roles
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
from app.services.fte_role_service import migrate_existing_fte_data, seed_default_fte_roles
from app.services.llm_client import test_llm_connection
from app.services.project_document_builder import (
    generate_enterprise_project_document,
    generate_master_governance_doctrine,
    render_project_document_pdf,
)

router = APIRouter(prefix="/settings", tags=["settings"])

EFFICIENCY_MIN = 0.1
EFFICIENCY_MAX = 1.0
LOCK_WINDOW_MINUTES = 10
TEAM_SIZE_MIN = 1


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
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    ensure_custom_role_permission(current_user, "can_manage_settings", "manage AI provider settings")
    return db.query(LLMConfig).order_by(LLMConfig.id.desc()).all()


@router.post("/llm/active", response_model=LLMConfigOut)
def set_active_llm(
    payload: LLMConfigIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    ensure_custom_role_permission(current_user, "can_manage_settings", "manage AI provider settings")
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
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.BA, UserRole.PM)),
):
    ensure_custom_role_permission(current_user, "can_manage_settings", "manage AI provider settings")
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
    ensure_custom_role_permission(current_user, "can_configure_team_capacity", "update team capacity")
    cfg = _get_or_create_governance(db)
    if _is_locked(cfg.team_locked_until):
        raise HTTPException(
            status_code=423,
            detail=f"Team capacity is locked until {cfg.team_locked_until.isoformat()}",
        )
    if min(payload.team_fe, payload.team_be, payload.team_ai, payload.team_pm, payload.team_fs) < TEAM_SIZE_MIN:
        raise HTTPException(status_code=400, detail=f"Team size must be at least {TEAM_SIZE_MIN} for FE, BE, AI, PM, and FS")
    if min(payload.efficiency_fe, payload.efficiency_be, payload.efficiency_ai, payload.efficiency_pm, payload.efficiency_fs) < EFFICIENCY_MIN:
        raise HTTPException(
            status_code=400,
            detail=f"Efficiency must be between {EFFICIENCY_MIN:.2f} and {EFFICIENCY_MAX:.2f}",
        )
    if max(payload.efficiency_fe, payload.efficiency_be, payload.efficiency_ai, payload.efficiency_pm, payload.efficiency_fs) > EFFICIENCY_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"Efficiency must be between {EFFICIENCY_MIN:.2f} and {EFFICIENCY_MAX:.2f}",
        )

    cfg.team_fe = payload.team_fe
    cfg.team_be = payload.team_be
    cfg.team_ai = payload.team_ai
    cfg.team_pm = payload.team_pm
    cfg.team_fs = payload.team_fs
    cfg.efficiency_fe = payload.efficiency_fe
    cfg.efficiency_be = payload.efficiency_be
    cfg.efficiency_ai = payload.efficiency_ai
    cfg.efficiency_pm = payload.efficiency_pm
    cfg.efficiency_fs = payload.efficiency_fs
    now_utc = datetime.utcnow()
    cfg.team_locked_until = now_utc + timedelta(minutes=LOCK_WINDOW_MINUTES)
    cfg.team_locked_by = current_user.id
    cfg.efficiency_confirmed_ceo_at = now_utc
    cfg.efficiency_confirmed_ceo_by = current_user.id
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
    ensure_custom_role_permission(current_user, "can_allocate_portfolio_quotas", "update portfolio quotas")
    cfg = _get_or_create_governance(db)
    if _is_locked(cfg.quota_locked_until):
        raise HTTPException(
            status_code=423,
            detail=f"Portfolio quotas are locked until {cfg.quota_locked_until.isoformat()}",
        )

    # Validate each role's quotas sum to 1.0
    for role in ["fe", "be", "ai", "pm", "fs"]:
        client_quota = getattr(payload, f"quota_{role}_client")
        internal_quota = getattr(payload, f"quota_{role}_internal")
        rnd_quota = getattr(payload, f"quota_{role}_rnd")
        total = client_quota + internal_quota + rnd_quota
        if abs(total - 1.0) > 1e-9:
            raise HTTPException(
                status_code=400,
                detail=f"{role.upper()} portfolio quotas must sum to 1.0 (currently {total:.2f}). Adjust Client+Internal+R&D to equal 1.0."
            )
        if min(client_quota, internal_quota, rnd_quota) < 0:
            raise HTTPException(
                status_code=400,
                detail=f"{role.upper()} portfolio quotas cannot be negative"
            )

    # Save all per-role quotas
    cfg.quota_fe_client = payload.quota_fe_client
    cfg.quota_fe_internal = payload.quota_fe_internal
    cfg.quota_fe_rnd = payload.quota_fe_rnd
    cfg.quota_be_client = payload.quota_be_client
    cfg.quota_be_internal = payload.quota_be_internal
    cfg.quota_be_rnd = payload.quota_be_rnd
    cfg.quota_ai_client = payload.quota_ai_client
    cfg.quota_ai_internal = payload.quota_ai_internal
    cfg.quota_ai_rnd = payload.quota_ai_rnd
    cfg.quota_pm_client = payload.quota_pm_client
    cfg.quota_pm_internal = payload.quota_pm_internal
    cfg.quota_pm_rnd = payload.quota_pm_rnd
    cfg.quota_fs_client = payload.quota_fs_client
    cfg.quota_fs_internal = payload.quota_fs_internal
    cfg.quota_fs_rnd = payload.quota_fs_rnd

    cfg.quota_locked_until = datetime.utcnow() + timedelta(minutes=LOCK_WINDOW_MINUTES)
    cfg.quota_locked_by = current_user.id
    cfg.updated_by = current_user.id
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.post("/governance/efficiency-confirmation", response_model=GovernanceOut)
def confirm_governance_efficiency(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP)),
):
    ensure_custom_role_permission(current_user, "can_manage_settings", "confirm monthly efficiency baseline")
    cfg = _get_or_create_governance(db)
    now_utc = datetime.utcnow()
    if current_user.role == UserRole.CEO:
        cfg.efficiency_confirmed_ceo_at = now_utc
        cfg.efficiency_confirmed_ceo_by = current_user.id
    elif current_user.role == UserRole.VP:
        cfg.efficiency_confirmed_vp_at = now_utc
        cfg.efficiency_confirmed_vp_by = current_user.id
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


@router.post("/fte_roles/seed", response_model=dict[str, str])
def seed_fte_roles_endpoint(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.CEO])),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Seed default FTE roles (Admin/CEO only)."""
    try:
        seed_default_fte_roles(db)
        return {"status": "success", "message": "Default FTE roles seeded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed FTE roles: {str(e)}")


@router.post("/fte_roles/migrate", response_model=dict[str, int | str])
def migrate_fte_data_endpoint(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.CEO])),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    """Migrate existing FTE data to dynamic system (Admin/CEO only)."""
    try:
        summary = migrate_existing_fte_data(db)
        return {
            "status": "success",
            "message": "FTE data migration completed",
            **summary,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to migrate FTE data: {str(e)}")
