from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta
from .models import ProjectFunding, FundingTask, Task, TaskScope


def _due(base_date, delta_days):
    if not base_date or delta_days is None:
        return None
    return base_date + timedelta(days=delta_days)


def _clone_task_fields(src: Task) -> dict:
    """
    Kopiuje TYLKO domenowe pola Task (bez scope/ID).
    Zostawiamy template dla śledzenia pochodzenia (jeśli było).
    """
    return dict(
        title=src.title,
        description=src.description,
        status=src.status,
        priority=src.priority,
        start_date=src.start_date,
        due_date=src.due_date,
        cost_amount=src.cost_amount,
        cost_currency=src.cost_currency,
        receipt_url=src.receipt_url,
        receipt_note=src.receipt_note,
        est_hours=src.est_hours,
        template=src.template,
    )


@receiver(post_save, sender=ProjectFunding)
def create_tasks_for_project_funding(
    sender, instance: ProjectFunding, created, **kwargs
):
    if not created:
        return

    project = instance.project
    funding = instance.funding
    base = instance.allocation_start or project.start_date or timezone.now().date()

    with transaction.atomic():
        for tmpl in FundingTask.objects.filter(funding=funding).order_by("id"):
            if Task.objects.filter(
                template=tmpl, scope__project_funding=instance
            ).exists():
                continue

            task = Task.objects.create(
                template=tmpl,
                title=tmpl.title,
                description=tmpl.description or "",
                status=tmpl.default_status,
                priority=tmpl.default_priority,
                due_date=_due(base, tmpl.default_due_days),
            )
            TaskScope.objects.create(
                task=task,
                project_funding=instance,
                funding_scoped=True,
            )

        funding_tasks_qs = Task.objects.filter(scope__funding=funding)
        for src in funding_tasks_qs:
            if Task.objects.filter(
                scope__project_funding=instance,
                title=src.title,
                template=src.template,
            ).exists():
                continue

            cloned = Task.objects.create(**_clone_task_fields(src))
            TaskScope.objects.create(
                task=cloned,
                project_funding=instance,
                funding_scoped=True,
            )


@receiver(post_delete, sender=ProjectFunding)
def delete_scoped_tasks_on_unlink(sender, instance: ProjectFunding, **kwargs):
    Task.objects.filter(
        scope__project_funding=instance,
        scope__funding_scoped=True,
    ).delete()
