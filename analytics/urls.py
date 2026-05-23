from django.urls import path
from .views import ResearchReportView, ExternalTestResultCreateView

urlpatterns = [
    path("research-report/", ResearchReportView.as_view(), name="research-report"),
    path("external-test/", ExternalTestResultCreateView.as_view(), name="external-test-create"),
    path("external-test/<int:pk>/", ExternalTestResultCreateView.as_view(), name="external-test-delete"),
]
