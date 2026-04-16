from django.core.management.base import BaseCommand
from django.db import transaction

from learning.models import TaskSolutionStep


class Command(BaseCommand):
    """
    Одноразовая команда для переноса существующих текстовых решений
    по шагу «Найдите значение искомой величины…» в новый тип шага
    «solution» (формула, СИ, расчёт, оценка).

    Логика очень простая и аккуратная:
    - Берём только те TaskSolutionStep, у которых:
        * step_type == "text"
        * у связанного SolutionStep в названии есть
          «Найдите значение искомой величины» (без учёта регистра)
        * content не пустой
    - Пытаемся распарсить content по подпунктам а)/б)/в)/г).
      Если распарсить не получилось — шаг НЕ трогаем.
    - Если получилось:
        * сохраняем старый текст как есть в поле content (на всякий случай)
        * заполняем schema_data = {formula, si, calc, reasoning}
        * меняем step_type на "solution".

    Команда безопасна для повторного запуска: если у шага уже
    step_type == "solution" или schema_data не пустой — мы его пропускаем.
    """

    help = "Мигрирует существующие текстовые решения в структурированный блок solution."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Показать, какие шаги будут изменены, но не сохранять изменения.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        qs = (
            TaskSolutionStep.objects.select_related("step", "task")
            .filter(
                step_type="text",
            )
            .exclude(content__isnull=True)
            .exclude(content__exact="")
        )

        # Ограничиваемся только шагами с нужным текстом названия
        target_substring = "найдите значение искомой величины"
        qs = [s for s in qs if target_substring in (s.step.title or "").lower()]

        if not qs:
            self.stdout.write(self.style.WARNING("Подходящих шагов не найдено."))
            return

        self.stdout.write(
            f"Найдено шагов для попытки миграции: {len(qs)}"
        )

        changed = 0

        @transaction.atomic
        def do_migrate():
            nonlocal changed
            for step in qs:
                # Если уже есть структурированные данные — пропускаем
                if step.step_type == "solution" or (step.schema_data or {}):
                    continue

                formula, si, calc, reasoning = self._parse_content(step.content)
                if not any([formula, si, calc, reasoning]):
                    # Ничего не смогли вытащить — не трогаем шаг
                    continue

                changed += 1

                self.stdout.write(
                    self.style.NOTICE(
                        f"- TaskSolutionStep id={step.id} (task={step.task_id}, "
                        f"step_title='{step.step.title}')"
                    )
                )
                self.stdout.write(f"  Формула: {formula or '—'}")
                self.stdout.write(f"  СИ: {si or '—'}")
                self.stdout.write(f"  Расчёт: {calc or '—'}")
                self.stdout.write(f"  Оценка: {reasoning or '—'}")

                if dry_run:
                    continue

                step.step_type = "solution"
                step.schema_data = {
                    "formula": formula or "",
                    "si": si or "",
                    "calc": calc or "",
                    "reasoning": reasoning or "",
                }
                # content не трогаем — оставляем как «сырой» текст
                step.save(update_fields=["step_type", "schema_data"])

        if dry_run:
            do_migrate()
            self.stdout.write(
                self.style.WARNING(
                    f"DRY-RUN завершён. Шагов, которые БЫЛИ БЫ изменены: {changed}"
                )
            )
        else:
            do_migrate()
            self.stdout.write(
                self.style.SUCCESS(f"Миграция завершена. Изменено шагов: {changed}")
            )

    def _parse_content(self, content: str):
        """
        Примитивный разбор текста вида:

        а) S = v * t
        б) v = 60 км/ч = 16,67 м/с
           t = 20 мин = 1200 с
        в) S = 16,67 * 1200 = 20004 м = 20 км
        г) Результат разумный, потому что...

        Возвращает (formula, si, calc, reasoning).
        Если ничего не нашли — все поля будут пустыми.
        """
        import re

        if not content:
            return "", "", "", ""

        # Нормализуем переводы строк
        text = content.replace("\r\n", "\n").replace("\r", "\n")
        lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

        current = None
        buckets = {"a": [], "b": [], "v": [], "g": []}

        for line in lines:
            # Ищем префиксы а)/б)/в)/г) в начале строки.
            # Допускаем как русские, так и латинские буквы.
            m = re.match(r"^([абвгabvg])\)\s*(.*)$", line, flags=re.IGNORECASE)
            if m:
                prefix = m.group(0)[0].lower()
                rest = m.group(1).strip()
                if prefix in ["а", "a"]:
                    current = "a"
                elif prefix in ["б", "b"]:
                    current = "b"
                elif prefix in ["в", "v"]:
                    current = "v"
                elif prefix in ["г", "g"]:
                    current = "g"
                else:
                    current = None

                if current and rest:
                    buckets[current].append(rest)
                continue

            if current:
                buckets[current].append(line)

        formula = "\n".join(buckets["a"]).strip()
        si = "\n".join(buckets["b"]).strip()
        calc = "\n".join(buckets["v"]).strip()
        reasoning = "\n".join(buckets["g"]).strip()

        # На случай, если не было меток а)/б)/в)/г) — ничего не трогаем
        if not any([formula, si, calc, reasoning]):
            return "", "", "", ""

        return formula, si, calc, reasoning

