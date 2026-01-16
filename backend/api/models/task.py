"""Task and TaskScope models.

These models represent generic tasks and the context (scope) in which a task
belongs (project, funding, or a project-funding relation).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Task(models.Model):
    """Represents a generic task.

    A task is independent of any particular project or funding. Its context is
    defined separately via the TaskScope model.

    Attributes:
        title: Short human-readable name of the task.
        description: Optional detailed description of the task.
        status: Current workflow status (todo/doing/done).
        priority: Priority level of the task (low/medium/high).
        start_date: Optional planned start date.
        due_date: Optional deadline date.
        cost_amount: Optional monetary cost associated with the task.
        cost_currency: ISO-like currency code for cost_amount (default: "PLN").
        receipt_url: Optional URL to the receipt or related document.
        receipt_note: Optional free-form note about the receipt/cost.
        assignees: Users assigned to the task through TaskAssignment.
        est_hours: Estimated duration of the task in hours.
        template: Optional reference to a FundingTask template.
        created_at: Timestamp when the task was created.
        updated_at: Timestamp when the task was last updated.
    """

    class Status(models.TextChoices):
        """Supported workflow states for a task."""

        TODO = "todo", "To do"
        DOING = "doing", "Doing"
        DONE = "done", "Done"

    class Priority(models.IntegerChoices):
        """Priority levels used to sort or filter tasks."""

        LOW = 1, "Low"
        MEDIUM = 2, "Medium"
        HIGH = 3, "High"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.TODO,
    )
    priority = models.IntegerField(
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )

    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    cost_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    cost_currency = models.CharField(max_length=3, default="PLN")
    receipt_url = models.URLField(blank=True)
    receipt_note = models.TextField(blank=True)

    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="api.TaskAssignment",
        through_fields=("task", "user"),
        blank=True,
        related_name="tasks",
    )

    est_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )

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
        """Meta options for Task."""

        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(start_date__isnull=True)
                    | Q(due_date__isnull=True)
                    | Q(start_date__lte=F("due_date"))
                ),
                name="task_dates_ok",
            ),
        ]

    def __str__(self) -> str:
        """Return a human-readable representation of the task."""
        return self.title
