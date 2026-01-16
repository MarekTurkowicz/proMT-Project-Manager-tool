import pytest
from django.db import IntegrityError, transaction

from api.models import ProjectFunding, Task, TaskScope


@pytest.mark.django_db
def test_integralnosc_relacji_project_funding_i_task_scope(project, funding):
    """
    Test weryfikuje integralność danych w warstwie ORM i bazy:
    - poprawne powiązanie zadania z finansowaniem projektu (TaskScope → ProjectFunding),
    - blokadę duplikacji relacji (project, funding) przez constraint bazy danych.
    """

    pf = ProjectFunding.objects.create(project=project, funding=funding)

    task = Task.objects.create(
        title="Zadanie testowe",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )

    scope = TaskScope.objects.create(task=task, project_funding=pf, funding_scoped=True)

    assert scope.project_funding_id == pf.id
    assert scope.project_id is None
    assert scope.funding_id is None

    with transaction.atomic():
        with pytest.raises(IntegrityError):
            ProjectFunding.objects.create(project=project, funding=funding)
