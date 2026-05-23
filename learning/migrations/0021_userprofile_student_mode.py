from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0020_task_allowed_answer_units"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="student_mode",
            field=models.CharField(
                choices=[("student", "Ученик"), ("pilot", "Апробация")],
                default="student",
                help_text="Режим поведения интерфейса и ограничений для ученика",
                max_length=16,
            ),
        ),
    ]
