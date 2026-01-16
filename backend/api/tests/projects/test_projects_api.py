import pytest


@pytest.mark.django_db
def test_list_projects_returns_200(api_client, project):
    res = api_client.get("/api/projects/")
    assert res.status_code == 200

    data = (
        res.data["results"]
        if isinstance(res.data, dict) and "results" in res.data
        else res.data
    )

    assert isinstance(data, list)
    assert any(p["id"] == project.id for p in data)


@pytest.mark.django_db
def test_create_project_returns_201(api_client):
    res = api_client.post(
        "/api/projects/",
        data={
            "name": "Created Project",
            "description": "desc",
            "status": "active",
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data["name"] == "Created Project"
