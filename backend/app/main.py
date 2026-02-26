from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import engine
from app.models.custom_role import CustomRole  # noqa: F401
from app.models.enums import UserRole
from app.models.fte_role import FteRole  # noqa: F401
from app.models.governance_config_fte import GovernanceConfigFte  # noqa: F401
from app.models.roadmap_item_fte import RoadmapItemFte, RoadmapPlanItemFte  # noqa: F401
from app.models.roadmap_movement_request import RoadmapMovementRequest  # noqa: F401
from app.models.user import User
from sqlalchemy.orm import Session

Base.metadata.create_all(bind=engine)


def _ensure_compat_columns() -> None:
    statements = [
        "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN'",
        "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PO'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP",
        "UPDATE users SET password_changed_at = created_at WHERE password_changed_at IS NULL AND force_password_change = FALSE",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium'",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS project_context VARCHAR(30) NOT NULL DEFAULT 'client'",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS initiative_type VARCHAR(30) NOT NULL DEFAULT 'new_feature'",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) NOT NULL DEFAULT 'standard'",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS rnd_hypothesis VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS rnd_experiment_goal VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS rnd_success_criteria VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS rnd_timebox_weeks INTEGER",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS rnd_decision_date VARCHAR(40) NOT NULL DEFAULT ''",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS rnd_next_gate VARCHAR(30) NOT NULL DEFAULT ''",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS rnd_risk_level VARCHAR(20) NOT NULL DEFAULT ''",
        "ALTER TABLE intake_items ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium'",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS project_context VARCHAR(30) NOT NULL DEFAULT 'client'",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS initiative_type VARCHAR(30) NOT NULL DEFAULT 'new_feature'",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) NOT NULL DEFAULT 'standard'",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS rnd_hypothesis VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS rnd_experiment_goal VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS rnd_success_criteria VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS rnd_timebox_weeks INTEGER",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS rnd_decision_date VARCHAR(40) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS rnd_next_gate VARCHAR(30) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS rnd_risk_level VARCHAR(20) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS fe_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS be_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS ai_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS pm_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS fs_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS accountable_person VARCHAR(255) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS picked_up BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS accountable_person VARCHAR(255) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) NOT NULL DEFAULT 'standard'",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS rnd_hypothesis VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS rnd_experiment_goal VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS rnd_success_criteria VARCHAR(2000) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS rnd_timebox_weeks INTEGER",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS rnd_decision_date VARCHAR(40) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS rnd_next_gate VARCHAR(30) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS rnd_risk_level VARCHAR(20) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS fe_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS be_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS ai_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS pm_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS fs_fte DOUBLE PRECISION",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS planned_start_date VARCHAR(20) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS planned_end_date VARCHAR(20) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS resource_count INTEGER",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS effort_person_weeks INTEGER",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS planning_status VARCHAR(20) NOT NULL DEFAULT 'not_started'",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS confidence VARCHAR(20) NOT NULL DEFAULT 'medium'",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS dependency_ids JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64) NOT NULL DEFAULT ''",
        "CREATE INDEX IF NOT EXISTS ix_documents_file_hash ON documents (file_hash)",
        """
        CREATE TABLE IF NOT EXISTS roadmap_redundancy_decisions (
            id SERIAL PRIMARY KEY,
            left_item_id INTEGER NOT NULL REFERENCES roadmap_items(id),
            right_item_id INTEGER NOT NULL REFERENCES roadmap_items(id),
            decision VARCHAR(32) NOT NULL,
            decided_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_redundancy_pair UNIQUE (left_item_id, right_item_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_redundancy_left_item_id ON roadmap_redundancy_decisions (left_item_id)",
        "CREATE INDEX IF NOT EXISTS ix_redundancy_right_item_id ON roadmap_redundancy_decisions (right_item_id)",
        """
        CREATE TABLE IF NOT EXISTS governance_configs (
            id SERIAL PRIMARY KEY,
            team_fe INTEGER NOT NULL DEFAULT 0,
            team_be INTEGER NOT NULL DEFAULT 0,
            team_ai INTEGER NOT NULL DEFAULT 0,
            team_pm INTEGER NOT NULL DEFAULT 0,
            efficiency_fe DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            efficiency_be DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            efficiency_ai DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            efficiency_pm DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            quota_client DOUBLE PRECISION NOT NULL DEFAULT 0.5,
            quota_internal DOUBLE PRECISION NOT NULL DEFAULT 0.5,
            team_locked_until TIMESTAMP,
            team_locked_by INTEGER REFERENCES users(id),
            quota_locked_until TIMESTAMP,
            quota_locked_by INTEGER REFERENCES users(id),
            efficiency_confirmed_ceo_at TIMESTAMP,
            efficiency_confirmed_ceo_by INTEGER,
            efficiency_confirmed_vp_at TIMESTAMP,
            efficiency_confirmed_vp_by INTEGER,
            roadmap_locked BOOLEAN NOT NULL DEFAULT FALSE,
            roadmap_locked_at TIMESTAMP,
            roadmap_locked_by INTEGER REFERENCES users(id),
            roadmap_lock_note VARCHAR(2000) NOT NULL DEFAULT '',
            updated_by INTEGER REFERENCES users(id),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS roadmap_movement_requests (
            id SERIAL PRIMARY KEY,
            plan_item_id INTEGER NOT NULL REFERENCES roadmap_plan_items(id),
            bucket_item_id INTEGER NOT NULL REFERENCES roadmap_items(id),
            request_type VARCHAR(24) NOT NULL DEFAULT 'request',
            status VARCHAR(24) NOT NULL DEFAULT 'pending',
            from_start_date VARCHAR(20) NOT NULL DEFAULT '',
            from_end_date VARCHAR(20) NOT NULL DEFAULT '',
            to_start_date VARCHAR(20) NOT NULL DEFAULT '',
            to_end_date VARCHAR(20) NOT NULL DEFAULT '',
            reason TEXT NOT NULL DEFAULT '',
            blocker VARCHAR(255) NOT NULL DEFAULT '',
            decision_reason TEXT NOT NULL DEFAULT '',
            requested_by INTEGER REFERENCES users(id),
            decided_by INTEGER REFERENCES users(id),
            requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
            decided_at TIMESTAMP,
            executed_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_roadmap_move_requests_plan_item_id ON roadmap_movement_requests (plan_item_id)",
        "CREATE INDEX IF NOT EXISTS ix_roadmap_move_requests_bucket_item_id ON roadmap_movement_requests (bucket_item_id)",
        "CREATE INDEX IF NOT EXISTS ix_roadmap_move_requests_status ON roadmap_movement_requests (status)",
        "CREATE INDEX IF NOT EXISTS ix_roadmap_move_requests_requested_by ON roadmap_movement_requests (requested_by)",
        """
        CREATE TABLE IF NOT EXISTS custom_roles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(80) NOT NULL UNIQUE,
            base_role user_role NOT NULL,
            scope TEXT NOT NULL DEFAULT '',
            responsibilities JSON NOT NULL DEFAULT '[]',
            can_create_users BOOLEAN NOT NULL DEFAULT FALSE,
            can_configure_team_capacity BOOLEAN NOT NULL DEFAULT FALSE,
            can_allocate_portfolio_quotas BOOLEAN NOT NULL DEFAULT FALSE,
            can_submit_commitment BOOLEAN NOT NULL DEFAULT FALSE,
            can_edit_roadmap BOOLEAN NOT NULL DEFAULT FALSE,
            can_manage_settings BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by INTEGER REFERENCES users(id),
            updated_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_custom_roles_name ON custom_roles (name)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role_id INTEGER",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS team_pm INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS efficiency_pm DOUBLE PRECISION NOT NULL DEFAULT 1.0",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS team_fs INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS efficiency_fs DOUBLE PRECISION NOT NULL DEFAULT 1.0",
        # Update existing team_fs = 0 to a default value for organizations adding FS later
        "UPDATE governance_configs SET team_fs = 2 WHERE team_fs = 0",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS team_locked_until TIMESTAMP",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS team_locked_by INTEGER",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS quota_locked_until TIMESTAMP",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS quota_locked_by INTEGER",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS efficiency_confirmed_ceo_at TIMESTAMP",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS efficiency_confirmed_ceo_by INTEGER",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS efficiency_confirmed_vp_at TIMESTAMP",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS efficiency_confirmed_vp_by INTEGER",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS roadmap_locked BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS roadmap_locked_at TIMESTAMP",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS roadmap_locked_by INTEGER",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS roadmap_lock_note VARCHAR(2000) NOT NULL DEFAULT ''",
        """
        CREATE TABLE IF NOT EXISTS fte_roles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE,
            abbreviation VARCHAR(10) NOT NULL UNIQUE,
            description VARCHAR(200) NOT NULL DEFAULT '',
            category VARCHAR(20) NOT NULL DEFAULT 'full_time',
            default_efficiency_factor DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            display_order INTEGER NOT NULL DEFAULT 0,
            color_code VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
            created_by INTEGER REFERENCES users(id),
            updated_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_fte_roles_name ON fte_roles (name)",
        "CREATE INDEX IF NOT EXISTS ix_fte_roles_abbreviation ON fte_roles (abbreviation)",
        """
        CREATE TABLE IF NOT EXISTS roadmap_item_fte (
            id SERIAL PRIMARY KEY,
            roadmap_item_id INTEGER NOT NULL REFERENCES roadmap_items(id),
            fte_role_id INTEGER NOT NULL REFERENCES fte_roles(id),
            fte_value DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_roadmap_item_fte UNIQUE (roadmap_item_id, fte_role_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_roadmap_item_fte_roadmap_item_id ON roadmap_item_fte (roadmap_item_id)",
        "CREATE INDEX IF NOT EXISTS ix_roadmap_item_fte_fte_role_id ON roadmap_item_fte (fte_role_id)",
        """
        CREATE TABLE IF NOT EXISTS roadmap_plan_item_fte (
            id SERIAL PRIMARY KEY,
            roadmap_plan_item_id INTEGER NOT NULL REFERENCES roadmap_plan_items(id),
            fte_role_id INTEGER NOT NULL REFERENCES fte_roles(id),
            fte_value DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_roadmap_plan_item_fte UNIQUE (roadmap_plan_item_id, fte_role_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_roadmap_plan_item_fte_roadmap_plan_item_id ON roadmap_plan_item_fte (roadmap_plan_item_id)",
        "CREATE INDEX IF NOT EXISTS ix_roadmap_plan_item_fte_fte_role_id ON roadmap_plan_item_fte (fte_role_id)",
        """
        CREATE TABLE IF NOT EXISTS governance_config_fte (
            id SERIAL PRIMARY KEY,
            governance_config_id INTEGER NOT NULL REFERENCES governance_configs(id),
            fte_role_id INTEGER NOT NULL REFERENCES fte_roles(id),
            team_size INTEGER NOT NULL DEFAULT 0,
            efficiency_factor DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            CONSTRAINT uq_governance_fte UNIQUE (governance_config_id, fte_role_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_governance_config_fte_governance_config_id ON governance_config_fte (governance_config_id)",
        "CREATE INDEX IF NOT EXISTS ix_governance_config_fte_fte_role_id ON governance_config_fte (fte_role_id)",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


_ensure_compat_columns()


def _ensure_admin_user() -> None:
    email = (settings.ADMIN_BOOTSTRAP_EMAIL or "").strip().lower()
    password = settings.ADMIN_BOOTSTRAP_PASSWORD or ""
    if not email or len(password) < 8:
        return
    with Session(engine) as db:
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if admin:
            return
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.role = UserRole.ADMIN
            existing.is_active = True
            existing.force_password_change = True
            existing.password_changed_at = None
            db.add(existing)
            db.commit()
            return
        db.add(
            User(
                full_name=(settings.ADMIN_BOOTSTRAP_NAME or "Platform Admin").strip() or "Platform Admin",
                email=email,
                password_hash=get_password_hash(password),
                role=UserRole.ADMIN,
                force_password_change=True,
                password_changed_at=None,
                is_active=True,
            )
        )
        db.commit()


def _ensure_fte_roles() -> None:
    from app.services.fte_role_service import seed_default_fte_roles

    with Session(engine) as db:
        # Check if any FTE roles exist
        from app.models.fte_role import FteRole

        existing_count = db.query(FteRole).count()
        if existing_count == 0:
            seed_default_fte_roles(db)


_ensure_admin_user()
_ensure_fte_roles()

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "env": settings.APP_ENV}
