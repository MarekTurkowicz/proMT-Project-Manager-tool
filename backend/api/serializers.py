from rest_framework import serializers
from django.db import transaction
from .models import (
    Project,
    Funding,
    ProjectFunding,
    FundingTask,
    Task,
    TaskScope,
    TaskAssignment,
    UserProfile,
)
from django.db.models import Q
from django.contrib.auth import get_user_model

User = get_user_model()


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

    # 👇 NOWE: użytkownicy przypisani do zadania

    # pełne dane userów (read-only) – do wyświetlania
    assignees = serializers.SerializerMethodField(read_only=True)

    # lista ID userów (write-only) – do zapisu
    assignee_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

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
            # NOWE:
            "assignees",  # read-only
            "assignee_ids",  # write-only
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
            "assignees",
        ]

    def get_assignees(self, obj):
        """
        Zwracamy lekkie info o userach przy zadaniu.
        Jeśli chcesz pełny UserSerializer, możesz go tu użyć.
        """
        users = obj.assignees.all()
        return [
            {
                "id": u.id,
                "username": u.username,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                # jak chcesz: rola z profilu
                "role": getattr(getattr(u, "profile", None), "role", None),
            }
            for u in users
        ]

    def validate(self, attrs):
        # --- KONTEKST (project / funding / project_funding) ---
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

        # --- NOWE: lista userów do przypisania ---
        assignee_ids = (
            attrs.pop("assignee_ids", None) if "assignee_ids" in attrs else None
        )
        # zapamiętujemy do create/update; None = nie zmieniaj, [] = wyczyść
        self._incoming_assignee_ids = assignee_ids

        return attrs

    def _apply_assignees(self, task, assignee_ids):
        """
        Ustawia przypisanych userów dla danego taska wykorzystując TaskAssignment.
        Semantyka:
        - None  -> nie ruszamy przypisań
        - []    -> czyścimy wszystkie
        - [..]  -> ustawiamy dokładnie taką listę (dodajemy/odejmujemy różnice)
        """
        from .models import (
            TaskAssignment,
        )  # dla pewności lokalny import, jeśli masz podział plików

        if assignee_ids is None:
            return  # brak pola w payloadzie -> nie zmieniamy

        # aktualne przypisania
        existing_qs = TaskAssignment.objects.filter(task=task)
        existing_ids = set(existing_qs.values_list("user_id", flat=True))

        new_ids = set(assignee_ids)

        # do usunięcia
        to_remove = existing_ids - new_ids
        if to_remove:
            existing_qs.filter(user_id__in=to_remove).delete()

        # do dodania
        to_add = new_ids - existing_ids
        if to_add:
            users = User.objects.filter(id__in=to_add)
            user_map = {u.id: u for u in users}

            request = self.context.get("request")
            assigned_by = (
                request.user if request and request.user.is_authenticated else None
            )

            for uid in to_add:
                user = user_map.get(uid)
                if user:
                    TaskAssignment.objects.create(
                        task=task,
                        user=user,
                        assigned_by=assigned_by,
                    )

    def create(self, validated_data):
        task = Task.objects.create(**validated_data)

        # scope
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

        # assignees
        self._apply_assignees(task, self._incoming_assignee_ids)

        return task

    def update(self, instance, validated_data):
        p = self._incoming_scope["project"]
        f = self._incoming_scope["funding"]
        pf = self._incoming_scope["project_funding"]

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        # scope
        if any(x is not None for x in (p, f, pf)):
            scope, _ = TaskScope.objects.get_or_create(task=instance)
            scope.project_id = p or None
            scope.funding_id = f or None
            scope.project_funding_id = pf or None
            scope.save()

        # assignees
        self._apply_assignees(instance, self._incoming_assignee_ids)

        return instance


# ---------- USER PROFILE ----------


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "role",
            "phone",
            "avatar_url",
        ]


# ---------- USER ----------
class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    tasks_count = serializers.IntegerField(read_only=True)
    done_tasks_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "profile",
            "tasks_count",
            "done_tasks_count",
        ]


class UserDetailSerializer(UserSerializer):
    tasks = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ["tasks"]

    def get_tasks(self, obj):
        """
        Lekka lista zadań usera — idealna pod kartę „zadania użytkownika”.
        Tutaj możesz dobrać, jakie pola chcesz.
        """
        user_tasks = obj.tasks.all().select_related("scope")
        return [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "start_date": t.start_date,
                "due_date": t.due_date,
                "project_id": (
                    getattr(t.scope, "project_id", None)
                    if hasattr(t, "scope")
                    else None
                ),
                "funding_id": (
                    getattr(t.scope, "funding_id", None)
                    if hasattr(t, "scope")
                    else None
                ),
                "project_funding_id": (
                    getattr(t.scope, "project_funding_id", None)
                    if hasattr(t, "scope")
                    else None
                ),
            }
            for t in user_tasks
        ]


# ---------- TASK ASSIGNMENT ----------
class TaskAssignmentSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    assigned_by_username = serializers.CharField(
        source="assigned_by.username",
        read_only=True,
    )

    class Meta:
        model = TaskAssignment
        fields = [
            "id",
            "task",
            "user",
            "user_detail",
            "assigned_by",
            "assigned_by_username",
            "assigned_at",
            "started_at",
            "finished_at",
            "worked_hours",
        ]
        read_only_fields = ["assigned_by", "assigned_at"]

    def create(self, validated_data):
        """
        Przy tworzeniu przypisania automatycznie ustawiamy assigned_by = request.user.
        """
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["assigned_by"] = request.user
        return super().create(validated_data)
