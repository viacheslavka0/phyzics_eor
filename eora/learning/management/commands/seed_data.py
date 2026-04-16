"""
Команда для заполнения базы начальными данными
Запуск: python manage.py seed_data
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from learning.models import (
    SchoolClass, SubjectSection, Topic,
    KnowledgeSystem, KSZone, KSQuestion,
    SolutionMethod, SolutionStep,
    Task, SchemaElementCategory, SchemaElement
)


class Command(BaseCommand):
    help = 'Заполняет базу начальными данными для демонстрации'

    def handle(self, *args, **options):
        User = get_user_model()
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "", "admin")
            self.stdout.write("  [OK] Создан суперпользователь admin / admin (вход на /app/ и /admin/)")
        self.stdout.write("Creating learning structure...")

        # =====================================================================
        # 1. Классы
        # =====================================================================
        class_7, _ = SchoolClass.objects.get_or_create(number=7, defaults={"title": "7 класс"})
        class_8, _ = SchoolClass.objects.get_or_create(number=8, defaults={"title": "8 класс"})
        class_9, _ = SchoolClass.objects.get_or_create(number=9, defaults={"title": "9 класс"})
        self.stdout.write("  [OK] Классы: 7, 8, 9")

        # =====================================================================
        # 2. Разделы (для 7 класса)
        # =====================================================================
        section_mech, _ = SubjectSection.objects.get_or_create(
            school_class=class_7,
            title="Механические явления",
            defaults={"order": 1}
        )
        self.stdout.write(f"  [OK] Раzdel: {section_mech.title}")

        # =====================================================================
        # 3. Темы
        # =====================================================================
        topic_rind, _ = Topic.objects.get_or_create(
            section=section_mech,
            title="Равномерное и неравномерное движение на участке траектории",
            defaults={"order": 1}
        )
        self.stdout.write(f"  [OK] Tema: {topic_rind.title}")

        # =====================================================================
        # 4. Система знаний
        # =====================================================================
        ks, created = KnowledgeSystem.objects.get_or_create(
            topic=topic_rind,
            title="Равномерное и неравномерное движение",
            defaults={
                "description": "Система знаний о равномерном и неравномерном движении тел на участке траектории",
                "image": "ks/1.png",
                "show_zones_by_default": True,
                "typical_task_title": "Найдите значение одной из величин, описывающих равномерное или неравномерное движение тел, в следующих задачах",
                "typical_task_description": """Систему знаний о равномерном и неравномерном движении можно применить при решении задач типа 
«Найти значение одной из величин, описывающих равномерное или неравномерное движение тел».

