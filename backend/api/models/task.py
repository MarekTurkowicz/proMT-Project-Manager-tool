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

    # ⬇️ CZYSTY Task — bez FK do Project/Funding
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.TODO
    )
    priority = models.IntegerField(choices=Priority.choices, default=Priority.MEDIUM)
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    # opcjonalne koszty/załączki
    cost_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    cost_currency = models.CharField(max_length=3, default="PLN")
    receipt_url = models.URLField(blank=True)
    receipt_note = models.TextField(blank=True)

    # przypisania
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="tasks"
    )
    est_hours = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )

    # jeśli używasz „szablonów zadań finansowania”
    template = models.ForeignKey(
        "api.FundingTask",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instances",
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
        return self.title


class TaskScope(models.Model):
    """
    Dokładnie JEDEN kontekst dla Task:
    - project XOR funding XOR project_funding
    (brak rekordu TaskScope => task „nieprzydzielony”)
    """

    task = models.OneToOneField(
        "api.Task", on_delete=models.CASCADE, related_name="scope"
    )

    project = models.ForeignKey(
        "api.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="task_scopes",
    )
    funding = models.ForeignKey(
        "api.Funding",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="task_scopes",
    )
    project_funding = models.ForeignKey(
        "api.ProjectFunding",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="task_scopes",
    )

    # znacznik: sklonowane z finansowania (po ProjectFunding)
    funding_scoped = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                name="taskscope_exactly_one",
                check=(
                    (
                        Q(project__isnull=False)
                        & Q(funding__isnull=True)
                        & Q(project_funding__isnull=True)
                    )
                    | (
                        Q(project__isnull=True)
                        & Q(funding__isnull=False)
                        & Q(project_funding__isnull=True)
                    )
                    | (
                        Q(project__isnull=True)
                        & Q(funding__isnull=True)
                        & Q(project_funding__isnull=False)
                    )
                ),
            ),
        ]
        indexes = [
            models.Index(fields=["project"]),
            models.Index(fields=["funding"]),
            models.Index(fields=["project_funding"]),
            models.Index(fields=["funding_scoped"]),
        ]

    def __str__(self):
        if self.project_id:
            return f"scope:project={self.project_id}"
        if self.funding_id:
            return f"scope:funding={self.funding_id}"
        if self.project_funding_id:
            return f"scope:PF={self.project_funding_id}"
        return "scope:?"
