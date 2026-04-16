"""
Наполнение cloze для типовой задачи СК #1
(Равномерное и неравномерное движение тел на участке траектории)

Эталонная формулировка:
«Описать движение и найти величины, характеризующие
равномерное или неравномерное движение конкретных тел.»
"""
from django.db import migrations


def populate_cloze(apps, schema_editor):
    KnowledgeSystem = apps.get_model("learning", "KnowledgeSystem")

    try:
        ks = KnowledgeSystem.objects.get(pk=1)
    except KnowledgeSystem.DoesNotExist:
        return

    # Текст с пропусками:
    # «{{0}} движение и {{1}} величины, {{2}} равномерное
    #  или неравномерное движение {{3}} тел.»
    ks.typical_task_cloze_text = (
        "{{0}} движение и {{1}} величины, {{2}} "
        "равномерное или неравномерное движение {{3}} тел."
    )

    ks.typical_task_cloze_blanks = [
        {"position": 0, "correct": "Описать"},
        {"position": 1, "correct": "найти"},
        {"position": 2, "correct": "характеризующие"},
        {"position": 3, "correct": "конкретных"},
    ]

    # Слова-отвлекатели — близкие по смыслу, чтобы нельзя было угадать
    ks.typical_task_cloze_distractors = [
        "Изучить",
        "определить",
        "описывающие",
        "измерить",
        "абстрактных",
        "зависящие",
        "вычислить",
        "различных",
    ]

    ks.save()


def depopulate_cloze(apps, schema_editor):
    KnowledgeSystem = apps.get_model("learning", "KnowledgeSystem")
    try:
        ks = KnowledgeSystem.objects.get(pk=1)
        ks.typical_task_cloze_text = ""
        ks.typical_task_cloze_blanks = []
        ks.typical_task_cloze_distractors = []
        ks.save()
    except KnowledgeSystem.DoesNotExist:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0010_add_typical_task_cloze"),
    ]

    operations = [
        migrations.RunPython(populate_cloze, depopulate_cloze),
    ]
