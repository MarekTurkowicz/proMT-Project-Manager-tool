from rest_framework import serializers
from django.db import transaction
from .models import Project, Funding, ProjectFunding, FundingTask, Task


# ---------- FUNDING ---------
class FundingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Funding
        fields = [
            "id",
            "type",
            "name",
            "funder",
            "program",
            "agreement_number",
            "amount_total",
            "currency",
            "start_date",
            "end_date",
            "reporting_deadline",
            "description",
            "created_at",
        ]
        read_only_fields = ["created_at"]


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
    owner_username = serializers.ReadOnlyField(source="owner.username")
    funding_ids = serializers.SerializerMethodField()

    def get_funding_ids(self, obj):
        # lista ID finansowań podpiętych do projektu (M2M przez through)
        return list(obj.fundings.values_list("id", flat=True))

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "status",
            "owner",
            "owner_username",
            "start_date",
            "end_date",
            "funding_ids",  # tylko do odczytu; łączenie robimy przez ProjectFunding
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "funding_ids"]


class ProjectFundingSerializer(serializers.ModelSerializer):
    project_name = serializers.ReadOnlyField(source="project.name")
    funding_name = serializers.ReadOnlyField(source="funding.name")

    class Meta:
        model = ProjectFunding
        fields = [
            "id",
            "project",
            "project_name",
            "funding",
            "funding_name",
            "allocation_start",
            "allocation_end",
            "is_primary",
            "note",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        start = attrs.get("allocation_start")
        end = attrs.get("allocation_end")
        if start and end and start > end:
            raise serializers.ValidationError(
                {
                    "allocation_end": "allocation_end nie może być wcześniejsze niż allocation_start."
                }
            )
        return attrs


# ---------- TASK ----------


class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.ReadOnlyField(source="project.name")
    funding_name = serializers.ReadOnlyField(source="funding.name")
    template_title = serializers.ReadOnlyField(source="template.title")

    class Meta:
        model = Task
        fields = [
            "id",
            "project",
            "project_name",
            "funding",
            "funding_name",
            "template",
            "template_title",
            "funding_scoped",
            "title",
            "description",
            "status",
            "priority",
            "start_date",
            "due_date",
            "assignees",
            "est_hours",
            "cost_amount",
            "cost_currency",
            "receipt_url",
            "receipt_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        """
        Zasady:
        - Task musi mieć project (Model to wymusza, ale sprawdzamy spójny błąd).
        - Jeśli funding jest ustawiony, to musi istnieć ProjectFunding(project, funding).
        - Jeśli template jest ustawiony, to:
            * domyślnie funding powinien być równy template.funding (jeśli funding przekazano i jest inny → błąd),
            * jeśli funding nie został przekazany, ustawimy go w create/update na template.funding.
        - Daty: start_date <= due_date (modelowe constrainty też są, ale zwracamy ładny błąd API).
        """
        project = attrs.get("project") or getattr(self.instance, "project", None)
        funding = attrs.get("funding", getattr(self.instance, "funding", None))
        template = attrs.get("template", getattr(self.instance, "template", None))

        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        due_date = attrs.get("due_date", getattr(self.instance, "due_date", None))
        if start_date and due_date and start_date > due_date:
            raise serializers.ValidationError(
                {"due_date": "due_date nie może być wcześniejsze niż start_date."}
            )

        if project is None:
            raise serializers.ValidationError(
                {"project": "Task musi należeć do projektu."}
            )

        # Jeśli funding przekazano → sprawdź, czy jest powiązany z projektem
        if funding is not None:
            exists = ProjectFunding.objects.filter(
                project=project, funding=funding
            ).exists()
            if not exists:
                raise serializers.ValidationError(
                    {
                        "funding": "To finansowanie nie jest podpięte do tego projektu (ProjectFunding nie istnieje)."
                    }
                )

        # Jeśli jest template → dopnij logikę spójności
        if template is not None:
            tpl_funding = template.funding
            if funding is None:
                # jeśli funding nie podano, użyj funding z template
                attrs["funding"] = tpl_funding
            elif funding.id != tpl_funding.id:
                raise serializers.ValidationError(
                    {
                        "template": "Szablon należy do innego finansowania niż podane w 'funding'."
                    }
                )

            # Task z template traktujemy jako grantowy
            attrs["funding_scoped"] = True

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # Jeśli funding nie ustawiony, ale template jest, validate() już go uzupełniło
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        # Jeżeli użytkownik spróbuje odpiąć funding z grantowego taska (funding_scoped=True),
        # pozwalamy, ale to już *nie będzie* grantowe:
        if "funding" in validated_data and instance.funding_scoped:
            if validated_data.get("funding") is None:
                validated_data["funding_scoped"] = False
                validated_data["template"] = None
        return super().update(instance, validated_data)
