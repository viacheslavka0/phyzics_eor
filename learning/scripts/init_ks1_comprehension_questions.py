from learning.models import KnowledgeSystem, KSZone, KSQuestion


def main():
    """
    Скрипт инициализации вопросов для осмысления СК #1.
    Перезаписывает метки зон и создаёт 6 вопросов типа 'match'
    с правильными зонами A–Е.
    """
    ks = KnowledgeSystem.objects.get(id=1)

    # Обновляем метки зон (по ID, которые уже созданы для этой таблицы)
    mapping = {
        73: "А",  # Физическая модель равномерного движения
        74: "Б",  # График s(t) для равномерного движения
        75: "В",  # График v(t) для равномерного движения
        77: "Г",  # Физическая модель неравномерного движения
        78: "Д",  # График средней скорости
        76: "Е",  # Закон неравномерного движения со средней скоростью
    }

    zones = {}
    for zid, label in mapping.items():
        z = KSZone.objects.get(id=zid, ks=ks)
        z.label = label
        z.save()
        zones[label] = z

    # Удаляем старые вопросы этой СК
    KSQuestion.objects.filter(ks=ks).delete()

    order = 1

    # 1. Физическая модель равномерного движения (А)
    q1 = KSQuestion.objects.create(
        ks=ks,
        type="match",
        order=order,
        text="Выдели на таблице физическую модель равномерного движения.",
    )
    q1.correct_zones.set([zones["А"]])
    q1.zones.set([zones["А"]])
    order += 1

    # 2. График s(t) для равномерного движения (Б)
    q2 = KSQuestion.objects.create(
        ks=ks,
        type="match",
        order=order,
        text="Выдели на таблице график зависимости пути от времени для равномерного движения.",
    )
    q2.correct_zones.set([zones["Б"]])
    q2.zones.set([zones["Б"]])
    order += 1

    # 3. График v(t) для равномерного движения (В)
    q3 = KSQuestion.objects.create(
        ks=ks,
        type="match",
        order=order,
        text="Выдели на таблице график зависимости скорости от времени для равномерного движения.",
    )
    q3.correct_zones.set([zones["В"]])
    q3.zones.set([zones["В"]])
    order += 1

    # 4. Физическая модель неравномерного движения (Г)
    q4 = KSQuestion.objects.create(
        ks=ks,
        type="match",
        order=order,
        text="Выдели на таблице физическую модель неравномерного движения.",
    )
    q4.correct_zones.set([zones["Г"]])
    q4.zones.set([zones["Г"]])
    order += 1

    # 5. График средней скорости (Д)
    q5 = KSQuestion.objects.create(
        ks=ks,
        type="match",
        order=order,
        text="Выдели на таблице график средней скорости.",
    )
    q5.correct_zones.set([zones["Д"]])
    q5.zones.set([zones["Д"]])
    order += 1

    # 6. Закон неравномерного движения со средней скоростью (Е)
    q6 = KSQuestion.objects.create(
        ks=ks,
        type="match",
        order=order,
        text="Выдели на таблице закон неравномерного движения со средней скоростью.",
    )
    q6.correct_zones.set([zones["Е"]])
    q6.zones.set([zones["Е"]])

    print("OK: zones and questions for KS #1 initialized")


if __name__ == "__main__":
    main()

