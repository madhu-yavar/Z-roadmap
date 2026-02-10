from fastapi import APIRouter

from app.api.routes import auth, chat, dashboard, documents, features, intake, projects, roadmap, settings, users

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
