import pytest
from django.contrib.auth import get_user_model
from api.models import Task

User = get_user_model()


def _results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


@pytest.mark.django_db
def test_create_task_unscoped(api_client):
    res = api_client.post(
        "/api/tasks/",
        {
            "title": "T1",
            "description": "d",
            "status": Task.Status.TODO,
            "priority": Task.Priority.MEDIUM,
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data["title"] == "T1"
    assert res.data["scope_project"] is None
    assert res.data["scope_funding"] is None
    assert res.data["scope_project_funding"] is None


@pytest.mark.django_db
def test_create_task_with_project_scope(api_client, project):
    res = api_client.post(
        "/api/tasks/",
        {
            "title": "ProjTask",
            "status": Task.Status.TODO,
            "priority": Task.Priority.LOW,
            "project": project.id,
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data["scope_project"] == project.id
    assert res.data["scope_project_funding"] is None


@pytest.mark.django_db
def test_create_task_rejects_multiple_scopes(
    api_client, project, project_funding, funding
):
    res = api_client.post(
        "/api/tasks/",
        {
            "title": "Bad",
            "status": Task.Status.TODO,
            "priority": Task.Priority.MEDIUM,
            "project": project.id,
            "funding": funding.id,
        },
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_list_tasks_filter_project_includes_project_and_pf(
    api_client, project, task_project_scoped, task_pf_scoped
):
    res = api_client.get(f"/api/tasks/?project={project.id}")
    assert res.status_code == 200
    payload = _results(res.data)
    titles = {t["title"] for t in payload}
    assert task_project_scoped.title in titles
    assert task_pf_scoped.title in titles


@pytest.mark.django_db
def test_list_tasks_filter_unassigned(api_client, task_unscoped, task_project_scoped):
    res = api_client.get("/api/tasks/?unassigned=true")
    assert res.status_code == 200
    payload = _results(res.data)
    titles = {t["title"] for t in payload}
    assert task_unscoped.title in titles
    assert task_project_scoped.title not in titles


@pytest.mark.django_db
def test_list_tasks_filter_funding_scoped(
    api_client, task_pf_scoped, task_project_scoped
):
    res = api_client.get("/api/tasks/?funding_scoped=true")
    assert res.status_code == 200
    payload = _results(res.data)
    titles = {t["title"] for t in payload}
    assert task_pf_scoped.title in titles
    assert task_project_scoped.title not in titles


@pytest.mark.django_db
def test_update_task_assignees_add_and_clear(api_client):
    u1 = User.objects.create_user(username="u1", password="x")
    u2 = User.objects.create_user(username="u2", password="x")

    res = api_client.post(
        "/api/tasks/",
        {
            "title": "AssignMe",
            "status": Task.Status.TODO,
            "priority": Task.Priority.MEDIUM,
            "assignee_ids": [u1.id, u2.id],
        },
        format="json",
    )
    assert res.status_code == 201
    task_id = res.data["id"]

    res2 = api_client.get(f"/api/tasks/{task_id}/")
    assert res2.status_code == 200
    assignees = res2.data.get("assignees", [])
    assert {a["id"] for a in assignees} == {u1.id, u2.id}

    res3 = api_client.patch(
        f"/api/tasks/{task_id}/",
        {"assignee_ids": []},
        format="json",
    )
    assert res3.status_code in (200, 202)
    res4 = api_client.get(f"/api/tasks/{task_id}/")
    assert res4.status_code == 200
    assert res4.data.get("assignees", []) == []


@pytest.mark.django_db
def test_task_delete(api_client):
    res = api_client.post(
        "/api/tasks/",
        {"title": "ToDel", "status": Task.Status.TODO, "priority": Task.Priority.LOW},
        format="json",
    )
    assert res.status_code == 201
    tid = res.data["id"]

    res2 = api_client.delete(f"/api/tasks/{tid}/")
    assert res2.status_code in (204, 200)

    res3 = api_client.get(f"/api/tasks/{tid}/")
    assert res3.status_code == 404
