from django.contrib import admin
from django.utils.html import format_html
from .models import (
    # Иерархия
    SchoolClass, SubjectSection, Topic,
    StudyGroup, StudyGroupMembership, UserProfile,
    # Система Знаний
    KnowledgeSystem, KSZone, KSQuestion,
    # Типовая задача
    TypicalTaskOption,
    # Cloze
    KSCloze,
    # Метод решения
    SolutionMethod, SolutionStep,
    # Задачи
    Task, TaskSolutionStep,
    # Редактор схем
    SchemaElementCategory, SchemaElement, SchemaTemplate, StudentSchema,
    # Сессии
    LearningSession, TaskAttempt, TaskAttemptImage, StepAttempt,
    # Осмысление
    ComprehensionAttempt, QuestionAnswer, ClozeAnswer,
    # Логи
    EventLog,
)


# =============================================================================
# 1. УЧЕБНАЯ ИЕРАРХИЯ
# =============================================================================

@admin.register(SchoolClass)
class SchoolClassAdmin(admin.ModelAdmin):
    list_display = ("number", "title", "sections_count")
    ordering = ("number",)

    def sections_count(self, obj):
        return obj.sections.count()
    sections_count.short_description = "Разделов"


@admin.register(SubjectSection)
class SubjectSectionAdmin(admin.ModelAdmin):
    list_display = ("title", "school_class", "order", "topics_count")
    list_filter = ("school_class",)
    search_fields = ("title",)
    ordering = ("school_class__number", "order")

    def topics_count(self, obj):
        return obj.topics.count()
    topics_count.short_description = "Тем"


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "order", "ks_count")
    list_filter = ("section__school_class", "section")
    search_fields = ("title",)
    ordering = ("section__school_class__number", "section__order", "order")

    def ks_count(self, obj):
        return obj.knowledge_systems.count()
    ks_count.short_description = "Систем Знаний"


class StudyGroupMembershipInline(admin.TabularInline):
    model = StudyGroupMembership
    extra = 0
    raw_id_fields = ("user",)


@admin.register(StudyGroup)
class StudyGroupAdmin(admin.ModelAdmin):
    list_display = ("title", "letter", "school_class", "owner", "created_at", "members_count")
    list_filter = ("school_class",)
    search_fields = ("title", "owner__username")
    raw_id_fields = ("owner", "school_class")
    inlines = [StudyGroupMembershipInline]

    def members_count(self, obj):
        return obj.memberships.count()

    members_count.short_description = "Учеников"


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "must_change_password")
    search_fields = ("user__username",)
    list_filter = ("must_change_password",)


# =============================================================================
# 2. СИСТЕМА ЗНАНИЙ
# =============================================================================

class KSZoneInline(admin.TabularInline):
    model = KSZone
    extra = 0
    fields = ("label", "x", "y", "width", "height")


class KSQuestionInline(admin.TabularInline):
    model = KSQuestion
    extra = 0
    fields = ("order", "type", "text")
    ordering = ("order",)


class KSClozeInline(admin.TabularInline):
    model = KSCloze
    extra = 0
    fields = ("order", "original_text")
    ordering = ("order",)


class TypicalTaskOptionInline(admin.TabularInline):
    model = TypicalTaskOption
    extra = 0
    fields = ("order", "text", "is_correct", "explanation")
    ordering = ("order",)


class TaskInline(admin.TabularInline):
    model = Task
    extra = 0
    fields = ("order", "title", "difficulty", "correct_answer", "answer_unit")
    ordering = ("order",)
    show_change_link = True


