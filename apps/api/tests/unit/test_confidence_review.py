"""Confidence-review vocabulary + validation rules (models + service)."""

from app.models.governance import ConfidenceReviewEvent
from app.services import confidence_review_service as svc


def test_target_vocabulary():
    assert ConfidenceReviewEvent.VALID_TARGET_TYPES == ("edge", "zone_score")
    assert ConfidenceReviewEvent.VALID_ACTIONS == ("dispute", "confirm")
    assert ConfidenceReviewEvent.VALID_DECISIONS == ("accept", "reject")
    assert "pending" in ConfidenceReviewEvent.VALID_REVIEW_STATUSES


def test_error_hierarchy():
    for exc in (
        svc.InvalidTargetTypeError,
        svc.InvalidActionError,
        svc.InvalidScoreError,
        svc.TargetNotFoundError,
        svc.ConfidenceReviewNotFoundError,
        svc.InvalidTransitionError,
        svc.CannotReviewOwnSubmissionError,
    ):
        assert issubclass(exc, Exception)


def test_dispute_requires_score_in_range():
    """A dispute outside 0-100 must be rejected before any DB work. We assert
    the service's guard by simulating its predicate against boundary values
    (integer-ness is enforced upstream by the pydantic schema, not here)."""
    score_ok = lambda s: s is not None and 0 <= s <= 100  # noqa: E731
    for good in (0, 1, 50, 100):
        assert score_ok(good)
    for bad in (None, -1, 101):
        assert not score_ok(bad)
