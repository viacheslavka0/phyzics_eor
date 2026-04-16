# Листинг кода проекта EORA - Адаптивная обучающая платформа

## Описание проекта

EORA - это современная адаптивная обучающая платформа для изучения физики, построенная на Django (backend) и React (frontend). Система реализует методику обучения через "Системы знаний" с интерактивными схемами, задачами и адаптивными алгоритмами.

## Архитектура проекта

```
eora/
├── eora/                    # Django проект
│   ├── settings.py         # Настройки Django
│   ├── urls.py            # URL маршруты
│   └── wsgi.py            # WSGI конфигурация
├── learning/              # Основное приложение
│   ├── models.py          # Модели данных
│   ├── views.py           # API представления
│   ├── serializers.py     # DRF сериализаторы
│   └── admin.py           # Админ панель
├── analytics/             # Приложение аналитики
├── ui/                    # React фронтенд
│   └── src/
│       ├── App.jsx        # Главный компонент ученика
│       ├── TeacherApp.jsx # Интерфейс учителя
│       └── components/    # React компоненты
└── static/               # Статические файлы
```

---

## 1. BACKEND - Django Models (learning/models.py)

### 1.1 Учебная иерархия

```python
# =============================================================================
# 1. УЧЕБНАЯ ИЕРАРХИЯ - Структура курса физики
# =============================================================================

class SchoolClass(models.Model):
    """
    Класс обучения (7, 8, 9 класс)
    Верхний уровень иерархии курса
    """
    number = models.PositiveSmallIntegerField(unique=True)  # Номер класса: 7, 8, 9
    title = models.CharField(max_length=50)                 # Название: "7 класс"

    class Meta:
        verbose_name = "Класс"
        verbose_name_plural = "Классы"
        ordering = ["number"]                               # Сортировка по номеру класса

    def __str__(self):
        return self.title


class SubjectSection(models.Model):
    """
    Раздел предмета (например, 'Механические явления')
    Второй уровень иерархии - тематические разделы
    """
    school_class = models.ForeignKey(
        SchoolClass, 
        on_delete=models.CASCADE, 
        related_name="sections"                             # Связь один-ко-многим с классом
    )
    title = models.CharField(max_length=200)               # Название раздела
    order = models.PositiveIntegerField(default=1)         # Порядок отображения

    class Meta:
        verbose_name = "Раздел"
        verbose_name_plural = "Разделы"
        ordering = ["school_class__number", "order"]       # Сортировка по классу и порядку

    def __str__(self):
        return f"{self.school_class}: {self.title}"


class Topic(models.Model):
    """
    Тема (например, 'Равномерное и неравномерное движение')
    Третий уровень иерархии - конкретные темы уроков
    """
    section = models.ForeignKey(
        SubjectSection, 
        on_delete=models.CASCADE, 
        related_name="topics"                               # Связь с разделом
    )
    title = models.CharField(max_length=255)               # Название темы
    order = models.PositiveIntegerField(default=1)         # Порядок в разделе

    class Meta:
        verbose_name = "Тема"
        verbose_name_plural = "Темы"
        ordering = ["section__order", "order"]             # Сортировка по разделу и порядку

    def __str__(self):
        return self.title
```

### 1.2 Система знаний - ядро платформы

```python
# =============================================================================
# 2. СИСТЕМА ЗНАНИЙ (СК) - Центральный элемент обучения
# =============================================================================

class KnowledgeSystem(models.Model):
    """
    Система знаний — ядро обучения.
    Содержит изображение-таблицу, вопросы для осмысления, метод решения, задачи.
    
    Каждая СК представляет собой законченный учебный блок с:
    - Таблицей знаний (изображение)
    - Интерактивными зонами для осмысления
    - Типовыми задачами
    - Методом решения задач
    """
    
    STATUS_CHOICES = [
        ("draft", "Черновик"),                             # В разработке
        ("published", "Опубликовано"),                     # Доступна ученикам
    ]

    # Связь с темой курса
    topic = models.ForeignKey(
        Topic, 
        on_delete=models.CASCADE, 
        related_name="knowledge_systems"
    )
    
    # Основная информация
    title = models.CharField(max_length=255)               # Название СК
    description = models.TextField(
        blank=True,
        help_text="Описание СК для ученика"
    )
    
    # Изображения системы знаний
    image = models.ImageField(
        upload_to="ks/",                                   # Основное изображение
        blank=True, null=True,
        help_text="Основное изображение Системы Знаний"
    )
    comprehension_image = models.ImageField(
        upload_to="ks/comprehension/",                     # Изображение для осмысления
        blank=True, null=True,
        help_text="Изображение таблицы для этапа осмысления (с зонами)"
    )
    
    # Настройки осмысления
    show_zones_by_default = models.BooleanField(
        default=True,
        help_text="Показывать зоны по умолчанию"
    )
    comprehension_pass_threshold = models.PositiveIntegerField(
        default=85,                                        # Порог прохождения 85%
        help_text="Минимальный процент правильных ответов для прохождения осмысления"
    )

    # Формулировка типовой задачи
    typical_task_title = models.CharField(
        max_length=255, blank=True,
        help_text="Название типа задач (например, 'Найти значения физических величин')"
    )
    typical_task_description = models.TextField(
        blank=True,
        help_text="Описание: с какой целью и в каких ситуациях применяется СК"
    )

    # Метаданные
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
    version = models.PositiveIntegerField(default=1)       # Версионирование СК
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Система знаний"
        verbose_name_plural = "Системы знаний"
        ordering = ["-created_at"]                         # Новые первыми

    def __str__(self):
        return f"{self.title} v{self.version} ({self.get_status_display()})"
```

### 1.3 Интерактивные зоны и вопросы

