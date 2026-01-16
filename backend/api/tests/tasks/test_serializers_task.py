import pytest
from rest_framework.test import APIRequestFactory

from api.models import Task, TaskScope, TaskAssignment
from api.serializers import TaskSerializer


@pytest.mark.django_db
def test_taskserializer_rejects_multiple_scopes(user, project, funding):

    payload = {
        "title": "Task",
        "status": Task.Status.TODO,
        "priority": Task.Priority.MEDIUM,
        "project": project.id,
        "funding": funding.id,
    }
    ser = TaskSerializer(data=payload, context={"request": None})
    assert not ser.is_valid()
    assert "Provide exactly one of" in str(ser.errors)


@pytest.mark.django_db
def test_taskserializer_creates_scope_and_assignees(user, project):

    rf = APIRequestFactory()
    req = rf.post("/fake")
    req.user = user

    payload = {
        "title": "Task with users",
        "description": "Longer description for screenshot purposes",
        "status": Task.Status.TODO,
        "priority": Task.Priority.HIGH,
        "project": project.id,
        "assignee_ids": [user.id],
    }

    ser = TaskSerializer(data=payload, context={"request": req})
    assert ser.is_valid(), ser.errors
    task = ser.save()

    scope = TaskScope.objects.get(task=task)
    assert scope.project_id == project.id
    assert scope.funding_id is None
    assert scope.project_funding_id is None

    qs = TaskAssignment.objects.filter(task=task)
    assert qs.count() == 1
    a = qs.first()
    assert a.user_id == user.id
    assert a.assigned_by_id == user.id


@pytest.mark.django_db
def test_taskserializer_update_clears_assignees(user, project):
    """
    Semantyka _apply_assignees:
    - assignee_ids = [] -> usuwa wszystkie przypisania
    """
    rf = APIRequestFactory()
    req = rf.patch("/fake")
    req.user = user

    task = Task.objects.create(
        title="T", status=Task.Status.TODO, priority=Task.Priority.MEDIUM
    )
    TaskScope.objects.create(task=task, project=project)
    TaskAssignment.objects.create(task=task, user=user, assigned_by=user)

    payload = {
        "title": "T updated",
        "assignee_ids": [],
    }

    ser = TaskSerializer(
        instance=task, data=payload, partial=True, context={"request": req}
    )
    assert ser.is_valid(), ser.errors
    ser.save()

    assert TaskAssignment.objects.filter(task=task).count() == 0
