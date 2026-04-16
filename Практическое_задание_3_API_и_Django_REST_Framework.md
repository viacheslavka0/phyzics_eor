# Практическое задание 3: Создание REST API для ЭОР

**К лекции:** "API и Django REST Framework"

**Тип в Moodle:** Задание (с прикреплением файлов)

**Время выполнения:** 2–2.5 часа

**Максимальный балл:** 20 баллов

---

## Цель задания

Освоить создание REST API с использованием Django REST Framework, научиться создавать сериализаторы, ViewSets, настраивать маршрутизацию и добавлять кастомные действия.

---

## Задание

Создайте REST API для вашего ЭОР (можно использовать модели из задания 2 или создать новые упрощённые модели). API должен предоставлять эндпоинты для работы с учебным контентом.

### Предварительные требования

**Вариант А:** Используйте модели из задания 2 (если оно выполнено).

**Вариант Б:** Создайте упрощённые модели для этого задания (минимум 2 связанные модели).

---

## Требования к API

### 1. Установка и настройка DRF

**Шаг 1:** Установите Django REST Framework:
```bash
pip install djangorestframework
```

**Шаг 2:** Добавьте в `settings.py`:
```python
INSTALLED_APPS = [
    ...
    'rest_framework',
    'learning',  # ваше приложение
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

**Шаг 3:** Создайте файлы:
- `learning/serializers.py` (если ещё нет)
- `learning/views.py` (если ещё нет)
- `learning/urls.py` (если ещё нет)

---

### 2. Сериализаторы (Serializers)

Создайте минимум **3 сериализатора**:

#### 2.1. Базовый сериализатор (ModelSerializer)

Создайте сериализатор для одной из ваших моделей:

```python
# serializers.py
from rest_framework import serializers
from .models import Course, Module, Lesson, Question

class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ("id", "title", "description", "created_at")
```

**Требования:**
- Используйте `ModelSerializer`
- Включите минимум 4 поля (включая `id`)
- Добавьте docstring к классу

#### 2.2. Сериализатор с вложенными объектами

Создайте сериализатор, который включает связанные объекты:

```python
class ModuleSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)  # Вложенный объект
    
    class Meta:
        model = Module
        fields = ("id", "title", "order", "course")
```

**Требования:**
- Используйте вложенный сериализатор (минимум 1 связь)
- Добавьте `read_only=True` для вложенного объекта

#### 2.3. Сериализатор с SerializerMethodField

Создайте сериализатор с вычисляемым полем:

```python
class CourseSerializer(serializers.ModelSerializer):
    modules_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = ("id", "title", "description", "modules_count")
    
    def get_modules_count(self, obj):
        """Количество модулей в курсе"""
        return obj.modules.count()
```

**Требования:**
- Добавьте минимум 1 `SerializerMethodField`
- Реализуйте метод `get_<field_name>()`
- Добавьте docstring к методу

#### 2.4. Разные сериализаторы для списка и деталей (опционально, +2 балла)

Создайте два сериализатора для одной модели:
- **Brief** — для списка (минимум полей)
- **Detail** — для деталей (все поля + связанные объекты)

```python
class CourseBriefSerializer(serializers.ModelSerializer):
    """Краткая информация о курсе (для списка)"""
    class Meta:
        model = Course
        fields = ("id", "title")

class CourseDetailSerializer(serializers.ModelSerializer):
    """Полная информация о курсе (для деталей)"""
    modules = ModuleSerializer(many=True, read_only=True)
    modules_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = ("id", "title", "description", "modules", "modules_count", "created_at")
    
    def get_modules_count(self, obj):
        return obj.modules.count()
```

---

### 3. ViewSets

Создайте минимум **2 ViewSet'а**:

#### 3.1. ModelViewSet (полный CRUD)

Создайте ViewSet с полным набором действий:

```python
# views.py
from rest_framework import viewsets, permissions
from .models import Course
from .serializers import CourseSerializer

class CourseViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с курсами"""
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
```

**Требования:**
- Используйте `ModelViewSet`
- Настройте `queryset` и `serializer_class`
- Добавьте `permission_classes`
- Добавьте docstring

**Автоматически создаются эндпоинты:**
- `GET /api/courses/` — список
- `POST /api/courses/` — создать
- `GET /api/courses/1/` — детали
- `PUT /api/courses/1/` — обновить
- `PATCH /api/courses/1/` — частично обновить
- `DELETE /api/courses/1/` — удалить

#### 3.2. ReadOnlyModelViewSet или GenericViewSet

Создайте ViewSet только для чтения или с ограниченными действиями:

```python
class ModuleViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet для чтения модулей"""
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAuthenticated]
```

**Или с миксинами:**
```python
from rest_framework import mixins, viewsets

class LessonViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    """ViewSet для списка и деталей уроков"""
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]
```

**Требования:**
- Используйте `ReadOnlyModelViewSet` или `GenericViewSet` с миксинами
- Настройте queryset с оптимизацией (если есть связи)

#### 3.3. Оптимизация запросов (обязательно)

Используйте `select_related()` и `prefetch_related()` для оптимизации:

```python
class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.select_related("author").prefetch_related(
        "modules__lessons"
    )
    serializer_class = CourseDetailSerializer
```

**Требования:**
- Используйте минимум 1 `select_related()` или `prefetch_related()`
- Обоснуйте выбор в комментарии

---

### 4. Маршрутизация (Routers)

Настройте маршрутизацию с помощью Router:

#### 4.1. Создание Router

```python
# learning/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CourseViewSet, ModuleViewSet

router = DefaultRouter()
router.register(r"courses", CourseViewSet, basename="courses")
router.register(r"modules", ModuleViewSet, basename="modules")

urlpatterns = [
    path("", include(router.urls)),
]
```

#### 4.2. Подключение в главный urls.py

```python
# my_eor/urls.py
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("learning.urls")),  # Подключение API
]
```

**Требования:**
- Используйте `DefaultRouter`
- Зарегистрируйте минимум 2 ViewSet'а
- Подключите в главный `urls.py`

---

### 5. Кастомные действия (@action)

Создайте минимум **2 кастомных действия**:

#### 5.1. Действие для конкретного объекта (detail=True)

```python
from rest_framework.decorators import action
from rest_framework.response import Response

class CourseViewSet(viewsets.ModelViewSet):
    ...
    
    @action(detail=True, methods=["get"])
    def modules(self, request, pk=None):
        """Получить список модулей курса"""
        course = self.get_object()
        modules = course.modules.all()
        serializer = ModuleSerializer(modules, many=True)
        return Response(serializer.data)
```

**Создаётся эндпоинт:** `GET /api/courses/1/modules/`

#### 5.2. Действие с POST методом

```python
@action(detail=True, methods=["post"])
def check(self, request, pk=None):
    """Проверить ответы (пример для вопросов)"""
    question = self.get_object()
    student_answer = request.data.get("answer")
    
    # Логика проверки
    is_correct = question.check_answer(student_answer)
    
    return Response({
        "is_correct": is_correct,
        "message": "Правильно!" if is_correct else "Неправильно"
    })
```

**Требования:**
- Минимум 1 действие с `detail=True`
- Минимум 1 действие с `methods=["post"]`
- Добавьте docstring к каждому действию
- Используйте `self.get_object()` для получения объекта

#### 5.3. Действие для коллекции (detail=False) — опционально, +1 балл

```python
@action(detail=False, methods=["get"])
def stats(self, request):
    """Статистика по всем курсам"""
    total_courses = Course.objects.count()
    total_modules = Module.objects.count()
    
    return Response({
        "total_courses": total_courses,
        "total_modules": total_modules,
    })
```

**Создаётся эндпоинт:** `GET /api/courses/stats/`

---

### 6. Валидация данных

Добавьте валидацию в сериализатор:

```python
class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ("id", "title", "description")
    
    def validate_title(self, value):
        """Проверка названия"""
        if len(value) < 3:
            raise serializers.ValidationError("Название должно быть не менее 3 символов")
        return value
    
    def validate(self, data):
        """Проверка всех полей"""
        if data.get("title") and data.get("description"):
            if data["title"] == data["description"]:
                raise serializers.ValidationError({
                    "title": "Название и описание не должны совпадать"
                })
        return data
```

**Требования:**
- Добавьте минимум 1 метод `validate_<field>()`
- Добавьте метод `validate()` для проверки нескольких полей

---

### 7. Тестирование API

#### 7.1. Запуск сервера

```bash
python manage.py runserver
```

#### 7.2. Тестирование через браузер

Откройте в браузере:
- `http://127.0.0.1:8000/api/courses/` — список курсов
- `http://127.0.0.1:8000/api/courses/1/` — детали курса

#### 7.3. Тестирование через Postman или curl (опционально)

