from fastapi import APIRouter

from app.api.routes import audit, auth, chat, dashboard, documents, features, fte_roles, intake, projects, roadmap, settings, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(features.router)
api_router.include_router(documents.router)
api_router.include_router(intake.router)
api_router.include_router(roadmap.router)
api_router.include_router(settings.router)
api_router.include_router(dashboard.router)
api_router.include_router(chat.router)
api_router.include_router(audit.router)
api_router.include_router(fte_roles.router, prefix="/fte_roles", tags=["fte_roles"])
