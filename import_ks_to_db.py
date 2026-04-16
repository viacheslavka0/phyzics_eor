#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Скрипт для загрузки систем знаний в БД
Требует ручного указания класса для каждой темы
"""

import os
import sys
import django
import json

# Настройка Django
sys.path.append(os.path.join(os.path.dirname(__file__), 'eora'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eora.settings')
django.setup()

from learning.models import SchoolClass, SubjectSection, Topic, KnowledgeSystem

def load_knowledge_systems():
    """Загружает системы знаний из JSON в БД"""
    
    # Читаем JSON
    with open('knowledge_systems.json', 'r', encoding='utf-8') as f:
        knowledge_systems = json.load(f)
    
    print("=" * 80)
    print("ЗАГРУЗКА СИСТЕМ ЗНАНИЙ В БД")
    print("=" * 80)
    print(f"\nНайдено систем знаний: {len(knowledge_systems)}\n")
    
    # Показываем список классов
    classes = SchoolClass.objects.all().order_by('number')
    print("Доступные классы:")
    for cls in classes:
        print(f"  {cls.id}. {cls.title} (номер: {cls.number})")
    
    print("\n" + "=" * 80)
    print("ИНСТРУКЦИЯ:")
    print("1. Для каждой системы знаний нужно указать:")
    print("   - ID класса (7, 8 или 9)")
    print("   - Название раздела")
    print("   - Название темы")
    print("2. Если раздела/темы нет, они будут созданы автоматически")
    print("3. Для пропуска введите 'skip'")
    print("=" * 80 + "\n")
    
    created_count = 0
    skipped_count = 0
    
    for i, ks_data in enumerate(knowledge_systems, 1):
        title = ks_data['title']
        print(f"\n[{i}/{len(knowledge_systems)}] {title}")
        print(f"Источник: {ks_data['source_text']}")
        
        # Запрашиваем класс
        class_input = input("ID класса (7/8/9) или 'skip': ").strip()
        if class_input.lower() == 'skip':
            skipped_count += 1
            print("Пропущено\n")
            continue
        
        try:
            class_number = int(class_input)
            school_class = SchoolClass.objects.get(number=class_number)
        except (ValueError, SchoolClass.DoesNotExist):
            print(f"Ошибка: класс {class_input} не найден. Пропущено.\n")
            skipped_count += 1
            continue
        
        # Запрашиваем раздел
        section_title = input("Название раздела: ").strip()
        if not section_title:
            print("Раздел не указан. Пропущено.\n")
            skipped_count += 1
            continue
        
        section, _ = SubjectSection.objects.get_or_create(
            school_class=school_class,
            title=section_title,
            defaults={'order': 1}
        )
        
        # Запрашиваем тему
        topic_title = input("Название темы: ").strip()
        if not topic_title:
            print("Тема не указана. Пропущено.\n")
            skipped_count += 1
            continue
        
        # Определяем порядок темы
        max_order = Topic.objects.filter(section=section).count()
        topic, _ = Topic.objects.get_or_create(
            section=section,
            title=topic_title,
            defaults={'order': max_order + 1}
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
            print(f"✓ Создана система знаний: {title}")
        else:
            print(f"⚠ Система знаний уже существует: {title}")
        
        print()
    
    print("=" * 80)
    print(f"\nГОТОВО!")
    print(f"Создано: {created_count}")
    print(f"Пропущено: {skipped_count}")
    print("=" * 80)

if __name__ == "__main__":
    try:
        load_knowledge_systems()
    except KeyboardInterrupt:
        print("\n\nПрервано пользователем")
    except Exception as e:
        print(f"\nОшибка: {e}")
        import traceback
        traceback.print_exc()
