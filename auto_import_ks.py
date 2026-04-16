#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Автоматическая загрузка систем знаний в БД с определением классов и тем
"""

import os
import sys
import django
import json

# Настройка кодировки для Windows консоли
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Настройка Django
sys.path.append(os.path.join(os.path.dirname(__file__), 'eora'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eora.settings')
django.setup()

from learning.models import SchoolClass, SubjectSection, Topic, KnowledgeSystem

# Маппинг систем знаний на класс, раздел и тему
KS_MAPPING = {
    # 7 КЛАСС - Механические явления
    "Равномерное и неравномерное движение на участке траектории": {
        "class": 7,
        "section": "Механические явления",
        "topic": "Равномерное и неравномерное движение"
    },
    "Относительность движения": {
        "class": 7,
        "section": "Механические явления",
        "topic": "Относительность движения"
    },
    "Равноускоренное прямолинейное движение": {
        "class": 7,
        "section": "Механические явления",
        "topic": "Равноускоренное прямолинейное движение"
    },
    "Равномерное движение по окружности": {
        "class": 7,
        "section": "Механические явления",
        "topic": "Равномерное движение по окружности"
    },
    "Механическое движение разных видов": {
        "class": 7,
        "section": "Механические явления",
        "topic": "Механическое движение"
    },
    
    # 7 КЛАСС - Силы и движение
    "Равновесие и равномерное движение тела под действием сил тяжести, упругости, трения": {
        "class": 7,
        "section": "Силы и движение",
        "topic": "Равновесие и движение под действием сил"
    },
    "Равноускоренное движение тел под действием сил тяжести, упругости, трения": {
        "class": 7,
        "section": "Силы и движение",
        "topic": "Равноускоренное движение под действием сил"
    },
    "Движение тел под действием сил тяжести и упругости": {
        "class": 7,
        "section": "Силы и движение",
        "topic": "Движение под действием сил"
    },
    
    # 7 КЛАСС - Давление
    "Равновесие жидкости в сообщающихся сосудах": {
        "class": 7,
        "section": "Давление",
        "topic": "Давление в жидкостях и газах"
    },
    "Равновесие тел в жидкостях и газах": {
        "class": 7,
        "section": "Давление",
        "topic": "Давление в жидкостях и газах"
    },
    
    # 7 КЛАСС - Работа и энергия
    "Простые механизмы": {
        "class": 7,
        "section": "Работа и энергия",
        "topic": "Простые механизмы"
    },
    
    # 7 КЛАСС - Звуковые явления
    "Звуковые явления": {
        "class": 7,
        "section": "Звуковые явления",
        "topic": "Звуковые явления"
    },
    
    # 7 КЛАСС - Свойства вещества
    "Основные свойства вещественных объектов": {
        "class": 7,
        "section": "Свойства вещества",
        "topic": "Свойства вещества"
    },
    
    # 8 КЛАСС - Тепловые явления
    "Виды теплопередачи": {
        "class": 8,
        "section": "Тепловые явления",
        "topic": "Теплопередача"
    },
    "Нагревание или охлаждение тел при теплопередаче": {
        "class": 8,
        "section": "Тепловые явления",
        "topic": "Теплопередача"
    },
    "Нагревание и охлаждение тел при теплопередаче в теплоизолированной оболочке": {
        "class": 8,
        "section": "Тепловые явления",
        "topic": "Теплопередача"
    },
    "Нагревание тел при сгорании топлива или совершении механической работы": {
        "class": 8,
        "section": "Тепловые явления",
        "topic": "Теплопередача"
    },
    "Нагревание (охлаждение), изменение агрегатного состояния вещества  при теплопередаче": {
        "class": 8,
        "section": "Тепловые явления",
        "topic": "Изменение агрегатного состояния вещества"
    },
    "Нагревание (охлаждение), изменение агрегатного состояния вещества при теплопередаче в теплоизолированной оболочке": {
        "class": 8,
        "section": "Тепловые явления",
        "topic": "Изменение агрегатного состояния вещества"
    },
    
    # 9 КЛАСС - Механика (продвинутые темы)
    "Движение тел, образующих замкнутую систему": {
        "class": 9,
        "section": "Механика",
        "topic": "Законы сохранения"
    },
    "Разгон и торможение по горизонтали": {
        "class": 9,
        "section": "Механика",
        "topic": "Движение под действием сил"
    },
}

def auto_import_ks():
    """Автоматически загружает системы знаний в БД"""
    
    # Читаем JSON
    with open('knowledge_systems.json', 'r', encoding='utf-8') as f:
        knowledge_systems = json.load(f)
    
    print("=" * 80)
    print("АВТОМАТИЧЕСКАЯ ЗАГРУЗКА СИСТЕМ ЗНАНИЙ В БД")
    print("=" * 80)
    print(f"\nНайдено систем знаний: {len(knowledge_systems)}\n")
    
    created_count = 0
    skipped_count = 0
    error_count = 0
    
    for i, ks_data in enumerate(knowledge_systems, 1):
        title = ks_data['title']
        print(f"\n[{i}/{len(knowledge_systems)}] {title}")
        
        # Ищем маппинг
        if title not in KS_MAPPING:
            print(f"[!] Нет маппинга для: {title}")
            print("   Пропущено (добавьте вручную)")
            skipped_count += 1
            continue
        
        mapping = KS_MAPPING[title]
        class_number = mapping['class']
        section_title = mapping['section']
        topic_title = mapping['topic']
        
        try:
            # Получаем или создаём класс
            school_class, _ = SchoolClass.objects.get_or_create(
                number=class_number,
                defaults={'title': f"{class_number} класс"}
            )
            
            # Получаем или создаём раздел
            max_section_order = SubjectSection.objects.filter(
                school_class=school_class
            ).count()
            section, _ = SubjectSection.objects.get_or_create(
                school_class=school_class,
                title=section_title,
                defaults={'order': max_section_order + 1}
            )
            
            # Получаем или создаём тему
            max_topic_order = Topic.objects.filter(section=section).count()
            topic, _ = Topic.objects.get_or_create(
                section=section,
                title=topic_title,
                defaults={'order': max_topic_order + 1}
            )
            
            # Создаём систему знаний
            ks, created = KnowledgeSystem.objects.get_or_create(
                topic=topic,
                title=title,
                defaults={
                    'status': 'draft',
                    'comprehension_pass_threshold': 85
                }
            )
            
            if created:
                created_count += 1
                print(f"[OK] Создана: {title}")
                print(f"  Класс: {class_number}, Раздел: {section_title}, Тема: {topic_title}")
            else:
                print(f"[!] Уже существует: {title}")
                
        except Exception as e:
            error_count += 1
            print(f"[ERROR] Ошибка: {e}")
    
    print("\n" + "=" * 80)
    print(f"\nГОТОВО!")
    print(f"Создано: {created_count}")
    print(f"Пропущено (нет маппинга): {skipped_count}")
    print(f"Ошибок: {error_count}")
    print("=" * 80)
    
    if skipped_count > 0:
        print("\n[!] Системы знаний без маппинга (нужно добавить вручную):")
        for ks_data in knowledge_systems:
            if ks_data['title'] not in KS_MAPPING:
                print(f"  - {ks_data['title']}")

if __name__ == "__main__":
    try:
        auto_import_ks()
    except KeyboardInterrupt:
        print("\n\nПрервано пользователем")
    except Exception as e:
        print(f"\nОшибка: {e}")
        import traceback
        traceback.print_exc()
