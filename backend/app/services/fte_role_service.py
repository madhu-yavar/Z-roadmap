from sqlalchemy.orm import Session

from app.models.fte_role import FteRole
from app.models.governance_config import GovernanceConfig
from app.models.governance_config_fte import GovernanceConfigFte
from app.models.roadmap_item import RoadmapItem
from app.models.roadmap_item_fte import RoadmapItemFte, RoadmapPlanItemFte
from app.models.roadmap_plan_item import RoadmapPlanItem


def seed_default_fte_roles(db: Session) -> None:
    """Seed default FTE roles if they don't exist."""
    default_roles = [
        {
            "name": "Frontend",
            "abbreviation": "FE",
            "description": "Frontend Engineer",
            "category": "full_time",
            "default_efficiency_factor": 1.0,
            "display_order": 1,
            "color_code": "#3B82F6",  # Blue
        },
        {
            "name": "Backend",
            "abbreviation": "BE",
            "description": "Backend Engineer",
            "category": "full_time",
            "default_efficiency_factor": 1.0,
            "display_order": 2,
            "color_code": "#10B981",  # Green
        },
        {
            "name": "AI/ML",
            "abbreviation": "AI",
            "description": "AI/ML Engineer",
            "category": "full_time",
            "default_efficiency_factor": 1.0,
            "display_order": 3,
            "color_code": "#8B5CF6",  # Purple
        },
        {
            "name": "Project Manager",
            "abbreviation": "PM",
            "description": "Project Manager",
            "category": "full_time",
            "default_efficiency_factor": 1.0,
            "display_order": 4,
            "color_code": "#F59E0B",  # Amber
        },
        {
            "name": "Full Stack",
            "abbreviation": "FS",
            "description": "Full Stack Engineer",
            "category": "full_time",
            "default_efficiency_factor": 1.0,
            "display_order": 5,
            "color_code": "#EC4899",  # Pink
        },
    ]

    for role_data in default_roles:
        existing = db.query(FteRole).filter(FteRole.abbreviation == role_data["abbreviation"]).first()
        if not existing:
            role = FteRole(**role_data)
            db.add(role)

    db.commit()


def migrate_existing_fte_data(db: Session) -> dict[str, int]:
    """
    Migrate existing hardcoded FTE data to the new dynamic system.
    Returns a summary of migrated records.
    """
    summary = {
        "roadmap_items_migrated": 0,
        "roadmap_plan_items_migrated": 0,
        "governance_configs_migrated": 0,
    }

    # Get all FTE roles
    fe_role = db.query(FteRole).filter(FteRole.abbreviation == "FE").first()
    be_role = db.query(FteRole).filter(FteRole.abbreviation == "BE").first()
    ai_role = db.query(FteRole).filter(FteRole.abbreviation == "AI").first()
    pm_role = db.query(FteRole).filter(FteRole.abbreviation == "PM").first()
    fs_role = db.query(FteRole).filter(FteRole.abbreviation == "FS").first()

    if not all([fe_role, be_role, ai_role, pm_role, fs_role]):
        # Seed default roles first
        seed_default_fte_roles(db)
        # Reload roles
        fe_role = db.query(FteRole).filter(FteRole.abbreviation == "FE").first()
        be_role = db.query(FteRole).filter(FteRole.abbreviation == "BE").first()
        ai_role = db.query(FteRole).filter(FteRole.abbreviation == "AI").first()
        pm_role = db.query(FteRole).filter(FteRole.abbreviation == "PM").first()
        fs_role = db.query(FteRole).filter(FteRole.abbreviation == "FS").first()

    role_map = {
        "fe": fe_role.id if fe_role else None,
        "be": be_role.id if be_role else None,
        "ai": ai_role.id if ai_role else None,
        "pm": pm_role.id if pm_role else None,
        "fs": fs_role.id if fs_role else None,
    }

    # Migrate RoadmapItem FTE data
    roadmap_items = db.query(RoadmapItem).all()
    for item in roadmap_items:
        for role_key, fte_role_id in role_map.items():
            if fte_role_id is None:
                continue
            fte_value = getattr(item, f"{role_key}_fte", None)
            if fte_value is not None and fte_value > 0:
                # Check if already migrated
                existing = (
                    db.query(RoadmapItemFte)
                    .filter(
                        RoadmapItemFte.roadmap_item_id == item.id,
                        RoadmapItemFte.fte_role_id == fte_role_id,
                    )
                    .first()
                )
                if not existing:
                    allocation = RoadmapItemFte(
                        roadmap_item_id=item.id,
                        fte_role_id=fte_role_id,
                        fte_value=fte_value,
                    )
                    db.add(allocation)
                    summary["roadmap_items_migrated"] += 1

    # Migrate RoadmapPlanItem FTE data
    plan_items = db.query(RoadmapPlanItem).all()
    for item in plan_items:
        for role_key, fte_role_id in role_map.items():
            if fte_role_id is None:
                continue
            fte_value = getattr(item, f"{role_key}_fte", None)
            if fte_value is not None and fte_value > 0:
                existing = (
                    db.query(RoadmapPlanItemFte)
                    .filter(
                        RoadmapPlanItemFte.roadmap_plan_item_id == item.id,
                        RoadmapPlanItemFte.fte_role_id == fte_role_id,
                    )
                    .first()
                )
                if not existing:
                    allocation = RoadmapPlanItemFte(
                        roadmap_plan_item_id=item.id,
                        fte_role_id=fte_role_id,
                        fte_value=fte_value,
                    )
                    db.add(allocation)
                    summary["roadmap_plan_items_migrated"] += 1

    # Migrate GovernanceConfig FTE data
    gov_configs = db.query(GovernanceConfig).all()
    for config in gov_configs:
        for role_key, fte_role_id in role_map.items():
            if fte_role_id is None:
                continue
            team_size = getattr(config, f"team_{role_key}", 0) or 0
            efficiency = getattr(config, f"efficiency_{role_key}", 1.0) or 1.0

            existing = (
                db.query(GovernanceConfigFte)
                .filter(
                    GovernanceConfigFte.governance_config_id == config.id,
                    GovernanceConfigFte.fte_role_id == fte_role_id,
                )
                .first()
            )
            if not existing:
                config_fte = GovernanceConfigFte(
                    governance_config_id=config.id,
                    fte_role_id=fte_role_id,
                    team_size=team_size,
                    efficiency_factor=efficiency,
                )
                db.add(config_fte)
                summary["governance_configs_migrated"] += 1

    db.commit()
    return summary


def get_active_fte_roles(db: Session) -> list[FteRole]:
    """Get all active FTE roles ordered by display order."""
    return (
        db.query(FteRole)
        .filter(FteRole.is_active == True)
        .order_by(FteRole.display_order, FteRole.name)
        .all()
    )


def get_fte_role_by_abbreviation(db: Session, abbreviation: str) -> FteRole | None:
    """Get an FTE role by its abbreviation."""
    return db.query(FteRole).filter(FteRole.abbreviation == abbreviation).first()
