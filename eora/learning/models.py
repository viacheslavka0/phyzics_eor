from django.db import models
from django.conf import settings

# =============================================================================
# 1. УЧЕБНАЯ ИЕРАРХИЯ
# =============================================================================

class SchoolClass(models.Model):
    """Класс обучения (7, 8, 9)"""
    number = models.PositiveSmallIntegerField(unique=True)
    title = models.CharField(max_length=50)  # "7 класс"

    class Meta:
        verbose_name = "Класс"
        verbose_name_plural = "Классы"
        ordering = ["number"]

    def __str__(self):
        return self.title


class SubjectSection(models.Model):
    """Раздел предмета (например, 'Механические явления')"""
    school_class = models.ForeignKey(
        SchoolClass, on_delete=models.CASCADE, related_name="sections"
    )
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "Раздел"
        verbose_name_plural = "Разделы"
        ordering = ["school_class__number", "order"]

    def __str__(self):
        return f"{self.school_class}: {self.title}"


class Topic(models.Model):
    """Тема (например, 'Равномерное и неравномерное движение')"""
    section = models.ForeignKey(
        SubjectSection, on_delete=models.CASCADE, related_name="topics"
    )
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "Тема"
        verbose_name_plural = "Темы"
        ordering = ["section__order", "order"]

    def __str__(self):
        return self.title


# =============================================================================
# 1b. АПРОБАЦИЯ — УЧЕБНЫЕ ГРУППЫ И ПРОФИЛЬ УЧЕНИКА
# =============================================================================


class StudyGroup(models.Model):
    """Группа для фокус-апробации: параллель + буква, набор учеников."""

    title = models.CharField(
        max_length=120,
        help_text="Например: «7 А — фокус весна 2026»",
    )
    letter = models.CharField(
        max_length=4,
        blank=True,
        default="",
        help_text="Буква класса (А, Б, …)",
    )
    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="study_groups",
        help_text="Необязательно: привязка к классу из структуры курса (7/8/9)",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_study_groups",
        help_text="Учитель-организатор, ведущий группу",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "title"]
        verbose_name = "Группа апробации"
        verbose_name_plural = "Группы апробации"

    def __str__(self):
        return self.title


class StudyGroupMembership(models.Model):
    group = models.ForeignKey(
        StudyGroup, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="study_group_memberships",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["group", "user"],
                name="uniq_studygroup_membership",
            ),
        ]
        verbose_name = "Участник группы"
        verbose_name_plural = "Участники групп"

    def __str__(self):
        return f"{self.user.username} → {self.group.title}"


