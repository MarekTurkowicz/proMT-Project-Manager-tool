import pytest

from api.models import Task, TaskScope


@pytest.mark.django_db
def test_create_pf_scoped_task_visible_in_api_list(api_client, project_funding):
    """
    End-to-end-ish:
    - tworzymy task
    - przypinamy scope do ProjectFunding (funding_scoped=True)
    - sprawdzamy w DB, że scope jest poprawny
    - sprawdzamy, że API listy tasków zwraca ten task (czyli integracja: DB -> serializer -> endpoint)
    """
    pf = project_funding

    task = Task.objects.create(
        title="E2E PF scoped task",
        status=Task.Status.TODO,
        priority=Task.Priority.HIGH,
    )
    TaskScope.objects.create(task=task, project_funding=pf, funding_scoped=True)

    scope = TaskScope.objects.get(task=task)
    assert scope.project_funding_id == pf.id
    assert scope.funding_scoped is True
    assert scope.project_id is None
    assert scope.funding_id is None

    res = api_client.get("/api/tasks/")
    assert res.status_code == 200

    data = res.data.get("results", res.data)
    assert any(item.get("id") == task.id for item in data)
