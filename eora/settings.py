"""
Django settings for eora project.
"""

from pathlib import Path
import os
from urllib.parse import urlparse
from typing import Optional, List

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    if v is None or not str(v).strip():
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def _env_list(name: str, default: Optional[List[str]] = None) -> List[str]:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return list(default or [])
    return [x.strip() for x in raw.split(",") if x.strip()]


STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]   # ИЩЕМ СТАТИКУ В КОРНЕ ПРОЕКТА
STATIC_ROOT = BASE_DIR / "static_collected"  # collectstatic → один каталог для Nginx /static/
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- Загрузка файлов: ограничения ---
FILE_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5 MB
ALLOWED_UPLOAD_EXTENSIONS = ("jpg", "jpeg", "png", "gif", "webp")

# --- БАЗОВОЕ ---
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if _env_bool("DJANGO_DEBUG", True):
        # Development: использовать небезопасный ключ только в разработке
        SECRET_KEY = "django-insecure-dev-only-change-in-production"
    else:
        raise ValueError(
            "DJANGO_SECRET_KEY environment variable is required in production"
        )

DEBUG = _env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS: List[str] = _env_list("DJANGO_ALLOWED_HOSTS")
if not ALLOWED_HOSTS and DEBUG:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

# --- ПРИЛОЖЕНИЯ ---
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # сторонние
    "rest_framework",
    "corsheaders",

    # наши
    "learning",
    "analytics",   # оставляем, если у тебя есть приложение analytics (startapp делал)
]

# --- MIDDLEWARE ---
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "learning.middleware.RestrictAdminToSuperuserMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    _cors_origins = _env_list("DJANGO_CORS_ALLOWED_ORIGINS")
    if _cors_origins:
        CORS_ALLOWED_ORIGINS = _cors_origins

CSRF_TRUSTED_ORIGINS = _env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

ROOT_URLCONF = "eora.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "static" / "app"],  # для статических HTML файлов
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "eora.wsgi.application"

# --- БАЗА ДАННЫХ ---
# Локально: SQLite. Прод: переменная DATABASE_URL (postgres://...)
def _database_config():
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        return {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": BASE_DIR / "db.sqlite3",
            }
        }
    parsed = urlparse(url)
    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError(f"Unsupported DATABASE_URL scheme: {parsed.scheme!r}")
    db_name = (parsed.path or "/").lstrip("/")
    if not db_name:
        raise ValueError("DATABASE_URL must include a database name in the path")
    return {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": db_name,
            "USER": parsed.username or "",
            "PASSWORD": parsed.password or "",
            "HOST": parsed.hostname or "",
            "PORT": str(parsed.port or "5432"),
        }
    }


DATABASES = _database_config()

# --- ПАРОЛИ (можно упростить позже) ---
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- ЛОКАЛИЗАЦИЯ ---
LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True



# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",  # логин/куки
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# --- Прод: HTTPS, Security Headers ---
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_HTTPONLY = False  # JS must be able to read csrftoken cookie for X-CSRFToken header
    SECURE_SSL_REDIRECT = _env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = 31536000  # 1 год
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_SECURITY_POLICY = {
        "default-src": ("'self'",),
        "script-src": ("'self'", "'unsafe-inline'"),  # Tailwind требует unsafe-inline
        "style-src": ("'self'", "'unsafe-inline'"),
        "img-src": ("'self'", "data:", "https:"),
        "font-src": ("'self'",),
        "connect-src": ("'self'",),
    }
else:
    # Development
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_HTTPONLY = False
