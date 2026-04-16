# Лекция 3: API и Django REST Framework

**Цель лекции:** Освоить создание REST API для ЭОР с использованием Django REST Framework, научиться создавать сериализаторы, представления (ViewSets) и настраивать маршрутизацию.

**Продолжительность:** 90 минут

---

## План лекции

1. **Введение: что такое API и зачем он нужен** (5 мин)
2. **Основы Django REST Framework** (10 мин)
3. **Сериализаторы (Serializers)** (20 мин)
4. **Представления (ViewSets)** (25 мин)
5. **Маршрутизация (Routers)** (10 мин)
6. **Кастомные действия (@action)** (10 мин)
7. **Аутентификация и права доступа** (5 мин)
8. **Обработка ошибок и валидация** (5 мин)

---

## 1. Введение: что такое API и зачем он нужен

### 1.1. Проблема без API

В традиционных веб-приложениях сервер генерирует HTML-страницы:

```
Браузер → Запрос → Сервер → HTML-страница → Браузер
```

**Проблемы:**
- ❌ Нельзя использовать данные в мобильном приложении
- ❌ Нельзя использовать данные в другом веб-приложении
- ❌ Сложно разделить frontend и backend
- ❌ Нет единого формата обмена данными

### 1.2. Решение: REST API

**API (Application Programming Interface)** — интерфейс для взаимодействия между приложениями.

**REST (Representational State Transfer)** — архитектурный стиль для создания веб-сервисов.

**Как это работает:**
```
Frontend (React) → HTTP запрос → Backend (Django) → JSON ответ → Frontend
```

**Преимущества:**
- ✅ Единый формат данных (JSON)
- ✅ Можно использовать в любом клиенте (веб, мобильное приложение, другой сервер)
- ✅ Разделение frontend и backend
- ✅ Легко тестировать и документировать

### 1.3. HTTP методы

REST API использует стандартные HTTP методы:

| Метод | Назначение | Пример |
|-------|------------|--------|
| `GET` | Получить данные | `GET /api/ks/1/` — получить систему знаний |
| `POST` | Создать новый объект | `POST /api/tasks/` — создать задачу |
| `PUT` | Полностью обновить объект | `PUT /api/tasks/1/` — обновить задачу |
| `PATCH` | Частично обновить объект | `PATCH /api/tasks/1/` — обновить только название |
| `DELETE` | Удалить объект | `DELETE /api/tasks/1/` — удалить задачу |

### 1.4. Формат данных: JSON

**JSON (JavaScript Object Notation)** — текстовый формат для обмена данными.

**Пример:**
```json
{
  "id": 1,
  "title": "Равномерное движение",
  "description": "Движение с постоянной скоростью",
  "status": "published",
  "tasks": [
    {"id": 1, "title": "Задача 1"},
    {"id": 2, "title": "Задача 2"}
  ]
}
```

---

## 2. Основы Django REST Framework

### 2.1. Установка

**Установка через pip:**
```bash
pip install djangorestframework
```

**Добавление в settings.py:**
```python
INSTALLED_APPS = [
    ...
    'rest_framework',
    'learning',  # ваше приложение
]
```

### 2.2. Основные компоненты DRF

**1. Serializers (Сериализаторы)** — преобразуют модели Django в JSON и обратно
**2. ViewSets (Представления)** — обрабатывают HTTP запросы
**3. Routers (Маршрутизаторы)** — автоматически создают URL-маршруты
**4. Permissions (Права доступа)** — контроль доступа к API

### 2.3. Структура проекта

```
learning/
├── models.py      ← модели данных (из лекции 2)
├── serializers.py ← сериализаторы (новое!)
├── views.py       ← ViewSets (новое!)
└── urls.py        ← маршрутизация (новое!)
```

---

## 3. Сериализаторы (Serializers)

### 3.1. Что такое сериализатор?

**Сериализация** — преобразование объекта Python (модель Django) в JSON.

**Десериализация** — преобразование JSON в объект Python.

**Сериализатор** — класс, который делает это преобразование.

### 3.2. Базовый сериализатор

