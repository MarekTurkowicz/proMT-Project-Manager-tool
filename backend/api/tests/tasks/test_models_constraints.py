import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from api.models import Task, TaskScope
from api.models import TaskAssignment


@pytest.mark.django_db
def test_taskscope_requires_exactly_one_context(project, funding, project_funding):
    t = Task.objects.create(
        title="Constraint test",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )

    with transaction.atomic():
        with pytest.raises(IntegrityError):
            TaskScope.objects.create(task=t)

    with transaction.atomic():
        with pytest.raises(IntegrityError):
            TaskScope.objects.create(task=t, project=project, funding=funding)

    ok = TaskScope.objects.create(task=t, project=project)
    assert ok.project_id == project.id
    assert ok.funding_id is None
    assert ok.project_funding_id is None


@pytest.mark.django_db
def test_taskassignment_unique_together(user):

    task = Task.objects.create(
        title="Assignment uniqueness",
        status=Task.Status.TODO,
        priority=Task.Priority.LOW,
    )

    TaskAssignment.objects.create(task=task, user=user)

    with transaction.atomic():
        with pytest.raises(IntegrityError):
            TaskAssignment.objects.create(task=task, user=user)
