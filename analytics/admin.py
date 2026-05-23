from django.contrib import admin
from .models import ExternalTestResult


@admin.register(ExternalTestResult)
class ExternalTestResultAdmin(admin.ModelAdmin):
    list_display = ["participant_code", "group_type", "test_type", "score_percent", "correct_tasks", "max_tasks", "study_group", "created_at"]
    list_filter = ["group_type", "test_type", "study_group"]
    search_fields = ["participant_code", "notes"]
    ordering = ["group_type", "test_type"]