**Пример модели:**
```python
# models.py
class KnowledgeSystem(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
```

**Сериализатор:**
```python
# serializers.py
from rest_framework import serializers
from .models import KnowledgeSystem

class KnowledgeSystemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeSystem
        fields = ("id", "title", "description", "status", "created_at")
```

**Использование:**
```python
# Преобразование модели в JSON
system = KnowledgeSystem.objects.get(id=1)
serializer = KnowledgeSystemSerializer(system)
json_data = serializer.data
# {"id": 1, "title": "Равномерное движение", ...}

# Преобразование JSON в модель
data = {"title": "Новая система", "description": "Описание"}
serializer = KnowledgeSystemSerializer(data=data)
if serializer.is_valid():
    system = serializer.save()  # Создаёт объект в БД
```

### 3.3. Типы сериализаторов

**ModelSerializer** — автоматически создаёт поля на основе модели:
```python
class KnowledgeSystemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeSystem
        fields = "__all__"  # Все поля модели
        # или
        fields = ("id", "title", "description")  # Только указанные поля
        # или
        exclude = ("created_at",)  # Все поля кроме указанных
```

**Serializer** — ручное определение полей (для сложных случаев):
```python
class CustomSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False)
    
    def create(self, validated_data):
        # Логика создания объекта
        return KnowledgeSystem.objects.create(**validated_data)
    
    def update(self, instance, validated_data):
        # Логика обновления объекта
        instance.title = validated_data.get("title", instance.title)
        instance.save()
        return instance
```

### 3.4. Вложенные сериализаторы

Когда нужно включить связанные объекты:

**Пример:**
```python
# Модели
class Topic(models.Model):
    title = models.CharField(max_length=255)

class KnowledgeSystem(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
```

**Сериализаторы:**
```python
class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ("id", "title")

class KnowledgeSystemSerializer(serializers.ModelSerializer):
    topic = TopicSerializer(read_only=True)  # Вложенный объект
    
    class Meta:
        model = KnowledgeSystem
        fields = ("id", "title", "topic")
```

**Результат:**
```json
{
  "id": 1,
  "title": "Равномерное движение",
  "topic": {
    "id": 1,
    "title": "Механика"
  }
}
```

**Важно:** `read_only=True` означает, что поле нельзя изменить через API. Для создания/обновления нужно использовать `topic_id`:

```python
class KnowledgeSystemSerializer(serializers.ModelSerializer):
    topic = TopicSerializer(read_only=True)
    topic_id = serializers.IntegerField(write_only=True)  # Для создания
    
    class Meta:
        model = KnowledgeSystem
        fields = ("id", "title", "topic", "topic_id")
```

### 3.5. SerializerMethodField — вычисляемые поля

Когда нужно добавить поле, которого нет в модели:

```python
class KnowledgeSystemSerializer(serializers.ModelSerializer):
    tasks_count = serializers.SerializerMethodField()
    
    class Meta:
        model = KnowledgeSystem
        fields = ("id", "title", "tasks_count")
    
    def get_tasks_count(self, obj):
        """Вычислить количество задач"""
        return obj.tasks.count()
```

**Результат:**
```json
{
  "id": 1,
  "title": "Равномерное движение",
  "tasks_count": 5
}
```

### 3.6. Работа с изображениями и файлами

Для получения полного URL изображения:

```python
class KnowledgeSystemSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = KnowledgeSystem
        fields = ("id", "title", "image", "image_url")
    
    def get_image_url(self, obj):
        """Получить полный URL изображения"""
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else ""
```

**Важно:** Нужно передать `request` в контекст сериализатора:
```python
serializer = KnowledgeSystemSerializer(system, context={"request": request})
```

### 3.7. Работа с JSONField

Если в модели есть `JSONField`, он автоматически сериализуется:

```python
# Модель
class KSQuestion(models.Model):
    text = models.TextField()
    options = models.JSONField(default=list)

# Сериализатор
class KSQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = KSQuestion
        fields = ("id", "text", "options")
```

