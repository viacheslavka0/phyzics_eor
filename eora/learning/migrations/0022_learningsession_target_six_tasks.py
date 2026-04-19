from django.db import migrations, models


def bump_track_to_six(apps, schema_editor):
    LearningSession = apps.get_model("learning", "LearningSession")
    LearningSession.objects.filter(target_tasks_count=5).update(target_tasks_count=6)


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0021_userprofile_student_mode"),
    ]

    operations = [
        migrations.RunPython(bump_track_to_six, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="learningsession",
            name="target_tasks_count",
            field=models.PositiveIntegerField(
                default=6,
                help_text="Сколько ситуаций в треке (по умолчанию 6: пять обычных + шестая с фото для учителя)",
            ),
        ),
    ]
