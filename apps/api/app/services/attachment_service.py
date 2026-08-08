"""Case-scoped attachment service (006 §1 / 999 §2.12): the attachment
endpoint was a stub (`{"_stub": True}`, no auth-visibility gate, no
storage) pending a storage decision. Decision: local disk, no new service
(S3/MinIO) — files live under settings.ATTACHMENT_STORAGE_PATH, addressed
by the attachment's own server-generated id. filename is never used to
build a filesystem path (path-traversal hardening 006 §1 flagged as
needed); it's sanitized to a bare basename and kept only for display and
the download Content-Disposition header.

Visibility: same case gate as every other case-scoped record (duplicated
inline rather than imported from case_service — case_service repeats this
exact block across seven of its own functions; this is the same
established pattern, not a new one). Attachments are tier-gated at the
RECORD level (classification_filter), like notes and cases — the
field-level redaction engine intentionally does not extend here: a file's
content is binary, not a text field a policy can mask.
"""

import json
import os
from pathlib import Path
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.classification import ROLE_MAX_CLASSIFICATION, classification_filter
from app.core.config import settings
from app.models.base import CLASSIFICATION_RANK
from app.models.base import ClassificationLevel as ModelClassificationLevel
from app.models.entities import Attachment, Case, Officer
from app.models.governance import AuditLogEntry
from app.schemas.cases import AttachmentSummary
from app.schemas.common import ClassificationLevel
from app.services.access_exception_service import exempt_case_ids
from app.services.district_service import get_accessible_district_ids

MAX_FILENAME_LENGTH = 255


class InvalidClassificationError(Exception):
    """classification is outside the four-tier vocabulary (422 at the router)."""


class ClassificationExceedsClearanceError(Exception):
    """Uploader cannot attach a file above their own max tier (422 at the router)."""


class UnsupportedContentTypeError(Exception):
    """content_type is outside ATTACHMENT_ALLOWED_CONTENT_TYPES (422 at the router)."""


class AttachmentTooLargeError(Exception):
    """File exceeds ATTACHMENT_MAX_SIZE_BYTES (413 at the router)."""


def _visible_case(db: Session, officer: Officer, case_id: UUID) -> Case | None:
    visible_tiers = classification_filter(officer.role)
    accessible = get_accessible_district_ids(officer)
    stmt = select(Case).where(Case.id == case_id, Case.classification.in_(visible_tiers))
    if accessible is not None:
        exempt = exempt_case_ids(db, officer)
        scope = Case.district_id.in_(accessible)
        if exempt:
            scope = or_(scope, Case.id.in_(exempt))
        stmt = stmt.where(scope)
    return db.execute(stmt).scalar_one_or_none()


def _storage_dir() -> Path:
    path = Path(settings.ATTACHMENT_STORAGE_PATH)
    path.mkdir(parents=True, exist_ok=True)
    return path


def storage_file_path(attachment_id) -> Path:
    return _storage_dir() / str(attachment_id)


def _to_summary(attachment: Attachment) -> AttachmentSummary:
    return AttachmentSummary(
        id=str(attachment.id),
        case_id=str(attachment.case_id),
        filename=attachment.filename,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
        classification=ClassificationLevel(attachment.classification.value),
        uploaded_by_id=str(attachment.uploaded_by_id),
        created_at=str(attachment.created_at) if attachment.created_at else None,
    )


def create_attachment(
    db: Session,
    officer: Officer,
    case_id: UUID,
    filename: str,
    content_type: str,
    content: bytes,
    classification: str,
) -> AttachmentSummary | None:
    """None -> case invisible/nonexistent (router 404). The DB row is only
    committed AFTER the file is written to disk, so a disk-write failure
    never leaves a committed row pointing at a missing file (the reverse
    ordering — commit then write — could)."""
    case = _visible_case(db, officer, case_id)
    if case is None:
        return None

    valid_values = {c.value for c in ModelClassificationLevel}
    if classification not in valid_values:
        raise InvalidClassificationError(classification)
    model_classification = ModelClassificationLevel(classification)
    max_tier = ROLE_MAX_CLASSIFICATION[officer.role]
    if CLASSIFICATION_RANK[model_classification] > CLASSIFICATION_RANK[max_tier]:
        raise ClassificationExceedsClearanceError(classification)

    if content_type not in settings.attachment_allowed_content_types_list:
        raise UnsupportedContentTypeError(content_type)
    if len(content) > settings.ATTACHMENT_MAX_SIZE_BYTES:
        raise AttachmentTooLargeError(str(len(content)))

    safe_filename = os.path.basename((filename or "").strip())[:MAX_FILENAME_LENGTH] or "unnamed"

    attachment = Attachment(
        case_id=case.id,
        uploaded_by_id=officer.id,
        filename=safe_filename,
        content_type=content_type,
        size_bytes=len(content),
        classification=model_classification,
    )
    db.add(attachment)
    db.flush()  # assigns attachment.id without committing

    storage_file_path(attachment.id).write_bytes(content)

    db.commit()
    db.refresh(attachment)
    return _to_summary(attachment)


def list_attachments(db: Session, officer: Officer, case_id: UUID) -> list[AttachmentSummary] | None:
    """None -> case invisible/nonexistent (router 404)."""
    case = _visible_case(db, officer, case_id)
    if case is None:
        return None

    visible_tiers = classification_filter(officer.role)
    rows = db.execute(
        select(Attachment)
        .where(Attachment.case_id == case_id, Attachment.classification.in_(visible_tiers))
        .order_by(Attachment.created_at.desc())
    ).scalars().all()
    return [_to_summary(a) for a in rows]


def get_attachment_for_download(
    db: Session,
    officer: Officer,
    case_id: UUID,
    attachment_id: UUID,
    ip_address: str | None = None,
) -> Attachment | None:
    """None -> case invisible, attachment nonexistent, wrong case, or above
    the viewer's tier — all indistinguishable (router 404, fail-closed,
    same as every other record-level lookup in this codebase). Writes ONE
    attachment_downloaded audit entry per successful lookup — a download
    takes content out of the system, the same risk profile export already
    audits."""
    case = _visible_case(db, officer, case_id)
    if case is None:
        return None

    visible_tiers = classification_filter(officer.role)
    attachment = db.execute(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.case_id == case_id,
            Attachment.classification.in_(visible_tiers),
        )
    ).scalar_one_or_none()
    if attachment is None:
        return None

    db.add(
        AuditLogEntry(
            actor_id=officer.id,
            action="attachment_downloaded",
            resource_type="attachment",
            resource_id=str(attachment.id),
            ip_address=ip_address,
            detail=json.dumps({"case_id": str(case_id), "filename": attachment.filename}),
        )
    )
    db.commit()
    return attachment