**Результат:**
```json
{
  "id": 1,
  "text": "Что такое равномерное движение?",
  "options": [
    {"text": "Движение с постоянной скоростью", "is_correct": true},
    {"text": "Движение с ускорением", "is_correct": false}
  ]
}
```

### 3.8. Валидация данных

**Автоматическая валидация:**
```python
class KnowledgeSystemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeSystem
        fields = ("title", "description")
    
    def validate_title(self, value):
        """Проверка названия"""
        if len(value) < 3:
            raise serializers.ValidationError("Название должно быть не менее 3 символов")
        return value
```

**Использование:**
```python
data = {"title": "АБ"}  # Слишком короткое
serializer = KnowledgeSystemSerializer(data=data)
if serializer.is_valid():
    serializer.save()
else:
    print(serializer.errors)  # {"title": ["Название должно быть не менее 3 символов"]}
```

### 3.9. Разные сериализаторы для разных случаев

Часто нужны разные сериализаторы для списка и деталей:

```python
# Краткая информация (для списка)
class KnowledgeSystemBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeSystem
        fields = ("id", "title", "status")

# Полная информация (для деталей)
class KnowledgeSystemDetailSerializer(serializers.ModelSerializer):
    zones = KSZoneSerializer(many=True, read_only=True)
    questions = KSQuestionSerializer(many=True, read_only=True)
    tasks = TaskBriefSerializer(many=True, read_only=True)
    
    class Meta:
        model = KnowledgeSystem
        fields = (
            "id", "title", "description", "status",
            "zones", "questions", "tasks"
        )
```

---

## 4. Представления (ViewSets)

### 4.1. Что такое ViewSet?

**ViewSet** — класс, который объединяет логику для обработки разных HTTP методов.

**Вместо:**
```python
# Старый способ (функции)
def get_knowledge_system(request, id):
    ...
def create_knowledge_system(request):
    ...
def update_knowledge_system(request, id):
    ...
```

**Используем:**
```python
# Новый способ (ViewSet)
class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeSystem.objects.all()
    serializer_class = KnowledgeSystemSerializer
```

### 4.2. Типы ViewSets

**ModelViewSet** — полный CRUD (Create, Read, Update, Delete):
```python
from rest_framework import viewsets

class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeSystem.objects.all()
    serializer_class = KnowledgeSystemSerializer
    permission_classes = [permissions.IsAuthenticated]
```

**Автоматически создаёт:**
- `GET /api/ks/` — список всех систем знаний
- `POST /api/ks/` — создать новую систему знаний
- `GET /api/ks/1/` — получить систему знаний по ID
- `PUT /api/ks/1/` — полностью обновить
- `PATCH /api/ks/1/` — частично обновить
- `DELETE /api/ks/1/` — удалить

**ReadOnlyModelViewSet** — только чтение:
```python
class KnowledgeSystemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = KnowledgeSystem.objects.all()
    serializer_class = KnowledgeSystemSerializer
```

**Автоматически создаёт:**
- `GET /api/ks/` — список
- `GET /api/ks/1/` — детали

**GenericViewSet + Mixins** — гибкая настройка:
```python
from rest_framework import mixins, viewsets

class KnowledgeSystemViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    queryset = KnowledgeSystem.objects.all()
    serializer_class = KnowledgeSystemSerializer
```

**Создаёт только:**
- `GET /api/ks/` — список
- `GET /api/ks/1/` — детали

### 4.3. Настройка queryset

**Базовый queryset:**
```python
class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeSystem.objects.all()
    serializer_class = KnowledgeSystemSerializer
```

**С фильтрацией:**
```python
class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeSystem.objects.filter(status="published")
    serializer_class = KnowledgeSystemSerializer
```

**С оптимизацией запросов:**
```python
class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeSystem.objects.select_related("topic").prefetch_related(
        "zones", "questions", "tasks"
    )
    serializer_class = KnowledgeSystemDetailSerializer
```

### 4.4. Разные сериализаторы для разных действий

