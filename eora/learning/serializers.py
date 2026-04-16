from rest_framework import serializers
from django.db import models as db_models
from .models import (
    SchoolClass, SubjectSection, Topic,
    KnowledgeSystem, KSZone, KSQuestion, KSCloze,
    TypicalTaskOption,
    Task, SolutionMethod, SolutionStep, TaskSolutionStep,
    SchemaElementCategory, SchemaElement, SchemaTemplate, StudentSchema,
    ComprehensionAttempt, QuestionAnswer, ClozeAnswer,
    StepAttempt, TaskAttempt,
    StudyGroup,
)


# =============================================================================
# КАТАЛОГ
# =============================================================================

class KnowledgeSystemBriefSerializer(serializers.ModelSerializer):
    """Краткая информация о Системе Знаний для каталога"""
    user_progress = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSystem
        fields = ("id", "title", "status", "user_progress")

    def get_user_progress(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        from .models import LearningSession
        best = (
            LearningSession.objects.filter(
                user=request.user, ks=obj, finished_at__isnull=False
            )
            .order_by("-score_percent")
            .values("score_percent", "tasks_solved_count", "tasks_correct_count", "passed")
            .first()
        )
        if not best:
            return None
        return {
            "completed": True,
            "score_percent": best["score_percent"],
            "tasks_solved": best["tasks_solved_count"],
            "tasks_correct": best["tasks_correct_count"],
            "passed": best["passed"],
        }


class TopicSerializer(serializers.ModelSerializer):
    """Тема с вложенными Системами Знаний"""
    knowledge_systems = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = ("id", "title", "order", "knowledge_systems")

    def get_knowledge_systems(self, obj):
        qs = obj.knowledge_systems.filter(status="published").only("id", "title", "status")
        return KnowledgeSystemBriefSerializer(qs, many=True, context=self.context).data


class SubjectSectionSerializer(serializers.ModelSerializer):
    """Раздел с вложенными темами"""
    topics = TopicSerializer(many=True, read_only=True)

    class Meta:
        model = SubjectSection
        fields = ("id", "title", "order", "topics")


class SchoolClassSerializer(serializers.ModelSerializer):
    """Класс с вложенными разделами"""
    sections = SubjectSectionSerializer(many=True, read_only=True)

    class Meta:
        model = SchoolClass
        fields = ("id", "number", "title", "sections")


class StudyGroupSerializer(serializers.ModelSerializer):
    """Группа апробации (класс + буква) для организатора."""

    member_count = serializers.SerializerMethodField()

    class Meta:
        model = StudyGroup
        fields = ("id", "title", "letter", "school_class", "created_at", "member_count")
        read_only_fields = ("created_at", "member_count")

    def get_member_count(self, obj):
        return obj.memberships.count()


# =============================================================================
# СИСТЕМА ЗНАНИЙ (ДЕТАЛИ)
# =============================================================================

class KSZoneSerializer(serializers.ModelSerializer):
    """Зона на изображении"""
    class Meta:
        model = KSZone
        fields = ("id", "x", "y", "width", "height", "label")


class KSQuestionSerializer(serializers.ModelSerializer):
    """Вопрос для осмысления Системы Знаний"""
    zone_ids = serializers.PrimaryKeyRelatedField(
        source="zones", many=True, read_only=True
    )
    correct_zone_ids = serializers.PrimaryKeyRelatedField(
        source="correct_zones", many=True, read_only=True
    )

    class Meta:
        model = KSQuestion
        fields = (
            "id", "type", "text", "order",
            "zone_ids", "correct_zone_ids",
            "options", "correct_answer_text", "fuzzy_match"
        )


class KSClozeSerializer(serializers.ModelSerializer):
    """Текст с пропусками для ученика"""
    all_options = serializers.SerializerMethodField()

    class Meta:
        model = KSCloze
        fields = ("id", "order", "marked_text", "blanks", "all_options")

    def get_all_options(self, obj):
        return obj.get_all_options()


class KSClozeFullSerializer(serializers.ModelSerializer):
    """Текст с пропусками для учителя (полная информация)"""

    class Meta:
        model = KSCloze
        fields = ("id", "order", "original_text", "marked_text", "blanks", "distractors")


class TypicalTaskOptionSerializer(serializers.ModelSerializer):
    """Вариант ответа для этапа «Типовая задача» (для ученика — без is_correct)"""
    class Meta:
        model = TypicalTaskOption
        fields = ("id", "text", "order")


class TypicalTaskOptionFullSerializer(serializers.ModelSerializer):
    """Вариант ответа для учителя (с пометкой правильности)"""
    class Meta:
        model = TypicalTaskOption
        fields = ("id", "ks", "text", "is_correct", "order", "explanation")


class TaskBriefSerializer(serializers.ModelSerializer):
    """Краткая информация о задаче"""
    class Meta:
        model = Task
        # Добавляем text, чтобы на этапе ознакомления (слайд 7)
        # можно было показать полную формулировку задания
        fields = ("id", "order", "title", "text", "difficulty")


class SolutionStepSerializer(serializers.ModelSerializer):
    """Шаг метода решения"""
    class Meta:
        model = SolutionStep
        fields = ("order", "title", "description", "hint", "hide_title_in_composition")


class SolutionMethodSerializer(serializers.ModelSerializer):
    """Метод решения"""
    steps = SolutionStepSerializer(many=True, read_only=True)

    class Meta:
        model = SolutionMethod
        fields = ("title", "description", "steps")


class KnowledgeSystemDetailSerializer(serializers.ModelSerializer):
    """Полная информация о Системе Знаний"""
    zones = KSZoneSerializer(many=True, read_only=True)
    questions = KSQuestionSerializer(many=True, read_only=True)
    clozes = KSClozeSerializer(many=True, read_only=True)
    tasks = TaskBriefSerializer(many=True, read_only=True)
    typical_task_options = TypicalTaskOptionSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()
    comprehension_image_url = serializers.SerializerMethodField()
    solution_method = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSystem
        fields = (
            "id", "title", "description", "status", "version", 
            "image_url", "comprehension_image_url", 
            "show_zones_by_default", "comprehension_pass_threshold",
            "typical_task_title", "typical_task_description",
            "typical_task_options",
            "typical_task_cloze",
            "zones", "questions", "clozes", "tasks",
            "solution_method",
        )

    typical_task_cloze = serializers.SerializerMethodField()

    def get_typical_task_cloze(self, obj):
        """Возвращает cloze данные для типовой задачи (без правильных ответов!)"""
        if not obj.typical_task_cloze_text:
            return None
        import random
        correct_words = [b["correct"] for b in (obj.typical_task_cloze_blanks or [])]
        all_options = list(set(correct_words + (obj.typical_task_cloze_distractors or [])))
        random.shuffle(all_options)
        return {
            "marked_text": obj.typical_task_cloze_text,
            "blanks_count": len(obj.typical_task_cloze_blanks or []),
            "all_options": all_options,
        }

    def get_image_url(self, obj):
        req = self.context.get("request")
        if obj.image and req:
            return req.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else ""

    def get_comprehension_image_url(self, obj):
        req = self.context.get("request")
        if obj.comprehension_image and req:
            return req.build_absolute_uri(obj.comprehension_image.url)
        return obj.comprehension_image.url if obj.comprehension_image else ""

    def get_solution_method(self, obj):
        try:
            method = obj.solution_method
            return SolutionMethodSerializer(method).data
        except SolutionMethod.DoesNotExist:
            return None


# =============================================================================
# РЕДАКТОР СХЕМ
# =============================================================================

class SchemaElementCategorySerializer(serializers.ModelSerializer):
    """Категория элементов схемы"""
    elements_count = serializers.SerializerMethodField()

    class Meta:
        model = SchemaElementCategory
        fields = ("id", "name", "slug", "description", "icon", "order", "elements_count")

    def get_elements_count(self, obj):
        return obj.elements.count()


class SchemaElementSerializer(serializers.ModelSerializer):
    """Элемент схемы"""
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)

    class Meta:
        model = SchemaElement
        fields = (
            "id", "name", "description", 
            "category", "category_name", "category_slug",
            "svg_icon", "svg_template",
            "default_props", "editable_props",
            "tags", "order", "is_system"
        )


