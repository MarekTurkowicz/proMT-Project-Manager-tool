from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    health,
    me,
    FundingViewSet,
    FundingTaskViewSet,
    ProjectViewSet,
    ProjectFundingViewSet,
    TaskViewSet,
)

router = DefaultRouter()
router.register(r"fundings", FundingViewSet, basename="funding")
router.register(r"funding-tasks", FundingTaskViewSet, basename="fundingtask")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"project-fundings", ProjectFundingViewSet, basename="projectfunding")
router.register(r"tasks", TaskViewSet, basename="task")

urlpatterns = [
    # health & auth
    path("health/", health, name="health"),
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", me, name="auth_me"),
    # CRUD API
    path("", include(router.urls)),
]
