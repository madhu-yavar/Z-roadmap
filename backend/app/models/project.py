from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ProjectStatus, ProjectType


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), default="", nullable=False)
    project_type: Mapped[ProjectType] = mapped_column(Enum(ProjectType, name="project_type"), nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus, name="project_status"), nullable=False)
    progress_pct: Mapped[int] = mapped_column(default=0, nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="projects")
    features = relationship("Feature", back_populates="project", cascade="all,delete")
    documents = relationship("Document", back_populates="project")