```python
# =============================================================================
# 3. ЗОНЫ И ВОПРОСЫ ДЛЯ ОСМЫСЛЕНИЯ СК
# =============================================================================

class KSZone(models.Model):
    """
    Прямоугольная зона на изображении СК для интерактивного взаимодействия.
    Ученик может кликать на зоны, отвечая на вопросы осмысления.
    """
    ks = models.ForeignKey(
        KnowledgeSystem, 
        on_delete=models.CASCADE, 
        related_name="zones"
    )
    
    # Координаты и размеры зоны на изображении
    x = models.PositiveIntegerField()                      # Левый верхний угол X
    y = models.PositiveIntegerField()                      # Левый верхний угол Y  
    width = models.PositiveIntegerField()                  # Ширина зоны
    height = models.PositiveIntegerField()                 # Высота зоны
    label = models.CharField(
        max_length=100, blank=True, 
        help_text="Метка зоны (для админки)"
    )

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
        ("text", "Открытый ответ"),                        # Ввод текста
        ("single", "Выбор одного варианта"),               # Радиокнопки
        ("multiple", "Множественный выбор"),               # Чекбоксы
        ("match", "Соответствие (выбор зон)"),             # Клики по зонам
    ]
    
    ks = models.ForeignKey(
        KnowledgeSystem, 
        on_delete=models.CASCADE, 
        related_name="questions"
    )
    type = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default="single",
        help_text="Тип вопроса"
    )
    text = models.TextField(help_text="Формулировка вопроса")
    order = models.PositiveIntegerField(default=1)         # Порядок вопроса
    
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
        Метод адаптируется к типу вопроса и формату ответа.
        
        Args:
            answer: str (для text), int (для single), 
                   list[int] (для multiple), list[int] (для match — ID зон)
        
        Returns:
            bool: True если ответ правильный
        """
        if self.type == "text":
            if self.fuzzy_match:
                # Нечеткое сравнение - игнорируем регистр и лишние пробелы
                return self._normalize(answer) == self._normalize(self.correct_answer_text)
            return answer.strip() == self.correct_answer_text.strip()
        
        elif self.type == "single":
            # Проверка выбора одного варианта
            if not self.options or not isinstance(answer, int):
                return False
            if 0 <= answer < len(self.options):
                return self.options[answer].get("is_correct", False)
            return False
        
        elif self.type == "multiple":
            # Проверка множественного выбора - все правильные варианты должны быть выбраны
            if not self.options or not isinstance(answer, list):
                return False
            correct_indices = {i for i, opt in enumerate(self.options) if opt.get("is_correct")}
            return set(answer) == correct_indices
        
        elif self.type == "match":
            # Проверка соответствия зон - правильные зоны должны быть выбраны
            correct_ids = set(self.correct_zones.values_list("id", flat=True))
            return set(answer) == correct_ids
        
        return False
    
    def _normalize(self, text):
        """Нормализация текста для нечёткого сравнения"""
        import re
        return re.sub(r'\s+', ' ', text.lower().strip())
```

### 1.4 Тексты с пропусками (Cloze)

```python
# =============================================================================
# 4. CLOZE (ТЕКСТ С ПРОПУСКАМИ) - Интерактивное заполнение
# =============================================================================

class KSCloze(models.Model):
    """
    Текст с пропусками для осмысления Системы Знаний.
    Учитель создает текст, выделяет слова — они становятся пропусками.
    Ученик заполняет пропуски из банка слов.
    """
    ks = models.ForeignKey(
        KnowledgeSystem, 
        on_delete=models.CASCADE, 
        related_name="clozes"
    )
    
    # Тексты
    original_text = models.TextField(
        blank=True, default="",
        help_text="Исходный текст до разметки пропусков"
    )
    marked_text = models.TextField(
        blank=True, default="",
        help_text='Текст с маркерами {{0}}, {{1}}, ... для пропусков'
    )
    
    # Пропуски в JSON формате
    blanks = models.JSONField(
        default=list,
        help_text='Пропуски: [{"position": 0, "correct": "слово"}, ...]'
    )
    
    # Слова-отвлекатели для усложнения задания
    distractors = models.JSONField(
        default=list,
        help_text='Слова-отвлекатели: ["неверное1", "неверное2", ...]'
    )
    
    order = models.PositiveIntegerField(default=1)         # Порядок в СК

    class Meta:
        verbose_name = "Текст с пропусками"
        verbose_name_plural = "Тексты с пропусками"
        ordering = ["ks", "order"]

    def __str__(self):
        return f"Cloze #{self.order} для {self.ks.title}"
    
    def get_all_options(self):
        """
        Получить все варианты (правильные + отвлекатели) в случайном порядке.
        Создает банк слов для выбора учеником.
        """
        import random
        correct_words = [b["correct"] for b in self.blanks]    # Правильные слова
        all_options = list(set(correct_words + self.distractors))  # Убираем дубли
        random.shuffle(all_options)                            # Перемешиваем
        return all_options
    
    def check_answers(self, answers):
        """
        Проверка ответов ученика на все пропуски.
        
        Args:
            answers: dict {position: "выбранное_слово", ...}
        
        Returns:
            dict: {"correct": [позиции], "wrong": [позиции], "score": 0.66}
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
```

### 1.5 Методы решения задач

```python
# =============================================================================
# 5. МЕТОД РЕШЕНИЯ - Алгоритм решения задач
# =============================================================================

class SolutionMethod(models.Model):
    """
    Метод решения задач для СК (общий алгоритм из 10 шагов).
    Определяет пошаговую методику решения задач данного типа.
    """
    ks = models.OneToOneField(
        KnowledgeSystem, 
        on_delete=models.CASCADE, 
        related_name="solution_method"
    )
    title = models.CharField(
        max_length=255,
        help_text="Название метода (например, 'Метод решения задач на РиНД')"
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
    """
    Шаг метода решения.
    Каждый метод состоит из упорядоченных шагов (обычно 10).
    """
    method = models.ForeignKey(
        SolutionMethod, 
        on_delete=models.CASCADE, 
        related_name="steps"
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
    
    # Для этапа "составление метода" - ученик должен заполнить название
    hide_title_in_composition = models.BooleanField(
        default=False,
        help_text="Скрыть название в этапе составления метода (ученик должен его заполнить)"
    )

    class Meta:
        verbose_name = "Шаг метода"
        verbose_name_plural = "Шаги метода"
        ordering = ["method", "order"]
        unique_together = ["method", "order"]              # Уникальность порядка в методе

    def __str__(self):
        return f"{self.order}. {self.title}"
```

### 1.6 Задачи