```python
class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeSystem.objects.all()
    
    def get_serializer_class(self):
        """Выбрать сериализатор в зависимости от действия"""
        if self.action == "list":
            return KnowledgeSystemBriefSerializer
        elif self.action == "retrieve":
            return KnowledgeSystemDetailSerializer
        return KnowledgeSystemSerializer
```

### 4.5. Переопределение действий

**Переопределение create:**
```python
class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    
    def create(self, request, *args, **kwargs):
        """Создание задачи с дополнительной логикой"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Дополнительная логика
        task = serializer.save()
        task.order = Task.objects.filter(ks=task.ks).count() + 1
        task.save()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
```

**Переопределение retrieve:**
```python
def retrieve(self, request, *args, **kwargs):
    """Получение деталей с дополнительными данными"""
    instance = self.get_object()
    serializer = self.get_serializer(instance)
    
    # Добавить дополнительные данные
    data = serializer.data
    data["attempts_count"] = instance.attempts.count()
    
    return Response(data)
```

---

## 5. Маршрутизация (Routers)

### 5.1. Что такое Router?

**Router** — автоматически создаёт URL-маршруты для ViewSet.

**Без Router (вручную):**
```python
# urls.py
from django.urls import path
from .views import KnowledgeSystemViewSet

urlpatterns = [
    path("ks/", KnowledgeSystemViewSet.as_view({"get": "list", "post": "create"})),
    path("ks/<int:pk>/", KnowledgeSystemViewSet.as_view({
        "get": "retrieve",
        "put": "update",
        "patch": "partial_update",
        "delete": "destroy"
    })),
]
```

**С Router (автоматически):**
```python
# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KnowledgeSystemViewSet

router = DefaultRouter()
router.register(r"ks", KnowledgeSystemViewSet, basename="ks")

urlpatterns = [
    path("", include(router.urls)),
]
```

**Автоматически создаются маршруты:**
- `GET /api/ks/` — список
- `POST /api/ks/` — создать
- `GET /api/ks/1/` — детали
- `PUT /api/ks/1/` — обновить
- `PATCH /api/ks/1/` — частично обновить
- `DELETE /api/ks/1/` — удалить

### 5.2. Регистрация нескольких ViewSets

```python
from rest_framework.routers import DefaultRouter
from .views import (
    KnowledgeSystemViewSet,
    TaskViewSet,
    TopicViewSet
)

router = DefaultRouter()
router.register(r"ks", KnowledgeSystemViewSet, basename="ks")
router.register(r"tasks", TaskViewSet, basename="tasks")
router.register(r"topics", TopicViewSet, basename="topics")

urlpatterns = [
    path("api/", include(router.urls)),
]
```

**Создаются маршруты:**
- `/api/ks/`, `/api/ks/1/`
- `/api/tasks/`, `/api/tasks/1/`
- `/api/topics/`, `/api/topics/1/`

### 5.3. Подключение в главный urls.py

```python
# eora/urls.py
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("learning.urls")),  # Подключение API
]
```

---

## 6. Кастомные действия (@action)

### 6.1. Что такое кастомное действие?

Иногда нужны дополнительные эндпоинты, не входящие в стандартный CRUD.

**Пример:** Проверка ответов ученика

```python
from rest_framework.decorators import action
from rest_framework.response import Response

class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeSystem.objects.all()
    serializer_class = KnowledgeSystemSerializer
    
    @action(detail=True, methods=["post"])
    def check(self, request, pk=None):
        """Проверка ответов ученика"""
        ks = self.get_object()
        data = request.data
        
        # Логика проверки
        score = calculate_score(ks, data)
        
        return Response({
            "score": score,
            "passed": score >= 80
        })
```

**Создаётся маршрут:**
- `POST /api/ks/1/check/` — проверить ответы

### 6.2. Параметры декоратора @action

**detail=True/False:**
- `detail=True` — действие для конкретного объекта: `/api/ks/1/check/`
- `detail=False` — действие для коллекции: `/api/ks/check_all/`

**methods:**
```python
@action(detail=True, methods=["get", "post"])
def check(self, request, pk=None):
    ...
```

