import pytest


def _results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


@pytest.mark.django_db
def test_list_fundings_returns_200(api_client, funding):
    res = api_client.get("/api/fundings/")
    assert res.status_code == 200

    payload = _results(res.data)
    assert any(f.get("id") == funding.id for f in payload)


@pytest.mark.django_db
def test_list_fundings_filter_by_project(api_client, project_funding):
    pf = project_funding
    res = api_client.get(f"/api/fundings/?project={pf.project_id}")
    assert res.status_code == 200

    payload = _results(res.data)
    ids = {f["id"] for f in payload}
    assert pf.funding_id in ids


@pytest.mark.django_db
def test_list_funding_tasks_returns_200(api_client, funding_task):
    res = api_client.get("/api/funding-tasks/")
    assert res.status_code == 200

    payload = _results(res.data)
    assert any(ft.get("id") == funding_task.id for ft in payload)


@pytest.mark.django_db
def test_list_funding_tasks_filter_by_funding(api_client, funding_task):
    ft = funding_task
    res = api_client.get(f"/api/funding-tasks/?funding={ft.funding_id}")
    assert res.status_code == 200

    payload = _results(res.data)
    ids = {x["id"] for x in payload}
    assert ft.id in ids