```python
# =============================================================================
# 6. ЗАДАЧИ - Практические задания
# =============================================================================

class Task(models.Model):
    """
    Задача на применение СК.
    Содержит условие, правильный ответ, эталонное решение.
    """
    
    DIFFICULTY_CHOICES = [
        (1, "Очень лёгкая"),
        (2, "Лёгкая"), 
        (3, "Средняя"),
        (4, "Сложная"),
        (5, "Очень сложная"),
    ]

    ks = models.ForeignKey(
        KnowledgeSystem, 
        on_delete=models.CASCADE, 
        related_name="tasks"
    )
    order = models.PositiveIntegerField(default=1, help_text="Порядок в списке")
    title = models.CharField(max_length=255, help_text="Краткое название задачи")
    text = models.TextField(help_text="Полный текст условия задачи")
    
    # Правильный численный ответ
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
    
    # Альтернативный текстовый ответ
    correct_answer_text = models.CharField(
        max_length=255, blank=True,
        help_text="Текстовый правильный ответ (если не числовой)"
    )

    # Сложность задачи
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
        """
        Проверка числового ответа с учётом погрешности.
        Учитывает допустимую погрешность для физических задач.
        """
        if self.correct_answer is None:
            return False
        if self.correct_answer == 0:
            return abs(student_answer) < 0.0001            # Для нулевых значений
        
        # Проверка с учетом процентной погрешности
        tolerance = self.answer_tolerance / 100.0
        lower = self.correct_answer * (1 - tolerance)
        upper = self.correct_answer * (1 + tolerance)
        return lower <= student_answer <= upper
```

### 1.7 Сессии обучения и прогресс

```python
# =============================================================================
# 8. СЕССИЯ ОБУЧЕНИЯ - Прогресс ученика
# =============================================================================

class LearningSession(models.Model):
    """
    Сессия работы ученика с СК.
    Отслеживает прогресс по этапам адаптивного алгоритма.
    """
    
    STAGE_CHOICES = [
        ("comprehension", "Осмысление СК"),                 # Изучение таблицы знаний
        ("typical_task", "Формулировка типовой задачи"),    # Понимание типа задач
        ("task_list", "Список задач"),                      # Просмотр задач
        ("difficulty_assessment", "Оценка трудности"),      # Субъективная оценка
        ("solving_easy", "Решение (вариант Лёгкое)"),       # Простое решение
        ("solving_medium", "Решение (вариант Непростое)"),  # Среднее решение
        ("solving_hard", "Решение (вариант Трудное)"),      # Сложное решение
        ("method_composition", "Составление метода"),        # Создание алгоритма
        ("step_by_step", "Пооперационный контроль"),        # Решение по шагам
        ("verbalization", "Проговаривание метода"),         # Объяснение алгоритма
        ("compact_solving", "Свёрнутое решение"),           # Быстрое решение
        ("diagnostic", "Диагностическая работа"),           # Итоговый контроль
        ("completed", "Завершено"),                         # Успешное завершение
    ]

    DIFFICULTY_CHOICES = [
        ("easy", "Лёгкое"),                                # Ученик считает легким
        ("medium", "Непростое"),                           # Средняя сложность
        ("hard", "Трудное"),                               # Высокая сложность
    ]

    # Связи
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="learning_sessions"
    )
    ks = models.ForeignKey(
        KnowledgeSystem, 
        on_delete=models.CASCADE, 
        related_name="sessions"
    )
    
    # Состояние прогресса
    current_stage = models.CharField(
        max_length=30, choices=STAGE_CHOICES, default="comprehension"
    )
    difficulty_choice = models.CharField(
        max_length=10, choices=DIFFICULTY_CHOICES, blank=True,
        help_text="Выбор ученика: насколько трудным показалось задание"
    )
    
    # Статистика прохождения
    comprehension_passed = models.BooleanField(default=False)  # Прошел ли осмысление
    comprehension_score = models.FloatField(default=0)         # Процент в осмыслении
    tasks_solved_count = models.PositiveIntegerField(default=0)    # Всего задач решено
    tasks_correct_count = models.PositiveIntegerField(default=0)   # Правильно решено
    wrong_attempts_in_row = models.PositiveIntegerField(
        default=0,
        help_text="Количество неправильных ответов подряд"       # Для адаптации
    )
    
    # Итоговый результат
    score_percent = models.FloatField(default=0)               # Общий процент
    passed = models.BooleanField(default=False)                # Успешно завершено
    
    # Временные метки
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Сессия обучения"
        verbose_name_plural = "Сессии обучения"
        ordering = ["-started_at"]                             # Новые первыми

    def __str__(self):
        return f"{self.user.username} — {self.ks.title} ({self.get_current_stage_display()})"
```

---

## 2. BACKEND - Django Views и API (learning/views.py)

### 2.1 API для каталога курса

```python
# =============================================================================
# /api/catalog/ — дерево классов → разделы → темы
# =============================================================================

class CatalogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Каталог: иерархия классов, разделов и тем.
    Возвращает полную структуру курса для отображения в интерфейсе ученика.
    """
    queryset = SchoolClass.objects.prefetch_related(
        "sections__topics__knowledge_systems"              # Оптимизация запросов
    ).order_by("number")
    serializer_class = SchoolClassSerializer
    permission_classes = [permissions.IsAuthenticated]     # Только для авторизованных
```

### 2.2 API системы знаний

