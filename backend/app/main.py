from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

Base.metadata.create_all(bind=engine)


def _ensure_compat_columns() -> None:
    statements = [
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
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS accountable_person VARCHAR(255) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_items ADD COLUMN IF NOT EXISTS picked_up BOOLEAN NOT NULL DEFAULT FALSE",
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
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS planned_start_date VARCHAR(20) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS planned_end_date VARCHAR(20) NOT NULL DEFAULT ''",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS resource_count INTEGER",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS effort_person_weeks INTEGER",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS planning_status VARCHAR(20) NOT NULL DEFAULT 'not_started'",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS confidence VARCHAR(20) NOT NULL DEFAULT 'medium'",
        "ALTER TABLE roadmap_plan_items ADD COLUMN IF NOT EXISTS dependency_ids JSON NOT NULL DEFAULT '[]'",
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
            updated_by INTEGER REFERENCES users(id),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS team_pm INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE governance_configs ADD COLUMN IF NOT EXISTS efficiency_pm DOUBLE PRECISION NOT NULL DEFAULT 1.0",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


_ensure_compat_columns()

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