class SchemaElementCreateSerializer(serializers.ModelSerializer):
    """Создание элемента учителем"""
    class Meta:
        model = SchemaElement
        fields = (
            "name", "description", "category",
            "svg_icon", "svg_template",
            "default_props", "editable_props", "tags"
        )

    def create(self, validated_data):
        validated_data["is_system"] = False
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class SchemaElementWithCategorySerializer(serializers.ModelSerializer):
    """Элемент с полной информацией о категории"""
    category = SchemaElementCategorySerializer(read_only=True)

    class Meta:
        model = SchemaElement
        fields = (
            "id", "name", "description", "category",
            "svg_icon", "svg_template",
            "default_props", "editable_props",
            "tags", "order", "is_system"
        )


class SchemaTemplateSerializer(serializers.ModelSerializer):
    """Шаблон схемы для задачи"""
    class Meta:
        model = SchemaTemplate
        fields = ("id", "name", "template_type", "data", "task", "created_at")
        read_only_fields = ("created_at",)


class StudentSchemaSerializer(serializers.ModelSerializer):
    """Схема ученика"""
    class Meta:
        model = StudentSchema
        fields = (
            "id", "task_attempt", "step", "data",
            "similarity_score", "is_correct", "feedback",
            "created_at"
        )
        read_only_fields = ("similarity_score", "is_correct", "feedback", "created_at")


