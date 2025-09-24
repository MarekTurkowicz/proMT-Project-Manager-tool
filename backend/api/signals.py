from datetime import timedelta
from django.utils import timezone
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from .models import ProjectFunding, Funding, FundingTask, Task


def _due(base_date, offset_days):
    if base_date and offset_days is not None:
        return base_date + timedelta(days=offset_days)
    return None


@receiver(post_save, sender=ProjectFunding)
def copy_funding_tasks_on_link(sender, instance, created, **kwargs):
    """
    Gdy podpinamy finansowanie do projektu:
    - skopiuj WSZYSTKIE FundingTask tego finansowania do Tasków w projekcie,
      oznacz funding_scoped=True oraz wstaw funding=to finansowanie.
    """
    if not created:
        return

    base = (
        instance.allocation_start
        or instance.project.start_date
        or instance.funding.start_date
        or timezone.now().date()
    )
    for tpl in FundingTask.objects.filter(funding=instance.funding):
        Task.objects.create(
            project=instance.project,
            funding=instance.funding,
            template=tpl,
            funding_scoped=True,
            title=tpl.title,
            description=tpl.description,
            status=tpl.default_status,
            priority=tpl.default_priority,
            est_hours=tpl.default_est_hours,
            due_date=_due(base, tpl.default_due_days),
        )


@receiver(pre_delete, sender=ProjectFunding)
def remove_grant_tasks_on_unlink(sender, instance, **kwargs):
    """
    Gdy ODPINAMY finansowanie od TEGO projektu:
    - usuń TYLKO zadania 'grantowe' (funding_scoped=True) powstałe z tego finansowania w tym projekcie,
    - zadaniom niegrantowym wyczyść funding=None.
    """
    Task.objects.filter(
        project=instance.project, funding=instance.funding, funding_scoped=True
    ).delete()

    Task.objects.filter(
        project=instance.project, funding=instance.funding, funding_scoped=False
    ).update(funding=None)


@receiver(pre_delete, sender=Funding)
def remove_all_grant_tasks_on_funding_delete(sender, instance, **kwargs):
    """
    Gdy kasujemy całe finansowanie:
    - usuń wszystkie jego zadania 'grantowe' we wszystkich projektach,
    - zwykłym zadaniom funding wyzeruje się przez on_delete=SET_NULL.
    """
    Task.objects.filter(funding=instance, funding_scoped=True).delete()
