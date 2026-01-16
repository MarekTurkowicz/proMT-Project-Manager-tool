import pytest
from rest_framework.test import APIClient
from django.test import Client


@pytest.mark.django_db
def test_me_returns_authenticated_user(api_client, user):
    res = api_client.get("/api/auth/me/")
    assert res.status_code == 200
    assert res.data["id"] == user.id
    assert res.data["username"] == user.username


@pytest.mark.django_db
def test_auth_csrf_returns_200(api_client):
    res = api_client.get("/api/auth/csrf/")
    assert res.status_code == 200
    assert "detail" in res.data


@pytest.mark.django_db
def test_auth_login_success(user):
    client = APIClient()
    res = client.post(
        "/api/auth/login/",
        {"username": user.username, "password": "pass12345"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["id"] == user.id
    assert res.data["username"] == user.username


@pytest.mark.django_db
def test_auth_login_invalid_credentials(user):
    client = APIClient()
    res = client.post(
        "/api/auth/login/",
        {"username": user.username, "password": "wrong"},
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_auth_logout_returns_204(api_client):
    res = api_client.post("/api/auth/logout/")
    assert res.status_code == 204


@pytest.mark.django_db
def test_auth_login_csrf_protection(user):
    """When CSRF checks are enforced, login should require a valid CSRF token."""
    client = Client(enforce_csrf_checks=True)

    res_csrf = client.get("/api/auth/csrf/")
    assert res_csrf.status_code == 200
    assert "csrftoken" in res_csrf.cookies
    csrf_token = res_csrf.cookies["csrftoken"].value

    res_no_csrf = client.post(
        "/api/auth/login/",
        {"username": user.username, "password": "pass12345"},
    )
    assert res_no_csrf.status_code == 403

    res_ok = client.post(
        "/api/auth/login/",
        {"username": user.username, "password": "pass12345"},
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    assert res_ok.status_code == 200
