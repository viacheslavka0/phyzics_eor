from django.db import models
from learning.models import StudyGroup


class ExternalTestResult(models.Model):
    """
    Результат внешнего (pre/post) тестирования — для сравнительного анализа.
    Используется для ввода данных контрольной группы (результаты из тетрадей)
    и собственных pre-данных экспериментальной группы до начала работы в EORA.
    """
    TEST_TYPE_CHOICES = [
        ("pre", "Входной тест"),
        ("post", "Итоговый тест"),
    ]
    GROUP_TYPE_CHOICES = [
        ("experiment", "Экспериментальная (EORA)"),
        ("control", "Контрольная"),
    ]

    study_group = models.ForeignKey(
        StudyGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="external_test_results",
        help_text="Группа апробации (необязательно)",
    )
    group_type = models.CharField(
        max_length=16,
        choices=GROUP_TYPE_CHOICES,
        default="control",
        help_text="Тип группы: экспериментальная или контрольная",
    )
    test_type = models.CharField(
        max_length=8,
        choices=TEST_TYPE_CHOICES,
        help_text="Входной или итоговый тест",
    )
    score_percent = models.FloatField(
        help_text="Результат в процентах (0–100)"
    )
    correct_tasks = models.PositiveIntegerField(
        default=0,
        help_text="Количество правильно решённых задач",
    )
    max_tasks = models.PositiveIntegerField(
        default=5,
        help_text="Всего задач в тесте",
    )
    participant_code = models.CharField(
        max_length=30,
        blank=True,
        help_text="Анонимный код участника (например, Ученик-01)",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Результат внешнего теста"
        verbose_name_plural = "Результаты внешних тестов"
        ordering = ["group_type", "test_type", "created_at"]

    def __str__(self):
        return (
            f"[{self.get_group_type_display()}] "
            f"{self.get_test_type_display()} — "
            f"{self.participant_code or 'аноним'}: {self.score_percent:.1f}%"
        )
