import pytest
from django.db import IntegrityError, transaction

from api.models import ProjectFunding, Task, TaskScope


@pytest.mark.django_db
def test_project_funding_unique_constraint(project, funding):
    ProjectFunding.objects.create(project=project, funding=funding)

    with transaction.atomic():
        with pytest.raises(IntegrityError):
            ProjectFunding.objects.create(project=project, funding=funding)


@pytest.mark.django_db
def test_deleting_project_funding_with_scoped_tasks_raises_integrity_error(
    project_funding,
):
    pf = project_funding

    t = Task.objects.create(
        title="Will block delete",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    TaskScope.objects.create(task=t, project_funding=pf, funding_scoped=True)

    with transaction.atomic():
        with pytest.raises(IntegrityError):
            pf.delete()
