"""
Бизнес-логика для обучающего модуля.

Сервисы вынесены из views для переиспользования, тестирования и изоляции логики.
"""

from django.db import transaction
from .models import (
    TaskAttempt, TaskAttemptImage, LearningSession, Task, EventLog,
    KnowledgeSystem, KSQuestion, KSCloze, KSZone
)


class TaskSubmissionService:
    """Обработка отправки ответов на задачи."""

    def __init__(self, task: Task, session: LearningSession, user):
        self.task = task
        self.session = session
        self.user = user

    def validate(self, data: dict) -> dict:
        """Валидировать входные данные для submit."""
        errors = {}

        # session_id check is done in view (session passed to __init__)
        answer_numeric = data.get("answer_numeric")
        answer_unit = (data.get("answer_unit") or "").strip()
        answer_text = data.get("answer_text", "")
        answer_files = list(data.get("answer_files", []))
        time_spent = data.get("time_spent_seconds", 0)

        # Проверка на последнюю ситуацию (требование фото)
        _raw_target = int(self.session.target_tasks_count or 0)
        if _raw_target < 2:
            self.session.target_tasks_count = 6
        target = int(self.session.target_tasks_count)
        require_photos = (self.session.tasks_solved_count + 1) >= target

        if require_photos and not answer_files:
            errors["detail"] = (
                "Для последней ситуации в этой работе нужно прикрепить хотя бы одно фото решения"
            )

        return {
            "answer_numeric": answer_numeric,
            "answer_unit": answer_unit,
            "answer_text": answer_text,
            "answer_files": answer_files,
            "time_spent": time_spent,
            "require_photos": require_photos,
            "target": target,
            "errors": errors,
        }

    def check_answer(self, answer_numeric=None, answer_text: str = "", answer_unit: str = "") -> bool:
        """Проверить корректность ответа."""
        is_correct = None

        if answer_numeric is not None:
            try:
                answer_numeric = float(answer_numeric)
                if self.task.correct_answer is not None:
                    is_correct = self.task.check_answer(answer_numeric, answer_unit or self.task.answer_unit)
                else:
                    is_correct = False
            except (ValueError, TypeError):
                is_correct = False
        elif answer_text and self.task.correct_answer_text:
            is_correct = answer_text.strip().lower() == self.task.correct_answer_text.strip().lower()

        return is_correct

    @transaction.atomic
    def process_answer(self, data: dict):
        """Обработать ответ: сохранить попытку, обновить сессию, залогировать."""
        validated = self.validate(data)
        if validated["errors"]:
            return {"errors": validated["errors"]}

        answer_numeric = validated["answer_numeric"]
        answer_text = validated["answer_text"]
        answer_unit = validated["answer_unit"]
        answer_files = validated["answer_files"]
        time_spent = validated["time_spent"]
        is_final_grade_task = validated["require_photos"]

        # Проверка ответа
        is_correct = self.check_answer(answer_numeric, answer_text, answer_unit)

        # Сохранение попытки
        attempt_kwargs = dict(
            session=self.session,
            task=self.task,
            answer_numeric=answer_numeric,
            answer_text=answer_text,
            answer_image=answer_files[0] if answer_files else None,
            is_correct=is_correct,
            time_spent_seconds=time_spent,
        )
        if is_final_grade_task:
            attempt_kwargs["teacher_review_status"] = "pending"

        attempt = TaskAttempt.objects.create(**attempt_kwargs)

        # Сохранение доп. изображений
        for i, img in enumerate(answer_files[1:], start=1):
            TaskAttemptImage.objects.create(attempt=attempt, image=img, order=i)

        # Проверка, была ли задача решена ранее
        previously_solved = TaskAttempt.objects.filter(
            session=self.session, task=self.task, is_correct=True
        ).exclude(pk=attempt.pk).exists()

        # Обновление статистики сессии
        self._update_session_stats(is_correct, is_final_grade_task, previously_solved)

        # Логирование
        EventLog.objects.create(
            user=self.user,
            session=self.session,
            event="task_submit",
            payload={
                "task_id": self.task.id,
                "answer_numeric": answer_numeric,
                "answer_unit": answer_unit or self.task.answer_unit or "",
                "answer_text": answer_text,
                "is_correct": is_correct,
                "attempt_id": attempt.id,
            }
        )

        return {
            "attempt": attempt,
            "is_correct": is_correct,
            "is_final_grade_task": is_final_grade_task,
            "previously_solved": previously_solved,
        }

    def _update_session_stats(self, is_correct: bool, is_final_grade_task: bool, previously_solved: bool):
        """Обновить счётчики сессии."""
        target = self.session.target_tasks_count

        if is_final_grade_task:
            has_previous_final_submission = TaskAttempt.objects.filter(
                session=self.session
            ).exclude(teacher_review_status="").exists()
            if not has_previous_final_submission:
                self.session.tasks_solved_count += 1
            if is_correct and not previously_solved:
                self.session.tasks_correct_count += 1
                self.session.wrong_attempts_in_row = 0
            elif not is_correct:
                self.session.wrong_attempts_in_row += 1
        else:
            if is_correct and not previously_solved:
                self.session.tasks_solved_count += 1
                self.session.tasks_correct_count += 1
                self.session.wrong_attempts_in_row = 0
            elif not is_correct:
                self.session.wrong_attempts_in_row += 1

        self.session.save()

        # Compute score if reached target
        if self.session.tasks_solved_count >= target:
            from .views import _compute_and_save_score
            _compute_and_save_score(self.session)