**GET запрос:**
```bash
curl http://127.0.0.1:8000/api/courses/
```

**POST запрос:**
```bash
curl -X POST http://127.0.0.1:8000/api/courses/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Новый курс", "description": "Описание"}'
```

---

## Что сдать

### 1. Архив проекта (обязательно)

Архив должен содержать:
- Весь код проекта
- Файлы `serializers.py`, `views.py`, `urls.py`
- Файл `requirements.txt` с зависимостями (минимум `Django` и `djangorestframework`)

**Исключите из архива:**
- `__pycache__/`
- `*.pyc`
- `db.sqlite3`
- `.venv/` или `venv/`

### 2. Скриншоты (обязательно)

**a) Скриншот списка объектов через API:**
- Откройте `http://127.0.0.1:8000/api/courses/` (или ваш эндпоинт)
- Должен быть виден JSON с данными

**b) Скриншот деталей объекта:**
- Откройте `http://127.0.0.1:8000/api/courses/1/` (или ваш эндпоинт)
- Должен быть виден JSON с полными данными

**c) Скриншот кастомного действия:**
- Откройте `http://127.0.0.1:8000/api/courses/1/modules/` (или ваш кастомный эндпоинт)
- Должен быть виден JSON ответ

**d) (Опционально) Скриншот POST запроса:**
- Создайте новый объект через API
- Покажите запрос и ответ

### 3. Описание API (обязательно)

Создайте текстовый файл `API_DESCRIPTION.txt` со следующим содержанием:

```
ОПИСАНИЕ API

БАЗОВЫЙ URL: http://127.0.0.1:8000/api/

ЭНДПОИНТЫ:

1. Курсы (Courses)
   - GET /api/courses/ — список всех курсов
   - POST /api/courses/ — создать новый курс
   - GET /api/courses/<id>/ — детали курса
   - PUT /api/courses/<id>/ — обновить курс
   - PATCH /api/courses/<id>/ — частично обновить курс
   - DELETE /api/courses/<id>/ — удалить курс
   - GET /api/courses/<id>/modules/ — список модулей курса (кастомное действие)

2. Модули (Modules)
   - GET /api/modules/ — список всех модулей
   - GET /api/modules/<id>/ — детали модуля
   ...

СЕРИАЛИЗАТОРЫ:

1. CourseSerializer
   - Поля: id, title, description, created_at
   - Вложенные объекты: нет
   - Вычисляемые поля: modules_count

2. ModuleSerializer
   - Поля: id, title, order, course
   - Вложенные объекты: course (CourseSerializer)
   ...

КАСТОМНЫЕ ДЕЙСТВИЯ:

1. CourseViewSet.modules
   - URL: GET /api/courses/<id>/modules/
   - Описание: Получить список модулей курса
   - Метод: GET
   - Параметры: нет

2. ...
```

### 4. Код (обязательно)

Приложите отдельно файлы:
- `learning/serializers.py`
- `learning/views.py`
- `learning/urls.py`

---

## Критерии оценивания

| Критерий | Баллы | Описание |
|----------|-------|----------|
| **Установка и настройка DRF** | 1 | DRF установлен и добавлен в INSTALLED_APPS, настройки REST_FRAMEWORK присутствуют |
| **Сериализаторы** | 4 | Создано минимум 3 сериализатора:<br>- Базовый ModelSerializer (1)<br>- С вложенными объектами (1)<br>- С SerializerMethodField (1)<br>- Разные для списка/деталей (опционально, +1) |
| **ViewSets** | 4 | Создано минимум 2 ViewSet'а:<br>- ModelViewSet (полный CRUD) (1.5)<br>- ReadOnlyModelViewSet или GenericViewSet (1)<br>- Оптимизация запросов (1.5) |
| **Маршрутизация** | 2 | Настроен Router:<br>- DefaultRouter создан (0.5)<br>- Зарегистрировано минимум 2 ViewSet'а (1)<br>- Подключено в главный urls.py (0.5) |
| **Кастомные действия** | 3 | Создано минимум 2 кастомных действия:<br>- Действие с detail=True (1)<br>- Действие с POST методом (1)<br>- Действие с detail=False (опционально, +1) |
| **Валидация** | 2 | Добавлена валидация в сериализатор:<br>- validate_<field>() метод (1)<br>- validate() метод (1) |
| **Тестирование** | 2 | API протестировано:<br>- Скриншоты списка и деталей (1)<br>- Скриншот кастомного действия (1) |
| **Описание API** | 2 | Файл API_DESCRIPTION.txt содержит:<br>- Список всех эндпоинтов (1)<br>- Описание сериализаторов и действий (1) |
| **Качество кода** | 1 | Код структурирован, есть комментарии и docstring, следует best practices |
| **ИТОГО** | **20** | |

