"""Role -> permission matrix (app/core/permissions.py)."""

from types import SimpleNamespace

from app.core.permissions import ROLE_PERMISSIONS, get_officer_permissions
from app.models.entities import Role


def _perms(role: Role) -> set[str]:
    officer = SimpleNamespace(role=role)
    return set(get_officer_permissions(officer))


def test_every_role_has_expected_permissions():
    assert "redaction:manage" in _perms(Role.ADMINISTRATOR)
    assert "entity:merge" in _perms(Role.ADMINISTRATOR)
    assert "exception:approve" in _perms(Role.ADMINISTRATOR)
    assert "confidence:review" in _perms(Role.ADMINISTRATOR)
    assert "audit:view" in _perms(Role.ADMINISTRATOR)

    assert "exception:approve" in _perms(Role.SUPERVISOR)
    assert "confidence:review" in _perms(Role.SUPERVISOR)
    assert "audit:view" in _perms(Role.SUPERVISOR)


def test_supervisor_cannot_redact_or_merge():
    perms = _perms(Role.SUPERVISOR)
    assert "redaction:manage" not in perms
    assert "entity:merge" not in perms


def test_analyst_has_no_governance_privileges():
    perms = _perms(Role.ANALYST)
    for gate in ("audit:view", "redaction:manage", "confidence:review", "exception:approve", "entity:merge"):
        assert gate not in perms


def test_district_officer_basic_surface():
    perms = _perms(Role.DISTRICT_OFFICER)
    assert "case:read" in perms
    assert "entity:read" in perms
    assert "map:view" in perms
    assert "search:basic" in perms
    assert "audit:view" not in perms


def test_matrix_is_stable_and_total():
    matrix = ROLE_PERMISSIONS
    assert set(matrix.keys()) == set(Role)
    for role, perms in matrix.items():
        assert isinstance(perms, list)
        assert len(perms) == len(set(perms)), f"duplicate permission in {role}"