class TaskDetailSerializer(serializers.ModelSerializer):
    """Полная информация о задаче с шаблонами схем"""
    schema_templates = SchemaTemplateSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = (
            "id", "order", "title", "text",
            "correct_answer", "answer_unit", "answer_tolerance",
            "difficulty",
            "solution_summary", "solution_detailed",
            "schema_templates"
        )


# =============================================================================
# СЕРИАЛИЗАТОРЫ ДЛЯ УЧИТЕЛЯ
# =============================================================================

class TaskListSerializer(serializers.ModelSerializer):
    """Список задач для учителя"""
    ks_title = serializers.CharField(source="ks.title", read_only=True)
    topic_title = serializers.CharField(source="ks.topic.title", read_only=True)
    has_schema = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id", "order", "title", "text",
            "ks", "ks_title", "topic_title",
            "correct_answer", "correct_answer_text", "answer_unit", "difficulty",
            "has_schema"
        )

    def get_has_schema(self, obj):
        return obj.schema_templates.filter(template_type="reference").exists()


class TaskCreateUpdateSerializer(serializers.ModelSerializer):
    """Создание/обновление задачи учителем"""
    class Meta:
        model = Task
        fields = (
            "id", "ks", "order", "title", "text",
            "correct_answer", "correct_answer_text",
            "answer_unit", "answer_tolerance", "difficulty",
            "solution_summary", "solution_detailed", "solution_image"
        )

    def create(self, validated_data):
        # Автоматически определяем order если не указан
        if "order" not in validated_data or not validated_data["order"]:
            ks = validated_data.get("ks")
            max_order = Task.objects.filter(ks=ks).aggregate(
                max_order=db_models.Max("order")
            )["max_order"] or 0
            validated_data["order"] = max_order + 1
        return super().create(validated_data)


class KnowledgeSystemListSerializer(serializers.ModelSerializer):
    """Список Систем Знаний для выбора в форме задачи"""
    topic_title = serializers.CharField(source="topic.title", read_only=True)
    section_title = serializers.CharField(source="topic.section.title", read_only=True)
    tasks_count = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSystem
        fields = ("id", "title", "topic_title", "section_title", "tasks_count", "status")

    def get_tasks_count(self, obj):
        return obj.tasks.count()


# =============================================================================
# ОТВЕТЫ УЧЕНИКА НА ОСМЫСЛЕНИЕ
# =============================================================================

class QuestionAnswerSerializer(serializers.ModelSerializer):
    """Ответ ученика на вопрос"""
    question_type = serializers.CharField(source="question.type", read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)

    class Meta:
        model = QuestionAnswer
        fields = (
            "id", "question", "question_type", "question_text",
            "answer_text", "answer_index", "answer_indices", "answer_zone_ids",
            "is_correct", "created_at"
        )
        read_only_fields = ("is_correct", "created_at")


class ClozeAnswerSerializer(serializers.ModelSerializer):
    """Ответ ученика на текст с пропусками"""
    class Meta:
        model = ClozeAnswer
        fields = (
            "id", "cloze", "answers",
            "correct_positions", "wrong_positions", "score", "is_correct",
            "created_at"
        )
        read_only_fields = ("correct_positions", "wrong_positions", "score", "is_correct", "created_at")


class ComprehensionAttemptSerializer(serializers.ModelSerializer):
    """Попытка осмысления"""
    question_answers = QuestionAnswerSerializer(many=True, read_only=True)
    cloze_answers = ClozeAnswerSerializer(many=True, read_only=True)

    class Meta:
        model = ComprehensionAttempt
        fields = (
            "id", "session", "total_questions", "correct_answers",
            "score_percent", "passed",
            "started_at", "finished_at",
            "question_answers", "cloze_answers"
        )
        read_only_fields = ("total_questions", "correct_answers", "score_percent", "passed", "started_at", "finished_at")