Такие задачи встречаются в ситуациях:
- определение расстояния, пройденного телом за известное время
- определение времени движения при известной скорости и пути
- определение скорости по известным пути и времени
- расчёт средней скорости при неравномерном движении""",
                "status": "published",
                "version": 1,
            }
        )
        self.stdout.write(f"  [OK] KS: {ks.title}")

        # =====================================================================
        # 5. Метод решения (10 шагов)
        # =====================================================================
        method, _ = SolutionMethod.objects.get_or_create(
            ks=ks,
            defaults={
                "title": "Метод решения задач на применение системы знаний о равномерном и неравномерном движении",
                "description": "Последовательность действий для решения задач на равномерное и неравномерное движение"
            }
        )

        steps_data = [
            {
                "order": 1,
                "title": "Выделите движущееся тело (тела)",
                "description": "Определите, какие тела участвуют в движении. Это могут быть автомобили, люди, животные, снаряды и т.д.",
                "hint": "Ищите в условии задачи существительные, которые могут двигаться"
            },
            {
                "order": 2,
                "title": "Выделите начальное положение тела и его характеристики. Изобразите",
                "description": "Определите, где находилось тело в начальный момент времени. Нарисуйте схему.",
                "hint": "Начальное положение часто указывается словами: 'находится', 'стоит', 'расположен'"
            },
            {
                "order": 3,
                "title": "Выделите последующие положения тела. Изобразите",
                "description": "Определите конечное положение тела или промежуточные точки траектории.",
                "hint": "Конечное положение может быть указано как 'прибыл', 'достиг', 'оказался'"
            },
            {
                "order": 4,
                "title": "Выделите участки движения и характеристики движения на каждом участке. Обозначьте",
                "description": "Разбейте движение на участки. Для каждого участка определите: путь (s), время (t), скорость (v).",
                "hint": "Если скорость меняется — это разные участки движения"
            },
            {
                "order": 5,
                "title": "Составьте уравнение s = vt для каждого участка",
                "description": "Для равномерного движения: s = v·t. Для неравномерного: s = v_ср·t",
                "hint": "Помните: путь = скорость × время"
            },
            {
                "order": 6,
                "title": "Установите известные характеристики и искомую величину. Запишите кратко данные",
                "description": "Выпишите в столбик 'Дано:' все известные величины. Под чертой укажите, что нужно найти.",
                "hint": "Не забудьте перевести единицы в СИ!"
            },
            {
                "order": 7,
                "title": "Установите, входит ли искомая величина в составленные уравнения",
                "description": "Проверьте, можно ли сразу найти искомую величину из уравнений шага 5.",
                "hint": "Если искомая величина есть в уравнении — выразите её"
            },
            {
                "order": 8,
                "title": "Составьте дополнительные уравнения при необходимости",
                "description": "Если число уравнений меньше числа неизвестных — нужны дополнительные связи.",
                "hint": "Дополнительные связи часто следуют из условия: 'одновременно', 'встретились', 'догнал'"
            },
            {
                "order": 9,
                "title": "Найдите значение искомой величины",
                "description": """а) Составьте формулу для расчёта искомой величины
б) Выразите величины в единицах СИ
в) Произведите расчёт
г) Оцените разумность результата""",
                "hint": "Проверьте размерность! Если ищете время — ответ должен быть в секундах"
            },
            {
                "order": 10,
                "title": "Сформулируйте ответ",
                "description": "Запишите ответ полным предложением с указанием единиц измерения.",
                "hint": "Ответ: 'Скорость автомобиля равна 20 м/с' или 'v = 20 м/с'"
            },
        ]

        for step_data in steps_data:
            SolutionStep.objects.get_or_create(
                method=method,
                order=step_data["order"],
                defaults={
                    "title": step_data["title"],
                    "description": step_data["description"],
                    "hint": step_data["hint"],
                }
            )
        self.stdout.write(f"  [OK] Method: {len(steps_data)} steps")

        # =====================================================================
        # 6. Задачи (10 штук)
        # =====================================================================
        tasks_data = [
            {
                "order": 1,
                "title": "Задача детектива",
                "text": "Вы – детектив и определяете область поиска преступника, который вышел из известного дома 20 мин назад и старается скрыться из города на автомобиле. Максимальная скорость автомобиля в городе — 60 км/ч. На каком максимальном расстоянии от дома может находиться преступник?",
                "correct_answer": 20,
                "answer_unit": "км",
                "answer_tolerance": 5,
                "difficulty": 2,
                "solution_summary": "s = v·t = 60 км/ч · (20/60) ч = 20 км",
                "solution_detailed": """1. Движущееся тело: автомобиль преступника
2. Начальное положение: у дома
3. Конечное положение: неизвестно (искомое)
4. Дано: t = 20 мин = 1/3 ч, v = 60 км/ч
5. Уравнение: s = v·t
6. Найти: s — ?
7. Искомая величина s входит в уравнение
8. Дополнительные уравнения не нужны
9. s = 60 · (1/3) = 20 км
10. Ответ: максимальное расстояние — 20 км"""
            },
            {
                "order": 2,
                "title": "Муха и скворец",
                "text": "Какое расстояние успеет пролететь муха, за которой гонится скворец, если он заметил её на расстоянии 5 м? Скорость движения мухи – 5 м/c, скворца – 20 м/с.",
                "correct_answer": 1.67,
                "answer_unit": "м",
                "answer_tolerance": 5,
                "difficulty": 3,
                "solution_summary": "t = a/(v_с - v_м) = 5/(20-5) = 1/3 c; s_м = v_м·t = 5·(1/3) ≈ 1,67 м",
                "solution_detailed": """1. Движущиеся тела: муха и скворец
