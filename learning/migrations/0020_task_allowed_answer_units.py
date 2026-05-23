from django.db import migrations, models


UNIT_GROUPS = {
    "м": ["см", "м", "км"],
    "см": ["см", "м", "км"],
    "км": ["см", "м", "км"],
    "с": ["с", "мин", "ч", "сут", "лет"],
    "мин": ["с", "мин", "ч", "сут", "лет"],
    "ч": ["с", "мин", "ч", "сут", "лет"],
    "сут": ["с", "мин", "ч", "сут", "лет"],
    "лет": ["с", "мин", "ч", "сут", "лет"],
    "м/с": ["м/с", "км/ч", "км/с"],
    "км/ч": ["м/с", "км/ч", "км/с"],
    "км/с": ["м/с", "км/ч", "км/с"],
}


def fill_allowed_units(apps, schema_editor):
    Task = apps.get_model("learning", "Task")
    for task in Task.objects.all():
        base = (task.answer_unit or "").strip()
        allowed = UNIT_GROUPS.get(base, [base] if base else [])
        if base and base not in allowed:
            allowed.insert(0, base)
        task.allowed_answer_units = allowed
        task.save(update_fields=["allowed_answer_units"])


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0019_taskattemptimage"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="allowed_answer_units",
            field=models.JSONField(blank=True, default=list, help_text="Допустимые единицы для ввода ответа учеником"),
        ),
        migrations.RunPython(fill_allowed_units, migrations.RunPython.noop),
    ]