# =============================================================================
# СТРУКТУРА КУРСА ДЛЯ УЧИТЕЛЯ
# =============================================================================

class SubjectSectionTeacherSerializer(serializers.ModelSerializer):
    """Раздел для редактирования"""
    class Meta:
        model = SubjectSection
        fields = ("id", "school_class", "title", "order")


class TopicTeacherSerializer(serializers.ModelSerializer):
    """Тема для редактирования"""
    section_title = serializers.CharField(source="section.title", read_only=True)

    class Meta:
        model = Topic
        fields = ("id", "section", "section_title", "title", "order")


class KnowledgeSystemTeacherSerializer(serializers.ModelSerializer):
    """Система Знаний для редактирования"""
    topic_title = serializers.CharField(source="topic.title", read_only=True)
    section_title = serializers.CharField(source="topic.section.title", read_only=True)
    zones_count = serializers.SerializerMethodField()
    questions_count = serializers.SerializerMethodField()
    clozes_count = serializers.SerializerMethodField()
    tasks_count = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSystem
        fields = (
            "id", "topic", "topic_title", "section_title",
            "title", "description", "status", "version",
            "image", "comprehension_image",
            "show_zones_by_default", "comprehension_pass_threshold",
            "typical_task_title", "typical_task_description",
            "zones_count", "questions_count", "clozes_count", "tasks_count",
            "created_at", "updated_at"
        )

    def get_zones_count(self, obj):
        return obj.zones.count()

    def get_questions_count(self, obj):
        return obj.questions.count()

    def get_clozes_count(self, obj):
        return obj.clozes.count()

    def get_tasks_count(self, obj):
        return obj.tasks.count()


class KSZoneCreateSerializer(serializers.ModelSerializer):
    """Создание/редактирование зоны"""
    class Meta:
        model = KSZone
        fields = ("id", "ks", "x", "y", "width", "height", "label")


class KSQuestionCreateSerializer(serializers.ModelSerializer):
    """Создание/редактирование вопроса"""
    class Meta:
        model = KSQuestion
        fields = (
            "id", "ks", "type", "text", "order",
            "zones", "correct_zones",
            "options", "correct_answer_text", "fuzzy_match"
        )


class KSClozeCreateSerializer(serializers.ModelSerializer):
    """Создание/редактирование текста с пропусками"""
    class Meta:
        model = KSCloze
        fields = ("id", "ks", "order", "original_text", "marked_text", "blanks", "distractors")


# =============================================================================
# ПООПЕРАЦИОННЫЙ КОНТРОЛЬ
# =============================================================================

class TaskSolutionStepSerializer(serializers.ModelSerializer):
    """Эталонное решение задачи по шагам"""
    step_order = serializers.IntegerField(source="step.order", read_only=True)
    step_title = serializers.CharField(source="step.title", read_only=True)
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = TaskSolutionStep
        fields = ("id", "step", "step_order", "step_title", "step_type", "content", "schema_data", "image", "image_url")
    
    def get_image_url(self, obj):
        req = self.context.get("request")
        if obj.image and req:
            return req.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else ""


class TaskSolutionStepCreateSerializer(serializers.ModelSerializer):
    """Создание/редактирование эталонного решения по шагам"""
    schema_data = serializers.JSONField(required=False, allow_null=True)
    
    class Meta:
        model = TaskSolutionStep
        fields = ("id", "task", "step", "step_type", "content", "schema_data", "image")
    
    # Обработка schema_data теперь в views.py перед передачей в сериализатор


class StepAttemptSerializer(serializers.ModelSerializer):
    """Попытка выполнения шага"""
    step_order = serializers.IntegerField(source="step.order", read_only=True)
    step_title = serializers.CharField(source="step.title", read_only=True)
    student_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = StepAttempt
        fields = (
            "id", "step", "step_order", "step_title",
            "student_answer", "student_image", "student_image_url",
            "is_correct", "chose_system_variant", "final_answer",
            "created_at", "updated_at"
        )
    
    def get_student_image_url(self, obj):
        req = self.context.get("request")
        if obj.student_image and req:
            return req.build_absolute_uri(obj.student_image.url)
        return obj.student_image.url if obj.student_image else ""


class StepAttemptCreateSerializer(serializers.ModelSerializer):
    """Создание попытки выполнения шага"""
    class Meta:
        model = StepAttempt
        fields = ("task_attempt", "step", "student_answer", "student_image")
