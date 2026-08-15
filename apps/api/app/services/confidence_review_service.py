"""Confidence review / feedback loop (brief 7.9; docs/decisions/010).

V1 write path is MIRROR-ONLY: an accepted dispute updates the relational
target's confidence_score + confidence_band (RelationshipEdgeRef or
ZoneRiskScore) and fires exactly one confidence_change Alert. Neo4j
edge-property sync is EXPLICITLY DEFERRED — the graph keeps its old
property; documented in 010 as the known gap. A rejected dispute
changes nothing. An accepted confirm changes nothing (it validates the
current score by recorded review).

Both submit and decide are gated confidence:review (the Sprint-1 gap —
submit previously had NO permission gate). Reviewers may not act on
their own submissions (inferred rule, same as access exceptions).
"""

import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import band_for_score
from app.models.entities import Officer, RelationshipEdgeRef, ZoneRiskScore
from app.models.governance import ConfidenceReviewEvent
from app.schemas.confidence import ConfidenceReviewSubmit
from app.services import audit_service
from app.services.alert_service import create_alert


class InvalidTargetTypeError(Exception):
    """target_type outside {edge, zone_score} (422 at the router)."""


class InvalidActionError(Exception):
    """action outside {dispute, confirm} (422 at the router)."""


class InvalidScoreError(Exception):
    """proposed_score not 0-100 for a dispute (422 at the router)."""


class TargetNotFoundError(Exception):
    """target_id does not reference an existing edge/zone-score (404)."""


class ConfidenceReviewNotFoundError(Exception):
    """review id does not exist (404 at the router)."""


class InvalidTransitionError(Exception):
    """review is not pending (422 at the router)."""


class CannotReviewOwnSubmissionError(Exception):
    """reviewer is the submitter (422 at the router; inferred rule)."""


def _write_audit_log(
    db: Session,
    actor: Officer,
    action: str,
    resource_id: str,
    detail: str | None,
) -> None:
    audit_service.write_audit_log(
        db,
        actor=actor,
        action=action,
        module=audit_service.MODULE_GOVERNANCE,
        resource_type="confidence_review",
        resource_id=resource_id,
        detail=detail,
    )


def _resolve_target(db: Session, target_type: str, target_id: UUID):
    if target_type == "edge":
        return db.get(RelationshipEdgeRef, target_id)
    if target_type == "zone_score":
        return db.get(ZoneRiskScore, target_id)
    raise InvalidTargetTypeError(target_type)


def _current_score(target) -> int | None:
    if isinstance(target, RelationshipEdgeRef):
        return target.confidence_score
    return target.score


def submit_review(
    db: Session,
    officer: Officer,
    payload: ConfidenceReviewSubmit,
) -> ConfidenceReviewEvent:
    if payload.action not in ConfidenceReviewEvent.VALID_ACTIONS:
        raise InvalidActionError(payload.action)
    if payload.action == "dispute":
        if payload.proposed_score is None or not 0 <= payload.proposed_score <= 100:
            raise InvalidScoreError(payload.proposed_score)

    target = _resolve_target(db, payload.target_type, payload.target_id)
    if target is None:
        raise TargetNotFoundError(f"{payload.target_type}:{payload.target_id}")

    event = ConfidenceReviewEvent(
        target_type=payload.target_type,
        target_id=str(payload.target_id),
        action=payload.action,
        original_score=_current_score(target),
        proposed_score=payload.proposed_score if payload.action == "dispute" else None,
        submitted_by_id=officer.id,
        review_status="pending",
    )
    db.add(event)
    db.flush()
    _write_audit_log(
        db=db,
        actor=officer,
        action="confidence_review_submitted",
        resource_id=str(event.id),
        detail=json.dumps(
            {
                "target_type": payload.target_type,
                "target_id": str(payload.target_id),
                "action": payload.action,
                "original_score": event.original_score,
                "proposed_score": event.proposed_score,
            }
        ),
    )
    db.commit()
    db.refresh(event)
    return event


def decide_review(
    db: Session,
    officer: Officer,
    review_id: UUID,
    decision: str,
) -> ConfidenceReviewEvent:
    if decision not in ConfidenceReviewEvent.VALID_DECISIONS:
        raise InvalidTransitionError(decision)
    event = db.get(ConfidenceReviewEvent, review_id)
    if event is None:
        raise ConfidenceReviewNotFoundError(str(review_id))
    if event.review_status != "pending":
        raise InvalidTransitionError(event.review_status)
    if event.submitted_by_id == officer.id:
        raise CannotReviewOwnSubmissionError(str(review_id))

    event.review_status = "accepted" if decision == "accept" else "rejected"
    event.reviewed_by_id = officer.id
    event.reviewed_at = datetime.now(timezone.utc)

    alert_id = None
    if decision == "accept" and event.action == "dispute":
        target = _resolve_target(db, event.target_type, UUID(event.target_id))
        if target is not None:
            if isinstance(target, RelationshipEdgeRef):
                target.confidence_score = event.proposed_score
                target.confidence_band = band_for_score(event.proposed_score).value
                target.verification_status = "disputed"
            else:
                target.score = event.proposed_score
                target.confidence_band = band_for_score(event.proposed_score).value
            alert_id = _fire_confidence_change_alert(db, event, target)

    db.flush()
    _write_audit_log(
        db=db,
        actor=officer,
        action=f"confidence_review_{decision}ed",
        resource_id=str(event.id),
        detail=json.dumps(
            {
                "decision": decision,
                "alert_id": alert_id,
                "score_written": decision == "accept" and event.action == "dispute",
            }
        ),
    )
    db.commit()
    db.refresh(event)
    return event


def _fire_confidence_change_alert(db: Session, event: ConfidenceReviewEvent, target) -> str:
    """Exactly one confidence_change Alert per accepted dispute (010).
    entity_type/entity_id stay NULL: mirrors carry no endpoint columns
    (007), so the alert names the relationship, not an entity. district_id
    resolves from the edge's linked case when present, else NULL."""
    district_id = None
    if isinstance(target, RelationshipEdgeRef) and target.case_id is not None:
        from app.models.entities import Case

        district_id = db.execute(
            select(Case.district_id).where(Case.id == target.case_id)
        ).scalar_one_or_none()
    alert = create_alert(
        db=db,
        alert_type="confidence_change",
        summary=(
            f"Confidence on relationship {event.target_id[:8]} changed "
            f"from {event.original_score} to {event.proposed_score} "
            f"({event.reviewed_by_id})"
        ),
        entity_type=None,
        entity_id=None,
        district_id=district_id,
        classification=target.classification,
    )
    return str(alert.id)
