from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import ChatInput, ChatOut
from app.services.agents.roadmap_chat_graph import run_chat_graph

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatOut)
def chat(payload: ChatInput, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    answer, evidence = run_chat_graph(payload.question, db, role=getattr(current_user, "role", ""))
    return ChatOut(answer=answer, evidence=evidence)
