"""Tier gating + score-band logic (app/core/classification.py, models/base.py)."""

import pytest

from app.core.classification import ROLE_MAX_CLASSIFICATION, classification_filter
from app.models.base import CLASSIFICATION_RANK, ConfidenceBand, band_for_score
from app.models.entities import Role


def test_band_for_score_boundaries():
    assert band_for_score(0) is ConfidenceBand.UNCONFIRMED
    assert band_for_score(39) is ConfidenceBand.UNCONFIRMED
    assert band_for_score(40) is ConfidenceBand.PROBABLE
    assert band_for_score(69) is ConfidenceBand.PROBABLE
    assert band_for_score(70) is ConfidenceBand.VERIFIED
    assert band_for_score(100) is ConfidenceBand.VERIFIED


def test_band_for_score_rejects_out_of_range():
    with pytest.raises(ValueError):
        band_for_score(-1)
    with pytest.raises(ValueError):
        band_for_score(101)


def test_classification_rank_is_total_order():
    levels = list(CLASSIFICATION_RANK)
    assert len(levels) == 4
    ranks = list(CLASSIFICATION_RANK.values())
    assert ranks == sorted(ranks)


def test_filter_administrator_sees_everything():
    assert set(classification_filter(Role.ADMINISTRATOR)) == set(CLASSIFICATION_RANK)


def test_filter_supervisor_reaches_protected_but_not_sealed():
    tiers = set(classification_filter(Role.SUPERVISOR))
    assert "protected" in {t.value for t in tiers}
    assert "sealed" not in {t.value for t in tiers}


def test_filter_district_officer_is_restricted_operational_max():
    tiers = {t.value for t in classification_filter(Role.DISTRICT_OFFICER)}
    assert tiers == {"open_operational", "restricted_operational"}


def test_max_classification_invariant():
    for role, max_tier in ROLE_MAX_CLASSIFICATION.items():
        assert CLASSIFICATION_RANK[max_tier] == max(
            CLASSIFICATION_RANK[t] for t in classification_filter(role)
        )
