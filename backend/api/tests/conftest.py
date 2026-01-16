import pytest
from datetime import date, timedelta
from uuid import uuid4

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from api.models import Project, Funding, FundingTask, ProjectFunding, Task, TaskScope

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="tester", password="pass12345")


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def project(user):
    return Project.objects.create(
        name=f"Test Project {uuid4().hex[:8]}",
        description="Desc",
        owner=user,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=30),
        status="active" if hasattr(Project, "status") else "active",
    )


@pytest.fixture
def funding():
    return Funding.objects.create(
        name=f"Grant A {uuid4().hex[:8]}",
        type=Funding.Type.INTERNAL,
        program="Wewnętrzne",
        funder="Uczelnia",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365),
    )


@pytest.fixture
def funding_task(funding):
    """
    Twoje środowisko już ma fixture 'funding_task' (widać w output),
    więc trzymamy tę nazwę, ale naprawiamy default_priority na enum/int.
    """
    return FundingTask.objects.create(
        funding=funding,
        title="Grant task template",
        description="Template desc",
        default_status=FundingTask.DefaultStatus.TODO,
        default_priority=FundingTask.DefaultPriority.MEDIUM,
        default_est_hours=2,
        default_due_days=30,
        mandatory=True,
    )


@pytest.fixture
def funding_task_template(funding_task):
    return funding_task


@pytest.fixture
def funding_global_task(funding):
    """
    Task podpięty do fundingu (TaskScope.funding).
    """
    t = Task.objects.create(
        title="Funding global task",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    TaskScope.objects.create(task=t, funding=funding, funding_scoped=False)
    return t


@pytest.fixture
def project_funding(project, funding):
    """
    Uwaga: u Ciebie jest unikalność (project_id, funding_id).
    Ten fixture tworzy JEDEN ProjectFunding dla pary project+funding.
    """
    return ProjectFunding.objects.create(
        project=project,
        funding=funding,
        allocation_start=date.today(),
        allocation_end=date.today() + timedelta(days=90),
        is_primary=True,
    )


@pytest.fixture
def task_unscoped():
    return Task.objects.create(
        title="Unscoped",
        status=Task.Status.TODO,
        priority=Task.Priority.LOW,
    )


@pytest.fixture
def task_project_scoped(project):
    t = Task.objects.create(
        title="Project scoped",
        status=Task.Status.DOING,
        priority=Task.Priority.HIGH,
    )
    TaskScope.objects.create(task=t, project=project, funding_scoped=False)
    return t


@pytest.fixture
def task_pf_scoped(project_funding):
    t = Task.objects.create(
        title="PF scoped",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    TaskScope.objects.create(
        task=t, project_funding=project_funding, funding_scoped=True
    )
    return t
