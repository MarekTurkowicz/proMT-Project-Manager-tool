from django.db import models
from django.db.models import Q, F
from django.conf import settings


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To do"
        DOING = "doing", "Doing"
        DONE = "done", "Done"

    class Priority(models.IntegerChoices):
        LOW = 1, "Low"
        MEDIUM = 2, "Medium"
        HIGH = 3, "High"

    project = models.ForeignKey(
        "api.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )

    funding = models.ForeignKey(
        "api.Funding",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )

    template = models.ForeignKey(
        "api.FundingTask",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instances",
    )

    # Flaga: to zadanie ma zniknąć, gdy odłączymy to finansowanie od projektu
    funding_scoped = models.BooleanField(default=False)

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.TODO
    )
    priority = models.IntegerField(choices=Priority.choices, default=Priority.MEDIUM)
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    # Prosta sekcja kosztów (bez dzielenia grantów po zadaniach)
    cost_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    cost_currency = models.CharField(max_length=3, default="PLN")
    receipt_url = models.URLField(blank=True)  # link do skanu faktury/rachunku
    receipt_note = models.TextField(blank=True)

    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="tasks"
    )
    est_hours = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(start_date__isnull=True)
                    | Q(due_date__isnull=True)
                    | Q(start_date__lte=F("due_date"))
                ),
                name="task_dates_ok",
            ),
        ]

    def __str__(self):
        tag = self.project.name if self.project else "brak projektu"
        if self.funding_id:
            tag += f" · {self.funding.name}"
        return f"{self.title} ({tag})"
