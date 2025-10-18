# backend/api/admin.py
from django.contrib import admin
from .models import (
    Project,
    Funding,
    FundingTask,
    ProjectFunding,
    Task,
    TaskScope,
)

# ---------- Inlines ----------


class TaskScopeInline(admin.StackedInline):
    """
    Edycja 'kontekstu' zadania (project | funding | project_funding) obok Taska.
    OneToOne, ale admin traktuje to jako inline.
    """

    model = TaskScope
    fk_name = "task"
    extra = 0
    can_delete = True
    autocomplete_fields = ["project", "funding", "project_funding"]


class FundingTaskInline(admin.TabularInline):
    """
    Lista szablonów zadań (FundingTask) na widoku Funding.
    """

    model = FundingTask
    extra = 0
    autocomplete_fields = ["funding"]


class ProjectFundingInline(admin.TabularInline):
    """
    Lista powiązań projekt–finansowanie na widoku Project.
    """

    model = ProjectFunding
    extra = 0
    autocomplete_fields = ["funding"]


class ProjectTaskScopeInline(admin.TabularInline):
    """
    Zadania należące bezpośrednio do projektu (TaskScope.project = <projekt>).
    Używamy TaskScope jako inline z FK na 'project'.
    W polu 'task' możesz wybrać istniejący Task albo kliknąć zielone "+" i dodać nowy.
    """

    model = TaskScope
    fk_name = "project"
    extra = 1
    verbose_name = "Project task"
    verbose_name_plural = "Project tasks"

    # pokazujemy tylko pola potrzebne dla „projectowego” scope
    fields = ("task", "funding_scoped")
    autocomplete_fields = ["task"]

    # nie pozwalamy w tym inline’ie edytować innych scope’ów (funding/PF)
    exclude = ("funding", "project_funding")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("task").filter(project__isnull=False)

    def get_formset(self, request, obj=None, **kwargs):
        FormSet = super().get_formset(request, obj, **kwargs)
        # 'funding_scoped' dla zadań projektowych sensownie powinno być False
        # Zrobimy pole tylko do odczytu i ustawimy domyślnie False.
        base_fields = FormSet.form.base_fields
        if "funding_scoped" in base_fields:
            base_fields["funding_scoped"].initial = False
            base_fields["funding_scoped"].disabled = True
        return FormSet


# ---------- Adminy głównych modeli ----------


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "status",
        "priority",
        "project",  # z TaskScope
        "funding",  # z TaskScope
        "project_funding",  # z TaskScope
        "funding_scoped",  # z TaskScope
        "due_date",
        "created_at",
    )
    search_fields = (
        "title",
        "description",
        "scope__project__name",
        "scope__funding__name",
        "scope__project_funding__project__name",
        "scope__project_funding__funding__name",
    )
    list_select_related = (
        "scope",
        "scope__project",
        "scope__funding",
        "scope__project_funding",
        "template",
    )
    list_filter = (
        "status",
        "priority",
        ("scope__project", admin.RelatedOnlyFieldListFilter),
        ("scope__funding", admin.RelatedOnlyFieldListFilter),
        ("scope__project_funding", admin.RelatedOnlyFieldListFilter),
        "scope__funding_scoped",
    )
    ordering = ("-created_at",)
    inlines = [TaskScopeInline]

    # --- kolumny pochodzące z TaskScope (safe na brak scope):
    def project(self, obj):
        return getattr(getattr(obj, "scope", None), "project", None)

    project.short_description = "Project"
    project.admin_order_field = "scope__project"

    def funding(self, obj):
        return getattr(getattr(obj, "scope", None), "funding", None)

    funding.short_description = "Funding"
    funding.admin_order_field = "scope__funding"

    def project_funding(self, obj):
        return getattr(getattr(obj, "scope", None), "project_funding", None)

    project_funding.short_description = "ProjectFunding"
    project_funding.admin_order_field = "scope__project_funding"

    def funding_scoped(self, obj):
        scope = getattr(obj, "scope", None)
        return getattr(scope, "funding_scoped", False) if scope else False

    funding_scoped.boolean = True
    funding_scoped.short_description = "Grant copy?"
    funding_scoped.admin_order_field = "scope__funding_scoped"


@admin.register(TaskScope)
class TaskScopeAdmin(admin.ModelAdmin):
    list_display = (
        "task",
        "project",
        "funding",
        "project_funding",
        "funding_scoped",
        "created_at",
    )
    search_fields = (
        "task__title",
        "project__name",
        "funding__name",
        "project_funding__project__name",
        "project_funding__funding__name",
    )
    autocomplete_fields = ["task", "project", "funding", "project_funding"]
    list_filter = (
        ("project", admin.RelatedOnlyFieldListFilter),
        ("funding", admin.RelatedOnlyFieldListFilter),
        ("project_funding", admin.RelatedOnlyFieldListFilter),
        "funding_scoped",
    )
    ordering = ("-created_at",)


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
    search_fields = ("name", "description", "owner__username")
    list_filter = ("status", ("owner", admin.RelatedOnlyFieldListFilter))
    ordering = ("-created_at",)
    inlines = [ProjectFundingInline]
    autocomplete_fields = ["owner"]


@admin.register(Funding)
class FundingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "program",
        "funder",
        "amount_total",
        "start_date",
        "end_date",
        "created_at",
    )
    search_fields = ("name", "program", "funder", "agreement_number", "description")
    list_filter = ("start_date", "end_date")
    ordering = ("-created_at",)
    inlines = [FundingTaskInline]


@admin.register(FundingTask)
class FundingTaskAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "funding",
        "title",
        "default_status",
        "default_priority",
        "default_due_days",
    )
    search_fields = ("title", "funding__name")
    list_filter = (
        ("funding", admin.RelatedOnlyFieldListFilter),
        "default_status",
        "default_priority",
    )
    autocomplete_fields = ["funding"]
    ordering = ("funding", "id")


@admin.register(ProjectFunding)
class ProjectFundingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "project",
        "funding",
        "is_primary",
        "allocation_start",
        "allocation_end",
        "created_at",
    )
    search_fields = ("project__name", "funding__name", "note")
    list_filter = (
        ("project", admin.RelatedOnlyFieldListFilter),
        ("funding", admin.RelatedOnlyFieldListFilter),
        "is_primary",
        "allocation_start",
        "allocation_end",
    )
    autocomplete_fields = ["project", "funding"]
    ordering = ("-created_at",)
