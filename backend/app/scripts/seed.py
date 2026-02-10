from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.enums import UserRole
from app.models.user import User

Base.metadata.create_all(bind=engine)

seed_users = [
    ("CEO User", "ceo@local.test", UserRole.CEO),
    ("VP User", "vp@local.test", UserRole.VP),
    ("BA User", "ba@local.test", UserRole.BA),
    ("PM User", "pm@local.test", UserRole.PM),
]


def run() -> None:
    db = SessionLocal()
    try:
        for full_name, email, role in seed_users:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                continue
            db.add(
                User(
                    full_name=full_name,
                    email=email,
                    password_hash=get_password_hash("pass1234"),
                    role=role,
                )
            )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    run()
