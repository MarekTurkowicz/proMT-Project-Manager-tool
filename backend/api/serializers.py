from rest_framework import serializers
from django.db import transaction
from .models import Project, Funding, ProjectFunding, FundingTask, Task, TaskScope
from django.db.models import Q


# ---------- FUNDING ---------
class FundingSerializer(serializers.ModelSerializer):
    tasks = serializers.SerializerMethodField()

    class Meta:
        model = Funding
        fields = [
            "id",
            "name",
            "program",
            "funder",
            "amount_total",
            "start_date",
            "end_date",
            "tasks",
            "type",
        ]

    def get_tasks(self, obj):
        """Zwróć taski przypisane bezpośrednio do fundingu."""
        qs = Task.objects.filter(scope__funding=obj)
        return [t.title for t in qs]


class FundingTaskSerializer(serializers.ModelSerializer):
    funding_name = serializers.ReadOnlyField(source="funding.name")

    class Meta:
        model = FundingTask
        fields = [
            "id",
            "funding",
            "funding_name",
            "title",
            "description",
            "default_status",
            "default_priority",
            "default_est_hours",
            "default_due_days",
            "mandatory",
        ]


# ---------- PROJECT ----------


class ProjectSerializer(serializers.ModelSerializer):
    tasks = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "status",
            "owner",
            "start_date",
            "end_date",
            "tasks",
        ]

    def get_tasks(self, obj):
        """Zwróć taski projektowe i grantowe (przez ProjectFunding)."""
        qs = Task.objects.filter(
            Q(scope__project=obj) | Q(scope__project_funding__project=obj)
        )
        return [t.title for t in qs]


class ProjectFundingSerializer(serializers.ModelSerializer):
    tasks = serializers.SerializerMethodField()

    class Meta:
        model = ProjectFunding
        fields = [
            "id",
            "project",
            "funding",
            "allocation_start",
            "allocation_end",
            "is_primary",
            "tasks",
        ]

    def get_tasks(self, obj):
        qs = Task.objects.filter(scope__project_funding=obj)
        return [t.title for t in qs]


# ---------- TASK ----------


class TaskSerializer(serializers.ModelSerializer):
    # WRITE-ONLY: front podaje co najwyżej jedno z nich (albo żadne)
    project = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    funding = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    project_funding = serializers.IntegerField(
        required=False, allow_null=True, write_only=True
    )

    # READ-ONLY: wygodne do list/widoków
    scope_project = serializers.IntegerField(source="scope.project_id", read_only=True)
    scope_funding = serializers.IntegerField(source="scope.funding_id", read_only=True)
    scope_project_funding = serializers.IntegerField(
        source="scope.project_funding_id", read_only=True
    )

    # (opcjonalnie) nazwy dla UI
    project_name = serializers.CharField(source="scope.project.name", read_only=True)
    funding_name = serializers.CharField(source="scope.funding.name", read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "status",
            "priority",
            "start_date",
            "due_date",
            "cost_amount",
            "cost_currency",
            "receipt_url",
            "receipt_note",
            "est_hours",
            "template",
            "created_at",
            "updated_at",
            # write-only wejścia:
            "project",
            "funding",
            "project_funding",
            # read-only wyjścia:
            "scope_project",
            "scope_funding",
            "scope_project_funding",
            "project_name",
            "funding_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "scope_project",
            "scope_funding",
            "scope_project_funding",
            "project_name",
            "funding_name",
        ]

    def validate(self, attrs):
        # wyciągamy „kontekst” z payloadu i trzymamy do create/update
        p = attrs.pop("project", None) if "project" in attrs else None
        f = attrs.pop("funding", None) if "funding" in attrs else None
        pf = attrs.pop("project_funding", None) if "project_funding" in attrs else None

        provided = [x for x in (p, f, pf) if x not in (None, "")]
        if len(provided) > 1:
            raise serializers.ValidationError(
                "Provide exactly one of: project, funding, project_funding."
            )

        if pf is not None and not ProjectFunding.objects.filter(pk=pf).exists():
            raise serializers.ValidationError("ProjectFunding does not exist.")

        self._incoming_scope = {"project": p, "funding": f, "project_funding": pf}
        return attrs

    def create(self, validated_data):
        task = Task.objects.create(**validated_data)
        p = self._incoming_scope["project"]
        f = self._incoming_scope["funding"]
        pf = self._incoming_scope["project_funding"]

        if any(x is not None for x in (p, f, pf)):
            TaskScope.objects.create(
                task=task,
                project_id=p or None,
                funding_id=f or None,
                project_funding_id=pf or None,
            )
        # brak scope => „nieprzydzielony”
        return task

    def update(self, instance, validated_data):
        p = self._incoming_scope["project"]
        f = self._incoming_scope["funding"]
        pf = self._incoming_scope["project_funding"]

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        if any(x is not None for x in (p, f, pf)):
            scope, _ = TaskScope.objects.get_or_create(task=instance)
            scope.project_id = p or None
            scope.funding_id = f or None
            scope.project_funding_id = pf or None
            scope.save()

        return instance