class ComprehensionCheckService:
    """Проверка осмысления (вопросы + cloze)."""

    def __init__(self, ks: KnowledgeSystem):
        self.ks = ks

    def check_questions(self, mappings: list) -> dict:
        """Проверить маппинги зон на вопросы."""
        questions = KSQuestion.objects.filter(ks=self.ks).prefetch_related("correct_zones")

        result = {
            "all_correct": True,
            "question_results": []
        }

        for q in questions:
            q_index = str(q.id)
            student_zones = set(mappings.get(q_index, []))
            correct_zones = set(q.correct_zones.values_list("id", flat=True))

            is_correct = student_zones == correct_zones
            if not is_correct:
                result["all_correct"] = False

            result["question_results"].append({
                "question_id": q.id,
                "is_correct": is_correct,
                "text": q.text,
            })

        return result

    def check_cloze(self, answers: dict) -> dict:
        """Проверить заполнение пропусков."""
        # Собираем все пропуски из всех KSCloze для данной СК
        clozes = KSCloze.objects.filter(ks=self.ks).order_by("order")
        all_blanks = []
        for cloze in clozes:
            all_blanks.extend(cloze.blanks or [])

        if not all_blanks:
            # Cloze не настроен — считаем этот блок пройденным
            return {"all_correct": True, "cloze_results": []}

        result = {
            "all_correct": True,
            "cloze_results": []
        }

        for blank in all_blanks:
            pos = str(blank["position"])
            student = (answers.get(pos) or "").strip()
            expected = blank.get("correct", "").strip()

            is_correct = bool(expected) and student.lower() == expected.lower()
            if not is_correct:
                result["all_correct"] = False

            result["cloze_results"].append({
                "position": blank["position"],
                "is_correct": is_correct,
                "student_answer": student,
                "correct_answer": expected if not is_correct else None,
            })

        return result

    def check_all(self, mappings: list, answers: dict) -> dict:
        """Проверить всё сразу."""
        questions_result = self.check_questions(mappings)
        cloze_result = self.check_cloze(answers)

        return {
            "all_correct": questions_result["all_correct"] and cloze_result["all_correct"],
            "questions": questions_result,
            "cloze": cloze_result,
        }


class SaveComprehensionService:
    """Сохранение осмысления (зоны, вопросы, cloze)."""

    def __init__(self, ks: KnowledgeSystem):
        self.ks = ks

    @transaction.atomic
    def save_zones(self, zones_data: list) -> dict:
        """Сохранить зоны (KSZone)."""
        # Удалить старые зоны
        KSZone.objects.filter(ks=self.ks).delete()

        created_zones = []
        for zone_data in zones_data:
            zone = KSZone.objects.create(
                ks=self.ks,
                label=zone_data.get("label", ""),
                coordinates=zone_data.get("coordinates", {}),
            )
            created_zones.append(zone)

        return {"zones_created": len(created_zones)}

    @transaction.atomic
    def save_questions(self, questions_data: list) -> dict:
        """Сохранить вопросы осмысления (KSQuestion)."""
        # Удалить старые вопросы
        KSQuestion.objects.filter(ks=self.ks).delete()

        created_questions = []
        for q_data in questions_data:
            question = KSQuestion.objects.create(
                ks=self.ks,
                text=q_data.get("text", ""),
                order=q_data.get("order", 0),
            )

            # Привязать правильные зоны
            zone_ids = q_data.get("correct_zone_ids", [])
            zones = KSZone.objects.filter(ks=self.ks, id__in=zone_ids)
            question.correct_zones.set(zones)

            created_questions.append(question)

        return {"questions_created": len(created_questions)}

    @transaction.atomic
    def save_cloze(self, blanks_data: list) -> dict:
        """Сохранить пропуски (cloze)."""
        self.ks.ks_cloze_blanks = blanks_data
        self.ks.save()

        return {"blanks_saved": len(blanks_data)}

    @transaction.atomic
    def save_all(self, zones_data: list, questions_data: list, blanks_data: list) -> dict:
        """Сохранить всё сразу."""
        result = {}
        result.update(self.save_zones(zones_data))
        result.update(self.save_questions(questions_data))
        result.update(self.save_cloze(blanks_data))
        return result
