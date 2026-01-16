import pytest
from django.db import IntegrityError, transaction

from api.models import ProjectFunding, Task, TaskScope


@pytest.mark.django_db
def test_project_funding_task_constraints(project, funding):
    """
    Test weryfikuje poprawność relacji ProjectFunding–Task
    oraz ograniczeń integralnościowych narzuconych na poziomie bazy danych.
    """

    project_funding = ProjectFunding.objects.create(project=project, funding=funding)

    task = Task.objects.create(
        title="Zadanie testowe",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )

    scope = TaskScope.objects.create(
        task=task, project_funding=project_funding, funding_scoped=True
    )

    assert scope.project_funding_id == project_funding.id
    assert scope.project_id is None
    assert scope.funding_id is None

    task_without_context = Task.objects.create(
        title="Zadanie bez kontekstu",
        status=Task.Status.TODO,
        priority=Task.Priority.LOW,
    )

    with transaction.atomic():
        with pytest.raises(IntegrityError):
            TaskScope.objects.create(task=task_without_context)

    with transaction.atomic():
        with pytest.raises(IntegrityError):
            ProjectFunding.objects.create(project=project, funding=funding)