2. Начальное положение: расстояние между ними a = 5 м
3. Конечное положение: скворец догоняет муху
4. v_м = 5 м/с, v_с = 20 м/с
5. За время t муха пролетит: s_м = v_м·t
   Скворец пролетит: s_с = v_с·t
6. Условие встречи: s_с - s_м = a
7. v_с·t - v_м·t = a → t = a/(v_с - v_м)
8. t = 5/(20-5) = 5/15 = 1/3 с
9. s_м = 5 · (1/3) ≈ 1,67 м
10. Ответ: муха пролетит примерно 1,67 м"""
            },
            {
                "order": 3,
                "title": "Переправа через реку",
                "text": "Вы переплываете реку перпендикулярно течению. Какое расстояние вам придётся пройти вверх по течению, чтобы попасть в точку, расположенную напротив того места, откуда вы начали движение? Ширина реки – 9 м, скорость течения реки – 0,2 м/с. Вы способны плыть со скоростью 0,5 м/с.",
                "correct_answer": 3.6,
                "answer_unit": "м",
                "answer_tolerance": 5,
                "difficulty": 4,
                "solution_summary": "t = d/v_пл = 9/0,5 = 18 с; снос = v_т·t = 0,2·18 = 3,6 м",
            },
            {
                "order": 4,
                "title": "Сигнал с Альфа Центавра",
                "text": "Через сколько времени до Земли дойдёт радиосигнал, посланный «братьями по разуму» с Альфа Центавра, которая находится на расстоянии 39 000 000 000 000 км? При расчётах примите 1 год равным 30 000 000 с. Скорость радиосигнала составляет 300 000 км/с.",
                "correct_answer": 4.33,
                "answer_unit": "лет",
                "answer_tolerance": 5,
                "difficulty": 3,
            },
            {
                "order": 5,
                "title": "Космическая станция",
                "text": "Является космическая станция искусственным спутником Земли, или она направляется к другим планетам, если за одну минуту она пролетает 480 км? Для полётов к другим планетам скорость должна быть не менее 11,9 км/с (вторая космическая скорость).",
                "correct_answer": 8,
                "answer_unit": "км/с",
                "answer_tolerance": 5,
                "difficulty": 2,
                "correct_answer_text": "спутник Земли",
            },
            {
                "order": 6,
                "title": "Погрузка свёклы",
                "text": "Найдите время погрузки свёклы с помощью транспортёра в автомашину грузоподъёмностью 3 т. Скорость движения транспортёра 0,5 м/с. Средняя масса корнеплодов – 2 кг, а расстояние между ними на ленте транспортёра 0,1 м.",
                "correct_answer": 300,
                "answer_unit": "с",
                "answer_tolerance": 5,
                "difficulty": 4,
            },
            {
                "order": 7,
                "title": "Пуля в вагоне",
                "text": "Вагон поезда, движущегося со скоростью 36 км/ч, был пробит пулей, летевшей перпендикулярно движению вагона. Отверстия в стенках смещены на 3 см друг относительно друга, ширина вагона – 2,7 м. Определите скорость пули.",
                "correct_answer": 900,
                "answer_unit": "м/с",
                "answer_tolerance": 5,
                "difficulty": 4,
            },
            {
                "order": 8,
                "title": "Бикфордов шнур",
                "text": "Какой длины бикфордов шнур нужно взять, чтобы при взрыве успеть отбежать на расстояние 300 м после того, как он будет зажжён? Скорость бега – 5 м/с, пламя распространяется по шнуру со скоростью 0,8 см/с.",
                "correct_answer": 48,
                "answer_unit": "см",
                "answer_tolerance": 5,
                "difficulty": 3,
            },
            {
                "order": 9,
                "title": "Перелёт самолёта",
                "text": "Самолёт пролетает 2200 км со скоростью 1000 км/ч. Затем из-за встречного ветра скорость самолёта уменьшается, и следующие 1700 км он пролетает уже со скоростью 850 км/ч. Какова средняя скорость самолёта за такой перелёт?",
                "correct_answer": 928.57,
                "answer_unit": "км/ч",
                "answer_tolerance": 2,
                "difficulty": 3,
            },
            {
                "order": 10,
                "title": "Велосипедист на горке",
                "text": "Катаясь на велосипеде, вы потрудились на подъёме, развивая скорость 6 км/ч, а обратно прокатились «с ветерком», разогнавшись до скорости 8 м/с. Какова средняя скорость вашего движения?",
                "correct_answer": 2.82,
                "answer_unit": "м/с",
                "answer_tolerance": 5,
                "difficulty": 3,
            },
        ]

        for task_data in tasks_data:
            Task.objects.get_or_create(
                ks=ks,
                order=task_data["order"],
                defaults={
                    "title": task_data["title"],
                    "text": task_data["text"],
                    "correct_answer": task_data.get("correct_answer"),
                    "answer_unit": task_data.get("answer_unit", ""),
                    "answer_tolerance": task_data.get("answer_tolerance", 1),
                    "difficulty": task_data.get("difficulty", 3),
                    "solution_summary": task_data.get("solution_summary", ""),
                    "solution_detailed": task_data.get("solution_detailed", ""),
                    "correct_answer_text": task_data.get("correct_answer_text", ""),
                }
            )
        self.stdout.write(f"  [OK] Tasks: {len(tasks_data)}")

        # =====================================================================
        # 7. Категории элементов схемы
        # =====================================================================
        categories_data = [
            {"name": "Точки и тела", "slug": "points", "icon": "●", "order": 1},
            {"name": "Векторы", "slug": "vectors", "icon": "→", "order": 2},
            {"name": "Линии и траектории", "slug": "lines", "icon": "—", "order": 3},
            {"name": "Оси координат", "slug": "axes", "icon": "⊥", "order": 4},
            {"name": "Надписи", "slug": "labels", "icon": "T", "order": 5},
        ]
        
        categories = {}
        for cat_data in categories_data:
            cat, _ = SchemaElementCategory.objects.get_or_create(
                slug=cat_data["slug"],
                defaults={
                    "name": cat_data["name"],
                    "icon": cat_data["icon"],
                    "order": cat_data["order"],
                    "is_system": True
                }
            )
            categories[cat_data["slug"]] = cat
        self.stdout.write(f"  [OK] Schema categories: {len(categories_data)}")

        # =====================================================================
        # 8. Элементы схемы с SVG
        # =====================================================================
        elements_data = [
            # === Точки и тела ===
            {
                "category": "points",
                "name": "Точка",
                "description": "Обозначение положения тела (материальная точка)",
                "svg_icon": '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
                "svg_template": '<circle cx="0" cy="0" r="{radius}" fill="{color}"/>',
                "default_props": {"color": "#1a1a2e", "radius": 6},
                "editable_props": ["color", "radius", "label"],
                "tags": "точка, положение, начало, конец",
                "order": 1
            },
            {
                "category": "points",
                "name": "Начальное положение",
                "description": "Точка начального положения тела (A или с индексом 0)",
                "svg_icon": '<circle cx="12" cy="12" r="5" fill="#22c55e" stroke="#15803d" stroke-width="2"/>',
                "svg_template": '<circle cx="0" cy="0" r="{radius}" fill="{color}" stroke="#15803d" stroke-width="2"/>',
                "default_props": {"color": "#22c55e", "radius": 6, "label": "A"},
                "editable_props": ["color", "radius", "label"],
                "tags": "начало, старт, исходное положение",
                "order": 2
            },
            {
                "category": "points",
                "name": "Конечное положение",
                "description": "Точка конечного положения тела (B или с индексом)",
                "svg_icon": '<circle cx="12" cy="12" r="5" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>',
                "svg_template": '<circle cx="0" cy="0" r="{radius}" fill="{color}" stroke="#b91c1c" stroke-width="2"/>',
                "default_props": {"color": "#ef4444", "radius": 6, "label": "B"},
                "editable_props": ["color", "radius", "label"],
                "tags": "конец, финиш, конечное положение",
                "order": 3
            },
            {
                "category": "points",
                "name": "Тело (круг)",
                "description": "Изображение тела в виде круга",
                "svg_icon": '<circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/>',
                "svg_template": '<circle cx="0" cy="0" r="{radius}" fill="{color}" stroke="{strokeColor}" stroke-width="2"/>',
                "default_props": {"color": "#3b82f6", "strokeColor": "#1d4ed8", "radius": 15},
                "editable_props": ["color", "radius", "label"],
                "tags": "тело, объект, материальная точка",
                "order": 4
            },
            {
                "category": "points",
                "name": "Тело (прямоугольник)",
                "description": "Изображение тела в виде прямоугольника (автомобиль, вагон)",
                "svg_icon": '<rect x="4" y="8" width="16" height="8" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>',
                "svg_template": '<rect x="{-width/2}" y="{-height/2}" width="{width}" height="{height}" fill="{color}" stroke="{strokeColor}" stroke-width="2"/>',
                "default_props": {"color": "#f59e0b", "strokeColor": "#d97706", "width": 40, "height": 20},
                "editable_props": ["color", "width", "height", "label"],
                "tags": "тело, машина, вагон, объект",
                "order": 5
            },
            # === Векторы ===
            {
                "category": "vectors",
                "name": "Вектор скорости",
                "description": "Вектор мгновенной скорости (v)",
                "svg_icon": '<path d="M4 12 H18 M18 12 L14 8 M18 12 L14 16" stroke="#ef4444" stroke-width="2" fill="none"/>',
                "svg_template": '<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"/><polygon points="{length},0 {length-10},-5 {length-10},5" fill="{color}"/>',
                "default_props": {"color": "#ef4444", "strokeWidth": 2, "length": 60, "label": "v"},
                "editable_props": ["color", "length", "label", "strokeWidth"],
                "tags": "скорость, вектор, v, направление движения",
                "order": 1
            },
            {
                "category": "vectors",
                "name": "Вектор перемещения",
                "description": "Вектор перемещения (s или r)",
                "svg_icon": '<path d="M4 12 H18 M18 12 L14 8 M18 12 L14 16" stroke="#3b82f6" stroke-width="2" fill="none"/>',
                "svg_template": '<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"/><polygon points="{length},0 {length-10},-5 {length-10},5" fill="{color}"/>',
                "default_props": {"color": "#3b82f6", "strokeWidth": 2, "length": 80, "label": "s"},
                "editable_props": ["color", "length", "label", "strokeWidth"],
                "tags": "перемещение, вектор, s, путь",
                "order": 2
            },
            {
                "category": "vectors",
                "name": "Вектор ускорения",
                "description": "Вектор ускорения (a)",
                "svg_icon": '<path d="M4 12 H18 M18 12 L14 8 M18 12 L14 16" stroke="#8b5cf6" stroke-width="2" fill="none"/>',
                "svg_template": '<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"/><polygon points="{length},0 {length-10},-5 {length-10},5" fill="{color}"/>',
                "default_props": {"color": "#8b5cf6", "strokeWidth": 2, "length": 50, "label": "a"},
                "editable_props": ["color", "length", "label", "strokeWidth"],
                "tags": "ускорение, вектор, a",
                "order": 3
            },
            {
                "category": "vectors",
                "name": "Вектор силы",
                "description": "Вектор силы (F)",
                "svg_icon": '<path d="M4 12 H18 M18 12 L14 8 M18 12 L14 16" stroke="#22c55e" stroke-width="3" fill="none"/>',
                "svg_template": '<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"/><polygon points="{length},0 {length-12},-6 {length-12},6" fill="{color}"/>',
                "default_props": {"color": "#22c55e", "strokeWidth": 3, "length": 70, "label": "F"},
                "editable_props": ["color", "length", "label", "strokeWidth"],
                "tags": "сила, вектор, F",
                "order": 4
            },
            # === Линии и траектории ===
            {
                "category": "lines",
                "name": "Линия",
                "description": "Прямая линия",
                "svg_icon": '<line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/>',
                "svg_template": '<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"/>',
                "default_props": {"color": "#1a1a2e", "strokeWidth": 2, "length": 100},
                "editable_props": ["color", "length", "strokeWidth"],
                "tags": "линия, прямая, отрезок",
                "order": 1
            },
            {
                "category": "lines",
                "name": "Пунктирная линия",
                "description": "Пунктирная линия для вспомогательных построений",
                "svg_icon": '<line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-dasharray="4 2"/>',
                "svg_template": '<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}" stroke-dasharray="8 4"/>',
                "default_props": {"color": "#6b7280", "strokeWidth": 1, "length": 100},
                "editable_props": ["color", "length", "strokeWidth"],
                "tags": "пунктир, вспомогательная, проекция",
                "order": 2
            },
            {
                "category": "lines",
                "name": "Траектория",
                "description": "Линия траектории движения",
                "svg_icon": '<path d="M4 16 Q10 4 16 12 T22 8" stroke="#3b82f6" stroke-width="2" fill="none"/>',
                "svg_template": '<path d="{path}" stroke="{color}" stroke-width="{strokeWidth}" fill="none"/>',
                "default_props": {"color": "#3b82f6", "strokeWidth": 2, "path": "M0,0 Q50,-30 100,0"},
                "editable_props": ["color", "strokeWidth"],
                "tags": "траектория, путь движения",
                "order": 3
            },
            {
                "category": "lines",
                "name": "Дуга угла",
                "description": "Дуга для обозначения угла",
                "svg_icon": '<path d="M16 12 A4 4 0 0 0 12 8" stroke="#8b5cf6" stroke-width="2" fill="none"/>',
                "svg_template": '<path d="M{radius},0 A{radius},{radius} 0 0 1 {endX},{endY}" stroke="{color}" stroke-width="{strokeWidth}" fill="none"/>',
                "default_props": {"color": "#8b5cf6", "strokeWidth": 2, "radius": 20, "angle": 45},
                "editable_props": ["color", "radius", "angle", "label"],
                "tags": "угол, дуга, градус",
                "order": 4
            },
            # === Оси координат ===
            {
                "category": "axes",
                "name": "Ось X",
                "description": "Горизонтальная ось координат",
                "svg_icon": '<path d="M2 12 H20 M20 12 L16 9 M20 12 L16 15" stroke="currentColor" stroke-width="2" fill="none"/>',
                "svg_template": '<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="2"/><polygon points="{length},0 {length-8},-4 {length-8},4" fill="{color}"/><text x="{length+5}" y="4" font-size="14" fill="{color}">{label}</text>',
                "default_props": {"color": "#1a1a2e", "length": 150, "label": "x"},
                "editable_props": ["color", "length", "label"],
                "tags": "ось, x, горизонталь, координаты",
                "order": 1
            },
            {
                "category": "axes",
                "name": "Ось Y",
                "description": "Вертикальная ось координат",
                "svg_icon": '<path d="M12 22 V4 M12 4 L9 8 M12 4 L15 8" stroke="currentColor" stroke-width="2" fill="none"/>',
                "svg_template": '<line x1="0" y1="0" x2="0" y2="-{length}" stroke="{color}" stroke-width="2"/><polygon points="0,-{length} -4,-{length-8} 4,-{length-8}" fill="{color}"/><text x="5" y="-{length}" font-size="14" fill="{color}">{label}</text>',
                "default_props": {"color": "#1a1a2e", "length": 150, "label": "y"},
                "editable_props": ["color", "length", "label"],
                "tags": "ось, y, вертикаль, координаты",
                "order": 2
            },
            {
                "category": "axes",
                "name": "Начало координат",
                "description": "Точка начала координат (O)",
                "svg_icon": '<circle cx="12" cy="12" r="3" fill="currentColor"/><text x="14" y="22" font-size="10">O</text>',
                "svg_template": '<circle cx="0" cy="0" r="4" fill="{color}"/><text x="6" y="14" font-size="12" fill="{color}">O</text>',
                "default_props": {"color": "#1a1a2e"},
                "editable_props": ["color"],
                "tags": "начало координат, O, центр",
                "order": 3
            },
            # === Надписи ===
            {
                "category": "labels",
                "name": "Текст",
                "description": "Произвольная надпись",
                "svg_icon": '<text x="6" y="16" font-size="14" font-weight="bold">T</text>',
                "svg_template": '<text x="0" y="0" font-size="{fontSize}" fill="{color}" font-family="serif">{text}</text>',
                "default_props": {"color": "#1a1a2e", "fontSize": 16, "text": "Текст"},
                "editable_props": ["color", "fontSize", "text"],
                "tags": "текст, надпись, подпись",
                "order": 1
            },
            {
                "category": "labels",
                "name": "Индекс величины",
                "description": "Обозначение физической величины с индексом (v₁, s₂)",
                "svg_icon": '<text x="4" y="14" font-size="14" font-style="italic">v<tspan baseline-shift="sub" font-size="10">1</tspan></text>',
                "svg_template": '<text x="0" y="0" font-size="{fontSize}" fill="{color}" font-family="serif" font-style="italic">{symbol}<tspan baseline-shift="sub" font-size="{fontSize*0.7}">{subscript}</tspan></text>',
                "default_props": {"color": "#1a1a2e", "fontSize": 18, "symbol": "v", "subscript": "1"},
                "editable_props": ["color", "fontSize", "symbol", "subscript"],
                "tags": "индекс, подстрочный, величина",
                "order": 2
            },
            {
                "category": "labels",
                "name": "Размерная линия",
                "description": "Линия с размером (расстояние, путь)",
                "svg_icon": '<line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1"/><line x1="4" y1="8" x2="4" y2="16" stroke="currentColor" stroke-width="1"/><line x1="20" y1="8" x2="20" y2="16" stroke="currentColor" stroke-width="1"/>',
                "svg_template": '<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="1"/><line x1="0" y1="-5" x2="0" y2="5" stroke="{color}" stroke-width="1"/><line x1="{length}" y1="-5" x2="{length}" y2="5" stroke="{color}" stroke-width="1"/><text x="{length/2}" y="-8" font-size="12" fill="{color}" text-anchor="middle">{label}</text>',
                "default_props": {"color": "#1a1a2e", "length": 80, "label": "s"},
                "editable_props": ["color", "length", "label"],
                "tags": "размер, расстояние, путь, s",
                "order": 3
            },
        ]

        for elem_data in elements_data:
            category = categories.get(elem_data["category"])
            SchemaElement.objects.get_or_create(
                name=elem_data["name"],
                defaults={
                    "category": category,
                    "description": elem_data["description"],
                    "svg_icon": elem_data["svg_icon"],
                    "svg_template": elem_data["svg_template"],
                    "default_props": elem_data["default_props"],
                    "editable_props": elem_data["editable_props"],
                    "tags": elem_data["tags"],
                    "order": elem_data["order"],
                    "is_system": True,
                }
            )
        self.stdout.write(f"  [OK] Schema elements: {len(elements_data)}")

        self.stdout.write(self.style.SUCCESS("\n=== Data loaded successfully! ==="))
        self.stdout.write(f"\nЭОР (учитель / ученик): http://127.0.0.1:8000/app/")
        self.stdout.write(f"Учитель (staff): admin / admin")
        self.stdout.write(f"Django /admin/ — только для суперпользователя (у admin он есть).")

