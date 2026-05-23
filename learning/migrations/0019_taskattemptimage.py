from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0018_pilot_groups_and_mastery"),
    ]

    operations = [
        migrations.CreateModel(
            name="TaskAttemptImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="student_solutions/")),
                ("order", models.PositiveSmallIntegerField(default=0)),
                (
                    "attempt",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="answer_images",
                        to="learning.taskattempt",
                    ),
                ),
            ],
            options={
                "verbose_name": "Фото к ответу",
                "verbose_name_plural": "Фото к ответам",
                "ordering": ["order", "id"],
            },
        ),
    ]
