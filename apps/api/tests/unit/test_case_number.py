"""Case-number format validation (app/services/case_service.py)."""

import re

from app.services.case_service import CASE_NUMBER_RE


def test_valid_case_numbers():
    for number in ("CASE-2026-0001", "AB-1", "X-99-Z", "123-ABC"):
        assert CASE_NUMBER_RE.match(number), number


def test_invalid_case_numbers():
    for number in ("lower-case-1", "ab", "CASE 2026", "CAS*", "", "-1", "A" * 33):
        assert CASE_NUMBER_RE.match(number) is None, number


def test_normalization_rule_uppercased():
    assert CASE_NUMBER_RE.match("case-2026-0001") is None  # lowercase not accepted verbatim
    assert CASE_NUMBER_RE.match("CASE-2026-0001".upper()) is not None
