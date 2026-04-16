# -*- coding: utf-8 -*-
"""
Заполнение TaskSolutionStep для задач 2-10 по аналогии с задачей 1 (детектив).
Шаги метода решения (SolutionStep id=1..10) уже существуют.

Для schema-шагов (2, 3, 4) оставляем пустую schema_data — учитель
заполнит графику через панель администратора.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "eora.settings")
django.setup()

from learning.models import Task, TaskSolutionStep, SolutionStep

METHOD_ID = 1  # единственный метод

STEPS_MAP = {s.order: s for s in SolutionStep.objects.filter(method_id=METHOD_ID)}

# ─── Данные для каждой задачи ────────────────────────────────────────────────
# Ключ = task_id. Значения — список из 10 словарей (по одному на шаг).
# Каждый словарь: {step_type, content, schema_data (опционально)}

TASK_DATA = {
    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 2: Муха и скворец
    # correct=1.67 м
    # ──────────────────────────────────────────────────────────────────────
    2: [
        # Шаг 1 — Выделите движущееся тело
        {"step_type": "text_pick", "content": "муха скворец"},
        # Шаг 2 — Начальное положение
        {"step_type": "schema", "content": "Муха и скворец находятся на расстоянии 5 м друг от друга", "schema_data": {}},
        # Шаг 3 — Последующие положения
        {"step_type": "schema", "content": "Скворец догоняет муху в некоторой точке", "schema_data": {}},
        # Шаг 4 — Участки движения
        {"step_type": "schema", "content": "Один участок: муха летит расстояние S₁, скворец — S₂ = S₁ + 5 м", "schema_data": {}},
        # Шаг 5 — Уравнение
        {"step_type": "text", "content": "S₁ = v₁·t (муха)\nS₂ = v₂·t (скворец)\nS₂ = S₁ + 5"},
        # Шаг 6 — Дано
        {"step_type": "symbol", "content": "Дано:\nv₁ = 5 м/с (муха)\nv₂ = 20 м/с (скворец)\nΔS = 5 м\nНайти: S₁",
         "schema_data": {"items": [
             {"fragment": "5 м/c", "symbol": "v₁", "isTarget": False},
             {"fragment": "20 м/с", "symbol": "v₂", "isTarget": False},
             {"fragment": "на расстоянии 5 м", "symbol": "ΔS", "isTarget": False},
             {"fragment": "Какое расстояние успеет пролететь муха", "symbol": "S₁", "isTarget": True}
         ]}},
        # Шаг 7 — Входит ли искомая?
        {"step_type": "boolean", "content": "no"},
        # Шаг 8 — Дополнительные уравнения
        {"step_type": "boolean", "content": "yes"},
        # Шаг 9 — Решение
        {"step_type": "solution", "content": "v₂·t = v₁·t + 5\nt = 5/(v₂ − v₁) = 5/(20 − 5) = 1/3 с\nS₁ = v₁·t = 5·(1/3) ≈ 1,67 м",
         "schema_data": {
             "formula": "S₁ = v₁ · ΔS / (v₂ − v₁)",
             "si": "v₁ = 5 м/с\nv₂ = 20 м/с\nΔS = 5 м",
             "calc": "t = 5/(20−5) = 1/3 с ≈ 0,33 с\nS₁ = 5 · 1/3 ≈ 1,67 м",
             "reasoning": "Муха за 0,33 с пролетит ~1,67 м — реалистично"
         }},
        # Шаг 10 — Ответ
        {"step_type": "text", "content": "Муха успеет пролететь расстояние примерно 1,67 м, прежде чем её догонит скворец"},
    ],

    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 3: Переплывание реки
    # correct=3.6 м
    # ──────────────────────────────────────────────────────────────────────
    3: [
        {"step_type": "text_pick", "content": "вы пловец"},
        {"step_type": "schema", "content": "Пловец на одном берегу реки шириной 9 м", "schema_data": {}},
        {"step_type": "schema", "content": "Пловец переплывает на другой берег; течение сносит его вниз", "schema_data": {}},
        {"step_type": "schema", "content": "Два участка: переправа (перпендикулярно) и снос течением", "schema_data": {}},
        {"step_type": "text", "content": "t = d / v_плавания\nS_сноса = v_течения · t"},
        {"step_type": "symbol", "content": "Дано:\nd = 9 м\nv_течения = 0,2 м/с\nv_плавания = 0,5 м/с\nНайти: S_сноса",
         "schema_data": {"items": [
             {"fragment": "9 м", "symbol": "d", "isTarget": False},
             {"fragment": "0,2 м/с", "symbol": "v_теч", "isTarget": False},
             {"fragment": "0,5 м/с", "symbol": "v_плав", "isTarget": False},
             {"fragment": "Какое расстояние вам придётся пройти", "symbol": "S", "isTarget": True}
         ]}},
        {"step_type": "boolean", "content": "no"},
        {"step_type": "boolean", "content": "yes"},
        {"step_type": "solution", "content": "t = d / v_плавания = 9 / 0,5 = 18 с\nS_сноса = v_течения · t = 0,2 · 18 = 3,6 м",
         "schema_data": {
             "formula": "S = v_теч · d / v_плав",
             "si": "d = 9 м\nv_теч = 0,2 м/с\nv_плав = 0,5 м/с",
             "calc": "t = 9/0,5 = 18 с\nS = 0,2 · 18 = 3,6 м",
             "reasoning": "Снос на 3,6 м при ширине реки 9 м — реалистично"
         }},
        {"step_type": "text", "content": "Вам придётся пройти вверх по течению 3,6 м, чтобы вернуться на уровень точки старта"},
    ],

    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 4: Радиосигнал от Альфа Центавра
    # correct=4.33 лет
    # ──────────────────────────────────────────────────────────────────────
    4: [
        {"step_type": "text_pick", "content": "радиосигнал"},
        {"step_type": "schema", "content": "Альфа Центавра — источник сигнала; Земля — приёмник", "schema_data": {}},
        {"step_type": "schema", "content": "Сигнал достигает Земли", "schema_data": {}},
        {"step_type": "schema", "content": "Один участок: равномерное движение сигнала от звезды до Земли", "schema_data": {}},
        {"step_type": "text", "content": "S = v · t"},
        {"step_type": "symbol", "content": "Дано:\nS = 39 000 000 000 000 км = 3,9·10¹³ км\nv = 300 000 км/с = 3·10⁵ км/с\n1 год = 30 000 000 с = 3·10⁷ с\nНайти: t (в годах)",
         "schema_data": {"items": [
             {"fragment": "39 000 000 000 000 км", "symbol": "S", "isTarget": False},
             {"fragment": "300 000 км/с", "symbol": "v", "isTarget": False},
             {"fragment": "Через сколько времени", "symbol": "t", "isTarget": True}
         ]}},
        {"step_type": "boolean", "content": "yes"},
        {"step_type": "boolean", "content": "no"},
        {"step_type": "solution", "content": "t = S / v = 3,9·10¹³ / 3·10⁵ = 1,3·10⁸ с\nt = 1,3·10⁸ / 3·10⁷ ≈ 4,33 года",
         "schema_data": {
             "formula": "t = S / v",
             "si": "S = 3,9·10¹³ км\nv = 3·10⁵ км/с",
             "calc": "t = 3,9·10¹³ / 3·10⁵ = 1,3·10⁸ с = 130 000 000 / 30 000 000 ≈ 4,33 года",
             "reasoning": "4,33 года — известное расстояние до ближайшей звезды, результат адекватный"
         }},
        {"step_type": "text", "content": "Радиосигнал от Альфа Центавра дойдёт до Земли примерно за 4,33 года"},
    ],

    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 5: Космическая станция
    # correct=8.0 км/с
    # ──────────────────────────────────────────────────────────────────────
    5: [
        {"step_type": "text_pick", "content": "космическая станция"},
        {"step_type": "schema", "content": "Космическая станция на орбите вокруг Земли", "schema_data": {}},
        {"step_type": "schema", "content": "Станция перемещается по орбите за одну минуту на 480 км", "schema_data": {}},
        {"step_type": "schema", "content": "Один участок: равномерное движение станции", "schema_data": {}},
        {"step_type": "text", "content": "S = v · t → v = S / t"},
        {"step_type": "symbol", "content": "Дано:\nS = 480 км\nt = 1 мин = 60 с\nv₂ = 11,9 км/с (вторая космическая)\nНайти: v",
         "schema_data": {"items": [
             {"fragment": "480 км", "symbol": "S", "isTarget": False},
             {"fragment": "одну минуту", "symbol": "t", "isTarget": False},
             {"fragment": "11,9 км/с", "symbol": "v₂", "isTarget": False},
             {"fragment": "Является космическая станция искусственным спутником", "symbol": "v", "isTarget": True}
         ]}},
        {"step_type": "boolean", "content": "yes"},
        {"step_type": "boolean", "content": "no"},
        {"step_type": "solution", "content": "v = S / t = 480 / 60 = 8 км/с\n8 км/с < 11,9 км/с → станция — спутник Земли",
         "schema_data": {
             "formula": "v = S / t",
             "si": "S = 480 км\nt = 1 мин = 60 с",
             "calc": "v = 480 / 60 = 8 км/с\nСравнение: 8 < 11,9 → спутник",
             "reasoning": "8 км/с — типичная скорость орбитальной станции (МКС ~7,66 км/с), результат адекватный"
         }},
        {"step_type": "text", "content": "Скорость станции — 8 км/с, что меньше второй космической скорости (11,9 км/с), значит, станция является искусственным спутником Земли"},
    ],

    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 6: Погрузка свёклы транспортёром
    # correct=300.0 с
    # ──────────────────────────────────────────────────────────────────────
    6: [
        {"step_type": "text_pick", "content": "корнеплоды свёкла транспортёр"},
        {"step_type": "schema", "content": "Транспортёр с корнеплодами, расположенными через 0,1 м друг от друга", "schema_data": {}},
        {"step_type": "schema", "content": "Все корнеплоды загружены в автомашину", "schema_data": {}},
        {"step_type": "schema", "content": "Один участок: равномерное движение ленты транспортёра", "schema_data": {}},
        {"step_type": "text", "content": "N = M / m (количество корнеплодов)\nL = N · d (длина ленты)\nt = L / v"},
        {"step_type": "symbol", "content": "Дано:\nM = 3 т = 3000 кг\nm = 2 кг\nd = 0,1 м\nv = 0,5 м/с\nНайти: t",
         "schema_data": {"items": [
             {"fragment": "3 т", "symbol": "M", "isTarget": False},
             {"fragment": "2 кг", "symbol": "m", "isTarget": False},
             {"fragment": "0,1 м", "symbol": "d", "isTarget": False},
             {"fragment": "0,5 м/с", "symbol": "v", "isTarget": False},
             {"fragment": "Найдите время погрузки", "symbol": "t", "isTarget": True}
         ]}},
        {"step_type": "boolean", "content": "no"},
        {"step_type": "boolean", "content": "yes"},
        {"step_type": "solution", "content": "N = M/m = 3000/2 = 1500 шт.\nL = N·d = 1500·0,1 = 150 м\nt = L/v = 150/0,5 = 300 с",
         "schema_data": {
             "formula": "t = (M · d) / (m · v)",
             "si": "M = 3 т = 3000 кг\nm = 2 кг\nd = 0,1 м\nv = 0,5 м/с",
             "calc": "N = 3000/2 = 1500\nL = 1500·0,1 = 150 м\nt = 150/0,5 = 300 с = 5 мин",
             "reasoning": "5 минут на загрузку 3 тонн свёклы транспортёром — реалистичный результат"
         }},
        {"step_type": "text", "content": "Время погрузки свёклы в автомашину составляет 300 с (5 минут)"},
    ],

    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 7: Пуля через вагон
    # correct=900.0 м/с
    # ──────────────────────────────────────────────────────────────────────
    7: [
        {"step_type": "text_pick", "content": "вагон пуля"},
        {"step_type": "schema", "content": "Вагон движется горизонтально; пуля летит перпендикулярно", "schema_data": {}},
        {"step_type": "schema", "content": "Пуля пробивает обе стенки; отверстия смещены на 3 см", "schema_data": {}},
        {"step_type": "schema", "content": "Два одновременных движения: вагон (горизонтально) и пуля (перпендикулярно)", "schema_data": {}},
        {"step_type": "text", "content": "Δ = v_ваг · t (смещение отверстий)\nd = v_пули · t (ширина вагона)"},
        {"step_type": "symbol", "content": "Дано:\nv_ваг = 36 км/ч\nΔ = 3 см = 0,03 м\nd = 2,7 м\nНайти: v_пули",
         "schema_data": {"items": [
             {"fragment": "36 км/ч", "symbol": "v_ваг", "isTarget": False},
             {"fragment": "3 см", "symbol": "Δ", "isTarget": False},
             {"fragment": "2,7 м", "symbol": "d", "isTarget": False},
             {"fragment": "Определите скорость пули", "symbol": "v_п", "isTarget": True}
         ]}},
        {"step_type": "boolean", "content": "no"},
        {"step_type": "boolean", "content": "yes"},
        {"step_type": "solution", "content": "v_ваг = 36 км/ч = 10 м/с\nt = Δ / v_ваг = 0,03 / 10 = 0,003 с\nv_пули = d / t = 2,7 / 0,003 = 900 м/с",
         "schema_data": {
             "formula": "v_п = d · v_ваг / Δ",
             "si": "v_ваг = 36 км/ч = 10 м/с\nΔ = 3 см = 0,03 м\nd = 2,7 м",
             "calc": "t = 0,03/10 = 0,003 с\nv_п = 2,7/0,003 = 900 м/с",
             "reasoning": "900 м/с — типичная скорость пули из винтовки, результат адекватный"
         }},
        {"step_type": "text", "content": "Скорость пули составляет 900 м/с"},
    ],

    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 8: Бикфордов шнур
    # correct=48.0 см
    # ──────────────────────────────────────────────────────────────────────
    8: [
        {"step_type": "text_pick", "content": "человек пламя"},
        {"step_type": "schema", "content": "Человек у шнура, шнур подожжён", "schema_data": {}},
        {"step_type": "schema", "content": "Человек отбежал на 300 м; пламя дошло до конца шнура", "schema_data": {}},
        {"step_type": "schema", "content": "Два одновременных движения: человек бежит и пламя горит по шнуру", "schema_data": {}},
        {"step_type": "text", "content": "S_бег = v_бег · t\nL_шнур = v_пламя · t"},
        {"step_type": "symbol", "content": "Дано:\nS = 300 м\nv_бег = 5 м/с\nv_пламя = 0,8 см/с\nНайти: L (длина шнура)",
         "schema_data": {"items": [
             {"fragment": "300 м", "symbol": "S", "isTarget": False},
             {"fragment": "5 м/с", "symbol": "v_бег", "isTarget": False},
             {"fragment": "0,8 см/с", "symbol": "v_пл", "isTarget": False},
             {"fragment": "Какой длины бикфордов шнур", "symbol": "L", "isTarget": True}
         ]}},
        {"step_type": "boolean", "content": "no"},
        {"step_type": "boolean", "content": "yes"},
        {"step_type": "solution", "content": "t = S / v_бег = 300 / 5 = 60 с\nL = v_пламя · t = 0,8 · 60 = 48 см",
         "schema_data": {
             "formula": "L = v_пл · S / v_бег",
             "si": "S = 300 м\nv_бег = 5 м/с\nv_пл = 0,8 см/с",
             "calc": "t = 300/5 = 60 с\nL = 0,8 · 60 = 48 см",
             "reasoning": "48 см шнура — реалистично для безопасного отбегания"
         }},
        {"step_type": "text", "content": "Необходим бикфордов шнур длиной 48 см"},
    ],

    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 9: Средняя скорость самолёта
    # correct=928.57 км/ч
    # ──────────────────────────────────────────────────────────────────────
    9: [
        {"step_type": "text_pick", "content": "самолёт"},
        {"step_type": "schema", "content": "Самолёт в точке вылета", "schema_data": {}},
        {"step_type": "schema", "content": "Самолёт в точке прилёта, пролетев два участка", "schema_data": {}},
        {"step_type": "schema", "content": "Участок 1: S₁ = 2200 км, v₁ = 1000 км/ч\nУчасток 2: S₂ = 1700 км, v₂ = 850 км/ч", "schema_data": {}},
        {"step_type": "text", "content": "S₁ = v₁ · t₁\nS₂ = v₂ · t₂\nv_ср = (S₁ + S₂) / (t₁ + t₂)"},
        {"step_type": "symbol", "content": "Дано:\nS₁ = 2200 км\nv₁ = 1000 км/ч\nS₂ = 1700 км\nv₂ = 850 км/ч\nНайти: v_ср",
         "schema_data": {"items": [
             {"fragment": "2200 км", "symbol": "S₁", "isTarget": False},
             {"fragment": "1000 км/ч", "symbol": "v₁", "isTarget": False},
             {"fragment": "1700 км", "symbol": "S₂", "isTarget": False},
             {"fragment": "850 км/ч", "symbol": "v₂", "isTarget": False},
             {"fragment": "средняя скорость самолёта", "symbol": "v_ср", "isTarget": True}
         ]}},
        {"step_type": "boolean", "content": "no"},
        {"step_type": "boolean", "content": "yes"},
        {"step_type": "solution", "content": "t₁ = S₁/v₁ = 2200/1000 = 2,2 ч\nt₂ = S₂/v₂ = 1700/850 = 2 ч\nv_ср = (2200+1700)/(2,2+2) = 3900/4,2 ≈ 928,57 км/ч",
         "schema_data": {
             "formula": "v_ср = (S₁ + S₂) / (S₁/v₁ + S₂/v₂)",
             "si": "S₁ = 2200 км, v₁ = 1000 км/ч\nS₂ = 1700 км, v₂ = 850 км/ч",
             "calc": "t₁ = 2200/1000 = 2,2 ч\nt₂ = 1700/850 = 2 ч\nv_ср = 3900/4,2 ≈ 928,57 км/ч",
             "reasoning": "Средняя скорость между 850 и 1000 — адекватный результат"
         }},
        {"step_type": "text", "content": "Средняя скорость самолёта за весь перелёт составляет примерно 928,57 км/ч"},
    ],

    # ──────────────────────────────────────────────────────────────────────
    # ЗАДАЧА 10: Велосипед (подъём и спуск)
    # correct=2.82 м/с
    # ──────────────────────────────────────────────────────────────────────
    10: [
        {"step_type": "text_pick", "content": "вы велосипедист"},
        {"step_type": "schema", "content": "Велосипедист внизу подъёма", "schema_data": {}},
        {"step_type": "schema", "content": "Велосипедист вернулся в начальную точку после спуска", "schema_data": {}},
        {"step_type": "schema", "content": "Участок 1 (подъём): v₁ = 6 км/ч\nУчасток 2 (спуск): v₂ = 8 м/с\nРасстояние одинаковое", "schema_data": {}},
        {"step_type": "text", "content": "S = v₁ · t₁ = v₂ · t₂\nv_ср = 2S / (t₁ + t₂) = 2v₁v₂ / (v₁ + v₂)"},
        {"step_type": "symbol", "content": "Дано:\nv₁ = 6 км/ч ≈ 1,67 м/с\nv₂ = 8 м/с\nS₁ = S₂ = S\nНайти: v_ср",
         "schema_data": {"items": [
             {"fragment": "6 км/ч", "symbol": "v₁", "isTarget": False},
             {"fragment": "8 м/с", "symbol": "v₂", "isTarget": False},
             {"fragment": "средняя скорость вашего движения", "symbol": "v_ср", "isTarget": True}
         ]}},
        {"step_type": "boolean", "content": "no"},
        {"step_type": "boolean", "content": "yes"},
        {"step_type": "solution", "content": "v₁ = 6 км/ч = 6/3,6 ≈ 1,67 м/с\nv_ср = 2·v₁·v₂/(v₁+v₂) = 2·1,67·8/(1,67+8) = 26,72/9,67 ≈ 2,76 м/с",
         "schema_data": {
             "formula": "v_ср = 2v₁v₂ / (v₁ + v₂)",
             "si": "v₁ = 6 км/ч = 1,67 м/с\nv₂ = 8 м/с",
             "calc": "v_ср = 2·1,67·8 / (1,67+8) = 26,72 / 9,67 ≈ 2,76 м/с",
             "reasoning": "Средняя скорость ближе к меньшей из двух — адекватно для велосипеда"
         }},
        {"step_type": "text", "content": "Средняя скорость движения велосипедиста составляет примерно 2,76 м/с"},
    ],
}


def populate():
    created = 0
    updated = 0
    skipped = 0

    for task_id, steps_data in TASK_DATA.items():
        task = Task.objects.get(id=task_id)
        print(f"\n--- Task {task_id} (order={task.order}): {task.text[:60]}...")

        for i, step_info in enumerate(steps_data):
            step_order = i + 1
            step = STEPS_MAP.get(step_order)
            if not step:
                print(f"  [SKIP] SolutionStep order={step_order} not found")
                skipped += 1
                continue

            defaults = {
                "step_type": step_info["step_type"],
                "content": step_info.get("content", ""),
                "schema_data": step_info.get("schema_data", {}),
            }

            obj, was_created = TaskSolutionStep.objects.update_or_create(
                task=task,
                step=step,
                defaults=defaults,
            )

            if was_created:
                print(f"  [CREATE] step {step_order} ({step_info['step_type']})")
                created += 1
            else:
                print(f"  [UPDATE] step {step_order} ({step_info['step_type']})")
                updated += 1

    print(f"\nDone: created={created}, updated={updated}, skipped={skipped}")


if __name__ == "__main__":
    populate()
