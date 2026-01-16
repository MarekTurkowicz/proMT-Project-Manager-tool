import pytest


def _results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


@pytest.mark.django_db
def test_list_project_fundings(api_client, project_funding):
    res = api_client.get("/api/project-fundings/")
    assert res.status_code == 200

    payload = _results(res.data)
    assert any(x.get("id") == project_funding.id for x in payload)


@pytest.mark.django_db
def test_project_funding_detail_has_tasks_field(api_client, project_funding):
    res = api_client.get(f"/api/project-fundings/{project_funding.id}/")
    assert res.status_code == 200
    assert "tasks" in res.data
    assert isinstance(res.data["tasks"], list)
