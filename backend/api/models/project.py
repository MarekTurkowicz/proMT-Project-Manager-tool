from django.db import models
from django.db.models import Q, F
from django.conf import settings


class Project(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        ACTIVE = "active", "Active"
        CLOSED = "closed", "Closed"

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_projects",
    )

    # M2M przez ProjectFunding
    fundings = models.ManyToManyField(
        "api.Funding", through="api.ProjectFunding", related_name="projects", blank=True
    )

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(start_date__isnull=True)
                    | Q(end_date__isnull=True)
                    | Q(start_date__lte=F("end_date"))
                ),
                name="project_dates_ok",
            ),
        ]

    def __str__(self):
        return self.name
