import pytest


@pytest.mark.django_db
def test_task_cannot_have_multiple_scopes(api_client, project, funding):
    res = api_client.post(
        "/api/tasks/",
        {"title": "Złe zadanie", "project": project.id, "funding": funding.id},
        format="json",
    )
    assert res.status_code == 400
    assert "Provide exactly one of" in str(res.data)


@pytest.mark.django_db
def test_task_with_project_creates_scope(api_client, project):
    res = api_client.post(
        "/api/tasks/",
        {"title": "Task projektowy", "project": project.id},
        format="json",
    )
    assert res.status_code == 201
    assert res.data["scope_project"] == project.id
