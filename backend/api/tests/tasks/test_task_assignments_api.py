import pytest

from api.models import Task, TaskScope


def _results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


@pytest.mark.django_db
def test_create_task_assignment_sets_assigned_by(api_client, user, project):
    task = Task.objects.create(
        title="Assignment via API",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    TaskScope.objects.create(task=task, project=project)

    res = api_client.post(
        "/api/task-assignments/",
        {"task": task.id, "user": user.id},
        format="json",
    )
    assert res.status_code == 201

    data = res.data
    assert data["task"] == task.id
    assert data["user"] == user.id
    assert data["assigned_by"] == user.id

    res2 = api_client.get(f"/api/task-assignments/?task={task.id}")
    assert res2.status_code == 200
    payload = _results(res2.data)
    assert any(a.get("id") == data["id"] for a in payload)
