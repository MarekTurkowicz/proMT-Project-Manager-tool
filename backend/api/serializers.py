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
    class Meta:
        model = Task
        fields = "__all__"
        extra_kwargs = {
            "project": {"required": False, "allow_null": True},
            "funding": {"required": False, "allow_null": True},
            "template": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        project = attrs.get("project") or getattr(self.instance, "project", None)
        funding = attrs.get("funding") or getattr(self.instance, "funding", None)
        if project and funding:
            if not ProjectFunding.objects.filter(
                project=project, funding=funding
            ).exists():
                raise serializers.ValidationError(
                    "This project and funding are not linked (no ProjectFunding record)."
                )
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