@admin.register(KnowledgeSystem)
class KnowledgeSystemAdmin(admin.ModelAdmin):
    list_display = (
        "title", "topic", "status", "version", 
        "zones_count", "questions_count", "tasks_count", "created_at"
    )
    list_filter = ("status", "topic__section__school_class", "topic__section", "topic")
    search_fields = ("title", "description")
    readonly_fields = ("created_at", "updated_at", "image_preview", "comprehension_image_preview")
    
    fieldsets = (
        ("Основное", {
            "fields": ("topic", "title", "description", "status", "version")
        }),
        ("Изображение Системы Знаний", {
            "fields": ("image", "image_preview")
        }),
        ("Осмысление Системы Знаний", {
            "fields": (
                "comprehension_image", "comprehension_image_preview", 
                "show_zones_by_default", "comprehension_pass_threshold"
            )
        }),
        ("Типовая задача", {
            "fields": (
                "typical_task_title", "typical_task_description",
                "typical_task_cloze_text", "typical_task_cloze_blanks",
                "typical_task_cloze_distractors",
            ),
            "classes": ("collapse",)
        }),
        ("Даты", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )
    
    inlines = [KSZoneInline, KSQuestionInline, KSClozeInline, TypicalTaskOptionInline, TaskInline]

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="max-width: 400px; max-height: 300px;" />',
                obj.image.url
            )
        return "—"
    image_preview.short_description = "Превью"

    def comprehension_image_preview(self, obj):
        if obj.comprehension_image:
            return format_html(
                '<img src="{}" style="max-width: 400px; max-height: 300px;" />',
                obj.comprehension_image.url
            )
        return "—"
    comprehension_image_preview.short_description = "Превью таблицы осмысления"

    def zones_count(self, obj):
        return obj.zones.count()
    zones_count.short_description = "Зон"

    def questions_count(self, obj):
        return obj.questions.count()
    questions_count.short_description = "Вопросов"

    def tasks_count(self, obj):
        return obj.tasks.count()
    tasks_count.short_description = "Задач"


@admin.register(KSZone)
class KSZoneAdmin(admin.ModelAdmin):
    list_display = ("id", "ks", "label", "x", "y", "width", "height")
    list_filter = ("ks",)
    search_fields = ("label", "ks__title")


@admin.register(TypicalTaskOption)
class TypicalTaskOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "ks", "order", "text_short", "is_correct")
    list_filter = ("is_correct", "ks")
    search_fields = ("text",)
    ordering = ("ks", "order")
    list_editable = ("order", "is_correct")

    def text_short(self, obj):
        return obj.text[:80] + "..." if len(obj.text) > 80 else obj.text
    text_short.short_description = "Текст"


@admin.register(KSQuestion)
class KSQuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "ks", "type", "order", "text_short", "zones_count")
    list_filter = ("type", "ks__topic__section__school_class", "ks")
    search_fields = ("text",)
    filter_horizontal = ("zones", "correct_zones")
    ordering = ("ks", "order")

    def text_short(self, obj):
        return obj.text[:60] + "..." if len(obj.text) > 60 else obj.text
    text_short.short_description = "Вопрос"

    def zones_count(self, obj):
        return obj.correct_zones.count()
    zones_count.short_description = "Зон"


# =============================================================================
# 3. CLOZE (ТЕКСТ С ПРОПУСКАМИ)
# =============================================================================

@admin.register(KSCloze)
class KSClozeAdmin(admin.ModelAdmin):
    list_display = ("id", "ks", "order", "blanks_count", "distractors_count")
    list_filter = ("ks__topic__section__school_class", "ks")
    ordering = ("ks", "order")
    
    fieldsets = (
        ("Основное", {
            "fields": ("ks", "order")
        }),
        ("Текст", {
            "fields": ("original_text", "marked_text")
        }),
        ("Пропуски и отвлекатели", {
            "fields": ("blanks", "distractors")
        }),
    )

    def blanks_count(self, obj):
        return len(obj.blanks) if obj.blanks else 0
    blanks_count.short_description = "Пропусков"

    def distractors_count(self, obj):
        return len(obj.distractors) if obj.distractors else 0
    distractors_count.short_description = "Отвлекателей"


# =============================================================================
# 4. МЕТОД РЕШЕНИЯ
# =============================================================================

class SolutionStepInline(admin.TabularInline):
    model = SolutionStep
    extra = 1
    fields = ("order", "title", "description", "hint")
    ordering = ("order",)


