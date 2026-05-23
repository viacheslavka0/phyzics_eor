"""
Демонстрационные данные для исследовательского дашборда (графики, корреляции).

  python manage.py seed_research_demo
  python manage.py seed_research_demo --clear  # удалить ранее посеянное демо

Пользователи: research_demo_01 … research_demo_20 (пароль: demo1234)
Группа: «Демо-данные для дашборда исследования»
"""
from datetime import timedelta
import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from analytics.models import ExternalTestResult
from learning.models import (
    KnowledgeSystem,
    LearningSession,
    TaskAttempt,
    StepAttempt,
    ComprehensionAttempt,
    StudyGroup,
    StudyGroupMembership,
    SolutionStep,
    UserProfile,
)

DEMO_USERNAME_PREFIX = "research_demo_"
DEMO_GROUP_TITLE = "Демо-данные для дашборда исследования"
SEED_MARKER = "SEED_RESEARCH_DEMO"

User = get_user_model()


class Command(BaseCommand):
    help = "Наполняет БД синтетическими данными для вкладки «Исследование»"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Удалить демо-пользователей, группу и synthetic external tests",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self._clear()
            return
        self._seed()

    def _clear(self):
        n_tests = ExternalTestResult.objects.filter(notes__contains=SEED_MARKER).delete()[0]
        User.objects.filter(username__startswith=DEMO_USERNAME_PREFIX).delete()
        sg_del = StudyGroup.objects.filter(title=DEMO_GROUP_TITLE).delete()[0]
        self.stdout.write(self.style.SUCCESS(
            f"Удалено: {n_tests} ExternalTestResult, группа («{DEMO_GROUP_TITLE}»: записей связанных таблиц {sg_del}), демо-пользователи."
        ))

    @transaction.atomic
    def _seed(self):
        ks = (
            KnowledgeSystem.objects.exclude(solution_method__isnull=True)
            .filter(tasks__isnull=False)
            .distinct()
            .first()
        )
        if not ks:
            ks = KnowledgeSystem.objects.filter(tasks__isnull=False).distinct().first()
        if not ks:
            ks = KnowledgeSystem.objects.first()
        if not ks:
            self.stdout.write(self.style.ERROR("Нет ни одной СК в БД. Сначала выполните: python manage.py seed_data"))
            return

        tasks = list(ks.tasks.all().order_by("order")[:6])
        if not tasks:
            self.stdout.write(self.style.ERROR(f"У СК «{ks.title}» нет задач. Добавьте задачи или запустите seed_data."))
            return

        method = getattr(ks, "solution_method", None)
        if not method:
            self.stdout.write(self.style.ERROR(f"У СК нет метода решения."))
            return
        steps = list(method.steps.all().order_by("order")[:8])
        if not steps:
            self.stdout.write(self.style.ERROR(f"У метода нет шагов."))
            return

        owner = User.objects.filter(is_staff=True).first()
        if not owner:
            self.stdout.write(self.style.ERROR("Нет ни одного пользователя со staff=True. Нужна учётка учителя."))
            return

        group, _ = StudyGroup.objects.get_or_create(
            title=DEMO_GROUP_TITLE,
            defaults={"letter": "Д", "owner": owner},
        )
        # Владельца можно обновить, если группа уже была
        if group.owner_id != owner.id:
            group.owner = owner
            group.save(update_fields=["owner"])

        # Повторный запуск без --clear: очищаем только сессии демо-пользователей
        demo_ids = User.objects.filter(username__startswith=DEMO_USERNAME_PREFIX).values_list("id", flat=True)
        if demo_ids:
            LearningSession.objects.filter(user_id__in=demo_ids).delete()

        rnd = random.Random(42)
        rng_ctrl = random.Random(101)
        rng_exp = random.Random(202)

        demo_users = []
        for i in range(1, 21):
            username = f"{DEMO_USERNAME_PREFIX}{i:02d}"
            u, created = User.objects.get_or_create(
                username=username,
                defaults={"email": "", "first_name": f"Участник-{i}", "last_name": "Демо"},
            )
            if created:
                u.set_password("demo1234")
                u.is_staff = False
                u.is_superuser = False
                u.save()
            demo_users.append(u)
            UserProfile.objects.get_or_create(user=u, defaults={"must_change_password": False})
            StudyGroupMembership.objects.get_or_create(group=group, user=u)

        # Профиль существующего владельца (если нужен в группе — не добавляем, чтобы не путать счётчик)

        # Паттерны сессий: (partial stage or completed, comprehension, mastery, difficulty, path, comprehension_tries)
        profiles = []
        # 5 «застряли» разные этапы
        profiles.extend([
            ("comprehension", 55, None, "", "", 2),
            ("comprehension", 72, None, "", "", 1),
            ("typical_task", 81, None, "", "", 1),
            ("task_list", 78, None, "medium", "review_example", 1),
            ("solving_medium", 70, None, "medium", "self_solve", 2),
            ("solving_hard", 92, None, "hard", "discuss_and_review", 3),
        ])
        # 14 завершённых — с позитивной корреляцией осмысление → усвоение
        for j in range(14):
            comp = rnd.randint(62, 98)
            slope = (comp - 50) / 220
            mastery = min(97.0, max(38.0, comp * 0.45 + rnd.gauss(32, 7) + j * 0.35))
            diffs = ["easy", "easy", "medium", "medium", "medium", "hard", "hard"]
            difficulty = rnd.choice(diffs)
            paths = ["self_solve", "review_example", "discuss_and_review"]
            path_weights = [0.45, 0.35, 0.20]
            r = rnd.random()
            acc = 0.0
            learning_path = paths[-1]
            for p, w in zip(paths, path_weights):
                acc += w
                if r <= acc:
                    learning_path = p
                    break
            tries = 1 if comp >= 88 else (2 if comp >= 75 else rnd.choice([2, 3]))
            profiles.append(("completed", comp, mastery, difficulty, learning_path, tries))

        # Обрезаем или дополняем до длины len(demo_users)
        while len(profiles) < len(demo_users):
            profiles.append(("completed", 80, 78.0, "medium", "self_solve", 1))
        profiles = profiles[: len(demo_users)]

        sessions_created = 0
        now = timezone.now()
        ta_count = st_count = ca_count = 0

        for idx, user in enumerate(demo_users):
            stage_key, comp, mastery, difficulty, learning_path, n_comp_tries = profiles[idx]

            passed = stage_key == "completed" and mastery is not None and mastery >= 55
            err_hist = {}
            if stage_key == "completed" and mastery is not None:
                for si in rnd.sample(range(1, len(steps) + 1), min(3, len(steps))):
                    err_hist[str(si)] = rnd.randint(0, 4)

            session = LearningSession.objects.create(
                user=user,
                ks=ks,
                current_stage=stage_key if stage_key != "completed" else "completed",
                difficulty_choice=difficulty,
                learning_path=learning_path,
                comprehension_passed=comp >= 85,
                comprehension_score=float(comp),
                tasks_solved_count=6 if stage_key == "completed" else rnd.randint(0, 4),
                tasks_correct_count=5 if stage_key == "completed" else rnd.randint(0, 3),
                wrong_attempts_in_row=rnd.randint(0, 2),
                step_error_history=err_hist,
                score_percent=float(mastery or 0) if mastery else float(comp),
                passed=passed,
                mastery_percent=mastery,
                typical_task_correct=rnd.choice([True, True, False]) if stage_key == "completed" else None,
            )
            started_at_demo = now - timedelta(days=idx // 5, hours=rnd.randint(8, 14), minutes=rnd.randint(0, 50))
            finished_demo = (
                started_at_demo + timedelta(hours=rnd.randint(1, 3), minutes=rnd.randint(10, 50))
                if stage_key == "completed"
                else None
            )
            LearningSession.objects.filter(pk=session.pk).update(
                started_at=started_at_demo,
                finished_at=finished_demo,
            )
            sessions_created += 1

            # Попытки осмысления
            base_time = started_at_demo
            for t in range(n_comp_tries):
                pct = (
                    float(comp + rnd.gauss(-4, 3)) if t < n_comp_tries - 1
                    else float(comp)
                )
                pct = min(99.9, max(30.0, pct))
                nq = 8 + rnd.randint(0, 4)
                correct = int(round(nq * pct / 100))
                CA = ComprehensionAttempt.objects.create(
                    session=session,
                    total_questions=nq,
                    correct_answers=correct,
                    score_percent=min(99.9, (correct / nq * 100) if nq else 0),
                    passed=(correct / nq * 100) >= ks.comprehension_pass_threshold if nq else False,
                )
                ComprehensionAttempt.objects.filter(pk=CA.pk).update(
                    started_at=base_time + timedelta(minutes=t * 5),
                    finished_at=base_time + timedelta(minutes=t * 5 + 15),
                )
                ca_count += 1

            if stage_key not in ("completed", "solving_medium", "solving_hard"):
                continue

            n_tasks = rnd.randint(min(4, len(tasks)), len(tasks)) if stage_key != "completed" else len(tasks)
            seq_tasks = rnd.sample(tasks, n_tasks) if n_tasks < len(tasks) else tasks[:]

            for ti, task in enumerate(seq_tasks):
                task_idx = ti + 1
                corr = rnd.random() < (0.45 + ti * 0.08 + (comp / 200))
                secs = rnd.randint(40, 360)
                att = TaskAttempt.objects.create(
                    session=session,
                    task=task,
                    is_correct=True if corr else False,
                    time_spent_seconds=secs,
                )
                TaTime = started_at_demo + timedelta(minutes=20 + ti * 7)
                TaskAttempt.objects.filter(pk=att.pk).update(
                    created_at=TaTime,
                )
                ta_count += 1

                frac_ok = max(30, min(95, int(48 + ti * 5 + rnd.gauss(0, 6) + comp * 0.15)))
                n_step_sample = rnd.randint(min(5, len(steps)), len(steps))
                for step in rnd.sample(steps, n_step_sample):
                    ok = rnd.random() < (frac_ok / 100)
                    chose_sys = (not ok) and rnd.random() < 0.35
                    if chose_sys:
                        ok = rnd.random() < 0.92
                    StepAttempt.objects.create(
                        task_attempt=att,
                        step=step,
                        is_correct=ok,
                        chose_system_variant=chose_sys,
                        student_answer="demo" if ok else "",
                        final_answer="" if chose_sys else "demo-final",
                    )
                    st_count += 1

        # Внешние тесты: эксперимент vs контроль
        ExternalTestResult.objects.filter(notes__contains=SEED_MARKER).delete()
        for i in range(10):
            p = rng_ctrl.randint(38, 58)
            ExternalTestResult.objects.create(
                study_group=None,
                group_type="control",
                test_type="pre",
                score_percent=float(p),
                correct_tasks=round((p / 100) * 5),
                max_tasks=5,
                participant_code=f"К-{i+1}",
                notes=SEED_MARKER,
            )
            p2 = min(94, rng_ctrl.randint(52, 78))
            ExternalTestResult.objects.create(
                study_group=None,
                group_type="control",
                test_type="post",
                score_percent=float(p2),
                correct_tasks=round((p2 / 100) * 5),
                max_tasks=5,
                participant_code=f"К-{i+1}",
                notes=SEED_MARKER,
            )
        for i in range(12):
            p = rng_exp.randint(40, 60)
            ExternalTestResult.objects.create(
                study_group=group,
                group_type="experiment",
                test_type="pre",
                score_percent=float(p),
                correct_tasks=round((p / 100) * 5),
                max_tasks=5,
                participant_code=f"Э-{i+1}",
                notes=SEED_MARKER,
            )
            lift = rng_exp.randint(15, 32)
            p2 = min(97, float(p + lift))
            ExternalTestResult.objects.create(
                study_group=group,
                group_type="experiment",
                test_type="post",
                score_percent=p2,
                correct_tasks=min(5, round((p2 / 100) * 5)),
                max_tasks=5,
                participant_code=f"Э-{i+1}",
                notes=SEED_MARKER,
            )

        self.stdout.write(self.style.SUCCESS(
            f"[OK] СК: «{ks.title}» | Сессии: {sessions_created} | "
            f"ComprehensionAttempt: {ca_count} | TaskAttempt: {ta_count} | StepAttempt: {st_count}"
        ))
        self.stdout.write(f"Группа: «{group.title}» (id={group.id}) — при фильтре в дашборде выберите её.")
        self.stdout.write(self.style.WARNING(
            "Учётки участников: research_demo_01 … research_demo_20, пароль: demo1234"
        ))