```python
# =============================================================================
# /api/ks/<id>/ — Система знаний
# =============================================================================

class KnowledgeSystemViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Детали Системы знаний с зонами, вопросами, задачами.
    Основной API для получения данных СК учеником.
    """
    queryset = KnowledgeSystem.objects.select_related("topic").prefetch_related(
        "zones",                                           # Интерактивные зоны
        "questions__correct_zones",                        # Вопросы с правильными зонами
        "clozes",                                         # Тексты с пропусками
        "tasks",                                          # Задачи СК
    )
    serializer_class = KnowledgeSystemDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=["post"])
    def check(self, request, pk=None):
        """
        POST /api/ks/<id>/check/
        Проверка ответов этапа "Осмысление СК".
        
        Принимает:
        - mappings: соответствия вопрос→зоны
        - cloze_answers: ответы на пропуски
        
        Возвращает:
        - passed: прошел ли этап
        - score_percent: процент правильных ответов
        - feedback: детальная обратная связь
        """
        ks: KnowledgeSystem = self.get_object()
        data = request.data or {}
        mappings = data.get("mappings", [])
        cloze_answers = data.get("cloze_answers", [])

        # --- Проверка соответствий (вопрос → набор зон)
        q_map_correct = {}
        total_mapping_items = 0
        
        for q in KSQuestion.objects.filter(ks=ks).prefetch_related("correct_zones"):
            total_mapping_items += 1
            qid = q.id
            correct_ids = set(q.correct_zones.values_list("id", flat=True))
            
            # Находим ответ ученика для этого вопроса
            chosen_ids = set()
            for item in mappings:
                if int(item.get("question_id", 0)) == qid:
                    chosen_ids = set(map(int, item.get("selected_zone_ids", [])))
                    break
            
            q_map_correct[qid] = (chosen_ids == correct_ids)

        # --- Проверка cloze (тексты с пропусками)
        gap_map = {}  # "cloze_id:position" -> correct_word
        for cl in KSCloze.objects.filter(ks=ks):
            for blank in cl.blanks:
                position = blank.get("position", 0)
                correct_word = blank.get("correct", "").strip().lower()
                gap_key = f"{cl.id}:{position}"
                gap_map[gap_key] = correct_word

        cloze_correct = {}
        total_cloze_items = 0
        
        for ans in cloze_answers:
            gap_id = str(ans.get("gap_id", ""))
            student_answer = str(ans.get("answer", "")).strip().lower()
            
            if gap_id in gap_map:
                total_cloze_items += 1
                correct_word = gap_map[gap_id]
                cloze_correct[gap_id] = (student_answer == correct_word)

        # --- Подсчёт итогового процента
        total_items = total_mapping_items + total_cloze_items
        correct_items = (
            sum(1 for ok in q_map_correct.values() if ok) +
            sum(1 for ok in cloze_correct.values() if ok)
        )
        
        if total_items == 0:
            score_percent = 100.0                          # Если нет вопросов
            passed = True
        else:
            score_percent = round((correct_items / total_items) * 100, 2)
            passed = score_percent >= 80.0                 # Порог прохождения 80%

        # --- Сохраняем/обновляем сессию ученика
        session, created = LearningSession.objects.get_or_create(
            user=request.user,
            ks=ks,
            finished_at__isnull=True,                      # Только незавершенные
            defaults={"current_stage": "comprehension"}
        )
        
        session.comprehension_score = score_percent
        session.comprehension_passed = passed
        if passed:
            session.current_stage = "typical_task"         # Переход к следующему этапу
        session.save()

        # --- Логирование для аналитики
        EventLog.objects.create(
            user=request.user,
            session=session,
            event="comprehension_check",
            payload={
                "ks_id": ks.id,
                "score_percent": score_percent,
                "passed": passed,
                "mappings": mappings,
                "cloze_answers": cloze_answers,
            },
        )

        # --- Формирование ответа
        mapping_feedback = [
            {"question_id": qid, "ok": ok} 
            for qid, ok in q_map_correct.items()
        ]
        cloze_feedback = [
            {"gap_id": gid, "ok": ok} 
            for gid, ok in cloze_correct.items()
        ]

        return Response({
            "passed": passed,
            "score_percent": score_percent,
            "mapping_feedback": mapping_feedback,
            "cloze_feedback": cloze_feedback,
            "next_stage": "typical_task" if passed else "comprehension",
            "session_id": session.id,
        }, status=status.HTTP_200_OK)
```

### 2.3 API работы с задачами

```python
# =============================================================================
# /api/task/<id>/ — Работа с задачами
# =============================================================================

class TaskViewSet(viewsets.GenericViewSet):
    """Работа с задачами - получение, отправка ответов"""
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """
        POST /api/task/<id>/submit/
        Отправить ответ на задачу.
        
        Обрабатывает:
        - Числовые и текстовые ответы
        - Проверку с учетом погрешности
        - Обновление статистики сессии
        - Адаптивные переходы между этапами
        """
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        session_id = request.data.get("session_id")
        answer_numeric = request.data.get("answer_numeric")
        answer_text = request.data.get("answer_text", "")
        time_spent = request.data.get("time_spent_seconds", 0)

        try:
            session = LearningSession.objects.get(pk=session_id, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        # Проверка ответа
        is_correct = None
        if answer_numeric is not None:
            try:
                answer_numeric = float(answer_numeric)
                if task.correct_answer is not None:
                    is_correct = task.check_answer(answer_numeric)  # Метод модели с погрешностью
                else:
                    is_correct = False
            except (ValueError, TypeError):
                is_correct = False
        elif answer_text and task.correct_answer_text:
            # Простое текстовое сравнение
            is_correct = answer_text.strip().lower() == task.correct_answer_text.strip().lower()

        # Сохраняем попытку решения
        attempt = TaskAttempt.objects.create(
            session=session,
            task=task,
            answer_numeric=answer_numeric,
            answer_text=answer_text,
            is_correct=is_correct,
            time_spent_seconds=time_spent,
        )

        # Обновляем статистику сессии
        session.tasks_solved_count += 1
        if is_correct:
            session.tasks_correct_count += 1
            session.wrong_attempts_in_row = 0              # Сброс счетчика ошибок
        else:
            session.wrong_attempts_in_row += 1
            
            # АДАПТИВНЫЙ АЛГОРИТМ: 2 ошибки подряд в "легком" → "непростое"
            if session.difficulty_choice == "easy" and session.wrong_attempts_in_row >= 2:
                session.current_stage = "method_composition"
                session.difficulty_choice = "medium"

        session.save()

        # Возвращаем результат с эталонным решением
        return Response({
            "is_correct": is_correct,
            "attempt_id": attempt.id,
            "tasks_solved_count": session.tasks_solved_count,
            "tasks_correct_count": session.tasks_correct_count,
            "wrong_attempts_in_row": session.wrong_attempts_in_row,
            "current_stage": session.current_stage,
            # Всегда показываем правильный ответ и решение
            "correct_answer": task.correct_answer,
            "answer_unit": task.answer_unit or "",
            "solution_summary": task.solution_summary or "",
            "solution_detailed": task.solution_detailed or "",
        }, status=status.HTTP_200_OK)
```