**url_path:**
```python
@action(detail=True, methods=["post"], url_path="verify-answers")
def check(self, request, pk=None):
    ...
```
Создаётся маршрут: `POST /api/ks/1/verify-answers/` (вместо `check`)

### 6.3. Примеры кастомных действий

**Получить список задач системы знаний:**
```python
@action(detail=True, methods=["get"])
def tasks(self, request, pk=None):
    """Получить список задач системы знаний"""
    ks = self.get_object()
    tasks = ks.tasks.all()
    serializer = TaskBriefSerializer(tasks, many=True)
    return Response(serializer.data)
```

**Создать несколько объектов:**
```python
@action(detail=False, methods=["post"])
def bulk_create(self, request):
    """Создать несколько систем знаний"""
    serializer = self.get_serializer(data=request.data, many=True)
    serializer.is_valid(raise_exception=True)
    self.perform_create(serializer)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
```

**Статистика:**
```python
@action(detail=True, methods=["get"])
def stats(self, request, pk=None):
    """Статистика по системе знаний"""
    ks = self.get_object()
    return Response({
        "tasks_count": ks.tasks.count(),
        "questions_count": ks.questions.count(),
        "zones_count": ks.zones.count(),
    })
```

### 6.4. Полный пример из реального проекта

```python
class KnowledgeSystemViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = KnowledgeSystem.objects.all()
    serializer_class = KnowledgeSystemDetailSerializer
    
    @action(detail=True, methods=["post"])
    def check(self, request, pk=None):
        """Проверка ответов этапа 'Осмысление СК'"""
        ks = self.get_object()
        data = request.data or {}
        mappings = data.get("mappings", [])
        cloze_answers = data.get("cloze_answers", [])
        
        # Проверка соответствий
        q_map_correct = {}
        for q in KSQuestion.objects.filter(ks=ks):
            correct_ids = set(q.correct_zones.values_list("id", flat=True))
            chosen_ids = set()
            for item in mappings:
                if item.get("question_id") == q.id:
                    chosen_ids = set(item.get("selected_zone_ids", []))
                    break
            q_map_correct[q.id] = (chosen_ids == correct_ids)
        
        # Проверка cloze
        cloze_correct = {}
        for cl in KSCloze.objects.filter(ks=ks):
            for blank in cl.blanks:
                position = blank.get("position", 0)
                correct_word = blank.get("correct", "").strip().lower()
                gap_key = f"{cl.id}:{position}"
                
                # Найти ответ ученика
                student_answer = ""
                for ans in cloze_answers:
                    if ans.get("gap_id") == gap_key:
                        student_answer = ans.get("answer", "").strip().lower()
                        break
                
                cloze_correct[gap_key] = (student_answer == correct_word)
        
        # Подсчёт процента
        total_items = len(q_map_correct) + len(cloze_correct)
        correct_items = (
            sum(1 for ok in q_map_correct.values() if ok) +
            sum(1 for ok in cloze_correct.values() if ok)
        )
        score_percent = round((correct_items / total_items) * 100, 2) if total_items > 0 else 100.0
        passed = score_percent >= 80.0
        
        return Response({
            "passed": passed,
            "score_percent": score_percent,
            "mapping_feedback": [{"question_id": qid, "ok": ok} for qid, ok in q_map_correct.items()],
            "cloze_feedback": [{"gap_id": gid, "ok": ok} for gid, ok in cloze_correct.items()],
        })
```

---

## 7. Аутентификация и права доступа

### 7.1. Базовые настройки

**В settings.py:**
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

### 7.2. Права доступа (Permissions)

**IsAuthenticated** — только авторизованные пользователи:
```python
from rest_framework import permissions

class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeSystem.objects.all()
    serializer_class = KnowledgeSystemSerializer
    permission_classes = [permissions.IsAuthenticated]
```

**IsAuthenticatedOrReadOnly** — чтение для всех, изменение только для авторизованных:
```python
permission_classes = [permissions.IsAuthenticatedOrReadOnly]
```

**AllowAny** — доступ для всех:
```python
permission_classes = [permissions.AllowAny]
```

