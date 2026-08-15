"""Zone risk interpretation boundaries (app/services/risk_service.py)."""

from app.services.risk_service import _interpretation_for_score


def test_low_below_40():
    assert _interpretation_for_score(0) == "low"
    assert _interpretation_for_score(39) == "low"


def test_elevated_40_to_69():
    assert _interpretation_for_score(40) == "elevated"
    assert _interpretation_for_score(69) == "elevated"


def test_priority_watch_at_70_plus():
    assert _interpretation_for_score(70) == "priority_watch"
    assert _interpretation_for_score(100) == "priority_watch"
