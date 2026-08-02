"""Health endpoint — no DB required, so it runs even where Postgres is absent."""

from tests.helpers import client


def test_health():
    c = client()
    res = c.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
