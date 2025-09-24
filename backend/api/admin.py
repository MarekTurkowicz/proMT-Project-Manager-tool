from django.contrib import admin
from .models import Project, Funding, ProjectFunding, FundingTask, Task


class ProjectFundingInlineForProject(admin.TabularInline):
    """W projekcie: lista powiązań z finansowaniami (M2M przez ProjectFunding)."""

    model = ProjectFunding
    fk_name = "project"
    extra = 1
    autocomplete_fields = ["funding"]
    fields = [
        "funding",
        "allocation_start",
        "allocation_end",
        "is_primary",
        "note",
        "created_at",
    ]
    readonly_fields = ["created_at"]
    show_change_link = True


class ProjectFundingInlineForFunding(admin.TabularInline):
    """W finansowaniu: lista projektów, do których jest podpięte (ten sam through, inny fk)."""

    model = ProjectFunding
    fk_name = "funding"
    extra = 0
    autocomplete_fields = ["project"]
    fields = [
        "project",
        "allocation_start",
        "allocation_end",
        "is_primary",
        "note",
        "created_at",
    ]
    readonly_fields = ["created_at"]
    show_change_link = True


class FundingTaskInline(admin.TabularInline):
    """Szablony zadań przypięte do finansowania (kopiują się do projektu przy podpięciu)."""

    model = FundingTask
    extra = 1
    fields = [
        "title",
        "description",
        "default_status",
        "default_priority",
        "default_est_hours",
        "default_due_days",
        "mandatory",
    ]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "status",
        "owner",
        "start_date",
        "end_date",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("name", "description")
    autocomplete_fields = ["owner"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [ProjectFundingInlineForProject]


@admin.register(Funding)
class FundingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "type",
        "funder",
        "amount_total",
        "currency",
        "start_date",
        "end_date",
        "created_at",
    )
    list_filter = ("type", "currency")
    search_fields = ("name", "funder", "program", "agreement_number", "description")
    readonly_fields = ["created_at"]
    inlines = [FundingTaskInline, ProjectFundingInlineForFunding]


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "project",
        "funding",
        "status",
        "priority",
        "due_date",
        "funding_scoped",
        "created_at",
    )
    list_filter = ("status", "priority", "funding_scoped", "funding", "project")
    search_fields = ("title", "description")
    autocomplete_fields = ["project", "funding", "assignees", "template"]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ("-created_at",)


@admin.register(FundingTask)
class FundingTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "funding", "title", "default_status", "default_priority")
    search_fields = ("title", "description", "funding__name")
    autocomplete_fields = ["funding"]