class UserProfile(models.Model):
    """Расширение учётной записи: принудительная смена пароля при первом входе."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_profile",
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text="Если True — ученик должен сменить пароль в приложении",
    )

    class Meta:
        verbose_name = "Профиль ЭОР"
        verbose_name_plural = "Профили ЭОР"

    def __str__(self):
        return f"Профиль {self.user.username}"


# =============================================================================
# 2. СИСТЕМА ЗНАНИЙ (СК)
# =============================================================================

class KnowledgeSystem(models.Model):
    """
    Система знаний — ядро обучения.
    Содержит изображение-таблицу, вопросы для осмысления, метод решения, задачи.
    """
    STATUS_CHOICES = [
        ("draft", "Черновик"),
        ("published", "Опубликовано"),
    ]

    topic = models.ForeignKey(
        Topic, on_delete=models.CASCADE, related_name="knowledge_systems"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(
        blank=True,
        help_text="Описание СК для ученика"
    )
    
    # Изображение таблицы Системы Знаний (для осмысления)
    image = models.ImageField(
        upload_to="ks/",
        blank=True, null=True,
        help_text="Основное изображение Системы Знаний"
    )
    comprehension_image = models.ImageField(
        upload_to="ks/comprehension/",
        blank=True, null=True,
        help_text="Изображение таблицы для этапа осмысления (с зонами)"
    )
    show_zones_by_default = models.BooleanField(
        default=True,
        help_text="Показывать зоны по умолчанию"
    )
    comprehension_pass_threshold = models.PositiveIntegerField(
        default=85,
        help_text="Минимальный процент правильных ответов для прохождения осмысления"
    )

    # Формулировка типовой задачи
    typical_task_title = models.CharField(
        max_length=255, blank=True,
        help_text="Название типа задач (например, 'Найти значения физических величин, характеризующих равномерное и неравномерное движение')"
    )
    typical_task_description = models.TextField(
        blank=True,
        help_text="Описание: с какой целью и в каких ситуациях применяется СК"
    )

    # Cloze для типовой задачи (ученик заполняет пропуски в формулировке)
    typical_task_cloze_text = models.TextField(
        blank=True, default="",
        help_text='Текст с маркерами {{0}}, {{1}}, ... для пропусков. Пример: "{{0}} движение и {{1}} величины"'
    )
    typical_task_cloze_blanks = models.JSONField(
        default=list, blank=True,
        help_text='Пропуски: [{"position": 0, "correct": "Описать"}, ...]'
    )
    typical_task_cloze_distractors = models.JSONField(
        default=list, blank=True,
        help_text='Слова-отвлекатели: ["неверное1", "неверное2", ...]'
    )

    # Мета
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Система знаний"
        verbose_name_plural = "Системы знаний"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} v{self.version} ({self.get_status_display()})"


# =============================================================================
# 2b. ВАРИАНТЫ ОТВЕТА ДЛЯ ТИПОВОЙ ЗАДАЧИ
# =============================================================================

class TypicalTaskOption(models.Model):
    """
    Вариант ответа для этапа «Сформулируйте типовую задачу».
    Ученик выбирает один правильный вариант из нескольких.
    """
    ks = models.ForeignKey(
        KnowledgeSystem, on_delete=models.CASCADE, related_name="typical_task_options"
    )
    text = models.TextField(help_text="Текст варианта ответа")
    is_correct = models.BooleanField(
        default=False,
        help_text="Является ли этот вариант правильным"
    )
    order = models.PositiveIntegerField(
        default=1,
        help_text="Порядок отображения"
    )
    explanation = models.TextField(
        blank=True,
        help_text="Пояснение, почему вариант правильный/неправильный (показывается после ответа)"
    )

    class Meta:
        verbose_name = "Вариант типовой задачи"
        verbose_name_plural = "Варианты типовой задачи"
        ordering = ["ks", "order"]

    def __str__(self):
        mark = "✅" if self.is_correct else "❌"
        return f"{mark} {self.text[:60]}"


# =============================================================================
# 3. ЗОНЫ И ВОПРОСЫ ДЛЯ ОСМЫСЛЕНИЯ СК
# =============================================================================

class KSZone(models.Model):
    """Прямоугольная зона на изображении СК"""
    ks = models.ForeignKey(
        KnowledgeSystem, on_delete=models.CASCADE, related_name="zones"
    )
    x = models.PositiveIntegerField()
    y = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    label = models.CharField(max_length=100, blank=True, help_text="Метка зоны (для админки)")

    class Meta:
        verbose_name = "Зона СК"
        verbose_name_plural = "Зоны СК"

    def __str__(self):
        return f"Зона {self.id} ({self.label})" if self.label else f"Зона {self.id}"


class KSQuestion(models.Model):
    """
    Вопрос для осмысления Системы Знаний.
    Поддерживает разные типы: текст, выбор, множественный выбор, соответствие с зонами.
    """
    TYPE_CHOICES = [
        ("text", "Открытый ответ"),
        ("single", "Выбор одного варианта"),
        ("multiple", "Множественный выбор"),
        ("match", "Соответствие (выбор зон)"),
    ]
    
    ks = models.ForeignKey(
        KnowledgeSystem, on_delete=models.CASCADE, related_name="questions"
    )
    type = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default="single",
        help_text="Тип вопроса"
    )
    text = models.TextField(help_text="Формулировка вопроса")
    order = models.PositiveIntegerField(default=1)
    
    # === Для типа "match" — привязка к зонам ===
    zones = models.ManyToManyField(
        KSZone, related_name="questions", blank=True,
        help_text="Зоны, которые подсвечиваются при этом вопросе"
    )
    correct_zones = models.ManyToManyField(
        KSZone, related_name="correct_for_questions", blank=True,
        help_text="Правильные зоны (для типа 'match')"
    )
    
    # === Для типов "single" и "multiple" — варианты ответа ===
    options = models.JSONField(
        default=list, blank=True,
        help_text='Варианты: [{"text": "Вариант 1", "is_correct": false}, ...]'
    )
    
    # === Для типа "text" — правильный ответ ===
    correct_answer_text = models.CharField(
        max_length=500, blank=True,
        help_text="Правильный текстовый ответ (для типа 'text')"
    )
    # Допускать ли похожие ответы (нечёткое сравнение)
    fuzzy_match = models.BooleanField(
        default=False,
        help_text="Разрешить похожие ответы (игнорировать регистр, пробелы)"
    )

    class Meta:
        verbose_name = "Вопрос Системы Знаний"
        verbose_name_plural = "Вопросы Системы Знаний"
        ordering = ["ks", "order"]

    def __str__(self):
        return f"[{self.get_type_display()}] Q{self.order}: {self.text[:40]}..."
    
    def check_answer(self, answer):
        """
        Проверка ответа ученика.
        answer: str (для text), int (для single), list[int] (для multiple), list[int] (для match — ID зон)
        """
        if self.type == "text":
            if self.fuzzy_match:
                return self._normalize(answer) == self._normalize(self.correct_answer_text)
            return answer.strip() == self.correct_answer_text.strip()
        
        elif self.type == "single":
            # answer — индекс выбранного варианта
            if not self.options or not isinstance(answer, int):
                return False
            if 0 <= answer < len(self.options):
                return self.options[answer].get("is_correct", False)
            return False
        
        elif self.type == "multiple":
            # answer — список индексов
            if not self.options or not isinstance(answer, list):
                return False
            correct_indices = {i for i, opt in enumerate(self.options) if opt.get("is_correct")}
            return set(answer) == correct_indices
        
        elif self.type == "match":
            # answer — список ID зон
            correct_ids = set(self.correct_zones.values_list("id", flat=True))
            return set(answer) == correct_ids
        
        return False
    
    def _normalize(self, text):
        """Нормализация текста для нечёткого сравнения"""
        import re
        return re.sub(r'\s+', ' ', text.lower().strip())


# =============================================================================
# 4. CLOZE (ТЕКСТ С ПРОПУСКАМИ)
# =============================================================================

class KSCloze(models.Model):
    """
    Текст с пропусками для осмысления Системы Знаний.
    Учитель вставляет текст, выделяет слова — они становятся пропусками.
    """
    ks = models.ForeignKey(
        KnowledgeSystem, on_delete=models.CASCADE, related_name="clozes"
    )
    
    # Исходный текст (для отображения учителю)
    original_text = models.TextField(
        blank=True, default="",
        help_text="Исходный текст до разметки пропусков"
    )
    
    # Текст с маркерами пропусков: "Это {{0}} движение"
    marked_text = models.TextField(
        blank=True, default="",
        help_text='Текст с маркерами {{0}}, {{1}}, ... для пропусков'
    )
    
    # Пропуски: [{"position": 0, "correct": "равномерное", "start": 4, "end": 15}, ...]
    blanks = models.JSONField(
        default=list,
        help_text='Пропуски: [{"position": 0, "correct": "слово"}, ...]'
    )
    
    # Слова-отвлекатели (добавляются учителем для усложнения)
    distractors = models.JSONField(
        default=list,
        help_text='Слова-отвлекатели: ["неверное1", "неверное2", ...]'
    )
    
    order = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "Текст с пропусками"
        verbose_name_plural = "Тексты с пропусками"
        ordering = ["ks", "order"]

    def __str__(self):
        return f"Cloze #{self.order} для {self.ks.title}"
    
    def get_all_options(self):
        """Получить все варианты (правильные + отвлекатели) в случайном порядке"""
        import random
        correct_words = [b["correct"] for b in self.blanks]
        all_options = list(set(correct_words + self.distractors))
        random.shuffle(all_options)
        return all_options
    
    def check_answers(self, answers):
        """
        Проверка ответов ученика.
        answers: {0: "слово1", 1: "слово2", ...}
        Возвращает: {"correct": [0, 2], "wrong": [1], "score": 0.66}
        """
        correct = []
        wrong = []
        
        for blank in self.blanks:
            pos = blank["position"]
            student_answer = answers.get(pos, "").strip().lower()
            correct_answer = blank["correct"].strip().lower()
            
            if student_answer == correct_answer:
                correct.append(pos)
            else:
                wrong.append(pos)
        
        total = len(self.blanks)
        score = len(correct) / total if total > 0 else 0
        
        return {
            "correct": correct,
            "wrong": wrong,
            "score": round(score, 2)
        }


# Удалены старые модели KSClozeOption и KSClozeGap — теперь всё в JSON


# =============================================================================
# 4.1. ОТВЕТЫ УЧЕНИКА НА ОСМЫСЛЕНИЕ
# =============================================================================

class ComprehensionAttempt(models.Model):
    """Попытка ученика пройти этап осмысления Системы Знаний"""
    session = models.ForeignKey(
        'LearningSession', on_delete=models.CASCADE, related_name="comprehension_attempts"
    )
    
    # Результат
    total_questions = models.PositiveIntegerField(default=0)
    correct_answers = models.PositiveIntegerField(default=0)
    score_percent = models.FloatField(default=0)
    passed = models.BooleanField(default=False)
    
    # Время
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Попытка осмысления"
        verbose_name_plural = "Попытки осмысления"

    def __str__(self):
        status = "✓" if self.passed else "✗"
        return f"{status} Осмысление — {self.session}"
    
    def calculate_score(self):
        """Пересчитать результат на основе ответов"""
        answers = self.question_answers.all()
        self.total_questions = answers.count()
        self.correct_answers = answers.filter(is_correct=True).count()
        self.score_percent = (self.correct_answers / self.total_questions * 100) if self.total_questions > 0 else 0
        self.passed = self.score_percent >= 85  # Порог 85%
        self.save()


class QuestionAnswer(models.Model):
    """Ответ ученика на вопрос осмысления"""
    attempt = models.ForeignKey(
        ComprehensionAttempt, on_delete=models.CASCADE, related_name="question_answers"
    )
    question = models.ForeignKey(
        KSQuestion, on_delete=models.CASCADE, related_name="student_answers"
    )
    
    # Ответ ученика (формат зависит от типа вопроса)
    answer_text = models.CharField(max_length=500, blank=True)  # Для type="text"
    answer_index = models.IntegerField(null=True, blank=True)  # Для type="single"
    answer_indices = models.JSONField(default=list, blank=True)  # Для type="multiple"
    answer_zone_ids = models.JSONField(default=list, blank=True)  # Для type="match"
    
    # Результат
    is_correct = models.BooleanField(null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ответ на вопрос"
        verbose_name_plural = "Ответы на вопросы"
        unique_together = ["attempt", "question"]

    def __str__(self):
        status = "✓" if self.is_correct else "✗" if self.is_correct is False else "?"
        return f"{status} Q{self.question.order}"
    
    def verify(self):
        """Проверить ответ и сохранить результат"""
        q = self.question
        
        if q.type == "text":
            self.is_correct = q.check_answer(self.answer_text)
        elif q.type == "single":
            self.is_correct = q.check_answer(self.answer_index)
        elif q.type == "multiple":
            self.is_correct = q.check_answer(self.answer_indices)
        elif q.type == "match":
            self.is_correct = q.check_answer(self.answer_zone_ids)
        
        self.save()
        return self.is_correct


class ClozeAnswer(models.Model):
    """Ответ ученика на текст с пропусками"""
    attempt = models.ForeignKey(
        ComprehensionAttempt, on_delete=models.CASCADE, related_name="cloze_answers"
    )
    cloze = models.ForeignKey(
        KSCloze, on_delete=models.CASCADE, related_name="student_answers"
    )
    
    # Ответы: {0: "слово1", 1: "слово2", ...}
    answers = models.JSONField(default=dict)
    
    # Результат
    correct_positions = models.JSONField(default=list)  # [0, 2, 4]
    wrong_positions = models.JSONField(default=list)  # [1, 3]
    score = models.FloatField(default=0)
    is_correct = models.BooleanField(default=False)  # Все пропуски верны
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ответ на текст с пропусками"
        verbose_name_plural = "Ответы на тексты с пропусками"
        unique_together = ["attempt", "cloze"]

    def __str__(self):
        return f"Cloze #{self.cloze.order} — {self.score*100:.0f}%"
    
    def verify(self):
        """Проверить ответы и сохранить результат"""
        result = self.cloze.check_answers(self.answers)
        self.correct_positions = result["correct"]
        self.wrong_positions = result["wrong"]
        self.score = result["score"]
        self.is_correct = len(result["wrong"]) == 0
        self.save()
        return result


# =============================================================================
# 5. МЕТОД РЕШЕНИЯ
# =============================================================================

class SolutionMethod(models.Model):
    """Метод решения задач для СК (общий алгоритм из 10 шагов)"""
    ks = models.OneToOneField(
        KnowledgeSystem, on_delete=models.CASCADE, related_name="solution_method"
    )
    title = models.CharField(
        max_length=255,
        help_text="Название метода (например, 'Метод решения задач на равномерное и неравномерное движение')"
    )
    description = models.TextField(
        blank=True,
        help_text="Общее описание метода"
    )

    class Meta:
        verbose_name = "Метод решения"
        verbose_name_plural = "Методы решения"

    def __str__(self):
        return self.title


class SolutionStep(models.Model):
    """Шаг метода решения"""
    method = models.ForeignKey(
        SolutionMethod, on_delete=models.CASCADE, related_name="steps"
    )
    order = models.PositiveIntegerField(help_text="Порядковый номер шага (1-10)")
    title = models.CharField(
        max_length=255,
        help_text="Краткое название действия"
    )
    description = models.TextField(
        blank=True,
        help_text="Подробное описание действия"
    )
    hint = models.TextField(
        blank=True,
        help_text="Подсказка ученику"
    )
    hide_title_in_composition = models.BooleanField(
        default=False,
        help_text="Скрыть название в этапе составления метода (ученик должен его заполнить)"
    )

    class Meta:
        verbose_name = "Шаг метода"
        verbose_name_plural = "Шаги метода"
        ordering = ["method", "order"]
        unique_together = ["method", "order"]

    def __str__(self):
        return f"{self.order}. {self.title}"


# =============================================================================
# 6. ЗАДАЧИ
# =============================================================================

class Task(models.Model):
    """Задача на применение СК"""
    DIFFICULTY_CHOICES = [
        (1, "Очень лёгкая"),
        (2, "Лёгкая"),
        (3, "Средняя"),
        (4, "Сложная"),
        (5, "Очень сложная"),
    ]

    ks = models.ForeignKey(
        KnowledgeSystem, on_delete=models.CASCADE, related_name="tasks"
    )
    order = models.PositiveIntegerField(default=1, help_text="Порядок в списке")
    title = models.CharField(max_length=255, help_text="Краткое название задачи")
    text = models.TextField(help_text="Полный текст условия задачи")
    
    # Правильный ответ
    correct_answer = models.FloatField(
        null=True, blank=True,
        help_text="Числовой правильный ответ"
    )
    answer_unit = models.CharField(
        max_length=50, blank=True,
        help_text="Единица измерения (м/с, км, с, ...)"
    )
    answer_tolerance = models.FloatField(
        default=1.0,
        help_text="Допустимая погрешность в процентах"
    )
    
    # Альтернативный текстовый ответ (для нечисловых задач)
    correct_answer_text = models.CharField(
        max_length=255, blank=True,
        help_text="Текстовый правильный ответ (если не числовой)"
    )

    # Сложность
    difficulty = models.PositiveSmallIntegerField(
        choices=DIFFICULTY_CHOICES, default=3
    )

    # Эталонное решение
    solution_summary = models.TextField(
        blank=True,
        help_text="Краткое решение (формула + ответ)"
    )
    solution_detailed = models.TextField(
        blank=True,
        help_text="Развёрнутое решение"
    )
    solution_image = models.ImageField(
        upload_to="solutions/", blank=True, null=True,
        help_text="Изображение с решением"
    )

    class Meta:
        verbose_name = "Задача"
        verbose_name_plural = "Задачи"
        ordering = ["ks", "order"]

    def __str__(self):
        return f"{self.order}. {self.title}"

    def check_answer(self, student_answer: float) -> bool:
        """Проверка числового ответа с учётом погрешности"""
        if self.correct_answer is None:
            return False
        if self.correct_answer == 0:
            return abs(student_answer) < 0.0001
        tolerance = self.answer_tolerance / 100.0
        lower = self.correct_answer * (1 - tolerance)
        upper = self.correct_answer * (1 + tolerance)
        return lower <= student_answer <= upper


class TaskSolutionStep(models.Model):
    """Эталонное решение задачи по шагам (для пооперационного контроля)"""
    STEP_TYPE_CHOICES = [
        ("text", "Текстовый ответ"),
        ("text_pick", "Выбор ответа из текста"),
        ("symbol", "Обозначение величины (Дано)"),
        ("boolean", "Ответ да/нет"),
        ("solution", "Блок решения (формула, СИ, расчёт, оценка)"),
        ("schema", "Схема (рисование)"),
    ]
    
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="solution_steps"
    )
    step = models.ForeignKey(
        SolutionStep, on_delete=models.CASCADE, related_name="task_solutions"
    )
    
    # Тип шага: текст или схема
    step_type = models.CharField(
        max_length=10,
        choices=STEP_TYPE_CHOICES,
        default="text",
        help_text="Тип шага: текстовый ответ или рисование схемы"
    )
    
    # Текстовое содержание (для step_type="text")
    content = models.TextField(
        blank=True,
        help_text="Результат выполнения этого шага для данной задачи (текст)"
    )
    
    # Данные схемы (для step_type="schema")
    schema_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="JSON с данными схемы (элементы, позиции и т.д.)"
    )
    
    # Изображение (для обоих типов, но для схемы - это превью)
    image = models.ImageField(
        upload_to="task_steps/", blank=True, null=True,
        help_text="Изображение (схема, график) для этого шага"
    )

    class Meta:
        verbose_name = "Шаг решения задачи"
        verbose_name_plural = "Шаги решения задач"
        ordering = ["task", "step__order"]
        unique_together = ["task", "step"]

    def __str__(self):
        return f"{self.task.title} — Шаг {self.step.order}"


# =============================================================================
# 7. РЕДАКТОР СХЕМ
# =============================================================================

class SchemaElementCategory(models.Model):
    """
    Категория элементов схемы для удобной классификации.
    Учитель может добавлять свои категории.
    """
    name = models.CharField(max_length=100, help_text="Название категории")
    slug = models.SlugField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Emoji или иконка")
    order = models.PositiveIntegerField(default=0)
    is_system = models.BooleanField(
        default=False,
        help_text="Системная категория (нельзя удалить)"
    )

    class Meta:
        verbose_name = "Категория элементов"
        verbose_name_plural = "Категории элементов"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class SchemaElement(models.Model):
    """
    Элемент для построения схем.
    Содержит SVG-код для отображения на холсте.
    Учитель может добавлять свои элементы.
    """
    category = models.ForeignKey(
        SchemaElementCategory, on_delete=models.CASCADE, 
        related_name="elements", null=True, blank=True
    )
    name = models.CharField(max_length=100, help_text="Название элемента")
    description = models.TextField(blank=True, help_text="Описание для подсказки")
    
    # SVG для отображения
    svg_icon = models.TextField(
        blank=True,
        help_text="SVG-код иконки для палитры (маленький, ~24x24)"
    )
    svg_template = models.TextField(
        blank=True,
        help_text="SVG-код для отрисовки на холсте"
    )
    
    # Свойства по умолчанию
    default_props = models.JSONField(
        default=dict, blank=True,
        help_text="Свойства: {color, strokeWidth, fontSize, ...}"
    )
    
    # Настраиваемые свойства (какие поля показывать в редакторе)
    editable_props = models.JSONField(
        default=list, blank=True,
        help_text="Список редактируемых свойств: ['color', 'label', 'size']"
    )
    
    # Метаданные
    is_system = models.BooleanField(
        default=False,
        help_text="Системный элемент (нельзя удалить/изменить)"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="created_schema_elements"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Для поиска и фильтрации
    tags = models.CharField(
        max_length=255, blank=True,
        help_text="Теги через запятую: скорость, механика, вектор"
    )
    
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Элемент схемы"
        verbose_name_plural = "Элементы схем"
        ordering = ["category__order", "order", "name"]

    def __str__(self):
        cat = self.category.name if self.category else "Без категории"
        return f"{self.name} ({cat})"


class SchemaTemplate(models.Model):
    """
    Шаблон/эталон схемы для задачи.
    Учитель создаёт эталонную схему, ученик — свою версию.
    """
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="schema_templates"
    )
    name = models.CharField(max_length=100, help_text="Название шаблона")
    
    # Тип шаблона
    TEMPLATE_TYPE_CHOICES = [
        ("reference", "Эталонная схема"),
        ("starter", "Начальная заготовка"),
        ("hint", "Подсказка"),
    ]
    template_type = models.CharField(
        max_length=20, choices=TEMPLATE_TYPE_CHOICES, default="reference"
    )
    
    # Данные схемы
    data = models.JSONField(
        default=dict,
        help_text="JSON: {width, height, elements: [{type, x, y, props, ...}]}"
    )
    
    # Превью
    preview_image = models.ImageField(
        upload_to="schema_previews/", blank=True, null=True,
        help_text="Автогенерируемое превью схемы"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        verbose_name = "Шаблон схемы"
        verbose_name_plural = "Шаблоны схем"

    def __str__(self):
        return f"{self.name} ({self.get_template_type_display()})"


class StudentSchema(models.Model):
    """
    Схема, созданная учеником при решении задачи.
    Сохраняется для анализа и ML.
    """
    task_attempt = models.ForeignKey(
        'TaskAttempt', on_delete=models.CASCADE, related_name="schemas"
    )
    step = models.ForeignKey(
        'SolutionStep', on_delete=models.SET_NULL, 
        null=True, blank=True, related_name="student_schemas",
        help_text="К какому шагу метода относится схема"
    )
    
    # Данные схемы
    data = models.JSONField(
        default=dict,
        help_text="JSON схемы ученика"
    )
    
    # Результат проверки
    similarity_score = models.FloatField(
        null=True, blank=True,
        help_text="Оценка похожести на эталон (0-1)"
    )
    is_correct = models.BooleanField(null=True, blank=True)
    feedback = models.TextField(blank=True, help_text="Обратная связь")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Схема ученика"
        verbose_name_plural = "Схемы учеников"

    def __str__(self):
        return f"Схема ученика для {self.task_attempt}"


# =============================================================================
# 8. СЕССИЯ ОБУЧЕНИЯ
# =============================================================================

class LearningSession(models.Model):
    """Сессия работы ученика с СК"""
    STAGE_CHOICES = [
        ("comprehension", "Осмысление СК"),
        ("typical_task", "Формулировка типовой задачи"),
        ("task_preview", "Ознакомление с заданием"),
        ("learning_path_choice", "Выбор порядка работы"),
        ("task_list", "Список задач"),
        ("difficulty_assessment", "Оценка трудности"),
        ("solving_easy", "Решение (вариант Лёгкое)"),
        ("solving_medium", "Решение (вариант Непростое)"),
        ("solving_hard", "Решение (вариант Трудное)"),
        ("method_composition", "Составление метода"),
        ("step_by_step", "Пооперационный контроль"),
        ("verbalization", "Проговаривание метода"),
        ("compact_solving", "Свёрнутое решение"),
        ("diagnostic", "Диагностическая работа"),
        ("completed", "Завершено"),
    ]

    DIFFICULTY_CHOICES = [
        ("easy", "Лёгкое"),
        ("medium", "Непростое"),
        ("hard", "Трудное"),
    ]

    LEARNING_PATH_CHOICES = [
        ("self_solve", "Попробую решить самостоятельно"),
        ("review_example", "Хорошо бы сначала разобрать пример"),
        ("discuss_and_review", "Нужно обсудить способ решения и разобрать пример"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning_sessions"
    )
    ks = models.ForeignKey(
        KnowledgeSystem, on_delete=models.CASCADE, related_name="sessions"
    )
    
    # Прогресс
    current_stage = models.CharField(
        max_length=30, choices=STAGE_CHOICES, default="comprehension"
    )
    difficulty_choice = models.CharField(
        max_length=10, choices=DIFFICULTY_CHOICES, blank=True,
        help_text="Выбор ученика: насколько трудным показалось задание"
    )
    learning_path = models.CharField(
        max_length=30, choices=LEARNING_PATH_CHOICES, blank=True,
        help_text="Выбранный порядок работы: самостоятельно / разобрать пример / обсудить и разобрать"
    )
    current_task_index = models.PositiveIntegerField(
        default=0,
        help_text="Индекс текущей задачи в последовательности (0-based)"
    )
    target_tasks_count = models.PositiveIntegerField(
        default=5,
        help_text="Целевое количество задач для решения в этой сессии"
    )
    
    # Типовая задача — выбранный вариант
    typical_task_option = models.ForeignKey(
        "TypicalTaskOption", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sessions",
        help_text="Выбранный учеником вариант типовой задачи"
    )
    typical_task_correct = models.BooleanField(
        null=True, blank=True,
        help_text="Правильно ли ученик выбрал типовую задачу"
    )
    typical_task_formulation = models.TextField(
        blank=True,
        help_text="(устаревшее) Формулировка типовой задачи, введенная учеником"
    )
    
    # Статистика
    comprehension_passed = models.BooleanField(default=False)
    comprehension_score = models.FloatField(default=0)
    tasks_solved_count = models.PositiveIntegerField(default=0)
    tasks_correct_count = models.PositiveIntegerField(default=0)
    wrong_attempts_in_row = models.PositiveIntegerField(
        default=0,
        help_text="Количество неправильных ответов подряд"
    )
    scenario_two_errors_used = models.BooleanField(
        default=False,
        help_text="Сценарий «2 ошибки» (cloze алгоритма) уже показывали в этой сессии",
    )
    step_by_step_completions = models.PositiveIntegerField(
        default=0,
        help_text="Сколько раз ученик успешно завершил пооперационный контроль",
    )
    step_error_history = models.JSONField(
        default=dict,
        blank=True,
        help_text="История ошибок по шагам: {step_order: error_count}",
    )
    
    # Итог
    score_percent = models.FloatField(default=0)
    passed = models.BooleanField(default=False)
    teacher_final_mark = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Отметка учителя 2–5 за итоговую задачу после проверки",
    )
    mastery_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Итоговый %% усвоения (автоматика + отметка + активность); до проверки — null",
    )
    
    # Время
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Сессия обучения"
        verbose_name_plural = "Сессии обучения"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user.username} — {self.ks.title} ({self.get_current_stage_display()})"


# =============================================================================
# 9. ПОПЫТКИ РЕШЕНИЯ
# =============================================================================

class TaskAttempt(models.Model):
    """Попытка решения задачи"""
    RATING_CHOICES = [
        (1, "Очень легко"),
        (2, "Легко"),
        (3, "Средне"),
        (4, "Сложно"),
        (5, "Очень сложно"),
    ]

    session = models.ForeignKey(
        LearningSession, on_delete=models.CASCADE, related_name="task_attempts"
    )
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="attempts"
    )
    
    # Ответ ученика
    answer_numeric = models.FloatField(null=True, blank=True)
    answer_text = models.CharField(max_length=255, blank=True)
    answer_image = models.ImageField(
        upload_to="student_solutions/", blank=True, null=True,
        help_text="Фото решения ученика"
    )
    
    # Схема ученика (JSON)
    schema_data = models.JSONField(
        default=dict, blank=True,
        help_text="Схема, нарисованная учеником"
    )
    
    # Результат
    is_correct = models.BooleanField(null=True)
    feedback = models.TextField(blank=True, help_text="Обратная связь системы")

    TEACHER_REVIEW_STATUS_CHOICES = [
        ("", "Не требуется"),
        ("pending", "Ожидает проверки"),
        ("accepted", "Принято"),
        ("rejected", "На доработку"),
    ]
    teacher_review_status = models.CharField(
        max_length=16,
        choices=TEACHER_REVIEW_STATUS_CHOICES,
        default="",
        blank=True,
        help_text="Для итоговой задачи: статус проверки учителем",
    )
    teacher_comment = models.TextField(blank=True)
    teacher_grade_2_5 = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Выставленная учителем отметка 2–5 за эту попытку",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_task_attempts",
    )
    
    # Оценка сложности учеником
    difficulty_rating = models.PositiveSmallIntegerField(
        choices=RATING_CHOICES, null=True, blank=True
    )
    
    # Время
    created_at = models.DateTimeField(auto_now_add=True)
    time_spent_seconds = models.PositiveIntegerField(
        default=0, help_text="Время на решение в секундах"
    )

    class Meta:
        verbose_name = "Попытка решения"
        verbose_name_plural = "Попытки решения"
        ordering = ["-created_at"]

    def __str__(self):
        status = "✓" if self.is_correct else "✗" if self.is_correct is False else "?"
        return f"{status} {self.task.title} — {self.session.user.username}"


class TaskAttemptImage(models.Model):
    """Фото к ответу на задачу (одно или несколько снимков тетради)."""

    attempt = models.ForeignKey(
        TaskAttempt, on_delete=models.CASCADE, related_name="answer_images"
    )
    image = models.ImageField(upload_to="student_solutions/")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Фото к ответу"
        verbose_name_plural = "Фото к ответам"

    def __str__(self):
        return f"Фото к попытке {self.attempt_id} (#{self.order})"


class StepAttempt(models.Model):
    """Попытка выполнения шага (для пооперационного контроля)"""
    task_attempt = models.ForeignKey(
        TaskAttempt, on_delete=models.CASCADE, related_name="step_attempts"
    )
    step = models.ForeignKey(
        SolutionStep, on_delete=models.CASCADE, related_name="attempts"
    )
    
    # Ответ ученика на этом шаге
    student_answer = models.TextField(blank=True)
    student_image = models.ImageField(
        upload_to="step_attempts/", blank=True, null=True
    )
    
    # Результат проверки
    is_correct = models.BooleanField(
        null=True, blank=True,
        help_text="Результат автоматической проверки (null = не проверено или выбор варианта)"
    )
    
    # Выбрал ли ученик вариант системы
    chose_system_variant = models.BooleanField(
        default=False,
        help_text="Ученик выбрал эталонный вариант вместо своего"
    )
    
    # Финальный вариант (после выбора ученика)
    final_answer = models.TextField(
        blank=True,
        help_text="Финальный вариант ответа (после выбора ученика)"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Попытка по шагу"
        verbose_name_plural = "Попытки по шагам"
        ordering = ["task_attempt", "step__order"]

    def __str__(self):
        return f"Шаг {self.step.order} — {self.task_attempt}"


# =============================================================================
# 10. ЛОГИРОВАНИЕ
# =============================================================================

class EventLog(models.Model):
    """Лог событий для аналитики"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
        null=True, blank=True
    )
    session = models.ForeignKey(
        LearningSession, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="events"
    )
    event = models.CharField(max_length=60)
    payload = models.JSONField(default=dict)
    ts = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Событие"
        verbose_name_plural = "События"
        ordering = ["-ts"]

    def __str__(self):
        return f"{self.event} @ {self.ts}"
