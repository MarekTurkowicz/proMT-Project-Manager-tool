from django.db import models
from django.conf import settings


class UserRole(models.TextChoices):
    ADMIN = "admin", "Administrator"
    PM = "pm", "Project Manager"
    MEMBER = "member", "Członek zespołu"
    VIEWER = "viewer", "Viewer"


class UserProfile(models.Model):
    """
    Stores additional information and business logic related to users, such as their role within a project, contact phone number, and an optional avatar image URL.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.MEMBER,
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
        help_text="Phone number - optional",
    )

    avatar_url = models.URLField(
        blank=True,
        help_text="URL to the user's avatar image - optional",
    )

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"
