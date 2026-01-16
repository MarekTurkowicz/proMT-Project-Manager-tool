from django.db import models
from django.core.validators import MinValueValidator
from django.db.models import Q, F


class Funding(models.Model):
    class Type(models.TextChoices):
        GRANT = "grant", "Grant"
        SPONSORSHIP = "sponsorship", "Sponsoring"
        DONATION = "donation", "Darowizna"
        INTERNAL = "internal", "Wewnętrzne"

    type = models.CharField(max_length=20, choices=Type.choices, default=Type.INTERNAL)
    name = models.CharField(max_length=200)
    funder = models.CharField(max_length=200, blank=True)
    program = models.CharField(max_length=200, blank=True)
    agreement_number = models.CharField(max_length=100, blank=True)
    amount_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    currency = models.CharField(max_length=3, default="PLN")

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    reporting_deadline = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(start_date__isnull=True)
                    | Q(end_date__isnull=True)
                    | Q(start_date__lte=F("end_date"))
                ),
                name="funding_dates_ok",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class ProjectFunding(models.Model):
    project = models.ForeignKey(
        "api.Project", on_delete=models.CASCADE, related_name="project_fundings"
    )
    funding = models.ForeignKey(
        "api.Funding", on_delete=models.CASCADE, related_name="funding_projects"
    )

    allocation_start = models.DateField(null=True, blank=True)
    allocation_end = models.DateField(null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("project", "funding")
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(allocation_start__isnull=True)
                    | Q(allocation_end__isnull=True)
                    | Q(allocation_start__lte=F("allocation_end"))
                ),
                name="projectfunding_dates_ok",
            ),
        ]

    def __str__(self):
        return f"{self.project.name} ↔ {self.funding.name}"


class FundingTask(models.Model):
    class DefaultStatus(models.TextChoices):
        TODO = "todo", "To do"
        DOING = "doing", "Doing"
        DONE = "done", "Done"

    class DefaultPriority(models.IntegerChoices):
        LOW = 1, "Low"
        MEDIUM = 2, "Medium"
        HIGH = 3, "High"

    funding = models.ForeignKey(
        Funding, on_delete=models.CASCADE, related_name="tasks_blueprint"
    )

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    default_status = models.CharField(
        max_length=10, choices=DefaultStatus.choices, default=DefaultStatus.TODO
    )
    default_priority = models.IntegerField(
        choices=DefaultPriority.choices, default=DefaultPriority.MEDIUM
    )
    default_est_hours = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )

    default_due_days = models.IntegerField(null=True, blank=True)

    mandatory = models.BooleanField(default=True)

    def __str__(self):
        return f"[{self.funding.name}] {self.title}"