**IsAdminUser** — только администраторы:
```python
permission_classes = [permissions.IsAdminUser]
```

### 7.3. Получение текущего пользователя

В ViewSet доступен `request.user`:

```python
def create(self, request, *args, **kwargs):
    serializer = self.get_serializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # Автоматически установить автора
    task = serializer.save(created_by=request.user)
    
    return Response(serializer.data, status=status.HTTP_201_CREATED)
```

---

## 8. Обработка ошибок и валидация

### 8.1. Валидация в сериализаторе

```python
class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ("title", "text", "difficulty")
    
    def validate_difficulty(self, value):
        """Проверка сложности"""
        if value < 1 or value > 5:
            raise serializers.ValidationError("Сложность должна быть от 1 до 5")
        return value
    
    def validate(self, data):
        """Проверка всех полей вместе"""
        if data.get("title") and len(data["title"]) < 3:
            raise serializers.ValidationError({
                "title": "Название должно быть не менее 3 символов"
            })
        return data
```

### 8.2. Обработка ошибок в ViewSet

```python
def create(self, request, *args, **kwargs):
    serializer = self.get_serializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(
            {"errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        instance = serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

### 8.3. Кастомные исключения

```python
from rest_framework.exceptions import APIException

class InsufficientScoreException(APIException):
    status_code = 400
    default_detail = "Недостаточно баллов для прохождения"
    default_code = "insufficient_score"

# Использование
if score < 80:
    raise InsufficientScoreException()
```

---

## Практические рекомендации

### 1. Организация файлов

**serializers.py:**
```python
# Группируйте сериализаторы комментариями
# =============================================================================
# КАТАЛОГ
# =============================================================================
class TopicSerializer(...): ...

# =============================================================================
# СИСТЕМА ЗНАНИЙ
# =============================================================================
class KnowledgeSystemSerializer(...): ...
```

**views.py:**
```python
# Группируйте ViewSets комментариями
# =============================================================================
# /api/catalog/ — дерево классов → разделов → тем
# =============================================================================
class CatalogViewSet(...): ...
```

### 2. Использование разных сериализаторов

- **Brief** — для списков (минимум полей)
- **Detail** — для деталей (все поля + связанные объекты)
- **Create/Update** — для создания/обновления (без read-only полей)

### 3. Оптимизация запросов

Всегда используйте `select_related()` и `prefetch_related()`:

```python
queryset = KnowledgeSystem.objects.select_related("topic").prefetch_related(
    "zones", "questions", "tasks"
)
```

### 4. Документация

Добавляйте docstring к ViewSets и действиям:

```python
class KnowledgeSystemViewSet(viewsets.ModelViewSet):
    """
    ViewSet для работы с Системами Знаний.
    
    list: Получить список всех систем знаний
    retrieve: Получить детали системы знаний
    check: Проверить ответы ученика (кастомное действие)
    """
    ...
```

---

## Итоги

1. **API** — интерфейс для обмена данными между frontend и backend
2. **Сериализаторы** — преобразуют модели в JSON и обратно
3. **ViewSets** — обрабатывают HTTP запросы (GET, POST, PUT, DELETE)
4. **Routers** — автоматически создают URL-маршруты
5. **@action** — для создания кастомных эндпоинтов
6. **Permissions** — контроль доступа к API

**Следующий шаг:** После создания API нужно создать frontend для работы с ним (React).

---

## Вопросы для самопроверки

1. В чём разница между сериализацией и десериализацией?
2. Когда использовать `ModelViewSet`, а когда `ReadOnlyModelViewSet`?
3. Что такое Router и зачем он нужен?
4. Как создать кастомный эндпоинт с помощью `@action`?
5. Как получить текущего пользователя в ViewSet?
6. Как оптимизировать запросы к БД в ViewSet?

---

## Дополнительные ресурсы

- [Официальная документация Django REST Framework](https://www.django-rest-framework.org/)
- [DRF Tutorial](https://www.django-rest-framework.org/tutorial/quickstart/)
- [DRF API Guide](https://www.django-rest-framework.org/api-guide/)
