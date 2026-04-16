from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("learning", "0015_alter_tasksolutionstep_step_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningsession",
            name="scenario_two_errors_used",
            field=models.BooleanField(
                default=False,
                help_text="Сценарий «2 ошибки» (cloze алгоритма) уже показывали в этой сессии",
            ),
        ),
        migrations.AddField(
            model_name="taskattempt",
            name="teacher_review_status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Не требуется"),
                    ("pending", "Ожидает проверки"),
                    ("accepted", "Принято"),
                    ("rejected", "На доработку"),
                ],
                default="",
                help_text="Для итоговой задачи: статус проверки учителем",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="taskattempt",
            name="teacher_comment",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="taskattempt",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="taskattempt",
            name="reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reviewed_task_attempts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
