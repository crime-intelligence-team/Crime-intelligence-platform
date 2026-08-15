"""Redaction-policy vocabulary (app/models/governance.py)."""

from app.models.governance import RedactionPolicyDecision


def test_valid_entity_types():
    expected = {
        "note", "case", "entity",
        "person", "organization", "vehicle", "device", "address",
    }
    assert set(RedactionPolicyDecision.REDACTION_ENTITY_TYPES) == expected


def test_field_prefixes_resolve_to_valid_entity_types():
    valid = set(RedactionPolicyDecision.REDACTION_ENTITY_TYPES)
    for field in RedactionPolicyDecision.REDACTION_FIELDS:
        prefix, _, _ = field.partition(".")
        assert prefix in valid, f"{field} prefix {prefix!r} not in entity vocabulary"
        assert field.count(".") == 1


def test_only_valid_decision_is_redact():
    assert RedactionPolicyDecision.VALID_DECISIONS == ("redact",)


def test_core_fields_present():
    fields = RedactionPolicyDecision.REDACTION_FIELDS
    for required in (
        "person.aliases",
        "person.date_of_birth",
        "vehicle.registration_number",
        "device.phone_number",
        "address.raw_text",
        "note.body",
        "case.summary",
    ):
        assert required in fields
