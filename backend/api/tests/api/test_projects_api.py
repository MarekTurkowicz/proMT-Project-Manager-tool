import pytest


def _results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


@pytest.mark.django_db
def test_list_projects_returns_200(api_client, project):
    res = api_client.get("/api/projects/")
    assert res.status_code == 200

    payload = _results(res.data)
    assert isinstance(payload, list)
    assert any(p.get("id") == project.id for p in payload)


@pytest.mark.django_db
def test_create_project_returns_201(api_client):
    res = api_client.post(
        "/api/projects/",
        {
            "name": "Created",
            "description": "x",
            "status": "active",
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data["id"] is not None
    assert res.data["name"] == "Created"


@pytest.mark.django_db
def test_project_detail_returns_200(api_client, project):
    res = api_client.get(f"/api/projects/{project.id}/")
    assert res.status_code == 200
    assert res.data["id"] == project.id
    assert res.data["name"] == project.name


@pytest.mark.django_db
def test_project_serializer_tasks_field_includes_project_and_pf_tasks(
    api_client, project, project_funding, task_project_scoped, task_pf_scoped
):
    res = api_client.get(f"/api/projects/{project.id}/")
    assert res.status_code == 200
    titles = res.data.get("tasks", [])
    assert task_project_scoped.title in titles
    assert task_pf_scoped.title in titles
