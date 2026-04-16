from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0006_add_step_type_and_schema_data"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningsession",
            name="typical_task_formulation",
            field=models.TextField(
                blank=True,
                help_text="Формулировка типовой задачи, введенная учеником",
            ),
        ),
    ]

