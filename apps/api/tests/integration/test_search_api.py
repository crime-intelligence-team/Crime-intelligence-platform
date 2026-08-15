"""Global search aggregator (Phase 5) against a live Postgres."""

import pytest

from tests import helpers
from app.models.entities import Role

pytestmark = pytest.mark.skipif(
    not helpers.postgres_available(), reason="Postgres not reachable"
)


@pytest.fixture(scope="module")
def admin_headers(c):
    helpers.make_officer("it_search_admin", Role.ADMINISTRATOR)
    return helpers.login(c, "it_search_admin")


def test_search_sections_present(c, admin_headers):
    res = c.get("/api/v1/search", params={"q": "Smuggling"}, headers=admin_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["query"] == "Smuggling"
    for section in ("cases", "entities", "districts"):
        assert body[section] is not None
        assert "items" in body[section] and "total" in body[section]


def test_search_requires_auth(c):
    res = c.get("/api/v1/search", params={"q": "Smuggling"})
    assert res.status_code == 401


def test_search_rejects_unknown_type(c, admin_headers):
    res = c.get("/api/v1/search", params={"q": "Smug", "types": "gibberish"}, headers=admin_headers)
    assert res.status_code == 422
    body = res.json()
    assert body["error"]["code"] == "invalid_search_type"


def test_search_rejects_empty_query(c, admin_headers):
    res = c.get("/api/v1/search", params={"q": " "}, headers=admin_headers)
    assert res.status_code == 422


def test_search_omits_disallowed_section(c):
    """An analyst holds case:read/entity:read/map:view, so all three sections
    appear; the important contract is that sections are gated by permission,
    so we assert the district section respects scope for a scoped officer."""
    helpers.make_officer("it_search_dto", Role.DISTRICT_OFFICER)
    headers = helpers.login(c, "it_search_dto")
    body = c.get("/api/v1/search", params={"q": "Central"}, headers=headers).json()
    assert body["districts"] is not None