---

## 3. FRONTEND - React Application (ui/src/App.jsx)

### 3.1 Главный компонент приложения ученика

```jsx
/**
 * EORA Learning Platform - Student Interface
 * Современный интерфейс для изучения систем знаний
 * 
 * Основные возможности:
 * - Каталог системы знаний с иерархической структурой
 * - Адаптивный алгоритм обучения с 7 этапами
 * - Интерактивное осмысление с зонами и cloze
 * - Решение задач с автоматической проверкой
 * - Построение схем и моделей ситуации
 */

import React, { useEffect, useState, createContext, useContext, lazy, Suspense } from "react";

// Ленивая загрузка тяжелых компонентов для оптимизации
const SchemaEditor = lazy(() => import("./components/SchemaEditor"));
const ElementCreatorVisual = lazy(() => import("./components/ElementCreatorVisual"));

// ============================================================================
// КОНСТАНТЫ И УТИЛИТЫ
// ============================================================================

// Получение CSRF токена для Django
const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

// Этапы адаптивного алгоритма обучения
const STAGES = {
  comprehension: { label: "Осмысление СК", icon: "📖", order: 1 },
  typical_task: { label: "Типовая задача", icon: "🎯", order: 2 },
  task_list: { label: "Список задач", icon: "📋", order: 3 },
  difficulty_assessment: { label: "Оценка трудности", icon: "⚖️", order: 4 },
  solving_easy: { label: "Решение задач", icon: "✏️", order: 5 },
  solving_medium: { label: "Решение задач", icon: "✏️", order: 5 },
  solving_hard: { label: "Решение задач", icon: "✏️", order: 5 },
  method_composition: { label: "Метод решения", icon: "🧩", order: 5 },
  step_by_step: { label: "По шагам", icon: "👣", order: 6 },
  completed: { label: "Завершено", icon: "🎉", order: 7 },
};

// ============================================================================
// КОНТЕКСТ ПРИЛОЖЕНИЯ
// ============================================================================

const AppContext = createContext(null);

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppContext not found");
  return ctx;
}

// ============================================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================================

export default function App() {
  // Состояние приложения
  const [loading, setLoading] = useState(true);                // Загрузка данных
  const [error, setError] = useState("");                      // Ошибки
  const [catalog, setCatalog] = useState([]);                  // Каталог курса
  const [selectedKS, setSelectedKS] = useState(null);          // Выбранная СК
  const [ksData, setKsData] = useState(null);                  // Данные СК
  const [session, setSession] = useState(null);                // Сессия обучения
  const [view, setView] = useState("catalog");                 // Текущий вид: catalog | learning

  // Загрузка каталога при старте приложения
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/catalog/");
        if (!r.ok) throw new Error("Войдите в систему через /admin/");
        const data = await r.json();
        setCatalog(data);                                      // Иерархия классов→разделы→темы→СК
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Загрузка данных СК при выборе
  useEffect(() => {
    if (!selectedKS) return;
    
    (async () => {
      setLoading(true);
      try {
        // Загружаем полные данные СК
        const ksRes = await fetch(`/api/ks/${selectedKS}/`);
        const ksJson = await ksRes.json();
        setKsData(ksJson);

        // Получаем или создаём сессию обучения
        const sessRes = await fetch(`/api/session/current/?ks_id=${selectedKS}`);
        const sessJson = await sessRes.json();
        setSession(sessJson);
        
        // Показываем модальное окно с предыдущими результатами (если есть)
        if (sessJson.last_completed && sessJson.created && 
            sessJson.current_stage === "comprehension") {
          // Обработка в LearningView
        }
        
        setView("learning");                                   // Переходим к обучению
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKS]);

  // Возврат к каталогу
  const handleBackToCatalog = () => {
    setView("catalog");
    setSelectedKS(null);
    setKsData(null);
    setSession(null);
  };

  // Обновление сессии (для синхронизации состояния)
  const updateSession = async () => {
    if (!selectedKS) return;
    const res = await fetch(`/api/session/current/?ks_id=${selectedKS}`);
    const data = await res.json();
    setSession(data);
  };

  // Контекстное значение для дочерних компонентов
  const contextValue = {
    catalog,
    selectedKS,
    setSelectedKS,
    ksData,
    session,
    setSession,
    updateSession,
    handleBackToCatalog,
    error,
    setError,
  };

  // Обработка ошибок и загрузки
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Ошибка</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {view === "catalog" ? <CatalogView /> : <LearningView />}
      </div>
    </AppContext.Provider>
  );
}
```

### 3.2 Компонент каталога курса