---

## Пример минимального решения

Ниже приведён пример минимального решения для справки. **Не копируйте его полностью!** Используйте как ориентир и адаптируйте под свою предметную область.

### models.py

```python
from django.db import models

class Course(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Курс"
        verbose_name_plural = "Курсы"
    
    def __str__(self):
        return self.title

class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=1)
    
    class Meta:
        verbose_name = "Модуль"
        verbose_name_plural = "Модули"
        ordering = ["order"]
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"
```

### serializers.py

```python
from rest_framework import serializers
from .models import Course, Module

class CourseSerializer(serializers.ModelSerializer):
    """Сериализатор для курса"""
    modules_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = ("id", "title", "description", "modules_count", "created_at")
    
    def get_modules_count(self, obj):
        """Количество модулей в курсе"""
        return obj.modules.count()

class ModuleSerializer(serializers.ModelSerializer):
    """Сериализатор для модуля"""
    course = CourseSerializer(read_only=True)
    
    class Meta:
        model = Module
        fields = ("id", "title", "order", "course")
    
    def validate_title(self, value):
        """Проверка названия модуля"""
        if len(value) < 3:
            raise serializers.ValidationError("Название должно быть не менее 3 символов")
        return value
```

### views.py

```python
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Course, Module
from .serializers import CourseSerializer, ModuleSerializer

class CourseViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с курсами"""
    queryset = Course.objects.prefetch_related("modules").all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=True, methods=["get"])
    def modules(self, request, pk=None):
        """Получить список модулей курса"""
        course = self.get_object()
        modules = course.modules.all()
        serializer = ModuleSerializer(modules, many=True)
        return Response(serializer.data)

class ModuleViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet для чтения модулей"""
    queryset = Module.objects.select_related("course").all()
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAuthenticated]
```

### urls.py (learning/urls.py)

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CourseViewSet, ModuleViewSet

router = DefaultRouter()
router.register(r"courses", CourseViewSet, basename="courses")
router.register(r"modules", ModuleViewSet, basename="modules")

urlpatterns = [
    path("", include(router.urls)),
]
```

### urls.py (my_eor/urls.py)

```python
from django.urls import path, include
from django.contrib import admin

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("learning.urls")),
]
```

---

## Рекомендации

1. **Используйте модели из задания 2** — если оно выполнено, это сэкономит время
2. **Начните с простого** — сначала создайте базовые сериализаторы и ViewSets, потом добавляйте сложность
3. **Тестируйте по ходу** — после каждого шага проверяйте, что API работает
4. **Используйте браузер** — для GET запросов можно использовать браузер (нужна авторизация)
5. **Документируйте код** — добавляйте docstring к классам и методам

---

## Часто задаваемые вопросы

**Q: Как протестировать API без авторизации?**  
A: Временно измените `permission_classes` на `[permissions.AllowAny]` или создайте суперпользователя и авторизуйтесь в браузере.

**Q: Как создать суперпользователя?**  
A: Выполните команду `python manage.py createsuperuser` и следуйте инструкциям.

**Q: Почему не работают вложенные сериализаторы при создании?**  
A: Для создания используйте `write_only=True` и отдельное поле с ID (например, `course_id`).

**Q: Как добавить фильтрацию?**  
A: Используйте библиотеку `django-filter` или переопределите метод `get_queryset()` в ViewSet.

**Q: Что делать, если получаю ошибку 403 Forbidden?**  
A: Проверьте настройки `permission_classes` и убедитесь, что вы авторизованы.

---

## Дополнительные задания (опционально, не оцениваются)

1. **Добавьте пагинацию** — ограничьте количество объектов на странице
2. **Добавьте фильтрацию** — фильтруйте объекты по параметрам запроса
3. **Добавьте поиск** — реализуйте поиск по названию/описанию
4. **Создайте документацию API** — используйте `drf-yasg` или `drf-spectacular` для автоматической генерации документации

---

**Удачи в выполнении задания!** 🚀

Если возникнут вопросы, обращайтесь к лекционному материалу или задавайте вопросы в форуме курса.
