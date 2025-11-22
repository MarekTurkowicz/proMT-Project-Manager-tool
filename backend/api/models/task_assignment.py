from django.db import models
from django.conf import settings


class TaskAssignment(models.Model):
    """
    Represents the assignment of tasks to users, including who assigned the task, when it was assigned, start and finish times, and worked hours.
    """

    task = models.ForeignKey(
        "Task",
        on_delete=models.CASCADE,
        related_name="assignments",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="task_assignments",
    )
    # PM who assigned user to task
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="assigned_tasks_made",
    )

    assigned_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)

    worked_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Real worked hours on the task in hours",
    )

    class Meta:
        unique_together = ("task", "user")
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.user} -> {self.task}"
