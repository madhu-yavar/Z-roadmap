from pathlib import Path
import hashlib
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings


def save_upload(file: UploadFile) -> tuple[str, str, str]:
    extension = Path(file.filename).suffix.lower()
    safe_name = f"{uuid4().hex}{extension}"

    storage_dir = Path(settings.FILE_STORAGE_PATH)
    storage_dir.mkdir(parents=True, exist_ok=True)

    hasher = hashlib.sha256()
    target_path = storage_dir / safe_name
    with target_path.open("wb") as out:
        data = file.file.read()
        out.write(data)
        hasher.update(data)

    return str(target_path), extension.replace(".", ""), hasher.hexdigest()
