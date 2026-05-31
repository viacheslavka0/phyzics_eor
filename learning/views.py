from rest_framework import viewsets, mixins, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import models as db_models, transaction
from django.utils import timezone
from django.http import JsonResponse
from django.middleware.csrf import get_token
import json
import os


def _scaffold_v2_enabled():
    """Флаг включения новой шкалы опоры (по умолчанию выкл — прод-поток не меняется).
    Включается переменной окружения SCAFFOLD_V2_ENABLED=1 (для тестов/постепенного раската)."""
    return os.environ.get("SCAFFOLD_V2_ENABLED", "0") == "1"


def _compute_next_support_level(prev_level, last_clean, compact_fail_streak):
    """Перенос уровня опоры на следующую задачу (Гальперин: сворачивание).
    Возвращает (next_level, next_compact_fail_streak).
    Правила: S2 → следующая S1 (не душим); S1 чисто → S0; S1 не чисто → перенос S1,
    на 2-й раз подряд → назначаем S2; S0 → S0."""
    if prev_level >= 2:
        return 1, 0
    if prev_level == 1:
        if last_clean:
            return 0, 0
        streak = compact_fail_streak + 1
        if streak >= 2:
            return 2, 0
        return 1, streak
    return 0, 0


def _apply_support_carry(session):
    """Вызывается при ЗАВЕРШЕНИИ задачи: считает уровень опоры для СЛЕДУЮЩЕЙ задачи
    и записывает в сессию. Идемпотентность обеспечивается тем, что зовётся один раз
    на завершение (в точках complete/submit). Активно только при SCAFFOLD_V2."""
    if not _scaffold_v2_enabled():
        return
    nl, ns = _compute_next_support_level(
        session.support_level, session.last_task_clean, session.compact_fail_streak
    )
    # После задачи 1 даём шанс: задача 2 всегда стартует самостоятельно (S0).
    if session.tasks_solved_count <= 1:
        nl, ns = 0, 0
    session.support_level = nl
    session.compact_fail_streak = ns
    session.last_task_clean = True


def csrf(request):
    """Явно устанавливает CSRF cookie и возвращает токен."""
    return JsonResponse({"csrfToken": get_token(request)})


class AuthLoginView(APIView):
    """Вход по логину/паролю (сессия) — для учеников без доступа к /admin/."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate, login

        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        if not username or not password:
            return Response(
                {"detail": "Укажите логин и пароль"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Неверный логин или пароль"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.is_active:
            return Response(
                {"detail": "Учётная запись отключена"},
                status=status.HTTP_403_FORBIDDEN,
            )
        login(request, user)
        # Строка профиля нужна для /api/account/me/ (student_mode и т.д.)
        UserProfile.objects.get_or_create(
            user=user,
            defaults={"must_change_password": False},
        )
        request.session.modified = True
        return Response(
            {
                "ok": True,
                "username": user.username,
                "is_staff": bool(user.is_staff),
            }
        )


class AuthLogoutView(APIView):
    """Выход из сессии."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.contrib.auth import logout

        logout(request)
        return Response({"ok": True})


