from django.db import models as dm
from django.db.models import Avg, Count, Q, F
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
import math

from learning.models import (
    LearningSession,
    TaskAttempt,
    StepAttempt,
    ComprehensionAttempt,
    StudyGroup,
    SolutionStep,
)
from .models import ExternalTestResult


def _safe_avg(values):
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def _pearson(xs, ys):
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx == 0 or dy == 0:
        return None
    return round(num / (dx * dy), 3)


class ResearchReportView(APIView):
    """
    Агрегирующий endpoint для исследовательского дашборда.
    GET /api/analytics/research-report/?group_id=X&ks_id=Y
    Возвращает все данные одним объектом.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        group_id = request.query_params.get("group_id")
        ks_id = request.query_params.get("ks_id")

        # Базовый QuerySet сессий
        sessions_qs = LearningSession.objects.all()
        if group_id:
            try:
                g = StudyGroup.objects.get(pk=group_id)
                user_ids = g.memberships.values_list("user_id", flat=True)
                sessions_qs = sessions_qs.filter(user_id__in=user_ids)
            except StudyGroup.DoesNotExist:
                pass
        if ks_id:
            sessions_qs = sessions_qs.filter(ks_id=ks_id)

        # ----------------------------------------------------------------
        # 1. СВОДКА
        # ----------------------------------------------------------------
        total = sessions_qs.count()
        completed = sessions_qs.filter(current_stage="completed").count()
        passed = sessions_qs.filter(passed=True).count()

        mastery_vals = list(sessions_qs.filter(mastery_percent__isnull=False)
                            .values_list("mastery_percent", flat=True))
        comp_vals = list(sessions_qs.filter(comprehension_score__gt=0)
                         .values_list("comprehension_score", flat=True))

        # Среднее время (только у завершённых с обоими полями)
        time_sessions = sessions_qs.filter(
            finished_at__isnull=False,
            started_at__isnull=False,
            current_stage="completed",
        )
        time_minutes_list = []
        for s in time_sessions:
            delta = (s.finished_at - s.started_at).total_seconds() / 60
            if 0 < delta < 600:  # отсекаем аномалии > 10 часов
                time_minutes_list.append(round(delta, 1))

        summary = {
            "total_sessions": total,
            "completed_sessions": completed,
            "passed_sessions": passed,
            "completion_rate": round(completed / total * 100, 1) if total else 0,
            "pass_rate": round(passed / total * 100, 1) if total else 0,
            "avg_mastery": _safe_avg(mastery_vals),
            "avg_comprehension": _safe_avg(comp_vals),
            "avg_time_minutes": _safe_avg(time_minutes_list),
        }

        # ----------------------------------------------------------------
        # 2. ВОРОНКА ЗАВЕРШЕНИЯ
        # ----------------------------------------------------------------
        STAGE_ORDER = [
            ("comprehension", "Осмысление СК"),
            ("typical_task", "Типовая задача"),
            ("task_list", "Список задач"),
            ("difficulty_assessment", "Оценка трудности"),
            ("solving_easy", "Решение задач (лёгкое)"),
            ("solving_medium", "Решение задач (непростое)"),
            ("solving_hard", "Решение задач (трудное)"),
            ("method_composition", "Метод решения"),
            ("step_by_step", "Пооперационный контроль"),
            ("completed", "Завершено"),
        ]
        # Для воронки: считаем сколько сессий «дошло» до этого этапа или дальше
        stage_values = list(sessions_qs.values_list("current_stage", flat=True))
        stage_order_map = {s: i for i, (s, _) in enumerate(STAGE_ORDER)}

        funnel = []
        for stage_key, stage_label in STAGE_ORDER:
            idx = stage_order_map.get(stage_key, 0)
            count = sum(
                1 for sv in stage_values
                if stage_order_map.get(sv, 0) >= idx
            )
            funnel.append({"stage": stage_key, "label": stage_label, "count": count})

        # ----------------------------------------------------------------
        # 3. КОРРЕЛЯЦИЯ ООД → УСВОЕНИЕ
        # ----------------------------------------------------------------
        ood_sessions = sessions_qs.filter(
            mastery_percent__isnull=False,
            comprehension_score__gt=0,
        ).values("comprehension_score", "mastery_percent", "difficulty_choice")

        ood_points = [
            {
                "x": round(s["comprehension_score"], 1),
                "y": round(s["mastery_percent"], 1),
                "difficulty": s["difficulty_choice"] or "unknown",
            }
            for s in ood_sessions
        ]
        xs = [p["x"] for p in ood_points]
        ys = [p["y"] for p in ood_points]
        ood_correlation = {
            "points": ood_points,
            "r": _pearson(xs, ys),
            "n": len(ood_points),
        }

        # Дополнительно: mastery по числу попыток осмысления
        comp_attempts_dist = []
        for tries in [1, 2, 3]:
            label = str(tries) if tries < 3 else "3+"
            if tries < 3:
                cnt = ComprehensionAttempt.objects.filter(
                    session__in=sessions_qs,
                ).values("session_id").annotate(c=Count("id")).filter(c=tries).count()
            else:
                cnt = ComprehensionAttempt.objects.filter(
                    session__in=sessions_qs,
                ).values("session_id").annotate(c=Count("id")).filter(c__gte=3).count()
            comp_attempts_dist.append({"label": label, "count": cnt})

        # ----------------------------------------------------------------
        # 4. АДАПТИВНЫЙ АЛГОРИТМ
        # ----------------------------------------------------------------
        DIFF_LABELS = {
            "easy": "Лёгкое",
            "medium": "Непростое",
            "hard": "Трудное",
            "": "Не выбрано",
        }
        PATH_LABELS = {
            "self_solve": "Сам решу",
            "review_example": "Разобрать пример",
            "discuss_and_review": "Обсудить и разобрать",
            "": "Не выбрано",
        }
        mastery_by_difficulty = {}
        for key in ("easy", "medium", "hard", ""):
            qs_d = sessions_qs.filter(
                difficulty_choice=key,
                mastery_percent__isnull=False,
            )
            vals = list(qs_d.values_list("mastery_percent", flat=True))
            if vals:
                mastery_by_difficulty[key] = {
                    "label": DIFF_LABELS.get(key, key),
                    "avg_mastery": _safe_avg(vals),
                    "count": len(vals),
                }

        learning_path_dist = {}
        for key in ("self_solve", "review_example", "discuss_and_review", ""):
            cnt = sessions_qs.filter(learning_path=key).count()
            if cnt > 0:
                learning_path_dist[key] = {
                    "label": PATH_LABELS.get(key, key),
                    "count": cnt,
                }

        # ----------------------------------------------------------------
        # 5. КРИВАЯ ОБУЧЕНИЯ (StepAttempt по индексу задачи в сессии)
        # ----------------------------------------------------------------
        # Берём TaskAttempt + StepAttempt, группируем по (task_index ≈ current_task_index)
        # Приближение: сортируем TaskAttempt внутри сессии по created_at
        step_curve_raw = {}  # task_position -> {correct_total, total, chose_system_total}
        ta_qs = TaskAttempt.objects.filter(
            session__in=sessions_qs,
        ).prefetch_related("step_attempts").order_by("session_id", "created_at")

        # Группируем по сессии, нумеруем внутри
        current_session = None
        task_position_in_session = 0
        for ta in ta_qs:
            if ta.session_id != current_session:
                current_session = ta.session_id
                task_position_in_session = 1
            else:
                task_position_in_session += 1

            pos = min(task_position_in_session, 8)  # cap at 8
            if pos not in step_curve_raw:
                step_curve_raw[pos] = {"correct": 0, "total": 0, "chose_sys": 0, "steps_total": 0}

            step_attempts = list(ta.step_attempts.all())
            for sa in step_attempts:
                step_curve_raw[pos]["steps_total"] += 1
                if sa.is_correct is True:
                    step_curve_raw[pos]["correct"] += 1
                if sa.chose_system_variant:
                    step_curve_raw[pos]["chose_sys"] += 1
            step_curve_raw[pos]["total"] += 1

        step_learning_curve = []
        for pos in sorted(step_curve_raw.keys()):
            d = step_curve_raw[pos]
            st = d["steps_total"]
            step_learning_curve.append({
                "task_index": pos,
                "label": f"Задача {pos}",
                "avg_correct_rate": round(d["correct"] / st * 100, 1) if st else None,
                "chose_system_rate": round(d["chose_sys"] / st * 100, 1) if st else None,
                "task_count": d["total"],
            })

        # Трудность шагов (из step_error_history в сессиях)
        step_difficulty = {}
        for sess in sessions_qs.exclude(step_error_history={}):
            history = sess.step_error_history or {}
            for step_order_str, err_count in history.items():
                try:
                    step_order = int(step_order_str)
                except (ValueError, TypeError):
                    continue
                if step_order not in step_difficulty:
                    step_difficulty[step_order] = {"errors": 0, "sessions": 0}
                step_difficulty[step_order]["errors"] += err_count
                step_difficulty[step_order]["sessions"] += 1

        # Получаем названия шагов
        step_titles = {}
        if ks_id:
            for ss in SolutionStep.objects.filter(method__ks_id=ks_id):
                step_titles[ss.order] = ss.title

        step_difficulty_list = []
        for order in sorted(step_difficulty.keys()):
            d = step_difficulty[order]
            step_difficulty_list.append({
                "step_order": order,
                "step_title": step_titles.get(order, f"Шаг {order}"),
                "avg_errors": round(d["errors"] / d["sessions"], 2) if d["sessions"] else 0,
                "sessions_with_errors": d["sessions"],
            })

        # ----------------------------------------------------------------
        # 6. ВНЕШНИЕ ТЕСТЫ (pre/post)
        # ----------------------------------------------------------------
        ext_qs = ExternalTestResult.objects.all()
        if group_id:
            ext_qs = ext_qs.filter(
                Q(study_group_id=group_id) | Q(study_group__isnull=True)
            )

        external_tests = {"experiment": {"pre": [], "post": []}, "control": {"pre": [], "post": []}}
        for r in ext_qs:
            gt = r.group_type if r.group_type in ("experiment", "control") else "control"
            tt = r.test_type if r.test_type in ("pre", "post") else "pre"
            external_tests[gt][tt].append({
                "id": r.id,
                "participant_code": r.participant_code or "аноним",
                "score_percent": r.score_percent,
                "correct_tasks": r.correct_tasks,
                "max_tasks": r.max_tasks,
            })

        # Считаем средние gain scores
        def _gain_score(exp_data, ctrl_data):
            result = {}
            for gt, data in [("experiment", exp_data), ("control", ctrl_data)]:
                pre_scores = [r["score_percent"] for r in data["pre"]]
                post_scores = [r["score_percent"] for r in data["post"]]
                result[gt] = {
                    "pre_avg": _safe_avg(pre_scores),
                    "post_avg": _safe_avg(post_scores),
                    "gain": (
                        round(_safe_avg(post_scores) - _safe_avg(pre_scores), 1)
                        if _safe_avg(pre_scores) is not None and _safe_avg(post_scores) is not None
                        else None
                    ),
                    "n_pre": len(pre_scores),
                    "n_post": len(post_scores),
                }
            return result

        gain_scores = _gain_score(external_tests["experiment"], external_tests["control"])

        # ----------------------------------------------------------------
        # 7. СПИСОК ГРУПП (для фильтра)
        # ----------------------------------------------------------------
        groups = list(StudyGroup.objects.all().values("id", "title"))

        return Response({
            "summary": summary,
            "funnel": funnel,
            "ood_correlation": ood_correlation,
            "comp_attempts_dist": comp_attempts_dist,
            "mastery_by_difficulty": mastery_by_difficulty,
            "learning_path_dist": learning_path_dist,
            "step_learning_curve": step_learning_curve,
            "step_difficulty": step_difficulty_list,
            "external_tests": external_tests,
            "gain_scores": gain_scores,
            "groups": groups,
        })


class ExternalTestResultCreateView(APIView):
    """
    POST /api/analytics/external-test/ — сохранить результат pre/post теста.
    DELETE /api/analytics/external-test/<id>/ — удалить запись.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        data = request.data
        obj = ExternalTestResult.objects.create(
            group_type=data.get("group_type", "control"),
            test_type=data.get("test_type", "pre"),
            score_percent=float(data.get("score_percent", 0)),
            correct_tasks=int(data.get("correct_tasks", 0)),
            max_tasks=int(data.get("max_tasks", 5)),
            participant_code=data.get("participant_code", ""),
            notes=data.get("notes", ""),
            study_group_id=data.get("study_group_id") or None,
        )
        return Response({"id": obj.id, "ok": True}, status=201)

    def delete(self, request, pk=None):
        try:
            ExternalTestResult.objects.get(pk=pk).delete()
            return Response({"ok": True})
        except ExternalTestResult.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
