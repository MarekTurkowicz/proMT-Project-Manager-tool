from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import F, Q


class TaskScope(models.Model):
    """Defines the context (scope) in which a task exists.

    Exactly one of the following should be set: project, funding, or
    project_funding. If no TaskScope exists for a Task, the task is considered
    not bound to any specific context.

    Attributes:
        task: The task being scoped.
        project: Optional project to which this task belongs.
        funding: Optional funding to which this task belongs.
        project_funding: Optional project-funding relation to which this task
            belongs.
        funding_scoped: Flag indicating that this scope originated from a
            funding context (via ProjectFunding).
        created_at: Timestamp when this scope record was created.
    """

    task = models.OneToOneField(
        "api.Task",
        on_delete=models.CASCADE,
        related_name="scope",
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

    funding_scoped = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Meta options for TaskScope."""

        constraints = [
            models.CheckConstraint(
                name="taskscope_exactly_one",
                condition=(
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

    def __str__(self) -> str:
        """Return a readable representation based on which scope is active."""
        if self.project_id:
            return f"scope:project={self.project_id}"
        if self.funding_id:
            return f"scope:funding={self.funding_id}"
        if self.project_funding_id:
            return f"scope:PF={self.project_funding_id}"
        return "scope:?"
