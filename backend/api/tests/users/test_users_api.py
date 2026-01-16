import pytest

from api.models import Task, TaskScope, TaskAssignment


def _results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


@pytest.mark.django_db
def test_list_users_includes_authenticated_user(api_client, user):
    res = api_client.get("/api/users/")
    assert res.status_code == 200

    payload = _results(res.data)
    assert any(u.get("id") == user.id for u in payload)


@pytest.mark.django_db
def test_user_detail_includes_tasks_list(api_client, user, project):
    task = Task.objects.create(
        title="User API task",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    TaskScope.objects.create(task=task, project=project)
    TaskAssignment.objects.create(task=task, user=user)

    res = api_client.get(f"/api/users/{user.id}/")
    assert res.status_code == 200

    tasks = res.data.get("tasks", [])
    assert isinstance(tasks, list)
    ids = {t["id"] for t in tasks}
    assert task.id in ids
