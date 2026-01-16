import pytest
from rest_framework.test import APIRequestFactory

from django.contrib.auth import get_user_model

from api.models import (
    Funding,
    Project,
    ProjectFunding,
    FundingTask,
    Task,
    TaskScope,
    TaskAssignment,
    UserProfile,
)
from api.serializers import (
    FundingSerializer,
    FundingTaskSerializer,
    ProjectSerializer,
    ProjectFundingSerializer,
    UserProfileSerializer,
    UserSerializer,
    UserDetailSerializer,
    TaskAssignmentSerializer,
)

User = get_user_model()


@pytest.mark.django_db
def test_funding_serializer_tasks_includes_funding_scoped_tasks(
    funding, funding_global_task
):
    """FundingSerializer.tasks should list titles of tasks scoped directly to this funding."""
    ser = FundingSerializer(instance=funding)
    titles = ser.data["tasks"]
    assert funding_global_task.title in titles


@pytest.mark.django_db
def test_funding_task_serializer_exposes_funding_name(funding_task):
    ser = FundingTaskSerializer(instance=funding_task)
    data = ser.data
    assert data["funding"] == funding_task.funding_id
    assert data["funding_name"] == funding_task.funding.name


@pytest.mark.django_db
def test_project_serializer_tasks_include_project_and_pf_scoped_tasks(
    project, project_funding
):
    t1 = Task.objects.create(
        title="P task",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    TaskScope.objects.create(task=t1, project=project)

    t2 = Task.objects.create(
        title="PF task",
        status=Task.Status.DOING,
        priority=Task.Priority.HIGH,
    )
    TaskScope.objects.create(task=t2, project_funding=project_funding)

    ser = ProjectSerializer(instance=project)
    titles = set(ser.data["tasks"])
    assert t1.title in titles
    assert t2.title in titles


@pytest.mark.django_db
def test_project_funding_serializer_tasks_include_pf_scoped_tasks(project_funding):
    t = Task.objects.create(
        title="PF scoped",
        status=Task.Status.TODO,
        priority=Task.Priority.LOW,
    )
    TaskScope.objects.create(task=t, project_funding=project_funding)

    ser = ProjectFundingSerializer(instance=project_funding)
    titles = ser.data["tasks"]
    assert t.title in titles


@pytest.mark.django_db
def test_user_profile_serializer_basic(user):
    profile = UserProfile.objects.create(
        user=user,
        role=UserProfile._meta.get_field("role").choices[0][0],
        phone="123-456",
        avatar_url="https://example.com/avatar.png",
    )

    ser = UserProfileSerializer(instance=profile)
    data = ser.data

    assert data["phone"] == "123-456"
    assert data["avatar_url"] == "https://example.com/avatar.png"


@pytest.mark.django_db
def test_user_serializer_includes_profile_and_counts(user):
    profile = UserProfile.objects.create(user=user)

    user.tasks_count = 5
    user.done_tasks_count = 2

    ser = UserSerializer(instance=user)
    data = ser.data

    assert data["id"] == user.id
    assert data["username"] == user.username
    assert data["profile"]["role"] == profile.role
    assert data["tasks_count"] == 5
    assert data["done_tasks_count"] == 2


@pytest.mark.django_db
def test_user_detail_serializer_returns_tasks_list(user, project):
    UserProfile.objects.create(user=user)

    task = Task.objects.create(
        title="User task",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    TaskScope.objects.create(task=task, project=project)
    TaskAssignment.objects.create(task=task, user=user)

    ser = UserDetailSerializer(instance=user)
    tasks = ser.data["tasks"]
    ids = {t["id"] for t in tasks}
    assert task.id in ids


@pytest.mark.django_db
def test_task_assignment_serializer_sets_assigned_by_from_request(user, project):
    rf = APIRequestFactory()
    req = rf.post("/fake")
    req.user = user

    task = Task.objects.create(
        title="Assignment test",
        status=Task.Status.TODO,
        priority=Task.Priority.MEDIUM,
    )
    TaskScope.objects.create(task=task, project=project)

    payload = {
        "task": task.id,
        "user": user.id,
    }

    ser = TaskAssignmentSerializer(data=payload, context={"request": req})
    assert ser.is_valid(), ser.errors
    assignment = ser.save()

    assert assignment.task_id == task.id
    assert assignment.user_id == user.id
    assert assignment.assigned_by_id == user.id
