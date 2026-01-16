import pytest
from django.db import IntegrityError, transaction

from api.models import Task, TaskScope


@pytest.mark.django_db
def test_task_scope_one_to_one_enforced(task_unscoped, project):
    TaskScope.objects.create(task=task_unscoped, project=project)
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            TaskScope.objects.create(task=task_unscoped, project=project)