class AccountMeView(APIView):
    """Профиль текущего пользователя (ученик / учитель) для клиента."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = _learning_profile(request.user)
        student_mode = (profile.student_mode if profile else "student")
        is_pilot = student_mode == "pilot"
        must_change_password = bool(profile and profile.must_change_password and not is_pilot)
        return Response(
            {
                "username": request.user.username,
                "first_name": request.user.first_name or "",
                "must_change_password": must_change_password,
                "is_staff": bool(request.user.is_staff),
                "student_mode": student_mode,
                "is_pilot_mode": is_pilot,
                "can_reset_progress": is_pilot,
            }
        )


class AccountChangePasswordView(APIView):
    """Смена пароля (после выдачи временного пароля организатором)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.contrib.auth import update_session_auth_hash

        old_password = request.data.get("old_password") or ""
        new_password = request.data.get("new_password") or ""
        if not new_password or len(new_password) < 8:
            return Response(
                {"detail": "Новый пароль обязателен, не короче 8 символов"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not request.user.check_password(old_password):
            return Response(
                {"detail": "Неверный текущий пароль"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as e:
            msgs = getattr(e, "messages", None) or getattr(e, "error_list", None)
            if msgs:
                detail = " ".join(str(m) for m in msgs)
            else:
                detail = str(e)
            return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        profile = _learning_profile(request.user)
        if profile and profile.must_change_password:
            profile.must_change_password = False
            profile.save(update_fields=["must_change_password"])
        update_session_auth_hash(request, request.user)
        return Response({"ok": True})


from .models import (
    SchoolClass, KnowledgeSystem,
    KSQuestion, KSZone, KSCloze,
    LearningSession, TaskAttempt, TaskAttemptImage, EventLog,
    Task, SolutionMethod, SolutionStep, TaskSolutionStep,
    SchemaElementCategory, SchemaElement, SchemaTemplate, StudentSchema,
    SubjectSection, Topic, StepAttempt,
    StudyGroup, StudyGroupMembership, UserProfile,
)
from .serializers import (
    SchoolClassSerializer, KnowledgeSystemDetailSerializer,
    SchemaElementCategorySerializer, SchemaElementSerializer,
    SchemaElementCreateSerializer, SchemaTemplateSerializer,
    StudentSchemaSerializer, TaskDetailSerializer,
    SubjectSectionTeacherSerializer, TopicTeacherSerializer,
    KnowledgeSystemTeacherSerializer, KSZoneSerializer,
    KSQuestionSerializer, KSClozeFullSerializer,
    TaskSolutionStepSerializer, TaskSolutionStepCreateSerializer,
    StepAttemptSerializer, StepAttemptCreateSerializer,
    StudyGroupSerializer,
)


def _learning_profile(user):
    """UserProfile для user; без исключения, если строки профиля ещё нет (reverse OneToOne)."""
    if not user or not getattr(user, "is_authenticated", False):
        return None
    return UserProfile.objects.filter(user_id=user.pk).first()


def _build_result_summary(session):
    """Build result_summary dict from TaskAttempts for a session."""
    from django.db.models import Min, Count, Q
    attempts = TaskAttempt.objects.filter(session=session)
    total_attempts = attempts.count()

    task_stats = (
        attempts.values("task_id", "task__title", "task__order")
        .annotate(
            attempts_count=Count("id"),
            first_correct=Min("id", filter=Q(is_correct=True)),
        )
        .order_by("task__order")
    )

    task_summaries = []
    solved_on_first_try = 0
    for ts in task_stats:
        is_solved = ts["first_correct"] is not None
        first_correct_attempt = None
        if is_solved:
            earlier = attempts.filter(
                task_id=ts["task_id"], id__lt=ts["first_correct"]
            ).count()
            first_correct_attempt = earlier + 1
            if first_correct_attempt == 1:
                solved_on_first_try += 1
        task_summaries.append({
            "task_id": ts["task_id"],
            "task_title": ts["task__title"] or f"Задача {ts['task__order']}",
            "is_solved": is_solved,
            "attempts_count": ts["attempts_count"],
            "first_correct_attempt": first_correct_attempt,
        })

    return {
        "total_attempts": total_attempts,
        "solved_on_first_try": solved_on_first_try,
        "task_summaries": task_summaries,
    }


def _compute_and_save_score(session):
    """Compute score_percent and passed flag, then save."""
    if session.tasks_solved_count > 0:
        session.score_percent = round(
            session.tasks_correct_count / session.tasks_solved_count * 100, 1
        )
    else:
        session.score_percent = 0
    session.passed = session.score_percent >= 50
    session.save(update_fields=["score_percent", "passed"])


def _student_ids_for_teacher_groups(user):
    """
    ID учеников из групп, которыми владеет учитель.
    None — у учителя нет групп: не фильтруем (показываем всех, как в пилоте одиночного учителя).
    set() — группы есть, но пусто.
    """
    qs = StudyGroup.objects.filter(owner=user)
    if not qs.exists():
        return None
    ids = set(
        StudyGroupMembership.objects.filter(group__in=qs).values_list("user_id", flat=True)
    )
    return ids


def _teacher_can_view_session(teacher, session):
    ids = _student_ids_for_teacher_groups(teacher)
    if ids is None:
        return True
    return session.user_id in ids


def _get_student_mode(user):
    prof = _learning_profile(user)
    if not prof:
        return UserProfile.MODE_STUDENT
    return prof.student_mode or UserProfile.MODE_STUDENT


def _is_pilot_user(user):
    return _get_student_mode(user) == UserProfile.MODE_PILOT


def _recalculate_mastery_after_teacher_review(session, review_status, grade_2_5):
    """
    Итог усвоения после проверки финальной задачи:
    - база: автоматический score_percent;
    - вклад учителя: отметка 2–5 → шкала 0–100;
    - небольшой бонус за активность по логам (мотивация к прохождению шагов).
    """
    base = float(session.score_percent or 0)
    n_events = EventLog.objects.filter(session=session).count()
    activity = min(12.0, float(n_events) * 0.12)

    mark = grade_2_5
    if mark is None:
        mark = 4 if review_status == "accepted" else 2
    mark = max(2, min(5, int(mark)))
    teacher_100 = (mark - 2) / 3.0 * 100.0

    blended = 0.60 * base + 0.30 * teacher_100 + 0.10 * min(100.0, activity * 7)
    if review_status == "rejected":
        blended = min(blended, max(30.0, base * 0.7))

    session.teacher_final_mark = mark
    session.mastery_percent = round(min(100.0, max(0.0, blended)), 1)
    session.passed = session.mastery_percent >= 50.0
    session.save(
        update_fields=["teacher_final_mark", "mastery_percent", "passed"]
    )

    EventLog.objects.create(
        user=session.user,
        session=session,
        event="teacher_mastery_recalculated",
        payload={
            "auto_score": base,
            "teacher_mark": mark,
            "review_status": review_status,
            "mastery_percent": session.mastery_percent,
            "passed": session.passed,
        },
    )


def _get_latest_final_review_attempt(session):
    """Последняя отправка финальной задачи на проверку учителю для сессии."""
    return (
        TaskAttempt.objects.filter(session=session)
        .exclude(teacher_review_status="")
        .order_by("-created_at", "-id")
        .first()
    )


def _build_final_review_payload(session):
    attempt = _get_latest_final_review_attempt(session)
    if not attempt:
        return None
    return {
        "attempt_id": attempt.id,
        "status": attempt.teacher_review_status or "pending",
        "auto_is_correct": attempt.is_correct,
        "teacher_grade_2_5": attempt.teacher_grade_2_5,
        "teacher_comment": attempt.teacher_comment or "",
        "reviewed_at": attempt.reviewed_at.isoformat() if attempt.reviewed_at else None,
        "mastery_percent": session.mastery_percent,
        "teacher_final_mark": session.teacher_final_mark,
    }


ALLOWED_STAGES = {
    "comprehension",
    "typical_task",
    "learning_path_choice",
    "task_preview",
    "task_list",
    "difficulty_assessment",
    "solving_easy",
    "solving_medium",
    "solving_hard",
    "method_composition",
    "step_by_step",
    "compact_solving",
    "completed",
}

ALLOWED_STAGE_TRANSITIONS = {
    "comprehension": {"comprehension", "typical_task"},
    "typical_task": {"learning_path_choice", "task_preview", "task_list"},
    "learning_path_choice": {"task_preview", "task_list"},
    "task_preview": {"task_list", "difficulty_assessment"},
    "difficulty_assessment": {"solving_easy", "solving_medium", "solving_hard", "method_composition", "step_by_step", "compact_solving"},
    "method_composition": {"step_by_step", "solving_medium", "task_list"},
    "task_list": {"step_by_step", "compact_solving", "solving_easy", "solving_medium", "solving_hard", "method_composition", "completed"},
    "solving_easy": {"task_list", "step_by_step", "compact_solving", "completed"},
    "solving_medium": {"task_list", "step_by_step", "compact_solving", "completed"},
    "solving_hard": {"task_list", "step_by_step", "compact_solving", "completed"},
    "step_by_step": {"task_list", "step_by_step", "compact_solving", "solving_easy", "solving_medium", "solving_hard", "completed"},
    "compact_solving": {"task_list", "step_by_step", "compact_solving", "solving_easy", "solving_medium", "solving_hard", "completed"},
    "completed": {"completed"},
}


# =============================================================================
# /api/catalog/ — дерево классов → разделы → темы
# =============================================================================

class CatalogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Каталог: иерархия классов, разделов и тем"""
    queryset = SchoolClass.objects.prefetch_related(
        "sections__topics__knowledge_systems"
    ).order_by("number")
    serializer_class = SchoolClassSerializer
    permission_classes = [permissions.IsAuthenticated]


# =============================================================================
# /api/ks/<id>/ — Система знаний
# =============================================================================

class KnowledgeSystemViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Детали Системы знаний"""
    queryset = KnowledgeSystem.objects.select_related("topic").prefetch_related(
        "zones",
        "questions__correct_zones",
        "clozes",
        "tasks",
    )
    serializer_class = KnowledgeSystemDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    # --------------------------------------------------------------------------
    # POST /api/ks/<id>/check/
    # Проверка ответов этапа "Осмысление СК" (соответствия + cloze)
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def check(self, request, pk=None):
        from .services import ComprehensionCheckService

        ks: KnowledgeSystem = self.get_object()
        data = request.data or {}

        # Преобразуем mappings из списка в словарь
        mappings_raw = data.get("mappings", [])
        mappings = {}
        if isinstance(mappings_raw, list):
            for item in mappings_raw:
                if isinstance(item, dict):
                    q_id = item.get("question_id")
                    zones = item.get("selected_zone_ids", [])
                    if q_id is not None:
                        mappings[str(q_id)] = zones

        # Преобразуем cloze_answers из списка в словарь
        cloze_answers_raw = data.get("cloze_answers", [])
        cloze_answers = {}
        if isinstance(cloze_answers_raw, list):
            for item in cloze_answers_raw:
                if isinstance(item, dict):
                    gap_id = item.get("gap_id") or item.get("position")
                    answer = item.get("answer", "")
                    if gap_id is not None:
                        cloze_answers[str(gap_id)] = answer

        # Использование сервиса для проверки
        service = ComprehensionCheckService(ks)
        check_result = service.check_all(mappings, cloze_answers)

        # Подсчёт процента
        total_mapping_items = len(check_result["questions"]["question_results"])
        total_cloze_items = len(check_result["cloze"]["cloze_results"])
        total_items = total_mapping_items + total_cloze_items

        correct_items = (
            sum(1 for q in check_result["questions"]["question_results"] if q["is_correct"])
            + sum(1 for c in check_result["cloze"]["cloze_results"] if c["is_correct"])
        )

        # Если нет вопросов, считаем что пройдено
        if total_items == 0:
            score_percent = 100.0
            passed = True
        else:
            score_percent = round((correct_items / total_items) * 100, 2)
            passed = score_percent >= ks.comprehension_pass_threshold

        # Сохранение сессии
        session, created = LearningSession.objects.get_or_create(
            user=request.user,
            ks=ks,
            finished_at__isnull=True,
            defaults={"current_stage": "comprehension"}
        )
        session.comprehension_score = score_percent
        session.comprehension_passed = passed
        if passed:
            session.current_stage = "typical_task"
        session.save()

        # Логирование
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

        # --- Ответ
        mapping_feedback = [
            {"question_id": q["question_id"], "ok": q["is_correct"]}
            for q in check_result["questions"]["question_results"]
        ]
        cloze_feedback = [
            {"position": c["position"], "ok": c["is_correct"]}
            for c in check_result["cloze"]["cloze_results"]
        ]

        return Response({
                "passed": passed,
                "score_percent": score_percent,
                "mapping_feedback": mapping_feedback,
                "cloze_feedback": cloze_feedback,
            "next_stage": "typical_task" if passed else "comprehension",
            "session_id": session.id,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/ks/<id>/zones/
    # Сохранение зон (для редактора)
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def zones(self, request, pk=None):
        ks = self.get_object()
        zones = request.data.get("zones", [])
        created = []
        with transaction.atomic():
            KSZone.objects.filter(ks=ks).delete()
            for z in zones:
                zone = KSZone.objects.create(
                    ks=ks,
                    x=z["x"],
                    y=z["y"],
                    width=z["width"],
                    height=z["height"],
                    label=z.get("label", ""),
                )
                created.append(zone.id)
        return Response({"created_zone_ids": created}, status=status.HTTP_201_CREATED)

    # --------------------------------------------------------------------------
    # POST /api/ks/<id>/bind_zones/
    # Привязка зон к вопросам
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def bind_zones(self, request, pk=None):
        ks = self.get_object()
        data = request.data or []
        with transaction.atomic():
            for item in data:
                q = KSQuestion.objects.get(pk=item["question_id"], ks=ks)
                q.correct_zones.set(item["zone_ids"])
        return Response({"ok": True}, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # GET /api/ks/<id>/tasks/
    # Список задач СК
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["get"])
    def tasks(self, request, pk=None):
        ks = self.get_object()
        tasks = Task.objects.filter(ks=ks).order_by("order")
        data = [{
            "id": t.id,
            "order": t.order,
            "title": t.title,
            "text": t.text,
            "difficulty": t.difficulty,
            "has_answer": t.correct_answer is not None or bool(t.correct_answer_text),
        } for t in tasks]
        return Response({"tasks": data}, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # GET /api/ks/<id>/method/
    # Метод решения
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["get"])
    def method(self, request, pk=None):
        ks = self.get_object()
        try:
            method = ks.solution_method
            steps = method.steps.all().order_by("order")
            return Response({
                "title": method.title,
                "description": method.description,
                "steps": [{
                    "id": s.id,
                    "order": s.order,
                    "title": s.title,
                    "description": s.description,
                    "hint": s.hint,
                    "hide_title_in_composition": s.hide_title_in_composition,
                } for s in steps]
            }, status=status.HTTP_200_OK)
        except SolutionMethod.DoesNotExist:
            return Response({"detail": "Метод решения не найден"}, status=status.HTTP_404_NOT_FOUND)

    # --------------------------------------------------------------------------
    # POST /api/ks/<id>/save_method/
    # Сохранить/обновить метод решения
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def save_method(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "Только учитель может изменять метод решения"}, status=status.HTTP_403_FORBIDDEN)
        ks = self.get_object()
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        
        if not title:
            return Response({"detail": "Название метода обязательно"}, status=status.HTTP_400_BAD_REQUEST)
        
        method, created = SolutionMethod.objects.get_or_create(
            ks=ks,
            defaults={"title": title, "description": description}
        )
        
        if not created:
            method.title = title
            method.description = description
            method.save()
        
        return Response({
            "id": method.id,
            "title": method.title,
            "description": method.description,
            "created": created
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/ks/<id>/save_step/
    # Сохранить/обновить шаг метода
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def save_step(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "Только учитель может изменять шаги метода"}, status=status.HTTP_403_FORBIDDEN)
        ks = self.get_object()
        
        try:
            method = ks.solution_method
        except SolutionMethod.DoesNotExist:
            return Response({"detail": "Сначала создайте метод решения"}, status=status.HTTP_404_NOT_FOUND)
        
        step_id = request.data.get("step_id")  # Если есть - обновляем, иначе создаем
        order = request.data.get("order")
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        hint = request.data.get("hint", "").strip()
        hide_title_in_composition = request.data.get("hide_title_in_composition", False)
        
        if not order or not title:
            return Response({"detail": "Порядок и название шага обязательны"}, status=status.HTTP_400_BAD_REQUEST)
        
        if step_id:
            # Обновление существующего шага
            try:
                step = SolutionStep.objects.get(pk=step_id, method=method)
                step.order = order
                step.title = title
                step.description = description
                step.hint = hint
                step.hide_title_in_composition = hide_title_in_composition
                step.save()
                created = False
            except SolutionStep.DoesNotExist:
                return Response({"detail": "Шаг не найден"}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Создание нового шага
            step, created = SolutionStep.objects.get_or_create(
                method=method,
                order=order,
                defaults={
                    "title": title,
                    "description": description,
                    "hint": hint,
                    "hide_title_in_composition": hide_title_in_composition,
                }
            )
            if not created:
                step.title = title
                step.description = description
                step.hint = hint
                step.hide_title_in_composition = hide_title_in_composition
                step.save()
        
        return Response({
            "id": step.id,
            "order": step.order,
            "title": step.title,
            "description": step.description,
            "hint": step.hint,
            "hide_title_in_composition": step.hide_title_in_composition,
            "created": created
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # DELETE /api/ks/<id>/delete_step/
    # Удалить шаг метода
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def delete_step(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "Только учитель может удалять шаги метода"}, status=status.HTTP_403_FORBIDDEN)
        ks = self.get_object()
        step_id = request.data.get("step_id")
        
        if not step_id:
            return Response({"detail": "step_id обязателен"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            step = SolutionStep.objects.get(pk=step_id, method__ks=ks)
            step.delete()
            return Response({"ok": True}, status=status.HTTP_200_OK)
        except SolutionStep.DoesNotExist:
            return Response({"detail": "Шаг не найден"}, status=status.HTTP_404_NOT_FOUND)

    # --------------------------------------------------------------------------
    # POST /api/ks/<id>/check_method_composition/
    # Проверка дополненного метода решения
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def check_method_composition(self, request, pk=None):
        from .models import SolutionMethod, SolutionStep
        
        ks = self.get_object()
        try:
            method = ks.solution_method
        except SolutionMethod.DoesNotExist:
            return Response({"detail": "Метод решения не найден"}, status=status.HTTP_404_NOT_FOUND)
        
        student_answers = request.data.get("answers", {})  # {stepOrder: "название"}
        
        # Получаем все шаги, которые нужно было заполнить
        steps_to_fill = method.steps.filter(hide_title_in_composition=True).order_by("order")
        
        correct = []
        wrong = []
        correct_answers = {}
        
        for step in steps_to_fill:
            student_answer = student_answers.get(str(step.order), "").strip().lower()
            correct_answer = step.title.strip().lower()
            
            # Нечёткое сравнение (игнорируем регистр и лишние пробелы)
            if student_answer == correct_answer:
                correct.append(step.order)
            else:
                wrong.append(step.order)
                correct_answers[step.order] = step.title
        
        return Response({
            "correct": correct,
            "wrong": wrong,
            "correct_answers": correct_answers,
            "total": len(steps_to_fill),
            "correct_count": len(correct),
        }, status=status.HTTP_200_OK)


# =============================================================================
# /api/session/ — Сессии обучения
# =============================================================================

class LearningSessionViewSet(viewsets.GenericViewSet):
    """Управление сессиями обучения"""
    permission_classes = [permissions.IsAuthenticated]

    # --------------------------------------------------------------------------
    # GET /api/session/current/?ks_id=...
    # Получить текущую сессию или создать новую
    # Возвращает текущую незавершенную сессию и последнюю завершенную (если есть)
    # --------------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def current(self, request):
        ks_id = request.query_params.get("ks_id")
        if not ks_id:
            return Response({"detail": "ks_id required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            ks = KnowledgeSystem.objects.get(pk=ks_id)
        except KnowledgeSystem.DoesNotExist:
            return Response({"detail": "KS not found"}, status=status.HTTP_404_NOT_FOUND)

        # Получаем текущую незавершенную сессию
        current_session = LearningSession.objects.filter(
            user=request.user,
            ks=ks,
            finished_at__isnull=True
        ).first()

        # Получаем последнюю завершенную сессию
        last_completed = LearningSession.objects.filter(
            user=request.user,
            ks=ks,
            finished_at__isnull=False
        ).order_by("-finished_at").first()

        # Если нет незавершенной сессии, но есть завершенная - не создаем новую автоматически
        # Пользователь сам решит, хочет ли он начать заново
        if not current_session:
            # Если есть завершенная сессия, возвращаем информацию о ней
            if last_completed:
                return Response({
                    "id": None,
                    "ks_id": ks.id,
                    "current_stage": None,
                    "has_completed": True,
                    # Дублируем итоги на верхний уровень — сайдбар и прочий UI читают эти поля
                    "tasks_solved_count": last_completed.tasks_solved_count,
                    "tasks_correct_count": last_completed.tasks_correct_count,
                    "target_tasks_count": last_completed.target_tasks_count,
                    "score_percent": last_completed.score_percent,
                    "passed": last_completed.passed,
                    "mastery_percent": last_completed.mastery_percent,
                    "teacher_final_mark": last_completed.teacher_final_mark,
                    "final_review": _build_final_review_payload(last_completed),
                    "last_completed": {
                        "id": last_completed.id,
                        "score_percent": last_completed.score_percent,
                        "tasks_correct_count": last_completed.tasks_correct_count,
                        "tasks_solved_count": last_completed.tasks_solved_count,
                        "comprehension_score": last_completed.comprehension_score,
                        "finished_at": last_completed.finished_at.isoformat() if last_completed.finished_at else None,
                        "passed": last_completed.passed,
                        "result_summary": _build_result_summary(last_completed),
                        "mastery_percent": last_completed.mastery_percent,
                        "teacher_final_mark": last_completed.teacher_final_mark,
                        "final_review": _build_final_review_payload(last_completed),
                    },
                    "created": False,
                    "result_summary": _build_result_summary(last_completed),
                }, status=status.HTTP_200_OK)
            # Если нет ни одной сессии, создаем новую
            else:
                current_session = LearningSession.objects.create(
                    user=request.user,
                    ks=ks,
                    current_stage="comprehension"
                )
                created = True
        else:
            created = False

        response_data = {
            "id": current_session.id,
            "ks_id": current_session.ks_id,
            "current_stage": current_session.current_stage,
            "difficulty_choice": current_session.difficulty_choice,
            "target_tasks_count": current_session.target_tasks_count,
            "scenario_two_errors_used": current_session.scenario_two_errors_used,
            "comprehension_passed": current_session.comprehension_passed,
            "comprehension_score": current_session.comprehension_score,
            "tasks_solved_count": current_session.tasks_solved_count,
            "tasks_correct_count": current_session.tasks_correct_count,
            "wrong_attempts_in_row": current_session.wrong_attempts_in_row,
            "score_percent": current_session.score_percent,
            "passed": current_session.passed,
            "mastery_percent": current_session.mastery_percent,
            "teacher_final_mark": current_session.teacher_final_mark,
            "started_at": current_session.started_at.isoformat(),
            "created": created,
            "has_completed": False,
            "step_by_step_completions": current_session.step_by_step_completions,
            "step_error_history": current_session.step_error_history or {},
            "result_summary": _build_result_summary(current_session),
            "final_review": _build_final_review_payload(current_session),
        }

        # Добавляем информацию о последней завершенной сессии, если есть
        if last_completed:
            response_data["last_completed"] = {
                "id": last_completed.id,
                "score_percent": last_completed.score_percent,
                "tasks_correct_count": last_completed.tasks_correct_count,
                "tasks_solved_count": last_completed.tasks_solved_count,
                "comprehension_score": last_completed.comprehension_score,
                "finished_at": last_completed.finished_at.isoformat() if last_completed.finished_at else None,
                "passed": last_completed.passed,
                "result_summary": _build_result_summary(last_completed),
                "mastery_percent": last_completed.mastery_percent,
                "teacher_final_mark": last_completed.teacher_final_mark,
                "final_review": _build_final_review_payload(last_completed),
            }

        return Response(response_data, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/set_difficulty/
    # Установить оценку трудности
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def set_difficulty(self, request, pk=None):
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        difficulty = request.data.get("difficulty")  # easy, medium, hard
        if difficulty not in ("easy", "medium", "hard"):
            return Response({"detail": "Invalid difficulty"}, status=status.HTTP_400_BAD_REQUEST)

        session.difficulty_choice = difficulty
        # Всегда 6 «ситуаций» в треке: 1–5 обычные, 6-я — итоговая с обязательным фото и проверкой учителя.
        session.target_tasks_count = 6

        st = session.current_stage
        if st in (
            "task_list",
            "difficulty_assessment",
            "solving_easy",
            "solving_medium",
            "solving_hard",
        ):
            if difficulty == "easy":
                session.current_stage = "task_list"
            elif difficulty == "medium":
                session.current_stage = "method_composition"
            else:
                session.current_stage = "step_by_step"
                # Старт задачи 1 на «трудно» = пооперационный контроль (S2).
                # (Итог задачи 1 не переносится — сбрасывается на 2-й задаче.)
                session.support_level = 2

        session.save()

        EventLog.objects.create(
            user=request.user,
            session=session,
            event="difficulty_set",
            payload={
                "difficulty": difficulty,
                "next_stage": session.current_stage,
                "target_tasks_count": session.target_tasks_count,
            }
        )

        return Response({
            "ok": True,
            "difficulty": difficulty,
            "next_stage": session.current_stage,
            "target_tasks_count": session.target_tasks_count,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/mark_scenario_two_errors_used/
    # После успешного cloze при 2 ошибках — больше не показывать тяжёлый сценарий в этой сессии
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def mark_scenario_two_errors_used(self, request, pk=None):
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        session.scenario_two_errors_used = True
        session.save(update_fields=["scenario_two_errors_used"])
        return Response({"ok": True, "scenario_two_errors_used": True})

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/complete_step_by_step/
    # Отметить успешное завершение пооперационного контроля (для постепенного сворачивания)
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def complete_step_by_step(self, request, pk=None):
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        session.step_by_step_completions += 1
        session.save(update_fields=["step_by_step_completions"])
        return Response({
            "ok": True,
            "step_by_step_completions": session.step_by_step_completions,
        })

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/reset/
    # Начать заново: завершить текущую сессию (если не завершена) и создать новую
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def reset(self, request, pk=None):
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        if not _is_pilot_user(request.user):
            return Response(
                {"detail": "Сброс доступен только в режиме апробации"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Если сессия не завершена, завершаем её
        if not session.finished_at:
            from django.utils import timezone
            session.finished_at = timezone.now()
            session.save()
        
        # Создаем новую сессию
        new_session = LearningSession.objects.create(
            user=request.user,
            ks=session.ks,
            current_stage="comprehension"
        )
        
        EventLog.objects.create(
            user=request.user,
            session=new_session,
            event="session_started",
            payload={"previous_session_id": session.id}
        )
        
        return Response({
            "ok": True,
            "session_id": new_session.id,
            "previous_session_id": session.id,
            "current_stage": new_session.current_stage
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/session/start_new/?ks_id=...
    # Создать новую сессию для системы знаний (даже если есть завершенная)
    # --------------------------------------------------------------------------
    @action(detail=False, methods=["post"])
    def start_new(self, request):
        ks_id = request.query_params.get("ks_id") or request.data.get("ks_id")
        if not ks_id:
            return Response({"detail": "ks_id required"}, status=status.HTTP_400_BAD_REQUEST)
        if not _is_pilot_user(request.user):
            return Response(
                {"detail": "Новый запуск доступен только в режиме апробации"},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        try:
            ks = KnowledgeSystem.objects.get(pk=ks_id)
        except KnowledgeSystem.DoesNotExist:
            return Response({"detail": "KS not found"}, status=status.HTTP_404_NOT_FOUND)

        # Создаем новую сессию
        new_session = LearningSession.objects.create(
            user=request.user,
            ks=ks,
            current_stage="comprehension"
        )
        
        EventLog.objects.create(
            user=request.user,
            session=new_session,
            event="session_started",
            payload={"ks_id": ks.id}
        )
        
        return Response({
            "ok": True,
            "session_id": new_session.id,
            "current_stage": new_session.current_stage
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/submit_typical_task/
    # Проверить выбранный вариант типовой задачи
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def submit_typical_task(self, request, pk=None):
        from .models import TypicalTaskOption

        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        option_id = request.data.get("option_id")
        if not option_id:
            return Response(
                {"detail": "Не выбран вариант ответа"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            option = TypicalTaskOption.objects.get(pk=option_id, ks=session.ks)
        except TypicalTaskOption.DoesNotExist:
            return Response(
                {"detail": "Вариант не найден"},
                status=status.HTTP_404_NOT_FOUND,
            )

        session.typical_task_option = option
        session.typical_task_correct = option.is_correct
        session.save()

        # Собираем все варианты с пометками правильности и пояснениями
        all_options = []
        for opt in TypicalTaskOption.objects.filter(ks=session.ks).order_by("order"):
            all_options.append({
                "id": opt.id,
                "text": opt.text,
                "is_correct": opt.is_correct,
                "explanation": opt.explanation,
            })

        return Response({
            "ok": True,
            "is_correct": option.is_correct,
            "selected_id": option.id,
            "explanation": option.explanation,
            "all_options": all_options,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/check_typical_task_cloze/
    # Проверить заполнение пропусков в формулировке типовой задачи
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def check_typical_task_cloze(self, request, pk=None):
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        ks = session.ks
        blanks = ks.typical_task_cloze_blanks or []
        if not blanks:
            return Response({"detail": "Cloze не настроен"}, status=status.HTTP_400_BAD_REQUEST)

        # answers: {"0": "Описать", "1": "найти", ...}
        answers = request.data.get("answers", {})

        correct_positions = []
        wrong_positions = []

        for blank in blanks:
            pos = str(blank["position"])
            student = answers.get(pos, "").strip()
            expected = blank["correct"].strip()

            if student.lower() == expected.lower():
                correct_positions.append(blank["position"])
            else:
                wrong_positions.append({
                    "position": blank["position"],
                    "student": student,
                    "correct": expected,
                })

        total = len(blanks)
        score = len(correct_positions) / total if total > 0 else 0
        passed = len(wrong_positions) == 0

        return Response({
            "ok": True,
            "passed": passed,
            "score": round(score * 100),
            "correct_positions": correct_positions,
            "wrong_positions": wrong_positions,
            "total": total,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/advance_stage/
    # Перейти к следующему этапу
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def advance_stage(self, request, pk=None):
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        next_stage = request.data.get("next_stage")
        if next_stage:
            if (
                not _is_pilot_user(request.user)
                and session.current_stage == "comprehension"
                and next_stage == "typical_task"
            ):
                return Response(
                    {"detail": "В режиме «ученик» нельзя пропускать этап осмысления"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if next_stage not in ALLOWED_STAGES:
                return Response({"detail": "Invalid next_stage"}, status=status.HTTP_400_BAD_REQUEST)
            allowed_next = ALLOWED_STAGE_TRANSITIONS.get(session.current_stage, set())
            if next_stage not in allowed_next:
                return Response({
                    "detail": "Transition is not allowed",
                    "current_stage": session.current_stage,
                    "requested_stage": next_stage,
                }, status=status.HTTP_400_BAD_REQUEST)
            session.current_stage = next_stage
            # Запись уровня опоры (инертно — читается маршрутизацией только при SCAFFOLD_V2).
            if next_stage == "step_by_step":
                session.support_level = max(session.support_level, 2)
                session.last_task_clean = False
            elif next_stage == "compact_solving":
                session.support_level = max(session.support_level, 1)
            # Если переходим на этап "completed", завершаем сессию
            if next_stage == "completed" and not session.finished_at:
                from django.utils import timezone
                session.finished_at = timezone.now()
            session.save()

        return Response({
            "ok": True,
            "current_stage": session.current_stage,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/set_learning_path/
    # Выбрать порядок работы (слайд 8)
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def set_learning_path(self, request, pk=None):
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        learning_path = request.data.get("learning_path")
        if learning_path not in ("self_solve", "review_example", "discuss_and_review"):
            return Response({"detail": "Invalid learning_path"}, status=status.HTTP_400_BAD_REQUEST)

        session.learning_path = learning_path
        
        # Определяем следующий этап в зависимости от выбора
        if learning_path == "self_solve":
            session.current_stage = "task_list"
            # Устанавливаем начальные параметры для адаптивного подбора
            session.current_task_index = 0
            session.target_tasks_count = 6
        elif learning_path == "review_example":
            # Переход к разбору примера (пока что на task_list, но можно добавить отдельный этап)
            session.current_stage = "task_list"
            session.current_task_index = 0
            session.target_tasks_count = 6
        else:  # discuss_and_review
            # Переход к обсуждению и разбору примера
            session.current_stage = "task_list"
            session.current_task_index = 0
            session.target_tasks_count = 6
        
        session.save()

        EventLog.objects.create(
            user=request.user,
            session=session,
            event="learning_path_set",
            payload={"learning_path": learning_path, "next_stage": session.current_stage}
        )

        return Response({
            "ok": True,
            "learning_path": learning_path,
            "next_stage": session.current_stage,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # GET /api/session/<id>/next_task/
    # Получить следующую задачу с адаптивным подбором сложности
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["get"])
    def next_task(self, request, pk=None):
        from .models import Task, TaskAttempt
        
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        # 0 и 1 давали «последняя ситуация» уже на первой задаче (сравнение с Math.max(1,0)==1 и 1 or 6 в submit).
        if not session.target_tasks_count or session.target_tasks_count < 2:
            session.target_tasks_count = 6
            session.save(update_fields=["target_tasks_count"])

        latest_final = _build_final_review_payload(session)
        final_rejected = latest_final and latest_final.get("status") == "rejected"
        if session.tasks_solved_count >= session.target_tasks_count and not final_rejected:
            if session.current_stage != "completed" or not session.finished_at:
                session.current_stage = "completed"
                if not session.finished_at:
                    session.finished_at = timezone.now()
                session.save()
                _compute_and_save_score(session)
            return Response({
                "task": None,
                "is_completed": True,
                "tasks_solved": session.tasks_solved_count,
                "tasks_correct": session.tasks_correct_count,
                "target_tasks_count": session.target_tasks_count,
                "current_stage": "completed",
            }, status=status.HTTP_200_OK)

        # Получаем все задачи для этой СК
        all_tasks = Task.objects.filter(ks=session.ks).order_by("order")
        if not all_tasks.exists():
            return Response({"detail": "No tasks available"}, status=status.HTTP_404_NOT_FOUND)

        # Получаем только ПРАВИЛЬНО решённые задачи в этой сессии
        solved_task_ids = set(
            TaskAttempt.objects.filter(session=session, is_correct=True)
            .values_list("task_id", flat=True)
        )

        # Адаптивный подбор: после этапа ознакомления система подбирает
        # следующую задачу по успешности и серии ошибок ученика.
        base_difficulty_level = 3
        if session.difficulty_choice == "easy":
            base_difficulty_level = 2
        elif session.difficulty_choice == "hard":
            base_difficulty_level = 4

        current_difficulty_level = base_difficulty_level
        if session.wrong_attempts_in_row >= 2:
            current_difficulty_level = max(1, base_difficulty_level - 1)
        elif session.tasks_correct_count > 0 and session.tasks_solved_count > 0:
            success_rate = session.tasks_correct_count / session.tasks_solved_count
            if success_rate >= 0.8:
                current_difficulty_level = min(5, base_difficulty_level + 1)
            elif success_rate < 0.6:
                current_difficulty_level = max(1, base_difficulty_level - 1)

        available_tasks = all_tasks.exclude(id__in=solved_task_ids).filter(
            difficulty__gte=max(1, current_difficulty_level - 1),
            difficulty__lte=min(5, current_difficulty_level + 1),
        )

        # Если нет задач подходящей сложности, берем любую нерешённую.
        if not available_tasks.exists():
            available_tasks = all_tasks.exclude(id__in=solved_task_ids)

        available_tasks = available_tasks.order_by("order")

        if not available_tasks.exists():
            if session.current_stage != "completed":
                session.current_stage = "completed"
                if not session.finished_at:
                    session.finished_at = timezone.now()
                session.save()
                _compute_and_save_score(session)
            return Response({
                "task": None,
                "is_completed": True,
                "tasks_solved": session.tasks_solved_count,
                "tasks_correct": session.tasks_correct_count,
                "target_tasks_count": session.target_tasks_count,
            }, status=status.HTTP_200_OK)

        # Выбираем задачу (можно добавить более сложную логику)
        # Пока берем первую подходящую
        next_task = available_tasks.first()

        # --- Шкала опоры (SCAFFOLD_V2) ---
        support_stage = None
        offer_practice_choice = False
        remaining_tasks_list = []
        if _scaffold_v2_enabled():
            is_last = (session.tasks_solved_count + 1) >= session.target_tasks_count
            chosen_id = request.query_params.get("chosen_task_id")
            proceed_control = request.query_params.get("proceed_control")

            # Ученик выбрал конкретную задачу для самостоятельной тренировки.
            if chosen_id:
                picked = all_tasks.exclude(id__in=solved_task_ids).filter(id=chosen_id).first()
                if picked:
                    next_task = picked
                session.control_choice_offered = True
                session.save(update_fields=["control_choice_offered"])
            elif proceed_control:
                session.control_choice_offered = True
                session.save(update_fields=["control_choice_offered"])
            # Развилка перед контрольной: предлагаем выбрать ещё задачу (один раз).
            # Задачу ВСЁ РАВНО возвращаем (это последняя/контрольная) — fallback на случай,
            # если фронт не покажет модалку; навигация не ломается.
            elif is_last and session.support_level > 0 and not session.control_choice_offered:
                offer_practice_choice = True
                remaining_tasks_list = list(
                    all_tasks.exclude(id__in=solved_task_ids).exclude(id=next_task.id)
                    .values("id", "order", "title")
                )

            # Маршрутизация по уровню опоры (идемпотентно — зависит только от support_level).
            if session.support_level == 1:
                support_stage = "compact_solving"
            elif session.support_level == 2:
                support_stage = "step_by_step"
            if support_stage and session.current_stage != support_stage:
                session.current_stage = support_stage
                session.save(update_fields=["current_stage"])

        illustration_url = None
        if next_task.illustration:
            try:
                illustration_url = request.build_absolute_uri(next_task.illustration.url)
            except Exception:
                pass
        return Response({
            "task": {
                "id": next_task.id,
                "order": next_task.order,
                "title": next_task.title,
                "text": next_task.text,
                "difficulty": next_task.difficulty,
                "answer_unit": next_task.answer_unit or "",
                "allowed_answer_units": next_task.allowed_answer_units or ([next_task.answer_unit] if next_task.answer_unit else []),
                "illustration_url": illustration_url,
            },
            "is_completed": False,
            "current_task_index": session.current_task_index,
            "tasks_solved": session.tasks_solved_count,
            "tasks_correct": session.tasks_correct_count,
            "target_tasks_count": session.target_tasks_count,
            "remaining_tasks": max(0, session.target_tasks_count - session.tasks_solved_count),
            "support_level": session.support_level,
            "support_stage": support_stage,
            "offer_practice_choice": offer_practice_choice,
            "remaining_tasks_list": remaining_tasks_list,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/session/<id>/move_to_next_task/
    # Перейти к следующей задаче после правильного ответа
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def move_to_next_task(self, request, pk=None):
        try:
            session = LearningSession.objects.get(pk=pk, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        session.current_task_index += 1
        
        # Проверяем, достигли ли целевого количества задач
        if session.tasks_solved_count >= session.target_tasks_count:
            session.current_stage = "completed"
            if not session.finished_at:
                session.finished_at = timezone.now()
            _compute_and_save_score(session)
        
        session.save()

        return Response({
            "ok": True,
            "current_task_index": session.current_task_index,
            "tasks_solved": session.tasks_solved_count,
            "target_tasks_count": session.target_tasks_count,
            "is_completed": session.tasks_solved_count >= session.target_tasks_count,
            "current_stage": session.current_stage,
        }, status=status.HTTP_200_OK)


# =============================================================================
# /api/task/<id>/ — Работа с задачами
# =============================================================================

class TaskViewSet(viewsets.GenericViewSet):
    """Работа с задачами"""
    permission_classes = [permissions.IsAuthenticated]
    # DRF требует serializer_class для генерации форм в браузере (GET на actions),
    # хотя мы возвращаем данные вручную. Укажем базовый сериализатор задач.
    serializer_class = TaskDetailSerializer

    # --------------------------------------------------------------------------
    # GET /api/task/<id>/
    # Получить детали задачи
    # --------------------------------------------------------------------------
    def retrieve(self, request, pk=None):
        try:
            task = Task.objects.select_related("ks").prefetch_related(
                "solution_steps__step"
            ).get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "id": task.id,
            "order": task.order,
            "title": task.title,
            "text": task.text,
            "difficulty": task.difficulty,
            "answer_unit": task.answer_unit,
            "allowed_answer_units": task.allowed_answer_units or ([task.answer_unit] if task.answer_unit else []),
            "ks_id": task.ks_id,
            "ks_title": task.ks.title,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/task/<id>/submit/
    # Отправить ответ на задачу
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        from .services import TaskSubmissionService

        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        session_id = request.data.get("session_id")
        if not session_id:
            return Response({"detail": "session_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = LearningSession.objects.get(pk=session_id, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        if session.ks_id != task.ks_id:
            return Response(
                {"detail": "Task does not belong to session knowledge system"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Подготовка данных
        answer_files = list(request.FILES.getlist("answer_images"))
        legacy_image = request.FILES.get("answer_image")
        if legacy_image and not answer_files:
            answer_files = [legacy_image]

        # Использование сервиса для обработки ответа
        service = TaskSubmissionService(task, session, request.user)
        result = service.process_answer({
            "answer_numeric": request.data.get("answer_numeric"),
            "answer_unit": request.data.get("answer_unit"),
            "answer_text": request.data.get("answer_text", ""),
            "answer_files": answer_files,
            "time_spent_seconds": request.data.get("time_spent_seconds", 0),
        })

        if "errors" in result:
            return Response(result["errors"], status=status.HTTP_400_BAD_REQUEST)

        attempt = result["attempt"]
        is_correct = result["is_correct"]
        is_final_grade_task = result["is_final_grade_task"]

        # Подсчёт попыток для этой задачи
        task_all_attempts = TaskAttempt.objects.filter(session=session, task=task)
        task_attempts_count = task_all_attempts.count()
        task_wrong_attempts_count = task_all_attempts.filter(is_correct=False).count()

        # Формирование ответа
        solution_image_url = None
        if task.solution_image:
            solution_image_url = request.build_absolute_uri(task.solution_image.url)

        solution_steps = []
        task_solution_steps = task.solution_steps.select_related("step").order_by("step__order").all()
        for tss in task_solution_steps:
            step_data = {
                "order": tss.step.order,
                "step_title": tss.step.title,
                "step_type": tss.step_type,
            }
            # content есть у всех типов кроме schema (там используется schema_data).
            # Раньше отдавали content только для step_type == "text" — из-за этого
            # шаги symbol/solution/boolean/text_pick приходили пустыми.
            if tss.step_type == "schema":
                step_data["schema_data"] = tss.schema_data
            else:
                step_data["content"] = tss.content
            if tss.image:
                step_data["image_url"] = request.build_absolute_uri(tss.image.url)
            solution_steps.append(step_data)

        response_data = {
            "attempt_id": attempt.id,
            "tasks_solved_count": session.tasks_solved_count,
            "tasks_correct_count": session.tasks_correct_count,
            "wrong_attempts_in_row": session.wrong_attempts_in_row,
            "current_stage": session.current_stage,
            "task_attempts_count": task_attempts_count,
            "task_wrong_attempts_count": task_wrong_attempts_count,
            "answer_unit": task.answer_unit or "",
            "selected_answer_unit": request.data.get("answer_unit") or task.answer_unit or "",
            "allowed_answer_units": task.allowed_answer_units or ([task.answer_unit] if task.answer_unit else []),
            "is_final_grade_task": is_final_grade_task,
        }

        if is_final_grade_task:
            response_data["teacher_review_status"] = attempt.teacher_review_status or "pending"
        else:
            response_data["is_correct"] = is_correct

        if not is_final_grade_task:
            response_data.update({
                "correct_answer": task.correct_answer,
                "solution_summary": task.solution_summary or "",
                "solution_detailed": task.solution_detailed or "",
                "solution_image_url": solution_image_url,
                "solution_steps": solution_steps,
            })

        urls = []
        if attempt.answer_image:
            urls.append(request.build_absolute_uri(attempt.answer_image.url))
        for row in attempt.answer_images.all().order_by("order", "id"):
            urls.append(request.build_absolute_uri(row.image.url))
        if urls:
            response_data["answer_image_urls"] = urls
            response_data["answer_image_url"] = urls[0]

        return Response(response_data, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # GET /api/task/<id>/solution/
    # Получить эталонное решение
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["get"])
    def solution(self, request, pk=None):
        try:
            task = Task.objects.prefetch_related("solution_steps__step").get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        steps = []
        for ts in task.solution_steps.all().order_by("step__order"):
            step_data = {
                "order": ts.step.order,
                "step_title": ts.step.title,
                "step_type": ts.step_type,
                "content": ts.content,
                "image": request.build_absolute_uri(ts.image.url) if ts.image else None,
            }
            if ts.step_type == "schema":
                step_data["schema_data"] = ts.schema_data
            steps.append(step_data)

        return Response({
            "task_id": task.id,
            "correct_answer": task.correct_answer,
            "answer_unit": task.answer_unit,
            "allowed_answer_units": task.allowed_answer_units or ([task.answer_unit] if task.answer_unit else []),
            "solution_summary": task.solution_summary,
            "solution_detailed": task.solution_detailed,
            "steps": steps,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # GET /api/task/<id>/step_by_step/?session_id=<id>
    # Получить задачу с эталонным решением по шагам для пооперационного контроля.
    # Если передан session_id — также возвращает сохранённые попытки ученика
    # (для восстановления прогресса после F5).
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["get"])
    def step_by_step(self, request, pk=None):
        try:
            task = Task.objects.select_related("ks", "ks__solution_method").prefetch_related(
                "solution_steps__step"
            ).get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            method = task.ks.solution_method
            method_steps = method.steps.all().order_by("order")
        except SolutionMethod.DoesNotExist:
            return Response({"detail": "Solution method not found for this task"}, status=status.HTTP_404_NOT_FOUND)

        solution_steps = {}
        for ts in task.solution_steps.all():
            solution_steps[ts.step.order] = {
                "content": ts.content,
                "image_url": request.build_absolute_uri(ts.image.url) if ts.image else None,
                "step_type": ts.step_type,
                "schema_data": ts.schema_data,
            }

        steps_data = []
        for step in method_steps:
            ref = solution_steps.get(step.order, None)
            steps_data.append({
                "order": step.order,
                "title": step.title,
                "description": step.description,
                "hint": step.hint,
                "step_type": ref["step_type"] if ref else "text",
                "reference_solution": ref,
            })

        # Восстановление прогресса: загружаем сохранённые StepAttempts сессии.
        saved_attempts = {}
        student_schema = None
        session_id = request.query_params.get("session_id")
        if session_id:
            try:
                session = LearningSession.objects.get(pk=session_id, user=request.user)
                task_attempt = (
                    TaskAttempt.objects
                    .filter(session=session, task=task)
                    .prefetch_related("step_attempts__step")
                    .order_by("id")
                    .first()
                )
                if task_attempt:
                    for sa in task_attempt.step_attempts.all():
                        if sa.final_answer:
                            saved_attempts[sa.step.order] = {
                                "student_answer": sa.student_answer,
                                "final_answer": sa.final_answer,
                                "is_correct": sa.is_correct,
                                "chose_system_variant": sa.chose_system_variant,
                                "needs_choice": False,
                            }
                    # Схема ученика (для восстановления редактора)
                    if task_attempt.schema_data:
                        student_schema = task_attempt.schema_data
            except LearningSession.DoesNotExist:
                pass  # не ломаем загрузку — просто не восстанавливаем прогресс

        return Response({
            "task": {
                "id": task.id,
                "order": task.order,
                "title": task.title,
                "text": task.text,
                "difficulty": task.difficulty,
            },
            "method": {
                "title": method.title,
                "description": method.description,
            },
            "steps": steps_data,
            "saved_attempts": saved_attempts,
            "student_schema": student_schema,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/task/<id>/save_student_schema/
    # Сохранить схему ученика (автосохранение из SchemaEditorSection).
    # GET  /api/task/<id>/save_student_schema/?session_id=<id>  — получить схему.
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post", "get"])
    def save_student_schema(self, request, pk=None):
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        session_id = request.data.get("session_id") or request.query_params.get("session_id")
        if not session_id:
            return Response({"detail": "session_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = LearningSession.objects.get(pk=session_id, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        task_attempt = (
            TaskAttempt.objects.filter(session=session, task=task).order_by("id").first()
        )

        if request.method == "GET":
            schema = (task_attempt.schema_data or {}) if task_attempt else {}
            return Response({"schema_data": schema if schema.get("elements") else None})

        # POST — сохраняем схему
        schema_data = request.data.get("schema_data") or {}
        if not task_attempt:
            task_attempt = TaskAttempt.objects.create(
                session=session, task=task, is_correct=None
            )
        task_attempt.schema_data = schema_data
        task_attempt.save(update_fields=["schema_data"])
        return Response({"ok": True})

    # --------------------------------------------------------------------------
    # POST /api/task/<id>/check_step/
    # Проверить ответ ученика на конкретном шаге
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def check_step(self, request, pk=None):
        try:
            task = Task.objects.select_related("ks").get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
        
        session_id = request.data.get("session_id")
        step_order = request.data.get("step_order")
        student_answer = request.data.get("student_answer", "").strip()
        
        if not session_id or not step_order:
            return Response({"detail": "session_id and step_order required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            session = LearningSession.objects.get(pk=session_id, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        if session.ks_id != task.ks_id:
            return Response({"detail": "Task does not belong to session knowledge system"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            step = SolutionStep.objects.get(
                method__ks=task.ks,
                order=step_order
            )
        except SolutionStep.DoesNotExist:
            return Response({"detail": "Step not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Получаем или создаем TaskAttempt для этой задачи.
        # Ранее здесь был get_or_create, но при наличии дублей это приводило к MultipleObjectsReturned.
        task_attempt = (
            TaskAttempt.objects
            .filter(session=session, task=task)
            .order_by("id")
            .first()
        )
        if task_attempt is None:
            task_attempt = TaskAttempt.objects.create(
                session=session,
                task=task,
                is_correct=None,
            )
        
        # Получаем эталонное решение для этого шага
        # Могло сохраниться несколько записей для одной пары (task, step),
        # поэтому берём первый по id, чтобы избежать MultipleObjectsReturned.
        reference_solution = (
            TaskSolutionStep.objects
            .filter(task=task, step=step)
            .order_by("id")
            .first()
        )
        if not reference_solution:
            return Response({
                "detail": "Reference solution not found for this step",
                "needs_manual_check": True
            }, status=status.HTTP_404_NOT_FOUND)
        # Базовое текстовое содержимое (для text / boolean / text_pick по умолчанию)
        reference_content = (reference_solution.content or "").strip()
        
        # Нечёткое сравнение / специализированная логика по типу шага
        student_normalized = student_answer.lower().strip()
        step_type = reference_solution.step_type if hasattr(reference_solution, "step_type") else "text"
        
        import json

        is_similar = False
        needs_choice = False
        reference_answer_for_response = reference_content  # то, что вернём фронтенду

        if step_type == "text_pick":
            # Для text_pick — сравниваем множества слов (порядок не важен)
            reference_normalized = reference_content.lower().strip()
            student_words = set(w for w in student_normalized.split() if w)
            reference_words = set(w for w in reference_normalized.split() if w)
            is_similar = student_words == reference_words
            # Если ответы отличаются, но не пустые - нужен выбор варианта
            needs_choice = not is_similar and bool(student_answer) and bool(reference_content)

        elif step_type == "boolean":
            # content хранит "yes" или "no"
            reference_normalized = reference_content.lower().strip()
            is_similar = bool(student_normalized) and (student_normalized == reference_normalized)
            # Для да/нет не предлагаем выбор варианта — просто фиксируем правильно/неправильно.
            needs_choice = False
            # Для UI отдадим человекочитаемый текст
            mapping = {"yes": "Да", "no": "Нет"}
            reference_answer_for_response = mapping.get(reference_normalized, reference_content)

        elif step_type == "symbol":
            # Для шага "Обозначение величины (Дано)" ожидаем JSON вида {"symbol": "...", "fragment": "..."}
            items = (reference_solution.schema_data or {}).get("items", [])
            target = None
            for it in items:
                if it.get("isTarget"):
                    target = it
                    break
            if target is None and items:
                target = items[0]
            
            target_symbol = (target.get("symbol") if target else "") or ""
            target_fragment = (target.get("fragment") if target else "") or ""
            # Показываем ученику полный эталон краткой записи (Дано + Найти) —
            # это уже корректно записано в reference_solution.content. Если content
            # пустой — собираем из items как fallback.
            if reference_content:
                reference_answer_for_response = reference_content
            else:
                givens = [(it.get("symbol", ""), it.get("fragment", "")) for it in items if not it.get("isTarget")]
                lines = ["Дано:"] + [f"{s} = {f}" for s, f in givens if s]
                if target_symbol:
                    lines.append(f"Найти: {target_symbol}")
                reference_answer_for_response = "\n".join(lines)
            
            try:
                data = json.loads(student_answer) if student_answer else {}
            except (TypeError, json.JSONDecodeError):
                data = {}
            
            student_symbol = (data.get("symbol") or "").strip()
            student_fragment = (data.get("fragment") or "").strip()
            
            # Для «Найти» сравниваем только символ — описание величины (fragment) необязательно.
            is_similar = bool(student_symbol and target_symbol) and (student_symbol == target_symbol)
            needs_choice = False  # здесь выбора варианта не требуется

        else:
            # Обычный текстовый шаг: простое сравнение
            reference_normalized = reference_content.lower().strip()
            is_similar = student_normalized == reference_normalized
            needs_choice = not is_similar and bool(student_answer) and bool(reference_content)
        
        # Создаем или обновляем попытку
        step_attempt, created = StepAttempt.objects.get_or_create(
            task_attempt=task_attempt,
            step=step,
            defaults={
                "student_answer": student_answer,
                "is_correct": is_similar if not needs_choice else None,
            }
        )
        
        if not created:
            step_attempt.student_answer = student_answer
            step_attempt.is_correct = is_similar if not needs_choice else None
            step_attempt.save()

        # Track per-step errors for enhanced support on future attempts
        if not is_similar:
            history = session.step_error_history or {}
            key = str(step_order)
            history[key] = history.get(key, 0) + 1
            session.step_error_history = history
            session.save(update_fields=["step_error_history"])
        
        # Если ответ правильный (is_similar) и не нужен выбор —
        # сразу фиксируем final_answer, чтобы фронтенд мог перейти к следующему шагу.
        # Для symbol и boolean также считаем правильный ответ окончательным.
        final_answer_value = None
        if is_similar and not needs_choice:
            # Для symbol в final_answer пишем человекочитаемую форму "S — путь"
            if step_type == "symbol":
                step_attempt.final_answer = reference_answer_for_response or student_answer
            # Для boolean — "Да"/"Нет"
            elif step_type == "boolean":
                mapping = {"yes": "Да", "no": "Нет"}
                step_attempt.final_answer = mapping.get(student_normalized, student_answer)
            else:
                step_attempt.final_answer = student_answer
            step_attempt.is_correct = True
            step_attempt.save()
            final_answer_value = step_attempt.final_answer
        elif step_type == "boolean" and not is_similar:
            # Булев шаг: при неверном ответе НЕ показываем сверку «Да/Нет» —
            # это запутывает. Сразу фиксируем эталон как итог + помечаем как
            # «принят эталонный вариант», чтобы фронт показал верный ответ + комментарий.
            mapping = {"yes": "Да", "no": "Нет"}
            step_attempt.final_answer = mapping.get(reference_normalized, reference_content)
            step_attempt.is_correct = False
            step_attempt.chose_system_variant = True
            step_attempt.save()
            final_answer_value = step_attempt.final_answer
        
        return Response({
            "step_order": step_order,
            "student_answer": student_answer,
            "reference_answer": reference_answer_for_response,
            "is_correct": is_similar,
            "needs_choice": needs_choice,
            "step_attempt_id": step_attempt.id,
            "final_answer": final_answer_value,
            "reference_image_url": request.build_absolute_uri(reference_solution.image.url) if reference_solution.image else None,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/task/<id>/choose_step_variant/
    # Выбрать вариант ответа (мой/программный)
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def choose_step_variant(self, request, pk=None):
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
        
        step_attempt_id = request.data.get("step_attempt_id")
        chose_system_variant = request.data.get("chose_system_variant", False)
        
        if not step_attempt_id:
            return Response({"detail": "step_attempt_id required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            step_attempt = StepAttempt.objects.select_related("step", "task_attempt").get(
                pk=step_attempt_id,
                task_attempt__session__user=request.user
            )
        except StepAttempt.DoesNotExist:
            return Response({"detail": "Step attempt not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Получаем эталонное решение
        try:
            reference_solution = TaskSolutionStep.objects.get(
                task=task,
                step=step_attempt.step
            )
        except TaskSolutionStep.DoesNotExist:
            return Response({"detail": "Reference solution not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Сохраняем выбор
        step_attempt.chose_system_variant = chose_system_variant
        step_attempt.final_answer = reference_solution.content if chose_system_variant else step_attempt.student_answer
        step_attempt.is_correct = True  # Если ученик выбрал вариант, считаем правильным
        step_attempt.save()
        
        return Response({
            "ok": True,
            "final_answer": step_attempt.final_answer,
            "chose_system_variant": chose_system_variant,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/task/<id>/complete_guided/
    # Отметить задачу как решённую после пооперационного контроля
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def complete_guided(self, request, pk=None):
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        session_id = request.data.get("session_id")
        if not session_id:
            return Response({"detail": "session_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = LearningSession.objects.get(pk=session_id, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        previously_solved = TaskAttempt.objects.filter(
            session=session, task=task, is_correct=True
        ).exists()

        if not previously_solved:
            task_attempt = (
                TaskAttempt.objects
                .filter(session=session, task=task)
                .order_by("id")
                .first()
            )
            if task_attempt:
                task_attempt.is_correct = True
                task_attempt.save(update_fields=["is_correct"])
            else:
                TaskAttempt.objects.create(
                    session=session, task=task, is_correct=True
                )

            session.tasks_solved_count += 1
            session.tasks_correct_count += 1
            session.wrong_attempts_in_row = 0
            session.save(update_fields=[
                "tasks_solved_count", "tasks_correct_count", "wrong_attempts_in_row"
            ])

        if session.tasks_solved_count >= session.target_tasks_count:
            _compute_and_save_score(session)

        # Завершён пооперационный (S2) → перенос опоры на следующую задачу (S1).
        _apply_support_carry(session)
        session.save()

        return Response({
            "ok": True,
            "tasks_solved_count": session.tasks_solved_count,
            "tasks_correct_count": session.tasks_correct_count,
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # GET /api/task/<id>/compact_solution/
    # Эталон для свёрнутого варианта (S1): существующие шаги, сгруппированные в 4 блока.
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["get"])
    def compact_solution(self, request, pk=None):
        try:
            task = Task.objects.prefetch_related("solution_steps__step").get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        steps = sorted(task.solution_steps.all(), key=lambda ts: ts.step.order)
        model_schema = None
        for ts in steps:
            if ts.step_type == "schema" and (ts.schema_data or {}).get("elements"):
                model_schema = ts.schema_data  # последняя (самая полная) модель ситуации
        given = next((ts.content for ts in steps if ts.step_type == "symbol"), "")
        text_steps = [ts for ts in steps if ts.step_type == "text"]
        equation = text_steps[0].content if text_steps else ""
        solution = next((ts.content for ts in steps if ts.step_type == "solution"), "")
        answer = text_steps[-1].content if len(text_steps) >= 2 else ""
        solution_block = "\n".join([x for x in [solution, answer] if x])

        return Response({
            "task": {
                "id": task.id,
                "title": task.title,
                "text": task.text,
                "answer_unit": task.answer_unit or "",
                "allowed_answer_units": task.allowed_answer_units or ([task.answer_unit] if task.answer_unit else []),
            },
            "blocks": [
                {"key": "model", "title": "Модель ситуации", "kind": "schema", "schema_data": model_schema},
                {"key": "given", "title": "Дано / Найти", "kind": "text", "content": given},
                {"key": "equation", "title": "Уравнение", "kind": "math", "content": equation},
                {"key": "solution", "title": "Решение и ответ", "kind": "math", "content": solution_block},
            ],
        }, status=status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # POST /api/task/<id>/complete_compact/
    # Завершить свёрнутый вариант (S1): объективная проверка ответа + самооценка по блокам.
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def complete_compact(self, request, pk=None):
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found"}, status=status.HTTP_404_NOT_FOUND)
        session_id = request.data.get("session_id")
        if not session_id:
            return Response({"detail": "session_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            session = LearningSession.objects.get(pk=session_id, user=request.user)
        except LearningSession.DoesNotExist:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        matched_count = int(request.data.get("matched_count") or 0)
        answer_numeric = request.data.get("answer_numeric")
        answer_unit = (request.data.get("answer_unit") or "").strip()
        # accept_reference: ученику предложили разбор, но он отказался (взял эталон) —
        # значит задачу финализируем как «не чисто», без ухода в пооперационный.
        accept_reference = bool(request.data.get("accept_reference"))

        is_answer_correct = False
        if answer_numeric is not None and task.correct_answer is not None:
            try:
                is_answer_correct = task.check_answer(float(answer_numeric), answer_unit or task.answer_unit)
            except (ValueError, TypeError):
                is_answer_correct = False
        # Успех (мягко): верный ответ И не меньше 2 из 4 блоков совпали.
        clean = bool(is_answer_correct and matched_count >= 2)
        # «Назначить разбор» = это был бы 2-й неуспех свёрнутого подряд.
        force_full = (not clean) and (session.compact_fail_streak + 1 >= 2)
        finalize = clean or accept_reference

        if finalize:
            previously_solved = TaskAttempt.objects.filter(
                session=session, task=task, is_correct=True
            ).exists()
            if not previously_solved:
                ta = TaskAttempt.objects.filter(session=session, task=task).order_by("id").first()
                if ta:
                    ta.is_correct = True
                    ta.save(update_fields=["is_correct"])
                else:
                    TaskAttempt.objects.create(session=session, task=task, is_correct=True)
                session.tasks_solved_count += 1
                session.tasks_correct_count += 1
                session.wrong_attempts_in_row = 0

            session.last_task_clean = clean
            if session.tasks_solved_count >= session.target_tasks_count:
                _compute_and_save_score(session)
            # Перенос опоры на следующую задачу (инкремент streak — внутри расчёта).
            _apply_support_carry(session)
            session.save()

        return Response({
            "ok": True,
            "is_answer_correct": is_answer_correct,
            "clean": clean,
            "suggest_full": (not clean),
            "force_full": force_full,
            "finalized": finalize,
            "tasks_solved_count": session.tasks_solved_count,
        }, status=status.HTTP_200_OK)


# =============================================================================
# РЕДАКТОР СХЕМ — API
# =============================================================================

class SchemaElementCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """API для категорий элементов схем"""
    queryset = SchemaElementCategory.objects.prefetch_related("elements").order_by("order")
    serializer_class = SchemaElementCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class SchemaElementViewSet(viewsets.ModelViewSet):
    """API для элементов схем"""
    queryset = SchemaElement.objects.select_related("category").order_by("category__order", "order")
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return SchemaElementCreateSerializer
        return SchemaElementSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Фильтр по категории
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)
        
        # Поиск по тегам и названию
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                db_models.Q(name__icontains=search) |
                db_models.Q(tags__icontains=search) |
                db_models.Q(description__icontains=search)
            )
        
        return qs

    # --------------------------------------------------------------------------
    # GET /api/schema-elements/grouped/
    # Получить элементы, сгруппированные по категориям
    # --------------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def grouped(self, request):
        """Элементы, сгруппированные по категориям"""
        categories = SchemaElementCategory.objects.prefetch_related("elements").order_by("order")
        result = []
        
        for cat in categories:
            elements = SchemaElementSerializer(cat.elements.all().order_by("order"), many=True).data
            result.append({
                "id": cat.id,
                "name": cat.name,
                "slug": cat.slug,
                "icon": cat.icon,
                "elements": elements
            })
        
        return Response(result)

    def destroy(self, request, *args, **kwargs):
        """Запретить удаление системных элементов"""
        instance = self.get_object()
        if instance.is_system:
            return Response(
                {"detail": "Нельзя удалить системный элемент"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class SchemaTemplateViewSet(viewsets.ModelViewSet):
    """API для шаблонов схем задач"""
    queryset = SchemaTemplate.objects.select_related("task")
    serializer_class = SchemaTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Фильтр по задаче
        task_id = self.request.query_params.get("task")
        if task_id:
            qs = qs.filter(task_id=task_id)
        
        # Фильтр по типу
        template_type = self.request.query_params.get("type")
        if template_type:
            qs = qs.filter(template_type=template_type)
        
        return qs


class StudentSchemaViewSet(viewsets.ModelViewSet):
    """API для схем учеников"""
    queryset = StudentSchema.objects.select_related("task_attempt", "step")
    serializer_class = StudentSchemaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Ученик видит только свои схемы
        if not self.request.user.is_staff:
            qs = qs.filter(task_attempt__session__user=self.request.user)
        return qs

    # --------------------------------------------------------------------------
    # POST /api/student-schemas/<id>/check/
    # Проверить схему ученика относительно эталона
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def check(self, request, pk=None):
        """Проверить схему ученика"""
        student_schema = self.get_object()
        
        # Получаем эталонную схему для этой задачи
        task = student_schema.task_attempt.task
        reference = SchemaTemplate.objects.filter(
            task=task, template_type="reference"
        ).first()
        
        if not reference:
            return Response({
                "detail": "Эталонная схема не найдена",
                "similarity_score": None,
                "is_correct": None
            })
        
        # Простая проверка: считаем количество элементов
        student_elements = student_schema.data.get("elements", [])
        reference_elements = reference.data.get("elements", [])
        
        # Базовая оценка по количеству элементов
        student_count = len(student_elements)
        reference_count = len(reference_elements)
        
        if reference_count == 0:
            similarity = 1.0 if student_count == 0 else 0.5
        else:
            # Простая метрика: отношение количества элементов
            similarity = min(student_count / reference_count, 1.0)
            
            # TODO: здесь будет ML-проверка
            # similarity = ml_check_schema(student_schema.data, reference.data)
        
        # Обновляем схему
        student_schema.similarity_score = similarity
        student_schema.is_correct = similarity >= 0.7  # Порог 70%
        student_schema.save()
        
        return Response({
            "similarity_score": similarity,
            "is_correct": student_schema.is_correct,
            "feedback": "Схема проверена" if student_schema.is_correct else "Попробуйте добавить больше элементов",
            "reference_elements_count": reference_count,
            "your_elements_count": student_count
        })


# =============================================================================
# API ДЛЯ УЧИТЕЛЯ
# =============================================================================

from .serializers import TaskListSerializer, TaskCreateUpdateSerializer, KnowledgeSystemListSerializer
from django.contrib.auth import get_user_model


class IsTeacher(permissions.BasePermission):
    """Проверка, что пользователь — учитель (staff)"""
    def has_permission(self, request, view):
        return request.user and request.user.is_staff


class OrganizerStudyGroupViewSet(viewsets.ModelViewSet):
    """Группы апробации: класс + буква, добавление учеников с логином/паролем."""

    serializer_class = StudyGroupSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        return StudyGroup.objects.filter(owner=self.request.user).select_related(
            "school_class"
        ).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"], url_path="add_student")
    def add_student(self, request, pk=None):
        group = self.get_object()
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        student_mode = (request.data.get("student_mode") or UserProfile.MODE_STUDENT).strip()
        if student_mode not in (UserProfile.MODE_STUDENT, UserProfile.MODE_PILOT):
            return Response({"detail": "student_mode должен быть student|pilot"}, status=status.HTTP_400_BAD_REQUEST)
        if not username or not password:
            return Response(
                {"detail": "Нужны username и password"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        User = get_user_model()
        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Такой логин уже занят"}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        user.is_staff = False
        user.is_superuser = False
        user.save(update_fields=["is_staff", "is_superuser"])
        StudyGroupMembership.objects.get_or_create(group=group, user=user)
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "must_change_password": (student_mode != UserProfile.MODE_PILOT),
                "student_mode": student_mode,
            },
        )
        EventLog.objects.create(
            user=request.user,
            session=None,
            event="organizer_student_created",
            payload={"group_id": group.id, "student_username": user.username},
        )
        return Response({"ok": True, "user_id": user.id, "username": user.username, "student_mode": student_mode})

    @action(detail=True, methods=["post"], url_path="remove_student")
    def remove_student(self, request, pk=None):
        group = self.get_object()
        uid = request.data.get("user_id")
        if not uid:
            return Response({"detail": "user_id обязателен"}, status=status.HTTP_400_BAD_REQUEST)
        StudyGroupMembership.objects.filter(group=group, user_id=int(uid)).delete()
        return Response({"ok": True})

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        group = self.get_object()
        rows = []
        for m in group.memberships.select_related("user"):
            u = m.user
            prof = _learning_profile(u)
            rows.append(
                {
                    "user_id": u.id,
                    "username": u.username,
                    "first_name": u.first_name or "",
                    "last_name": u.last_name or "",
                    "must_change_password": bool(
                        prof
                        and prof.must_change_password
                        and (prof.student_mode != UserProfile.MODE_PILOT)
                    ),
                    "student_mode": (prof.student_mode if prof else UserProfile.MODE_STUDENT),
                    "joined_at": m.created_at.isoformat(),
                }
            )
        return Response(rows)

    @action(detail=True, methods=["get"], url_path="student_card")
    def student_card(self, request, pk=None):
        group = self.get_object()
        uid = request.query_params.get("user_id")
        if not uid:
            return Response({"detail": "user_id обязателен"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid_int = int(uid)
        except (TypeError, ValueError):
            return Response({"detail": "Некорректный user_id"}, status=status.HTTP_400_BAD_REQUEST)
        if not StudyGroupMembership.objects.filter(group=group, user_id=uid_int).exists():
            return Response({"detail": "Ученик не состоит в этой группе"}, status=status.HTTP_404_NOT_FOUND)
        User = get_user_model()
        try:
            user = User.objects.get(pk=uid_int)
        except User.DoesNotExist:
            return Response({"detail": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)
        profile = _learning_profile(user)
        sessions = LearningSession.objects.filter(user=user).select_related("ks").order_by("-created_at")
        sessions_data = []
        for s in sessions[:60]:
            try:
                ks_title = s.ks.title if getattr(s, "ks", None) else "Система знаний"
                sessions_data.append(
                    {
                        "session_id": s.id,
                        "ks_id": s.ks_id,
                        "ks_title": ks_title,
                        "current_stage": s.current_stage,
                        "score_percent": s.score_percent,
                        "mastery_percent": getattr(s, "mastery_percent", None),
                        "tasks_solved_count": s.tasks_solved_count,
                        "tasks_correct_count": s.tasks_correct_count,
                        "finished_at": s.finished_at.isoformat() if s.finished_at else None,
                    }
                )
            except Exception:
                # Не ломаем карточку ученика из-за одной повреждённой/несовместимой записи сессии.
                sessions_data.append(
                    {
                        "session_id": s.id,
                        "ks_id": s.ks_id,
                        "ks_title": "Система знаний",
                        "current_stage": getattr(s, "current_stage", ""),
                        "score_percent": getattr(s, "score_percent", 0),
                        "mastery_percent": getattr(s, "mastery_percent", None),
                        "tasks_solved_count": getattr(s, "tasks_solved_count", 0),
                        "tasks_correct_count": getattr(s, "tasks_correct_count", 0),
                        "finished_at": None,
                    }
                )
        return Response({
            "user_id": user.id,
            "username": user.username,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "must_change_password": bool(
                profile
                and profile.must_change_password
                and (profile.student_mode != UserProfile.MODE_PILOT)
            ),
            "student_mode": (profile.student_mode if profile else UserProfile.MODE_STUDENT),
            "sessions": sessions_data,
        })

    @action(detail=True, methods=["patch"], url_path="update_student")
    def update_student(self, request, pk=None):
        group = self.get_object()
        uid = request.data.get("user_id")
        if not uid:
            return Response({"detail": "user_id обязателен"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid_int = int(uid)
        except (TypeError, ValueError):
            return Response({"detail": "Некорректный user_id"}, status=status.HTTP_400_BAD_REQUEST)
        if not StudyGroupMembership.objects.filter(group=group, user_id=uid_int).exists():
            return Response({"detail": "Ученик не состоит в этой группе"}, status=status.HTTP_404_NOT_FOUND)
        User = get_user_model()
        try:
            user = User.objects.get(pk=uid_int)
        except User.DoesNotExist:
            return Response({"detail": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)
        profile, _ = UserProfile.objects.get_or_create(user=user)

        updates_user = []
        updates_profile = []
        if "first_name" in request.data:
            user.first_name = (request.data.get("first_name") or "").strip()
            updates_user.append("first_name")
        if "last_name" in request.data:
            user.last_name = (request.data.get("last_name") or "").strip()
            updates_user.append("last_name")
        if "must_change_password" in request.data:
            profile.must_change_password = bool(request.data.get("must_change_password"))
            updates_profile.append("must_change_password")
        if "student_mode" in request.data:
            mode = (request.data.get("student_mode") or "").strip()
            if mode not in (UserProfile.MODE_STUDENT, UserProfile.MODE_PILOT):
                return Response({"detail": "student_mode должен быть student|pilot"}, status=status.HTTP_400_BAD_REQUEST)
            profile.student_mode = mode
            updates_profile.append("student_mode")
            # Для режима апробации принудительную смену пароля отключаем.
            if mode == UserProfile.MODE_PILOT and profile.must_change_password:
                profile.must_change_password = False
                updates_profile.append("must_change_password")
        if updates_user:
            user.save(update_fields=list(dict.fromkeys(updates_user)))
        if updates_profile:
            profile.save(update_fields=list(dict.fromkeys(updates_profile)))

        if bool(request.data.get("clear_learning_data")):
            if profile.student_mode != UserProfile.MODE_PILOT:
                return Response(
                    {"detail": "Стирание данных доступно только для режима апробации"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            LearningSession.objects.filter(user=user).delete()
            EventLog.objects.filter(user=user).delete()

        return Response({"ok": True})


class TeacherPilotDashboardViewSet(viewsets.ViewSet):
    """Сводка для учителя: группы и очередь проверок."""

    permission_classes = [IsTeacher]

    def list(self, request):
        groups = StudyGroup.objects.filter(owner=request.user).select_related("school_class")
        groups_data = [
            {
                "id": g.id,
                "title": g.title,
                "letter": g.letter,
                "school_class_id": g.school_class_id,
                "member_count": g.memberships.count(),
            }
            for g in groups
        ]
        student_ids = _student_ids_for_teacher_groups(request.user)
        pending_qs = TaskAttempt.objects.filter(teacher_review_status="pending").select_related(
            "session__user", "task", "task__ks"
        )
        if student_ids is not None:
            pending_qs = pending_qs.filter(session__user_id__in=student_ids)
        pending = []
        for a in pending_qs.order_by("-created_at")[:100]:
            pending.append(
                {
                    "attempt_id": a.id,
                    "session_id": a.session_id,
                    "student": a.session.user.username,
                    "ks_title": a.task.ks.title,
                    "ks_id": a.task.ks_id,
                    "created_at": a.created_at.isoformat(),
                }
            )
        return Response({"groups": groups_data, "pending_final_reviews": pending})


class TeacherPilotSessionViewSet(viewsets.GenericViewSet):
    """Просмотр сессии ученика учителем (итоги + попытки + сводка логов)."""

    permission_classes = [IsTeacher]
    queryset = LearningSession.objects.all()
    lookup_url_kwarg = "pk"

    def retrieve(self, request, pk=None):
        try:
            session = LearningSession.objects.select_related("user", "ks").get(pk=int(pk))
        except (LearningSession.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Сессия не найдена"}, status=status.HTTP_404_NOT_FOUND)
        if not _teacher_can_view_session(request.user, session):
            return Response({"detail": "Нет доступа к этой сессии"}, status=status.HTTP_403_FORBIDDEN)

        attempts = []
        for a in session.task_attempts.select_related("task").order_by("task__order", "-id"):
            attempts.append(
                {
                    "id": a.id,
                    "task_order": a.task.order,
                    "task_title": a.task.title,
                    "answer_numeric": a.answer_numeric,
                    "is_correct": a.is_correct,
                    "teacher_review_status": a.teacher_review_status,
                    "teacher_grade_2_5": a.teacher_grade_2_5,
                    "created_at": a.created_at.isoformat(),
                }
            )
        from django.db.models import Count

        log_agg = list(
            EventLog.objects.filter(session=session)
            .values("event")
            .annotate(c=Count("id"))
            .order_by("-c")[:30]
        )
        return Response(
            {
                "id": session.id,
                "student": session.user.username,
                "ks_title": session.ks.title,
                "ks_id": session.ks_id,
                "current_stage": session.current_stage,
                "finished_at": session.finished_at.isoformat() if session.finished_at else None,
                "score_percent": session.score_percent,
                "mastery_percent": session.mastery_percent,
                "teacher_final_mark": session.teacher_final_mark,
                "passed": session.passed,
                "tasks_solved_count": session.tasks_solved_count,
                "tasks_correct_count": session.tasks_correct_count,
                "target_tasks_count": session.target_tasks_count,
                "result_summary": _build_result_summary(session),
                "task_attempts": attempts,
                "event_counts": log_agg,
            }
        )


class TeacherTaskSolutionStepViewSet(viewsets.ModelViewSet):
    """API для управления эталонными решениями задач по шагам (для учителя)"""
    queryset = TaskSolutionStep.objects.select_related("task", "step").order_by("task", "step__order")
    serializer_class = TaskSolutionStepCreateSerializer
    permission_classes = [IsTeacher]
    
    def get_queryset(self):
        qs = super().get_queryset()
        task_id = self.request.query_params.get("task")
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs
    
    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return TaskSolutionStepSerializer
        return TaskSolutionStepCreateSerializer
    
    def create(self, request, *args, **kwargs):
        """Переопределяем create для обработки schema_data из FormData"""
        # Создаем словарь из request.data для удобной работы
        data_dict = {}
        for key, value in request.data.items():
            data_dict[key] = value
        
        # Обрабатываем schema_data из FormData (приходит как строка JSON)
        if 'schema_data' in data_dict:
            schema_data_value = data_dict['schema_data']
            if schema_data_value:
                if isinstance(schema_data_value, str) and schema_data_value.strip():
                    try:
                        parsed = json.loads(schema_data_value)
                        data_dict['schema_data'] = parsed
                    except (json.JSONDecodeError, TypeError) as e:
                        return Response(
                            {"schema_data": [f"Неверный формат JSON: {str(e)}. Получено: {schema_data_value[:100]}"]},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                elif not schema_data_value or schema_data_value == '':
                    # Пустая строка = пустой объект для JSONField
                    data_dict['schema_data'] = {}
            else:
                # None = пустой объект
                data_dict['schema_data'] = {}
        else:
            # Если schema_data не передан, устанавливаем пустой объект
            data_dict['schema_data'] = {}
        
        serializer = self.get_serializer(data=data_dict)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        """Переопределяем update для обработки schema_data из FormData или JSON"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Если это JSON запрос (для схем), данные уже распарсены
        if request.content_type and 'application/json' in request.content_type:
            data = request.data
        else:
            # FormData - нужно обработать
            data = {}
            for key, value in request.data.items():
                data[key] = value
            
            # Обрабатываем schema_data из FormData
            if 'schema_data' in data:
                schema_data_value = data['schema_data']
                if schema_data_value:
                    if isinstance(schema_data_value, str) and schema_data_value.strip():
                        try:
                            data['schema_data'] = json.loads(schema_data_value)
                        except (json.JSONDecodeError, TypeError) as e:
                            return Response(
                                {"schema_data": [f"Неверный формат JSON: {str(e)}"]},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    elif not schema_data_value or schema_data_value == '':
                        data['schema_data'] = {}
        
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)


class TeacherTaskViewSet(viewsets.ModelViewSet):
    """API для управления задачами учителем"""
    queryset = Task.objects.select_related("ks", "ks__topic").prefetch_related("schema_templates")
    permission_classes = [IsTeacher]

    def get_serializer_class(self):
        if self.action == "list":
            return TaskListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return TaskCreateUpdateSerializer
        return TaskDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Фильтр по СК
        ks_id = self.request.query_params.get("ks")
        if ks_id:
            qs = qs.filter(ks_id=ks_id)
        
        # Поиск
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                db_models.Q(title__icontains=search) |
                db_models.Q(text__icontains=search)
            )
        
        return qs.order_by("ks__topic__order", "ks__id", "order")

    # --------------------------------------------------------------------------
    # POST /api/teacher/tasks/<id>/upload_illustration/
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload_illustration(self, request, pk=None):
        task = self.get_object()
        if "illustration" not in request.FILES:
            return Response({"error": "Файл не передан"}, status=status.HTTP_400_BAD_REQUEST)
        task.illustration = request.FILES["illustration"]
        task.save(update_fields=["illustration"])
        url = request.build_absolute_uri(task.illustration.url)
        return Response({"illustration_url": url})

    @action(detail=True, methods=["delete"])
    def delete_illustration(self, request, pk=None):
        task = self.get_object()
        if task.illustration:
            task.illustration.delete(save=False)
            task.illustration = None
            task.save(update_fields=["illustration"])
        return Response({"ok": True})

    # --------------------------------------------------------------------------
    # POST /api/teacher/tasks/<id>/save_schema/
    # Сохранить эталонную схему для задачи
    # --------------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def save_schema(self, request, pk=None):
        task = self.get_object()
        schema_data = request.data.get("data", {})
        template_type = request.data.get("template_type", "reference")
        name = request.data.get("name", f"Схема для {task.title}")

        # Обновляем или создаём шаблон
        template, created = SchemaTemplate.objects.update_or_create(
            task=task,
            template_type=template_type,
            defaults={
                "name": name,
                "data": schema_data,
            }
        )

        return Response({
            "id": template.id,
            "created": created,
            "message": "Схема сохранена"
        })


class TeacherKnowledgeSystemViewSet(viewsets.ReadOnlyModelViewSet):
    """API для списка СК (для выбора при создании задачи)"""
    queryset = KnowledgeSystem.objects.select_related("topic", "topic__section").order_by("topic__section__order", "topic__order")
    serializer_class = KnowledgeSystemListSerializer
    permission_classes = [IsTeacher]


# =============================================================================
# API для учителя — структура курса
# =============================================================================

class TeacherSectionViewSet(viewsets.ModelViewSet):
    """API для управления разделами учителем"""
    queryset = SubjectSection.objects.select_related("school_class").order_by("school_class__number", "order")
    serializer_class = SubjectSectionTeacherSerializer
    permission_classes = [IsTeacher]


class TeacherTopicViewSet(viewsets.ModelViewSet):
    """API для управления темами учителем"""
    queryset = Topic.objects.select_related("section", "section__school_class").order_by("section__order", "order")
    serializer_class = TopicTeacherSerializer
    permission_classes = [IsTeacher]


class TeacherKnowledgeSystemFullViewSet(viewsets.ModelViewSet):
    """API для управления системами знаний учителем"""
    queryset = KnowledgeSystem.objects.select_related("topic", "topic__section").prefetch_related(
        "zones", "questions", "clozes", "tasks"
    ).order_by("topic__section__order", "topic__order")
    serializer_class = KnowledgeSystemTeacherSerializer
    permission_classes = [IsTeacher]

    @action(detail=True, methods=["get"])
    def comprehension(self, request, pk=None):
        """Получить данные для редактирования осмысления"""
        ks = self.get_object()
        
        return Response({
            "comprehension_image": request.build_absolute_uri(ks.comprehension_image.url) if ks.comprehension_image else None,
            "comprehension_pass_threshold": ks.comprehension_pass_threshold,
            "zones": KSZoneSerializer(ks.zones.all().order_by("id"), many=True).data,
            "questions": KSQuestionSerializer(ks.questions.all().order_by("order"), many=True).data,
            "clozes": KSClozeFullSerializer(ks.clozes.all().order_by("order"), many=True).data,
        })

    @action(detail=True, methods=["post"])
    def upload_image(self, request, pk=None):
        """Загрузить изображение для осмысления"""
        ks = self.get_object()
        image_file = request.FILES.get("image")
        image_type = request.data.get("type", "comprehension")
        
        if not image_file:
            return Response({"detail": "Не указан файл изображения"}, status=status.HTTP_400_BAD_REQUEST)
        
        if image_type == "comprehension":
            ks.comprehension_image = image_file
        else:
            ks.image = image_file
        ks.save()
        
        url = request.build_absolute_uri(ks.comprehension_image.url if image_type == "comprehension" else ks.image.url)
        return Response({"url": url})

    @action(detail=True, methods=["post"])
    def save_comprehension(self, request, pk=None):
        """Сохранить данные осмысления"""
        ks = self.get_object()
        data = request.data
        
        zones_data = data.get("zones", [])
        questions_data = data.get("questions", [])
        clozes_data = data.get("clozes", [])
        threshold = data.get("comprehension_pass_threshold", 85)
        
        with transaction.atomic():
            ks.comprehension_pass_threshold = threshold
            ks.save()
            
            # ------------ ЗОНЫ -------------
            # Обновляем зоны аккуратно, не ломая внешние ключи
            existing_zone_ids = set()
            for z in zones_data:
                zid_raw = z.get("id")
                if isinstance(zid_raw, int):
                    existing_zone_ids.add(zid_raw)
                elif isinstance(zid_raw, str) and zid_raw.isdigit():
                    existing_zone_ids.add(int(zid_raw))

            if existing_zone_ids:
                # Удаляем только те зоны, которых нет в присланном списке
                KSZone.objects.filter(ks=ks).exclude(id__in=existing_zone_ids).delete()
            else:
                # Если нет ни одного валидного id, а зоны переданы — считаем, что все зоны создаются заново
                if zones_data:
                    KSZone.objects.filter(ks=ks).delete()

            for zone_data in zones_data:
                zid_raw = zone_data.get("id")
                if isinstance(zid_raw, int):
                    zid = zid_raw
                elif isinstance(zid_raw, str) and zid_raw.isdigit():
                    zid = int(zid_raw)
                else:
                    zid = None

                zone_fields = {
                    "ks": ks,
                    "x": zone_data.get("x", 0),
                    "y": zone_data.get("y", 0),
                    "width": zone_data.get("width", 0),
                    "height": zone_data.get("height", 0),
                    "label": zone_data.get("label", ""),
                }

                if zid:
                    try:
                        zone = KSZone.objects.get(id=zid, ks=ks)
                        for key, value in zone_fields.items():
                            setattr(zone, key, value)
                        zone.save()
                    except KSZone.DoesNotExist:
                        KSZone.objects.create(**zone_fields)
                else:
                    KSZone.objects.create(**zone_fields)
            
            # Собираем только валидные числовые ID вопросов
            existing_question_ids = set()
            for q in questions_data:
                q_id_raw = q.get("id")
                if not q_id_raw:
                    continue
                if isinstance(q_id_raw, int):
                    existing_question_ids.add(q_id_raw)
                elif isinstance(q_id_raw, str) and q_id_raw.isdigit():
                    existing_question_ids.add(int(q_id_raw))

            # Удаляем вопросы, которых нет в списке сохраняемых
            if existing_question_ids:
                KSQuestion.objects.filter(ks=ks).exclude(id__in=existing_question_ids).delete()
            else:
                # Если нет ни одного валидного id — считаем, что все вопросы новые
                KSQuestion.objects.filter(ks=ks).delete()
            
            for q_data in questions_data:
                q_id_raw = q_data.get("id")
                # Преобразуем id: если это временный строковый id (например, "q_123"), считаем, что вопрос новый
                if isinstance(q_id_raw, int):
                    q_id = q_id_raw
                elif isinstance(q_id_raw, str) and q_id_raw.isdigit():
                    q_id = int(q_id_raw)
                else:
                    q_id = None
                question_data = {
                    "ks": ks,
                    "type": q_data.get("type", "text"),
                    "text": q_data.get("text", ""),
                    "order": q_data.get("order", 1),
                    "options": q_data.get("options", []),
                    "correct_answer_text": q_data.get("correct_answer_text", ""),
                    "fuzzy_match": q_data.get("fuzzy_match", False),
                }
                
                if q_id:
                    try:
                        question = KSQuestion.objects.get(id=q_id, ks=ks)
                        for key, value in question_data.items():
                            setattr(question, key, value)
                        question.save()
                    except KSQuestion.DoesNotExist:
                        # Если вопрос с таким id не найден (например, был удалён) — создаём новый
                        question = KSQuestion.objects.create(**question_data)
                else:
                    question = KSQuestion.objects.create(**question_data)
                
                if q_data.get("type") == "match" and q_data.get("correct_zone_ids"):
                    # Оставляем только числовые ID зон
                    zone_ids = []
                    for zid_raw in q_data["correct_zone_ids"]:
                        if isinstance(zid_raw, int):
                            zone_ids.append(zid_raw)
                        elif isinstance(zid_raw, str) and zid_raw.isdigit():
                            zone_ids.append(int(zid_raw))
                    question.correct_zones.set(zone_ids)
            
            # Собираем только валидные ID (числа) для удаления
            existing_cloze_ids = set()
            for c in clozes_data:
                cloze_id = c.get("id")
                if cloze_id:
                    # Проверяем, что это число
                    if isinstance(cloze_id, int):
                        existing_cloze_ids.add(cloze_id)
                    elif isinstance(cloze_id, str) and cloze_id.isdigit():
                        existing_cloze_ids.add(int(cloze_id))
            # Удаляем только те cloze, которых нет в списке для сохранения
            if existing_cloze_ids:
                KSCloze.objects.filter(ks=ks).exclude(id__in=existing_cloze_ids).delete()
            else:
                # Если нет ни одного валидного ID, удаляем все (все новые)
                KSCloze.objects.filter(ks=ks).delete()
            
            for cloze_data in clozes_data:
                cloze_id = cloze_data.get("id")
                # Проверяем, что id - это число (не строка-временный id)
                if cloze_id and (not isinstance(cloze_id, int) and not (isinstance(cloze_id, str) and cloze_id.isdigit())):
                    cloze_id = None
                elif cloze_id and isinstance(cloze_id, str) and cloze_id.isdigit():
                    cloze_id = int(cloze_id)
                
                cloze_obj_data = {
                    "ks": ks,
                    "order": cloze_data.get("order", 1),
                    "original_text": cloze_data.get("original_text", ""),
                    "marked_text": cloze_data.get("marked_text", ""),
                    "blanks": cloze_data.get("blanks", []),
                    "distractors": cloze_data.get("distractors", []),
                }
                
                if cloze_id:
                    try:
                        cloze = KSCloze.objects.get(id=cloze_id, ks=ks)
                        for key, value in cloze_obj_data.items():
                            setattr(cloze, key, value)
                        cloze.save()
                    except KSCloze.DoesNotExist:
                        # Если cloze с таким id не найден, создаем новый
                        KSCloze.objects.create(**cloze_obj_data)
                else:
                    KSCloze.objects.create(**cloze_obj_data)
        
        return Response({"ok": True})

    @action(detail=True, methods=["get"])
    def typical_task(self, request, pk=None):
        """Получить данные для редактирования типовой задачи"""
        ks = self.get_object()
        
        return Response({
            "options": TypicalTaskOptionFullSerializer(ks.typical_task_options.all().order_by("order"), many=True).data,
            "cloze": {
                "text": ks.typical_task_cloze_text or "",
                "blanks": ks.typical_task_cloze_blanks or [],
                "distractors": ks.typical_task_cloze_distractors or [],
            } if ks.typical_task_cloze_text else None,
        })

    @action(detail=True, methods=["post"])
    def save_typical_task(self, request, pk=None):
        """Сохранить данные типовой задачи (варианты ответа и cloze)"""
        from .models import TypicalTaskOption
        if not request.user.is_staff:
            return Response({"detail": "Только учитель может изменять типовую задачу"}, status=status.HTTP_403_FORBIDDEN)
        
        ks = self.get_object()
        data = request.data
        
        options_data = data.get("options", [])
        cloze_data = data.get("cloze")
        
        with transaction.atomic():
            # ------------ ВАРИАНТЫ ОТВЕТА -------------
            existing_option_ids = set()
            for opt in options_data:
                opt_id = opt.get("id")
                if isinstance(opt_id, int):
                    existing_option_ids.add(opt_id)
                elif isinstance(opt_id, str) and opt_id.isdigit():
                    existing_option_ids.add(int(opt_id))
            
            if existing_option_ids:
                TypicalTaskOption.objects.filter(ks=ks).exclude(id__in=existing_option_ids).delete()
            else:
                TypicalTaskOption.objects.filter(ks=ks).delete()
            
            for opt_data in options_data:
                opt_id = opt_data.get("id")
                if isinstance(opt_id, int):
                    oid = opt_id
                elif isinstance(opt_id, str) and opt_id.isdigit():
                    oid = int(opt_id)
                else:
                    oid = None
                
                option_fields = {
                    "ks": ks,
                    "text": opt_data.get("text", ""),
                    "is_correct": opt_data.get("is_correct", False),
                    "order": opt_data.get("order", 1),
                    "explanation": opt_data.get("explanation", ""),
                }
                
                if oid:
                    try:
                        option = TypicalTaskOption.objects.get(id=oid, ks=ks)
                        for key, value in option_fields.items():
                            setattr(option, key, value)
                        option.save()
                    except TypicalTaskOption.DoesNotExist:
                        TypicalTaskOption.objects.create(**option_fields)
                else:
                    TypicalTaskOption.objects.create(**option_fields)
            
            # ------------ CLOZE -------------
            if cloze_data:
                # Строим marked_text из original_text и blanks
                original_text = cloze_data.get("original_text", "")
                blanks = cloze_data.get("blanks", [])
                
                # Сортируем пропуски по позиции start (с конца, чтобы не сбивать индексы)
                sorted_blanks = sorted(blanks, key=lambda b: b.get("start", 0), reverse=True)
                
                marked_text = original_text
                for blank in sorted_blanks:
                    start = blank.get("start", 0)
                    end = blank.get("end", 0)
                    position = blank.get("position", 0)
                    marked_text = marked_text[:start] + f"{{{{{position}}}}}" + marked_text[end:]
                
                ks.typical_task_cloze_text = marked_text
                ks.typical_task_cloze_blanks = blanks
                ks.typical_task_cloze_distractors = cloze_data.get("distractors", [])
            else:
                ks.typical_task_cloze_text = ""
                ks.typical_task_cloze_blanks = []
                ks.typical_task_cloze_distractors = []
            
            ks.save()
        
        return Response({"ok": True})


# =============================================================================
# Учитель — проверка итоговых ответов (задача 6)
# =============================================================================


class TeacherFinalTaskReviewViewSet(viewsets.GenericViewSet):
    """Очередь итоговых работ (ожидают проверки учителя) и выставление отметки."""

    permission_classes = [IsTeacher]
    queryset = TaskAttempt.objects.none()

    @staticmethod
    def _serialize_attempt(a, request):
        img_urls = []
        if a.answer_image:
            img_urls.append(request.build_absolute_uri(a.answer_image.url))
        for row in a.answer_images.all().order_by("order", "id"):
            img_urls.append(request.build_absolute_uri(row.image.url))
        user = a.session.user
        return {
            "id": a.id,
            "created_at": a.created_at.isoformat(),
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            "answer_numeric": a.answer_numeric,
            "answer_text": a.answer_text,
            "answer_image_url": img_urls[0] if img_urls else None,
            "answer_image_urls": img_urls,
            "is_correct_auto": a.is_correct,
            "teacher_review_status": a.teacher_review_status,
            "teacher_grade_2_5": a.teacher_grade_2_5,
            "teacher_comment": a.teacher_comment or "",
            "student": user.get_full_name() or user.username,
            "student_id": user.id,
            "session_id": a.session_id,
            "task_id": a.task_id,
            "task_order": a.task.order,
            "ks_id": a.task.ks_id,
            "ks_title": a.task.ks.title,
        }

    def list(self, request):
        ks_id = request.query_params.get("ks_id")
        status_filter = request.query_params.get("status", "pending")  # pending | reviewed | all
        qs = (
            TaskAttempt.objects.exclude(teacher_review_status="")
            .select_related("session__user", "task", "task__ks")
            .prefetch_related("answer_images")
        )
        if status_filter == "pending":
            qs = qs.filter(teacher_review_status="pending")
        elif status_filter == "reviewed":
            qs = qs.filter(teacher_review_status__in=["accepted", "rejected"])
        # "all" — no extra filter
        student_ids = _student_ids_for_teacher_groups(request.user)
        if student_ids is not None:
            qs = qs.filter(session__user_id__in=student_ids)
        if ks_id:
            qs = qs.filter(task__ks_id=int(ks_id))
        qs = qs.order_by("-created_at")
        out = [self._serialize_attempt(a, request) for a in qs[:200]]
        return Response(out)

    @action(detail=True, methods=["patch"], url_path="edit")
    def edit_review(self, request, pk=None):
        """Редактировать уже выставленную оценку / комментарий."""
        try:
            attempt = TaskAttempt.objects.select_related("task", "session").get(pk=pk)
        except (TaskAttempt.DoesNotExist, ValueError):
            return Response({"detail": "Попытка не найдена"}, status=status.HTTP_404_NOT_FOUND)
        if attempt.teacher_review_status not in ("accepted", "rejected"):
            return Response(
                {"detail": "Можно редактировать только уже проверенные работы"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _teacher_can_view_session(request.user, attempt.session):
            return Response({"detail": "Нет доступа"}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get("status", attempt.teacher_review_status)
        if new_status not in ("accepted", "rejected"):
            return Response({"detail": "status должен быть accepted|rejected"}, status=status.HTTP_400_BAD_REQUEST)

        comment = (request.data.get("comment") or "").strip()
        grade_raw = request.data.get("grade_2_5")
        grade = attempt.teacher_grade_2_5
        if grade_raw is not None and grade_raw != "":
            try:
                grade = int(grade_raw)
            except (TypeError, ValueError):
                return Response({"detail": "grade_2_5 должен быть целым числом 2–5"}, status=status.HTTP_400_BAD_REQUEST)
            if grade not in (2, 3, 4, 5):
                return Response({"detail": "Отметка должна быть в диапазоне 2–5"}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == "accepted" and not grade:
            return Response({"detail": "Для принятия работы укажите отметку 2–5"}, status=status.HTTP_400_BAD_REQUEST)

        prev_status = attempt.teacher_review_status
        attempt.teacher_review_status = new_status
        attempt.teacher_comment = comment
        attempt.teacher_grade_2_5 = grade
        attempt.reviewed_by = request.user
        attempt.save(update_fields=["teacher_review_status", "teacher_comment", "teacher_grade_2_5", "reviewed_by"])

        sess = attempt.session
        target = max(2, int(sess.target_tasks_count or 6))
        # Adjust session stage/state only if status changed
        if prev_status != new_status:
            if new_status == "rejected":
                if sess.tasks_solved_count >= target:
                    sess.tasks_solved_count = target - 1
                sess.current_stage = "task_list"
                sess.current_task_index = max(0, target - 1)
                sess.finished_at = None
                sess.save(update_fields=["tasks_solved_count", "current_stage", "current_task_index", "finished_at"])
            else:
                if sess.tasks_solved_count < target:
                    sess.tasks_solved_count = target
                sess.current_stage = "completed"
                if not sess.finished_at:
                    sess.finished_at = timezone.now()
                sess.save(update_fields=["tasks_solved_count", "current_stage", "finished_at"])
        _recalculate_mastery_after_teacher_review(sess, new_status, grade)
        return Response({"ok": True, "mastery_percent": sess.mastery_percent})

    @action(detail=False, methods=["post"], url_path="submit")
    def submit_review(self, request):
        attempt_id = request.data.get("attempt_id")
        new_status = request.data.get("status")
        comment = (request.data.get("comment") or "").strip()
        grade_raw = request.data.get("grade_2_5")
        grade = None
        if grade_raw is not None and grade_raw != "":
            try:
                grade = int(grade_raw)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "grade_2_5 должен быть целым числом 2–5"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if grade not in (2, 3, 4, 5):
                return Response(
                    {"detail": "Отметка должна быть в диапазоне 2–5"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if new_status == "accepted" and grade is None:
            return Response(
                {"detail": "Для принятия работы укажите отметку 2–5"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not attempt_id or new_status not in ("accepted", "rejected"):
            return Response(
                {"detail": "Нужны attempt_id и status: accepted|rejected"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            attempt = TaskAttempt.objects.select_related("task", "session").get(pk=int(attempt_id))
        except (TaskAttempt.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Попытка не найдена"}, status=status.HTTP_404_NOT_FOUND)
        if attempt.teacher_review_status != "pending":
            return Response(
                {"detail": "Эта работа не в статусе ожидания проверки"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _teacher_can_view_session(request.user, attempt.session):
            return Response({"detail": "Нет доступа"}, status=status.HTTP_403_FORBIDDEN)

        attempt.teacher_review_status = new_status
        attempt.teacher_comment = comment
        attempt.teacher_grade_2_5 = grade
        attempt.reviewed_at = timezone.now()
        attempt.reviewed_by = request.user
        attempt.save(
            update_fields=[
                "teacher_review_status",
                "teacher_comment",
                "teacher_grade_2_5",
                "reviewed_at",
                "reviewed_by",
            ]
        )
        sess = attempt.session
        target = max(2, int(sess.target_tasks_count or 6))
        if new_status == "rejected":
            if sess.tasks_solved_count >= target:
                sess.tasks_solved_count = target - 1
            if attempt.is_correct and sess.tasks_correct_count > 0:
                sess.tasks_correct_count -= 1
            sess.current_stage = "task_list"
            sess.current_task_index = max(0, target - 1)
            sess.finished_at = None
            sess.save(
                update_fields=[
                    "tasks_solved_count",
                    "tasks_correct_count",
                    "current_stage",
                    "current_task_index",
                    "finished_at",
                ]
            )
            _compute_and_save_score(sess)
        else:
            if sess.tasks_solved_count < target:
                sess.tasks_solved_count = target
            sess.current_stage = "completed"
            if not sess.finished_at:
                sess.finished_at = timezone.now()
            sess.save(
                update_fields=["tasks_solved_count", "current_stage", "finished_at"]
            )
            _compute_and_save_score(sess)
        _recalculate_mastery_after_teacher_review(sess, new_status, grade)
        return Response(
            {
                "ok": True,
                "attempt_id": attempt.id,
                "status": new_status,
                "mastery_percent": sess.mastery_percent,
                "passed": sess.passed,
                "teacher_grade_2_5": attempt.teacher_grade_2_5,
                "teacher_comment": attempt.teacher_comment or "",
            }
        )

    @action(detail=False, methods=["get"], url_path="gradebook")
    def gradebook(self, request):
        """
        Журнал оценок: ученики × СК × результаты.
        Returns { students, ks_list, cells }
        """
        student_ids = _student_ids_for_teacher_groups(request.user)
        qs = (
            LearningSession.objects.select_related("user", "ks")
            .order_by("user__last_name", "user__first_name", "ks__title")
        )
        if student_ids is not None:
            qs = qs.filter(user_id__in=student_ids)

        students = {}  # id → {id, username, full_name}
        ks_map = {}    # id → {id, title, topic_title}
        cells = {}     # "{user_id}_{ks_id}" → cell data

        # Pre-fetch final review attempts for efficiency
        session_ids = list(qs.values_list("id", flat=True))
        final_attempts = (
            TaskAttempt.objects.filter(session_id__in=session_ids)
            .exclude(teacher_review_status="")
            .select_related("task__ks")
            .order_by("-created_at")
        )
        latest_attempt_by_session = {}
        for a in final_attempts:
            if a.session_id not in latest_attempt_by_session:
                latest_attempt_by_session[a.session_id] = a

        for sess in qs:
            user = sess.user
            ks = sess.ks
            uid = user.id
            kid = ks.id

            if uid not in students:
                full_name = (user.get_full_name() or "").strip()
                students[uid] = {
                    "id": uid,
                    "username": user.username,
                    "full_name": full_name or user.username,
                }
            if kid not in ks_map:
                ks_map[kid] = {"id": kid, "title": ks.title}

            key = f"{uid}_{kid}"
            fa = latest_attempt_by_session.get(sess.id)
            grade = fa.teacher_grade_2_5 if fa else None
            final_status = fa.teacher_review_status if fa else None

            # Keep only the most progressed session per student/ks
            existing = cells.get(key)
            is_better = (
                not existing
                or (sess.current_stage == "completed" and existing["current_stage"] != "completed")
                or (grade is not None and existing["grade"] is None)
            )
            if is_better:
                cells[key] = {
                    "session_id": sess.id,
                    "mastery_percent": sess.mastery_percent,
                    "grade": grade,
                    "current_stage": sess.current_stage,
                    "final_review_status": final_status,
                    "finished_at": sess.finished_at.isoformat() if sess.finished_at else None,
                    "attempt_id": fa.id if fa else None,
                }

        return Response({
            "students": sorted(students.values(), key=lambda x: x["full_name"]),
            "ks_list": sorted(ks_map.values(), key=lambda x: x["title"]),
            "cells": cells,
        })