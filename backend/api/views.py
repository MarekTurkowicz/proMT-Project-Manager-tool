from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import viewsets, permissions
from .models import Funding, FundingTask, Project, ProjectFunding, Task
from .serializers import (
    FundingSerializer,
    FundingTaskSerializer,
    ProjectSerializer,
    ProjectFundingSerializer,
    TaskSerializer,
)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    user = request.user
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_staff": user.is_staff,
        }
    )


class IsAuthenticated(permissions.IsAuthenticated):
    """Skrótowo, żeby mieć spójną nazwę."""

    pass


class FundingViewSet(viewsets.ModelViewSet):
    queryset = Funding.objects.all().order_by("-created_at")
    serializer_class = FundingSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["name", "funder", "program", "agreement_number", "description"]
    ordering_fields = ["created_at", "start_date", "end_date", "amount_total", "name"]
    ordering = ["-created_at"]


class FundingTaskViewSet(viewsets.ModelViewSet):
    queryset = FundingTask.objects.select_related("funding").all().order_by("id")
    serializer_class = FundingTaskSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["title", "description", "funding__name"]
    ordering_fields = ["id", "default_priority", "default_status", "default_due_days"]
    ordering = ["id"]

    def get_queryset(self):
        qs = super().get_queryset()
        funding_id = self.request.query_params.get("funding")
        if funding_id:
            qs = qs.filter(funding_id=funding_id)
        return qs


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by("-created_at")
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["name", "description", "owner__username"]
    ordering_fields = ["created_at", "start_date", "end_date", "name", "status"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ["list"]:  # (ew. "retrieve" też, jeśli chcesz publicznie)
            return [permissions.AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        # Jeśli nie podasz ownera, domyślnie przypisz tworzącego
        owner = serializer.validated_data.get("owner") or self.request.user
        serializer.save(owner=owner)


class ProjectFundingViewSet(viewsets.ModelViewSet):
    queryset = (
        ProjectFunding.objects.select_related("project", "funding")
        .all()
        .order_by("-created_at")
    )
    serializer_class = ProjectFundingSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["project__name", "funding__name", "note"]
    ordering_fields = ["created_at", "allocation_start", "allocation_end", "is_primary"]
    ordering = ["-created_at"]

    queryset = (
        ProjectFunding.objects.select_related("project", "funding")
        .all()
        .order_by("-created_at")
    )

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        funding_id = self.request.query_params.get("funding")
        if project_id:
            qs = qs.filter(project_id=project_id)
        if funding_id:
            qs = qs.filter(funding_id=funding_id)
        return qs


class TaskViewSet(viewsets.ModelViewSet):
    queryset = (
        Task.objects.select_related("project", "funding", "template")
        .prefetch_related("assignees")
        .all()
        .order_by("-created_at")
    )
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    search_fields = [
        "title",
        "description",
        "project__name",
        "funding__name",
        "assignees__username",
    ]
    ordering_fields = [
        "created_at",
        "updated_at",
        "due_date",
        "priority",
        "status",
        "title",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        funding_id = self.request.query_params.get("funding")
        status_ = self.request.query_params.get("status")
        if project_id:
            qs = qs.filter(project_id=project_id)
        if funding_id:
            qs = qs.filter(funding_id=funding_id)
        if status_:
            qs = qs.filter(status=status_)
        return qs
