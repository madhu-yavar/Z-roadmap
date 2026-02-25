from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GovernanceConfigFte(Base):
    __tablename__ = "governance_config_fte"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    governance_config_id: Mapped[int] = mapped_column(ForeignKey("governance_configs.id"), nullable=False)
    fte_role_id: Mapped[int] = mapped_column(ForeignKey("fte_roles.id"), nullable=False)
    team_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    efficiency_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    __table_args__ = (
        UniqueConstraint('governance_config_id', 'fte_role_id', name='uq_governance_fte'),
    )
