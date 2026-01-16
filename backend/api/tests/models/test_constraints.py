import pytest
from datetime import date, timedelta
from django.db import IntegrityError, transaction

from api.models import Funding, Project, ProjectFunding, Task


@pytest.mark.django_db
def test_funding_dates_constraint_ok():
    Funding.objects.create(name="Ok", start_date=date.today(), end_date=date.today())


@pytest.mark.django_db
def test_funding_dates_constraint_rejects_start_after_end():
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            Funding.objects.create(
                name="Bad",
                start_date=date.today() + timedelta(days=10),
                end_date=date.today(),
            )


@pytest.mark.django_db
def test_projectfunding_dates_constraint_rejects_start_after_end(project, funding):
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            ProjectFunding.objects.create(
                project=project,
                funding=funding,
                allocation_start=date.today() + timedelta(days=10),
                allocation_end=date.today(),
            )


@pytest.mark.django_db
def test_task_dates_constraint_rejects_start_after_due():
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            Task.objects.create(
                title="Bad dates",
                status=Task.Status.TODO,
                priority=Task.Priority.MEDIUM,
                start_date=date.today() + timedelta(days=10),
                due_date=date.today(),
            )


@pytest.mark.django_db
def test_project_dates_constraint_ok():
    Project.objects.create(
        name="OK project",
        description="Desc",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=1),
    )


@pytest.mark.django_db
def test_project_dates_constraint_rejects_start_after_end():
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            Project.objects.create(
                name="Bad project",
                description="Desc",
                start_date=date.today() + timedelta(days=10),
                end_date=date.today(),
            )