@admin.register(SolutionMethod)
class SolutionMethodAdmin(admin.ModelAdmin):
    list_display = ("title", "ks", "steps_count")
    search_fields = ("title", "ks__title")
    inlines = [SolutionStepInline]

    def steps_count(self, obj):
        return obj.steps.count()
    steps_count.short_description = "Шагов"


@admin.register(SolutionStep)
class SolutionStepAdmin(admin.ModelAdmin):
    list_display = ("method", "order", "title")
    list_filter = ("method__ks",)
    search_fields = ("title", "description")
    ordering = ("method", "order")


# =============================================================================
# 5. ЗАДАЧИ
# =============================================================================

class TaskSolutionStepInline(admin.TabularInline):
    model = TaskSolutionStep
    extra = 0
    fields = ("step", "content", "image")
    ordering = ("step__order",)
    autocomplete_fields = ("step",)


class SchemaTemplateInline(admin.TabularInline):
    model = SchemaTemplate
    extra = 0
    fields = ("name", "template_type")


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "order", "title", "ks", "difficulty", 
        "correct_answer", "answer_unit", "has_solution"
    )
    list_filter = ("ks__topic__section__school_class", "ks", "difficulty")
    search_fields = ("title", "text")
    ordering = ("ks", "order")
    
    fieldsets = (
        ("Основное", {
            "fields": ("ks", "order", "title", "text", "difficulty")
        }),
        ("Правильный ответ", {
            "fields": ("correct_answer", "answer_unit", "answer_tolerance", "correct_answer_text")
        }),
        ("Эталонное решение", {
            "fields": ("solution_summary", "solution_detailed", "solution_image"),
            "classes": ("collapse",)
        }),
    )
    
    inlines = [TaskSolutionStepInline, SchemaTemplateInline]

    def has_solution(self, obj):
        return bool(obj.solution_summary or obj.solution_detailed)
    has_solution.boolean = True
    has_solution.short_description = "Решение"


@admin.register(TaskSolutionStep)
class TaskSolutionStepAdmin(admin.ModelAdmin):
    list_display = ("task", "step", "content_short")
    list_filter = ("task__ks",)
    search_fields = ("task__title", "content")
    autocomplete_fields = ("step",)

    def content_short(self, obj):
        return obj.content[:80] + "..." if len(obj.content) > 80 else obj.content
    content_short.short_description = "Содержание"


# =============================================================================
# 6. РЕДАКТОР СХЕМ
# =============================================================================

@admin.register(SchemaElementCategory)
class SchemaElementCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "icon", "order", "is_system", "elements_count")
    list_editable = ("order",)
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("order", "name")

    def elements_count(self, obj):
        return obj.elements.count()
    elements_count.short_description = "Элементов"