```jsx
// ============================================================================
// КАТАЛОГ КУРСА - Иерархическое отображение
// ============================================================================

function CatalogView() {
  const { catalog, setSelectedKS } = useApp();
  const [expandedClass, setExpandedClass] = useState(null);     // Развернутый класс
  const [expandedSection, setExpandedSection] = useState(null); // Развернутый раздел

  // Компонент для стрелки раскрытия
  const ChevronIcon = ({ expanded, size = "md" }) => (
    <svg
      className={`${size === "sm" ? "w-3 h-3" : "w-4 h-4"} transition-transform ${
        expanded ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Заголовок */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">
          EORA - Адаптивное обучение физике
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Изучайте физику через системы знаний с персонализированным подходом
        </p>
      </div>

      {/* Список классов */}
      <div className="max-w-4xl mx-auto space-y-6">
        {catalog.map((schoolClass) => (
          <div key={schoolClass.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
            
            {/* Заголовок класса */}
            <button
              onClick={() => setExpandedClass(expandedClass === schoolClass.id ? null : schoolClass.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">{schoolClass.number}</span>
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-lg">{schoolClass.title}</h4>
                  <p className="text-sm text-slate-500">
                    {schoolClass.sections?.length || 0} разделов
                  </p>
                </div>
              </div>
              <ChevronIcon expanded={expandedClass === schoolClass.id} />
            </button>

            {/* Разделы класса */}
            {expandedClass === schoolClass.id && (
              <div className="border-t border-slate-100 bg-slate-50/50">
                {schoolClass.sections?.map((section) => (
                  <div key={section.id}>
                    <button
                      onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                      className="w-full px-6 py-3 pl-16 flex items-center justify-between hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📚</span>
                        <span className="font-medium">{section.title}</span>
                        <span className="badge-secondary text-xs">
                          {section.topics?.length || 0} тем
                        </span>
                      </div>
                      <ChevronIcon expanded={expandedSection === section.id} size="sm" />
                    </button>

                    {/* Темы раздела */}
                    {expandedSection === section.id && (
                      <div className="bg-white border-t border-slate-100">
                        {section.topics?.map((topic) => (
                          <div key={topic.id} className="pl-24 pr-6 py-3 border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm">📝</span>
                              <span className="text-sm font-medium text-slate-700">{topic.title}</span>
                            </div>
                            
                            {/* Системы знаний темы */}
                            <div className="grid gap-2">
                              {topic.knowledge_systems?.map((ks) => (
                                <button
                                  key={ks.id}
                                  onClick={() => setSelectedKS(ks.id)}
                                  className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg transition-all group"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                      <span className="text-white font-medium text-sm">СК</span>
                                    </div>
                                    <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700">
                                      {ks.title}
                                    </span>
                                  </div>
                                  <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Подвал */}
      <div className="text-center mt-16 text-slate-500">
        <p className="text-sm">
          Выберите систему знаний для начала обучения
        </p>
      </div>
    </div>
  );
}
```

### 3.3 Компонент обучения

```jsx
// ============================================================================
// ИНТЕРФЕЙС ОБУЧЕНИЯ - Адаптивные этапы
// ============================================================================

function LearningView() {
  const { ksData, session, handleBackToCatalog, updateSession } = useApp();
  const [showPreviousResults, setShowPreviousResults] = useState(false);

  // Показ модального окна с предыдущими результатами
  useEffect(() => {
    if (session?.last_completed && session?.created && 
        session?.current_stage === "comprehension") {
      setShowPreviousResults(true);
    }
  }, [session]);

  const handleStartNewSession = async () => {
    try {
      const response = await fetch(`/api/session/start_new/?ks_id=${ksData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        await updateSession();                             // Обновляем состояние
        setShowPreviousResults(false);
      }
    } catch (error) {
      console.error('Error starting new session:', error);
    }
  };

  const handleContinue = () => {
    setShowPreviousResults(false);
  };

  // Рендер текущего этапа обучения
  const renderCurrentStage = () => {
    if (!session?.current_stage) return null;

    switch (session.current_stage) {
      case "comprehension":
        return <ComprehensionStage />;                     // Осмысление СК
      case "typical_task": 
        return <TypicalTaskStage />;                       // Типовая задача
      case "task_list":
        return <TaskListStage />;                          // Список задач
      case "difficulty_assessment":
        return <DifficultyAssessmentStage />;              // Оценка трудности
      case "solving_easy":
      case "solving_medium": 
      case "solving_hard":
        return <SolvingStage />;                           // Решение задач
      case "method_composition":
        return <MethodCompositionStage />;                 // Составление метода
      case "step_by_step":
        return <StepByStepStage />;                        // Пооперационный контроль
      case "completed":
        return <CompletedStage />;                         // Завершение
      default:
        return <div>Неизвестный этап: {session.current_stage}</div>;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Шапка с прогрессом */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToCatalog}
                className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                К каталогу
              </button>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">{ksData?.title}</h1>
                <p className="text-sm text-slate-500">
                  {STAGES[session?.current_stage]?.label || session?.current_stage}
                </p>
              </div>
            </div>
            
            {/* Индикатор прогресса */}
            <div className="flex items-center gap-2">
              {Object.entries(STAGES).map(([key, stage]) => (
                <div
                  key={key}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    session?.current_stage === key
                      ? 'bg-blue-500 text-white'
                      : stage.order <= (STAGES[session?.current_stage]?.order || 0)
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                  title={stage.label}
                >
                  {stage.order <= (STAGES[session?.current_stage]?.order || 0) ? '✓' : stage.order}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="container mx-auto px-4 py-8">
        {renderCurrentStage()}
      </div>

      {/* Модальное окно предыдущих результатов */}
      {showPreviousResults && session?.last_completed && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Предыдущие результаты</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Осмысление:</span>
                <span className="font-medium">{session.last_completed.comprehension_score}%</span>
              </div>
              <div className="flex justify-between">
                <span>Задач решено:</span>
                <span className="font-medium">
                  {session.last_completed.tasks_correct_count}/{session.last_completed.tasks_solved_count}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Итоговый результат:</span>
                <span className={`font-medium ${session.last_completed.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {session.last_completed.passed ? 'Успешно' : 'Не пройдено'}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleContinue}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Продолжить
              </button>
              <button
                onClick={handleStartNewSession}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Начать заново
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. ИНТЕРАКТИВНЫЙ РЕДАКТОР СХЕМ (ui/src/components/SchemaEditor.jsx)

### 4.1 Основные возможности редактора

```jsx
/**
 * SchemaEditor — улучшенный редактор схем для построения модели ситуации
 * Использует react-konva для canvas-редактирования
 * 
 * Функции:
 * - История действий (Ctrl+Z / Ctrl+Y)
 * - Контекстное меню по ПКМ  
 * - Привязка к сетке и объектам
 * - Множественное выделение мышью
 * - Автоматическое расширение холста
 * - Палитра физических элементов
 * - Панель свойств для настройки элементов
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Circle, Rect, Line, Arrow, Text, Group, Transformer } from 'react-konva';

// =============================================================================
// КОНСТАНТЫ РЕДАКТОРА
// =============================================================================

const GRID_SIZE = 25;                                      // Размер сетки в пикселях
const SNAP_THRESHOLD = 10;                                 // Порог привязки
const EDGE_THRESHOLD = 50;                                 // Расстояние до края для расширения
const EXPAND_AMOUNT = 100;                                 // На сколько расширяется холст

// =============================================================================
// ХУК ДЛЯ ИСТОРИИ ДЕЙСТВИЙ (UNDO/REDO)
// =============================================================================

const useHistory = (initialState) => {
  const [history, setHistory] = useState([initialState]);  // Стек состояний
  const [currentIndex, setCurrentIndex] = useState(0);     // Текущая позиция

  const currentState = history[currentIndex];

  // Добавление нового состояния в историю
  const pushState = useCallback((newState) => {
    const newHistory = history.slice(0, currentIndex + 1);  // Обрезаем "будущее"
    newHistory.push(newState);
    if (newHistory.length > 50) {                          // Ограничиваем историю
      newHistory.shift();
    }
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [history, currentIndex]);

  // Отмена действия
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Повтор действия
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, history.length]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return { currentState, pushState, undo, redo, canUndo, canRedo };
};
```

### 4.2 Функции привязки и выравнивания

```jsx
// =============================================================================
// ФУНКЦИИ ПРИВЯЗКИ (SNAPPING) - Точное позиционирование
// =============================================================================

// Привязка к сетке
const snapToGrid = (value, gridSize = GRID_SIZE) => {
  return Math.round(value / gridSize) * gridSize;
};

// Получение линий для привязки к объектам
const getSnapLines = (elements, currentIds, canvasWidth, canvasHeight) => {
  const lines = {
    vertical: [GRID_SIZE * 10],                            // Основная вертикальная линия
    horizontal: [canvasHeight / 2],                        // Центральная горизонталь
  };

  // Добавляем линии от других элементов (кроме выделенных)
  elements.forEach(el => {
    if (!currentIds.includes(el.id)) {
      lines.vertical.push(el.x);
      lines.horizontal.push(el.y);
    }
  });

  return lines;
};

// Поиск ближайшей линии привязки
const findClosestSnapLine = (value, lines, threshold = SNAP_THRESHOLD) => {
  let closest = null;
  let minDist = threshold;

  lines.forEach(line => {
    const dist = Math.abs(value - line);
    if (dist < minDist) {
      minDist = dist;
      closest = line;
    }
  });

  return closest;
};
```

### 4.3 Компонент элемента на холсте

```jsx
// =============================================================================
// КОМПОНЕНТ ЭЛЕМЕНТА НА ХОЛСТЕ - Интерактивные физические объекты
// =============================================================================

const SchemaElementOnCanvas = ({ 
  element, 
  isSelected, 
  onSelect, 
  onChange, 
  onContextMenu,
  onDragMove,
  snapEnabled,
  isTeacher,
  readOnly = false
}) => {
  const shapeRef = useRef();
  const trRef = useRef();

  // Настройка трансформера при выделении
  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current && isTeacher) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, isTeacher]);

  // Обработка перемещения с привязкой
  const handleDragEnd = (e) => {
    let x = e.target.x();
    let y = e.target.y();

    if (snapEnabled) {
      x = snapToGrid(x);                                   // Привязка к сетке
      y = snapToGrid(y);
    }

    onChange({
      ...element,
      x,
      y,
    });
  };

  // Обработка трансформации (масштабирование, поворот)
  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    const newX = node.x();
    const newY = node.y();
    const newRotation = node.rotation();
    
    // Сбрасываем трансформацию и пересчитываем размеры
    node.scaleX(1);
    node.scaleY(1);
    
    if (['vector', 'line', 'axis-x', 'axis-y'].includes(element.type)) {
      // Для линий и векторов изменяем длину
      const currentLength = element.length || 60;
      const newLength = Math.max(20, Math.abs(currentLength * scaleX));
      
      onChange({
        ...element,
        x: newX,
        y: newY,
        length: newLength,
        rotation: newRotation,
      });
    } else if (element.type === 'point' || element.type === 'body-circle') {
      // Для окружностей изменяем радиус
      const currentRadius = element.radius || 6;
      const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
      const newRadius = Math.max(3, currentRadius * avgScale);
      
      onChange({
        ...element,
        x: newX,
        y: newY,
        radius: newRadius,
        rotation: newRotation,
      });
    } else {
      // Для прямоугольников изменяем ширину и высоту
      onChange({
        ...element,
        x: newX,
        y: newY,
        width: Math.max(5, (element.width || 40) * Math.abs(scaleX)),
        height: Math.max(5, (element.height || 20) * Math.abs(scaleY)),
        rotation: newRotation,
      });
    }
  };

  // Общие свойства для всех элементов
  const commonProps = {
    ref: shapeRef,
    x: element.x,
    y: element.y,
    draggable: !readOnly,
    onClick: (e) => !readOnly && onSelect(element.id, e.evt.ctrlKey || e.evt.shiftKey),
    onDragEnd: readOnly ? undefined : handleDragEnd,
    onTransformEnd: readOnly ? undefined : handleTransformEnd,
    onContextMenu: readOnly ? undefined : (e) => {
      e.evt.preventDefault();
      onContextMenu(element.id, e.evt.clientX, e.evt.clientY);
    },
  };

  // Рендер элемента в зависимости от типа
  const renderShape = () => {
    switch (element.type) {
      case 'point':
        return (
          <Circle
            {...commonProps}
            radius={element.radius || 6}
            fill={element.color || '#1a1a2e'}
            stroke={isSelected ? '#3b82f6' : undefined}
            strokeWidth={isSelected ? 2 : 0}
          />
        );
      
      case 'body-circle':
        return (
          <Circle
            {...commonProps}
            radius={element.radius || 15}
            fill={element.color || '#3b82f6'}
            stroke={isSelected ? '#1d4ed8' : (element.strokeColor || '#1d4ed8')}
            strokeWidth={isSelected ? 3 : 2}
          />
        );
      
      case 'vector':
        const len = element.length || 60;
        return (
          <Arrow
            {...commonProps}
            points={[0, 0, len, 0]}                        // Вектор от начала координат
            stroke={element.color || '#ef4444'}
            strokeWidth={element.strokeWidth || 2}
            fill={element.color || '#ef4444'}
            pointerLength={10}
            pointerWidth={8}
            rotation={element.rotation || 0}
          />
        );
      
      case 'axis-x':
        return (
          <Group {...commonProps}>
            <Arrow
              points={[0, 0, element.length || 150, 0]}
              stroke={element.color || '#1a1a2e'}
              strokeWidth={2}
              fill={element.color || '#1a1a2e'}
              pointerLength={8}
              pointerWidth={6}
            />
            <Text
              x={(element.length || 150) + 5}
              y={-8}
              text={element.label || 'x'}                  // Подпись оси
              fontSize={14}
              fill={element.color || '#1a1a2e'}
            />
          </Group>
        );
      
      case 'text':
        return (
          <Text
            {...commonProps}
            text={element.text || 'Текст'}
            fontSize={element.fontSize || 16}
            fill={element.color || '#1a1a2e'}
            fontFamily="serif"
          />
        );
      
      default:
        return (
          <Circle
            {...commonProps}
            radius={10}
            fill="#ccc"
          />
        );
    }
  };

  return (
    <>
      {renderShape()}
      {/* Трансформер для изменения размеров (только для учителя) */}
      {isSelected && isTeacher && (
        <Transformer
          ref={trRef}
          enabledAnchors={getTransformerAnchors(element.type)}
          rotateEnabled={canRotate(element.type)}
          keepRatio={shouldKeepRatio(element.type)}
        />
      )}
    </>
  );
};

// Вспомогательные функции для трансформера
const getTransformerAnchors = (type) => {
  if (['vector', 'line'].includes(type)) {
    return ['middle-left', 'middle-right'];               // Только растяжение
  }
  if (type === 'point' || type === 'body-circle') {
    return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  }
  return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
};

const canRotate = (type) => {
  return !['axis-x', 'axis-y', 'text', 'label'].includes(type);
};

const shouldKeepRatio = (type) => {
  return type === 'point' || type === 'body-circle';
};
```

---

## 5. НАСТРОЙКИ DJANGO (eora/settings.py)

```python
"""
Django settings for eora project.
Конфигурация для адаптивной обучающей платформы
"""

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# =============================================================================
# СТАТИЧЕСКИЕ ФАЙЛЫ И МЕДИА
# =============================================================================

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]                   # Статика React из сборки
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"                            # Загруженные изображения СК

# =============================================================================
# БЕЗОПАСНОСТЬ И БАЗОВЫЕ НАСТРОЙКИ  
# =============================================================================

SECRET_KEY = 'django-insecure-cv_r-4&gnsn4qjg)2zpqbz93d@vk)6f_g7^3z^1a+8m^h6(ynn'
DEBUG = True                                               # В продакшене = False
ALLOWED_HOSTS: list[str] = []                              # В продакшене указать домены

# =============================================================================
# ПРИЛОЖЕНИЯ
# =============================================================================

INSTALLED_APPS = [
    # Django core
    "django.contrib.admin",
    "django.contrib.auth", 
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Сторонние пакеты
    "rest_framework",                                      # API
    "corsheaders",                                         # CORS для фронтенда

    # Наши приложения
    "learning",                                            # Основная логика обучения
    "analytics",                                           # Аналитика и отчеты
]

# =============================================================================
# MIDDLEWARE
# =============================================================================

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",               # CORS должен быть первым
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware", 
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

CORS_ALLOW_ALL_ORIGINS = True                              # В продакшене настроить точно

ROOT_URLCONF = "eora.urls"

# =============================================================================
# ШАБЛОНЫ
# =============================================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "static" / "app"],             # Для статических HTML
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth", 
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# =============================================================================
# БАЗА ДАННЫХ
# =============================================================================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",            # SQLite для разработки
        "NAME": BASE_DIR / "db.sqlite3",                   # В продакшене - PostgreSQL
    }
}

# =============================================================================
# ЛОКАЛИЗАЦИЯ
# =============================================================================

LANGUAGE_CODE = "ru-ru"                                    # Русский интерфейс
TIME_ZONE = "Europe/Moscow"                                # Московское время
USE_I18N = True
USE_TZ = True

# =============================================================================
# DJANGO REST FRAMEWORK
# =============================================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",  # Аутентификация через сессии
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",      # Только для авторизованных
    ],
}
```

---

## 6. ОПИСАНИЕ АДАПТИВНОГО АЛГОРИТМА ОБУЧЕНИЯ

### 6.1 Этапы алгоритма

1. **Осмысление СК** - Изучение таблицы знаний с интерактивными зонами и cloze-заданиями
2. **Типовая задача** - Понимание типа задач, решаемых данной СК  
3. **Список задач** - Ознакомление с набором задач разной сложности
4. **Оценка трудности** - Субъективная оценка учеником сложности материала
5. **Решение задач** - Адаптивный выбор уровня: легкое/непростое/трудное
6. **Составление метода** - Создание алгоритма решения (для средней/высокой сложности)
7. **Пооперационный контроль** - Решение задач по шагам с проверкой каждого

### 6.2 Адаптивная логика

```python
# Адаптивные переходы в TaskViewSet.submit()
if session.difficulty_choice == "easy" and session.wrong_attempts_in_row >= 2:
    # При 2 ошибках подряд в "легком" режиме → переход на "непростое"
    session.current_stage = "method_composition"
    session.difficulty_choice = "medium"
```

### 6.3 Типы заданий

- **Числовые задачи** с автоматической проверкой и учетом погрешности
- **Текстовые ответы** с точным и нечетким сравнением  
- **Интерактивные схемы** для построения моделей ситуации
- **Cloze-тексты** с банком слов и отвлекателями
- **Соответствие зон** на изображениях СК

---

## Заключение

Проект EORA представляет собой современную адаптивную обучающую платформу, которая:

1. **Использует методику "Системы знаний"** для структурированного изучения физики
2. **Реализует адаптивный алгоритм** с 7 этапами обучения 
3. **Предоставляет интерактивные инструменты** - схемы, зоны, cloze-задания
4. **Отслеживает прогресс** ученика и адаптируется под его уровень
5. **Построена на современных технологиях** - Django REST API + React

Архитектура проекта позволяет легко расширять функциональность, добавлять новые типы заданий и интегрировать ML-алгоритмы для персонализации обучения.