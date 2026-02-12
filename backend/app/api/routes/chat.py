from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import ChatInput, ChatOut, IntakeSupportInput
from app.services.agents.intake_support_agent import run_intake_support_agent
from app.services.agents.roadmap_chat_graph import run_chat_graph

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatOut)
def chat(payload: ChatInput, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    answer, evidence = run_chat_graph(payload.question, db, role=getattr(current_user, "role", ""))
    return ChatOut(
        answer=answer,
        evidence=evidence,
        actions=[],
        support_applied=False,
        intake_item_id=None,
        support_state="general",
        intent_clear=None,
        next_action="none",
    )


@router.post("/intake-support", response_model=ChatOut)
def intake_support(payload: IntakeSupportInput, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        answer, evidence, actions, support_applied, item_id, support_state, intent_clear, next_action = run_intake_support_agent(
            intake_item_id=payload.intake_item_id,
            db=db,
            role=getattr(current_user, "role", ""),
            question=(payload.question or "").strip(),
            changed_by=getattr(current_user, "id", None),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Intake support failed: {exc}") from exc
    return ChatOut(
        answer=answer,
        evidence=evidence,
        actions=actions,
        support_applied=support_applied,
        intake_item_id=item_id,
        support_state=support_state,
        intent_clear=intent_clear,
        next_action=next_action,
    )