@admin.register(SchemaElement)
class SchemaElementAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_system", "created_by", "order")
    list_filter = ("category", "is_system")
    search_fields = ("name", "description", "tags")
    list_editable = ("order",)
    ordering = ("category__order", "order", "name")
    
    fieldsets = (
        ("Основное", {
            "fields": ("name", "category", "description", "tags", "order")
        }),
        ("SVG", {
            "fields": ("svg_icon", "svg_template"),
            "classes": ("collapse",),
        }),
        ("Свойства", {
            "fields": ("default_props", "editable_props"),
            "classes": ("collapse",),
        }),
        ("Мета", {
            "fields": ("is_system", "created_by"),
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SchemaTemplate)
class SchemaTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "task", "template_type", "created_at")
    list_filter = ("template_type", "task__ks")
    search_fields = ("name", "task__title")


@admin.register(StudentSchema)
class StudentSchemaAdmin(admin.ModelAdmin):
    list_display = ("task_attempt", "step", "similarity_score", "is_correct", "created_at")
    list_filter = ("is_correct",)
    readonly_fields = ("created_at",)


# =============================================================================
# 7. СЕССИИ ОБУЧЕНИЯ
# =============================================================================

class TaskAttemptInline(admin.TabularInline):
    model = TaskAttempt
    extra = 0
    fields = ("task", "answer_numeric", "is_correct", "difficulty_rating", "created_at")
    readonly_fields = ("created_at",)
    ordering = ("created_at",)


class ComprehensionAttemptInline(admin.TabularInline):
    model = ComprehensionAttempt
    extra = 0
    fields = ("total_questions", "correct_answers", "score_percent", "passed", "started_at")
    readonly_fields = ("started_at",)


@admin.register(LearningSession)
class LearningSessionAdmin(admin.ModelAdmin):
    list_display = (
        "user", "ks", "current_stage", "difficulty_choice",
        "tasks_correct_count", "tasks_solved_count", 
        "score_percent", "passed", "started_at"
    )
    list_filter = (
        "current_stage", "difficulty_choice", "passed",
        "ks__topic__section__school_class", "ks"
    )
    search_fields = ("user__username", "ks__title")
    readonly_fields = ("started_at", "finished_at")
    ordering = ("-started_at",)
    
    fieldsets = (
        ("Основное", {
            "fields": ("user", "ks", "current_stage", "difficulty_choice")
        }),
        ("Прогресс", {
            "fields": (
                "comprehension_passed", "comprehension_score",
                "tasks_solved_count", "tasks_correct_count", "wrong_attempts_in_row"
            )
        }),
        ("Итог", {
            "fields": ("score_percent", "passed")
        }),
        ("Время", {
            "fields": ("started_at", "finished_at")
        }),
    )
    
    inlines = [ComprehensionAttemptInline, TaskAttemptInline]


class TaskAttemptImageInline(admin.TabularInline):
    model = TaskAttemptImage
    extra = 0
    fields = ("order", "image")
    readonly_fields = ()


class StepAttemptInline(admin.TabularInline):
    model = StepAttempt
    extra = 0
    fields = ("step", "student_answer", "chose_system_variant", "created_at")
    readonly_fields = ("created_at",)


@admin.register(TaskAttempt)
class TaskAttemptAdmin(admin.ModelAdmin):
    list_display = (
        "task", "session_user", "answer_numeric", "is_correct",
        "difficulty_rating", "time_spent_seconds", "created_at"
    )
    list_filter = ("is_correct", "difficulty_rating", "task__ks")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)
    inlines = [TaskAttemptImageInline, StepAttemptInline]

    def session_user(self, obj):
        return obj.session.user.username
    session_user.short_description = "Ученик"


# =============================================================================
# 8. ОСМЫСЛЕНИЕ
# =============================================================================

class QuestionAnswerInline(admin.TabularInline):
    model = QuestionAnswer
    extra = 0
    fields = ("question", "is_correct", "created_at")
    readonly_fields = ("created_at",)


class ClozeAnswerInline(admin.TabularInline):
    model = ClozeAnswer
    extra = 0
    fields = ("cloze", "score", "is_correct", "created_at")
    readonly_fields = ("created_at",)


@admin.register(ComprehensionAttempt)
class ComprehensionAttemptAdmin(admin.ModelAdmin):
    list_display = ("session", "total_questions", "correct_answers", "score_percent", "passed", "started_at")
    list_filter = ("passed", "session__ks")
    readonly_fields = ("started_at", "finished_at")
    inlines = [QuestionAnswerInline, ClozeAnswerInline]


@admin.register(QuestionAnswer)
class QuestionAnswerAdmin(admin.ModelAdmin):
    list_display = ("attempt", "question", "is_correct", "created_at")
    list_filter = ("is_correct", "question__type")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ClozeAnswer)
class ClozeAnswerAdmin(admin.ModelAdmin):
    list_display = ("attempt", "cloze", "score", "is_correct", "created_at")
    list_filter = ("is_correct",)
    readonly_fields = ("created_at", "updated_at")


# =============================================================================
# 9. ЛОГИ
# =============================================================================

@admin.register(EventLog)
class EventLogAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "session", "ts")
    list_filter = ("event",)
    search_fields = ("event", "user__username")
    readonly_fields = ("user", "session", "event", "payload", "ts")
    ordering = ("-ts",)
