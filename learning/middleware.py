"""Ограничение доступа к встроенной панели Django."""

from django.http import HttpResponseForbidden


class RestrictAdminToSuperuserMiddleware:
    """
    Панель /admin/ — только для is_superuser (настройка контента, сырые модели).
    Учителя и ученики работают через /app/.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.path.startswith("/admin/")
            and request.user.is_authenticated
            and not request.user.is_superuser
        ):
            return HttpResponseForbidden(
                "Панель Django доступна только суперпользователю. "
                "Вход для курса: откройте /app/"
            )
        return self.get_response(request)
