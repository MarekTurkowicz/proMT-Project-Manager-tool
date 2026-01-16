import pytest

from django.contrib.auth import get_user_model

from api.models import (
    Funding,
    FundingTask,
    Project,
    ProjectFunding,
    Task,
    TaskScope,
    TaskAssignment,
    UserProfile,
)

User = get_user_model()


@pytest.mark.django_db
def test_funding_str_uses_name_and_type_display(funding):
    assert str(funding) == f"{funding.name} ({funding.get_type_display()})"


@pytest.mark.django_db
def test_project_str_is_name(project):
    assert str(project) == project.name


@pytest.mark.django_db
def test_project_funding_str_uses_names(project_funding):
    pf = project_funding
    assert str(pf) == f"{pf.project.name} ↔ {pf.funding.name}"


@pytest.mark.django_db
def test_funding_task_str_includes_funding_and_title(funding_task):
    ft = funding_task
    assert str(ft) == f"[{ft.funding.name}] {ft.title}"


@pytest.mark.django_db
def test_task_str_is_title(task_unscoped):
    assert str(task_unscoped) == task_unscoped.title


@pytest.mark.django_db
def test_task_scope_str_for_project_scope(task_project_scoped):
    scope = task_project_scoped.scope
    assert str(scope) == f"scope:project={scope.project_id}"


@pytest.mark.django_db
def test_task_scope_str_for_funding_scope(funding_global_task):
    scope = funding_global_task.scope
    assert str(scope) == f"scope:funding={scope.funding_id}"


@pytest.mark.django_db
def test_task_scope_str_for_project_funding_scope(task_pf_scoped):
    scope = task_pf_scoped.scope
    assert str(scope) == f"scope:PF={scope.project_funding_id}"


@pytest.mark.django_db
def test_user_profile_str_includes_username_and_role(user):
    profile = UserProfile.objects.create(user=user)
    assert str(profile) == f"{user.username} ({profile.get_role_display()})"


@pytest.mark.django_db
def test_task_assignment_str_shows_user_and_task(user):
    task = Task.objects.create(
        title="Assignment for user",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    assignment = TaskAssignment.objects.create(task=task, user=user)
    assert str(assignment) == f"{user} -> {task}"
