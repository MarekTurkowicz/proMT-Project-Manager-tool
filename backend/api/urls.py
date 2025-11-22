from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import auth_csrf, auth_login, auth_logout, health, me
from .views import (
    FundingViewSet,
    FundingTaskViewSet,
    ProjectViewSet,
    ProjectFundingViewSet,
    TaskViewSet,
    TaskAssignmentViewSet,
    UserViewSet,
)


router = DefaultRouter()
router.register(r"fundings", FundingViewSet, basename="funding")
router.register(r"funding-tasks", FundingTaskViewSet, basename="fundingtask")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"project-fundings", ProjectFundingViewSet, basename="projectfunding")
router.register(r"tasks", TaskViewSet, basename="task")
router.register(r"task-assignments", TaskAssignmentViewSet, basename="task-assignment")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    path("health/", health, name="health"),
    path("auth/me/", me, name="auth_me"),
    path("auth/csrf/", auth_csrf, name="auth_csrf"),
    path("auth/login/", auth_login, name="auth_login"),
    path("auth/logout/", auth_logout, name="auth_logout"),
    path("", include(router.urls)),
]
