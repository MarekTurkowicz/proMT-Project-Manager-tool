import pytest


@pytest.mark.django_db
def test_health_endpoint_ok(api_client):
    res = api_client.get("/api/health/")
    assert res.status_code == 200
    assert res.data["status"] == "ok"
