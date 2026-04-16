from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView, RedirectView
from django.conf.urls import handler404

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("learning.urls")),
    path("app/", TemplateView.as_view(template_name="index.html")),
    path("teacher/", RedirectView.as_view(url="/app/", permanent=False)),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
if settings.DEBUG:
    static_dir = settings.STATICFILES_DIRS[0] if settings.STATICFILES_DIRS else None
    if static_dir:
        urlpatterns += static(settings.STATIC_URL, document_root=static_dir)
