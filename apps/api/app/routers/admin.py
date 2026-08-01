from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_officer, require_permissions
from app.models.entities import Officer
from app.models.governance import ConfidenceReviewEvent
from app.schemas.common import PaginatedResponse
from app.schemas.confidence import (
    ConfidenceReviewDecision,
    ConfidenceReviewResponse,
    ConfidenceReviewSubmit,
)
from app.services import confidence_review_service

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _to_response(event: ConfidenceReviewEvent) -> ConfidenceReviewResponse:
    return ConfidenceReviewResponse(
        id=str(event.id),
        target_type=event.target_type,
        target_id=event.target_id,
        action=event.action,
        original_score=event.original_score,
        proposed_score=event.proposed_score,
        review_status=event.review_status,
        submitted_by_id=str(event.submitted_by_id),
        reviewed_by_id=str(event.reviewed_by_id) if event.reviewed_by_id else None,
        reviewed_at=event.reviewed_at.isoformat() if event.reviewed_at else None,
        created_at=event.created_at.isoformat() if event.created_at else None,
    )


@router.post(
    "/confidence-review",
    response_model=ConfidenceReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_confidence_review(
    payload: ConfidenceReviewSubmit,
    officer: Officer = Depends(require_permissions("confidence:review")),
    db: Session = Depends(get_db),
):
    """Submit a dispute/confirm on an edge or zone score (brief 7.9).
    Gated confidence:review — closes the Sprint-1 gap where submit had
    no permission gate at all (decision 010)."""
    try:
        return _to_response(
            confidence_review_service.submit_review(
                db=db, officer=officer, payload=payload
            )
        )
    except confidence_review_service.InvalidTargetTypeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_target_type",
                    "message": "Confidence review target type is not valid",
                    "details": {"valid_target_types": ("edge", "zone_score")},
                }
            },
        )
    except confidence_review_service.InvalidActionError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_action",
                    "message": "Confidence review action is not valid",
                    "details": {"valid_actions": ("dispute", "confirm")},
                }
            },
        )
    except confidence_review_service.InvalidScoreError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_score",
                    "message": "proposed_score must be an integer between 0 and 100",
                }
            },
        )
    except confidence_review_service.TargetNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "confidence_target_not_found",
                    "message": "Confidence review target does not exist",
                }
            },
        )


@router.post(
    "/confidence-review/{review_id}/decision",
    response_model=ConfidenceReviewResponse,
)
def decide_confidence_review(
    review_id: str,
    payload: ConfidenceReviewDecision,
    officer: Officer = Depends(require_permissions("confidence:review")),
    db: Session = Depends(get_db),
):
    """Accept/reject a pending review. An accepted dispute writes the
    proposed score to the relational mirror (Neo4j sync deferred — 010)
    and fires exactly one confidence_change Alert."""
    try:
        review_uuid = UUID(review_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_uuid",
                    "message": "Review ID is not a valid UUID",
                }
            },
        )
    try:
        return _to_response(
            confidence_review_service.decide_review(
                db=db, officer=officer, review_id=review_uuid, decision=payload.decision
            )
        )
    except confidence_review_service.InvalidTransitionError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "invalid_transition",
                    "message": "Review is not pending or decision is not valid",
                }
            },
        )
    except confidence_review_service.ConfidenceReviewNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "confidence_review_not_found",
                    "message": "Confidence review not found",
                }
            },
        )
    except confidence_review_service.CannotReviewOwnSubmissionError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "cannot_review_own_submission",
                    "message": "A reviewer cannot decide on their own confidence review submission",
                }
            },
        )
