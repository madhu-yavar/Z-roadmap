from pathlib import Path
import hashlib
import mimetypes

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.document import Document
from app.models.enums import UserRole
from app.models.intake_analysis import IntakeAnalysis
from app.models.intake_item import IntakeItem
from app.models.intake_item_version import IntakeItemVersion
from app.models.project import Project
from app.models.roadmap_plan_item import RoadmapPlanItem
from app.models.roadmap_item import RoadmapItem
from app.models.roadmap_item_version import RoadmapItemVersion
from app.models.user import User
from app.schemas.common import BulkDeleteOut, BulkIdsIn
from app.schemas.document import DocumentOut
from app.services.document_parser import extract_document_units
from app.services.file_storage import save_upload

router = APIRouter(prefix="/documents", tags=["documents"])


def _compute_hash(path: str) -> str:
    h = hashlib.sha256()
    p = Path(path)
    with p.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _backfill_missing_hashes(db: Session, max_rows: int = 100) -> None:
    missing = (
        db.query(Document)
        .filter((Document.file_hash == "") | (Document.file_hash.is_(None)))
        .order_by(Document.id.desc())
        .limit(max_rows)
        .all()
    )
    changed = False
    for doc in missing:
        try:
            doc.file_hash = _compute_hash(doc.file_path)
            db.add(doc)
            changed = True
        except Exception:
            continue
    if changed:
        db.flush()


@router.post("/upload", response_model=DocumentOut)
def upload_document(
    file: UploadFile = File(...),
    project_id: int | None = Form(None),
    notes: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CEO, UserRole.VP, UserRole.PM, UserRole.BA)),
):
    if project_id:
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    file_path, file_type, file_hash = save_upload(file)
    _backfill_missing_hashes(db)
    duplicate = db.query(Document).filter(Document.file_hash == file_hash).order_by(Document.id.desc()).first()
    if duplicate:
        try:
            p = Path(file_path)
            if p.exists():
                p.unlink()
        except Exception:
            pass
        raise HTTPException(
            status_code=409,
            detail=(
                f"Duplicate upload detected. Existing document id={duplicate.id}, "
                f"name={duplicate.file_name}. Reuse existing item from Intake Queue."
            ),
        )

    document = Document(
        project_id=project_id,
        uploaded_by=current_user.id,
        file_name=file.filename,
        file_type=file_type,
        file_path=file_path,
        file_hash=file_hash,
        notes=notes,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Document).order_by(Document.id.desc()).all()


@router.get("/{document_id}/file")
def get_document_file(
    document_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(doc.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found on disk")

    guessed_type = mimetypes.guess_type(doc.file_name or "")[0]
    media_type = guessed_type or "application/octet-stream"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=doc.file_name,
        headers={"Content-Disposition": f'inline; filename="{doc.file_name}"'},
    )


@router.get("/{document_id}/preview")
def get_document_preview(
    document_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(doc.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document file not found on disk")

    ext = (doc.file_type or path.suffix.replace(".", "")).lower()
    if ext in {"pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "md", "csv", "json", "xml", "html"}:
        return {"mode": "inline_file", "file_type": ext}

    if ext in {"doc", "docx", "ppt", "pptx", "xls", "xlsx"}:
        try:
            units = extract_document_units(file_path=doc.file_path, file_type=doc.file_type)
        except Exception:
            return {"mode": "download_only", "file_type": ext}
        lines = [u.get("text", "").strip() for u in units if u.get("text")]
        preview_lines = [line for line in lines if line][:200]
        return {
            "mode": "extracted_text",
            "file_type": ext,
            "preview_text": "\n".join(preview_lines),
            "line_count": len(preview_lines),
        }

    return {"mode": "download_only", "file_type": ext}


@router.post("/bulk-delete", response_model=BulkDeleteOut)
def bulk_delete_documents(
    payload: BulkIdsIn,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.CEO)),
):
    ids = sorted(set(payload.ids))
    if not ids:
        return BulkDeleteOut(deleted=0)

    documents = db.query(Document).filter(Document.id.in_(ids)).all()
    deleted = 0

    for doc in documents:
        direct_roadmap_ids = [
            rid
            for (rid,) in db.query(RoadmapItem.id).filter(RoadmapItem.source_document_id == doc.id).all()
        ]
        intake = db.query(IntakeItem).filter(IntakeItem.document_id == doc.id).first()
        if intake:
            roadmap_id = intake.roadmap_item_id
            db.query(IntakeAnalysis).filter(IntakeAnalysis.intake_item_id == intake.id).delete(synchronize_session=False)
            db.query(IntakeItemVersion).filter(IntakeItemVersion.intake_item_id == intake.id).delete(
                synchronize_session=False
            )
            db.query(IntakeItem).filter(IntakeItem.id == intake.id).delete(synchronize_session=False)

            if roadmap_id:
                db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id == roadmap_id).delete(
                    synchronize_session=False
                )
                db.query(RoadmapItemVersion).filter(RoadmapItemVersion.roadmap_item_id == roadmap_id).delete(
                    synchronize_session=False
                )
                db.query(RoadmapItem).filter(RoadmapItem.id == roadmap_id).delete(synchronize_session=False)

        if direct_roadmap_ids:
            db.query(RoadmapPlanItem).filter(RoadmapPlanItem.bucket_item_id.in_(direct_roadmap_ids)).delete(
                synchronize_session=False
            )
            db.query(RoadmapItemVersion).filter(RoadmapItemVersion.roadmap_item_id.in_(direct_roadmap_ids)).delete(
                synchronize_session=False
            )
            db.query(RoadmapItem).filter(RoadmapItem.id.in_(direct_roadmap_ids)).delete(synchronize_session=False)

        db.query(Document).filter(Document.id == doc.id).delete(synchronize_session=False)
        try:
            file_path = Path(doc.file_path)
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass
        deleted += 1

    db.commit()
    return BulkDeleteOut(deleted=deleted)
