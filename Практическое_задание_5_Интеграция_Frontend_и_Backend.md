# Практическое задание 5: Интеграция Frontend и Backend

**К лекции:** "Интеграция Frontend и Backend"

**Тип в Moodle:** Задание (с прикреплением файлов)

**Время выполнения:** 2.5–3 часа

**Максимальный балл:** 25 баллов

---

## Цель задания

Освоить интеграцию React-приложения с Django REST API, научиться настраивать CORS, работать с аутентификацией, обрабатывать ошибки и синхронизировать состояние между клиентом и сервером.

---

## Задание

Интегрируйте ваше React-приложение (из задания 4) с Django REST API (из задания 3). Приложение должно полноценно работать с backend: загружать данные, создавать/обновлять/удалять объекты, обрабатывать ошибки и синхронизировать состояние.

### Предварительные требования

**Обязательно:**
- Выполнено задание 3 (REST API) или есть работающий Django backend с API
- Выполнено задание 4 (React Frontend) или есть базовое React-приложение

**Если задания не выполнены:**
- Можно использовать упрощённые версии для демонстрации интеграции

---

## Требования к интеграции

### 1. Настройка CORS

#### 1.1. Установка django-cors-headers

**Шаг 1:** Установите пакет:
```bash
pip install django-cors-headers
```

**Шаг 2:** Добавьте в `settings.py`:
```python
INSTALLED_APPS = [
    'corsheaders',  # Добавить в начало списка
    ...
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Добавить в начало
    ...
]

# Для разработки
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
```

**Требования:**
- ✅ CORS настроен корректно
- ✅ Разрешены запросы с frontend
- ✅ Разрешена отправка cookies (`CORS_ALLOW_CREDENTIALS = True`)

#### 1.2. Альтернатива: Proxy в Vite (опционально, +1 балл)

Если используете Vite, можно настроить proxy вместо CORS:

**vite.config.js:**
```js
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

---

### 2. Утилита для работы с API

#### 2.1. Базовая утилита

Создайте файл `src/utils/api.js` с функциями для работы с API:

**Требования:**
- Функция получения CSRF токена
- Базовая функция `apiCall` с обработкой ошибок
- Поддержка `credentials: 'include'`
- Обработка статусов 401, 403, 404, 500
- Обработка ошибок валидации

**Пример:**
```jsx
const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

export async function apiCall(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFCookie(),
        ...options.headers,
      },
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Требуется авторизация. Войдите через /admin/');
      }
      if (res.status === 403) {
        throw new Error('Нет доступа');
      }
      const error = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      throw new Error(error.detail || error.message || 'Ошибка');
    }
    
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

#### 2.2. Специализированные функции

Создайте функции для конкретных эндпоинтов:

```jsx
export async function fetchCourses() {
  return apiCall('/api/courses/');
}

export async function fetchCourse(id) {
  return apiCall(`/api/courses/${id}/`);
}

export async function createCourse(data) {
  return apiCall('/api/courses/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCourse(id, data) {
  return apiCall(`/api/courses/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCourse(id) {
  return apiCall(`/api/courses/${id}/`, {
    method: 'DELETE',
  });
}
```

**Требования:**
- Минимум 5 функций для разных операций (GET, POST, PATCH, DELETE)
- Все функции используют базовую `apiCall`

---

### 3. Интеграция в компоненты

#### 3.1. Загрузка данных

Обновите компоненты для загрузки данных с сервера:

**Требования:**
- Используйте `useEffect` для загрузки данных при монтировании
- Обрабатывайте состояния загрузки (`loading`)
- Обрабатывайте ошибки (`error`)
- Показывайте индикатор загрузки

**Пример:**
```jsx
function CourseList() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true);
        setError('');
        const data = await fetchCourses();
        setCourses(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadCourses();
  }, []);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  
  return (
    <div>
      {courses.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
```

#### 3.2. Создание объектов

Создайте форму для создания новых объектов:

**Требования:**
- Форма с валидацией на клиенте
- Обработка ошибок валидации от сервера
- Обновление списка после успешного создания
- Показ сообщений об успехе/ошибке

**Пример:**
```jsx
function CreateCourseForm({ onSuccess }) {
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    
    try {
      const newCourse = await createCourse(formData);
      onSuccess(newCourse);
      setFormData({ title: '', description: '' });
    } catch (err) {
      // Обработка ошибок валидации
      if (err.message.includes(':')) {
        const errors = {};
        err.message.split('\n').forEach(line => {
          const [field, message] = line.split(':');
          if (field && message) {
            errors[field.trim()] = message.trim();
          }
        });
        setFieldErrors(errors);
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {error && <ErrorMessage message={error} />}
      
      <input
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        className={fieldErrors.title ? 'border-red-500' : ''}
      />
      {fieldErrors.title && (
        <p className="text-red-600 text-sm">{fieldErrors.title}</p>
      )}
      
      <button type="submit" disabled={submitting}>
        {submitting ? 'Создание...' : 'Создать'}
      </button>
    </form>
  );
}
```

#### 3.3. Обновление объектов

Реализуйте возможность редактирования объектов:

**Требования:**
- Форма редактирования (можно модальное окно)
- Загрузка данных объекта для редактирования
- Обновление через PATCH запрос
- Обновление списка после успешного обновления

#### 3.4. Удаление объектов

Реализуйте удаление с подтверждением:

**Требования:**
- Кнопка удаления с подтверждением (confirm или модальное окно)
- DELETE запрос к API
- Обновление списка после удаления
- Обработка ошибок

**Пример:**
```jsx
const handleDelete = async (id) => {
  if (!confirm('Вы уверены, что хотите удалить этот курс?')) {
    return;
  }
  
  try {
    await deleteCourse(id);
    setCourses(courses.filter(c => c.id !== id));
  } catch (error) {
    alert('Ошибка удаления: ' + error.message);
  }
};
```

---

### 4. Синхронизация состояния

#### 4.1. Обновление после изменений

Реализуйте обновление списка после создания/обновления/удаления:

**Вариант А: Перезагрузка данных**
```jsx
const loadCourses = async () => {
  const data = await fetchCourses();
  setCourses(data);
};

const handleCreate = async (formData) => {
  await createCourse(formData);
  await loadCourses(); // Перезагружаем список
};
```

**Вариант Б: Оптимистичное обновление** (опционально, +2 балла)
```jsx
const handleCreate = async (formData) => {
  // Оптимистично добавляем
  const tempCourse = { id: Date.now(), ...formData };
  setCourses([...courses, tempCourse]);
  
  try {
    const newCourse = await createCourse(formData);
    setCourses(courses.map(c => c.id === tempCourse.id ? newCourse : c));
  } catch (error) {
    setCourses(courses.filter(c => c.id !== tempCourse.id));
    throw error;
  }
};
```

**Требования:**
- Минимум один способ синхронизации (перезагрузка данных)
- Состояние обновляется корректно после всех операций

#### 4.2. Context API для глобального состояния (опционально, +2 балла)

Создайте контекст для управления глобальным состоянием:

**Требования:**
- Context для данных (курсы, модули и т.д.)
- Функции для CRUD операций
- Использование в компонентах

---

### 5. Обработка ошибок

#### 5.1. Глобальная обработка

Создайте компонент для отображения ошибок:

**Требования:**
- Компонент `ErrorMessage` для отображения ошибок
- Обработка разных типов ошибок (401, 403, 404, 500, валидация)
- Понятные сообщения для пользователя

#### 5.2. Обработка в формах

**Требования:**
- Показ ошибок валидации рядом с полями
- Общая ошибка формы
- Валидация на клиенте перед отправкой

#### 5.3. Обработка сетевых ошибок

**Требования:**
- Обработка ошибок сети (нет интернета, таймаут)
- Повторная попытка при ошибке (опционально)

---

### 6. Работа с файлами (опционально, +3 балла)

Если в вашем API есть загрузка файлов, реализуйте её:

**Требования:**
- Компонент для выбора файла
- Превью изображения (если это изображение)
- Загрузка через FormData
- Отображение прогресса загрузки
- Обработка ошибок

**Пример:**
```jsx
const handleFileUpload = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('title', title);
  
  try {
    const response = await fetch('/api/courses/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRFCookie(),
      },
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Ошибка загрузки');
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
```

---

### 7. Тестирование интеграции

#### 7.1. Проверка работы

**Требования:**
- Запустите Django сервер (`python manage.py runserver`)
- Запустите React приложение (`npm run dev`)
- Авторизуйтесь через `/admin/`
- Проверьте все операции (создание, чтение, обновление, удаление)

#### 7.2. Проверка CORS

**Требования:**
- Убедитесь, что запросы проходят без ошибок CORS
- Проверьте в DevTools (Network), что cookies отправляются

---

## Что сдать

### 1. Архив Backend (обязательно)

Архив должен содержать:
- Весь код Django проекта
- Файл `requirements.txt` с зависимостями (включая `djangorestframework` и `django-cors-headers`)
- Настройки CORS в `settings.py`

### 2. Архив Frontend (обязательно)

Архив должен содержать:
- Весь код React проекта
- Файл `package.json`
- Утилиты для работы с API (`src/utils/api.js`)
- Обновлённые компоненты

### 3. Скриншоты (обязательно)

**a) Скриншот работающего приложения:**
- Откройте приложение в браузере
- Должен быть виден интерфейс с данными, загруженными с сервера

**b) Скриншот Network в DevTools:**
- Покажите вкладку Network
- Должны быть видны успешные запросы к API (статус 200)
- Должны быть видны заголовки с CSRF токеном

**c) Скриншот создания объекта:**
- Покажите процесс создания нового объекта
- Должен быть виден POST запрос и ответ

**d) Скриншот обработки ошибки:**
- Покажите, как обрабатывается ошибка (например, валидация)
- Должно быть видно сообщение об ошибке в интерфейсе

### 4. Описание интеграции (обязательно)

Создайте файл `INTEGRATION_DESCRIPTION.md`:

```
ОПИСАНИЕ ИНТЕГРАЦИИ

НАСТРОЙКА CORS:
- Использован пакет: django-cors-headers
- Настройки в settings.py: [опишите настройки]
- Альтернатива (если использована): Proxy в Vite

УТИЛИТЫ API:
- Файл: src/utils/api.js
- Функции: [список функций]
- Обработка ошибок: [как обрабатываются ошибки]
- CSRF токен: [как получается и используется]

ИНТЕГРАЦИЯ В КОМПОНЕНТЫ:
- Загрузка данных: [какие компоненты загружают данные]
- Создание объектов: [как реализовано]
- Обновление объектов: [как реализовано]
- Удаление объектов: [как реализовано]

СИНХРОНИЗАЦИЯ СОСТОЯНИЯ:
- Способ: [перезагрузка данных / оптимистичное обновление / Context API]
- Как обновляется состояние после операций: [описание]

ОБРАБОТКА ОШИБОК:
- Типы обрабатываемых ошибок: [401, 403, 404, 500, валидация]
- Как отображаются ошибки: [компоненты, сообщения]

РАБОТА С ФАЙЛАМИ (если реализована):
- Как реализована загрузка файлов
- Использование FormData
- Обработка ошибок

ТЕСТИРОВАНИЕ:
- Как запустить backend: [команды]
- Как запустить frontend: [команды]
- Как протестировать интеграцию: [инструкции]
```

### 5. Инструкции по запуску (обязательно)

Создайте файл `SETUP.md`:

```markdown
# Инструкции по запуску

## Backend

1. Установите зависимости:
```bash
pip install -r requirements.txt
```

2. Примените миграции:
```bash
python manage.py migrate
```

3. Создайте суперпользователя (если нужно):
```bash
python manage.py createsuperuser
```

4. Запустите сервер:
```bash
python manage.py runserver
```

Сервер будет доступен на http://localhost:8000

## Frontend

1. Установите зависимости:
```bash
npm install
```

2. Запустите приложение:
```bash
npm run dev
```

Приложение будет доступно на http://localhost:5173

## Тестирование

1. Откройте http://localhost:8000/admin/ и авторизуйтесь
2. Откройте http://localhost:5173
3. Проверьте работу всех операций (создание, чтение, обновление, удаление)
```

---

## Критерии оценивания

| Критерий | Баллы | Описание |
|----------|-------|----------|
| **Настройка CORS** | 2 | CORS настроен корректно:<br>- Установлен django-cors-headers (0.5)<br>- Настроен в settings.py (0.5)<br>- Разрешены запросы и cookies (1) |
| **Утилита для API** | 3 | Создана утилита api.js:<br>- Функция получения CSRF токена (0.5)<br>- Базовая функция apiCall (1)<br>- Обработка ошибок (401, 403, 404, 500) (1)<br>- Специализированные функции (минимум 5) (0.5) |
| **Загрузка данных** | 2 | Данные загружаются с сервера:<br>- useEffect для загрузки (0.5)<br>- Обработка loading (0.5)<br>- Обработка error (0.5)<br>- Отображение данных (0.5) |
| **Создание объектов** | 3 | Реализовано создание:<br>- Форма с валидацией (0.5)<br>- POST запрос к API (0.5)<br>- Обработка ошибок валидации (1)<br>- Обновление списка после создания (1) |
| **Обновление объектов** | 2 | Реализовано обновление:<br>- Форма редактирования (0.5)<br>- PATCH запрос (0.5)<br>- Обновление списка (1) |
| **Удаление объектов** | 2 | Реализовано удаление:<br>- Подтверждение удаления (0.5)<br>- DELETE запрос (0.5)<br>- Обновление списка (1) |
| **Синхронизация состояния** | 2 | Состояние синхронизируется:<br>- Обновление после операций (1)<br>- Оптимистичное обновление или Context API (опционально, +1) |
| **Обработка ошибок** | 3 | Ошибки обрабатываются корректно:<br>- Глобальная обработка (1)<br>- Обработка в формах (1)<br>- Понятные сообщения для пользователя (1) |
| **Работа с файлами** | 3 | Реализована загрузка файлов (опционально):<br>- Компонент выбора файла (0.5)<br>- Использование FormData (1)<br>- Превью (0.5)<br>- Обработка ошибок (1) |
| **Тестирование** | 2 | Приложение протестировано:<br>- Все операции работают (1)<br>- Скриншоты приложены (1) |
| **Документация** | 2 | Создана документация:<br>- INTEGRATION_DESCRIPTION.md (1)<br>- SETUP.md с инструкциями (1) |
| **Качество кода** | 1 | Код структурирован, следует best practices |
| **ИТОГО** | **25** | |

---

## Пример минимального решения

### Backend: settings.py

```python
INSTALLED_APPS = [
    'corsheaders',
    ...
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    ...
]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
```

### Frontend: src/utils/api.js

```jsx
const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

export async function apiCall(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFCookie(),
        ...options.headers,
      },
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Требуется авторизация');
      }
      const error = await res.json().catch(() => ({ detail: 'Ошибка' }));
      throw new Error(error.detail || 'Ошибка');
    }
    
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export async function fetchCourses() {
  return apiCall('/api/courses/');
}

export async function createCourse(data) {
  return apiCall('/api/courses/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

### Frontend: src/App.jsx

```jsx
import { useState, useEffect } from 'react';
import { fetchCourses, createCourse } from './utils/api';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import CourseList from './components/CourseList';
import CreateForm from './components/CreateForm';

export default function App() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const loadCourses = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchCourses();
      setCourses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadCourses();
  }, []);
  
  const handleCreate = async (formData) => {
    try {
      await createCourse(formData);
      await loadCourses(); // Перезагружаем список
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  };
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  
  return (
    <div>
      <CreateForm onSubmit={handleCreate} />
      <CourseList courses={courses} />
    </div>
  );
}
```

---

## Рекомендации

1. **Начните с CORS** — убедитесь, что запросы проходят
2. **Создайте утилиту API** — это основа для всех запросов
3. **Тестируйте по шагам** — сначала загрузка данных, потом создание, потом обновление
4. **Используйте DevTools** — проверяйте Network и Console
5. **Обрабатывайте все ошибки** — не оставляйте необработанные исключения

---

## Часто задаваемые вопросы

**Q: Получаю ошибку CORS, что делать?**  
A: Убедитесь, что `django-cors-headers` установлен, добавлен в `INSTALLED_APPS` и `MIDDLEWARE`, и `CORS_ALLOW_CREDENTIALS = True`.

**Q: Cookies не отправляются, почему?**  
A: Убедитесь, что используете `credentials: 'include'` в fetch запросах и `CORS_ALLOW_CREDENTIALS = True` в Django.

**Q: Получаю 403 Forbidden, что делать?**  
A: Убедитесь, что вы авторизованы через `/admin/` и CSRF токен отправляется в заголовке `X-CSRFToken`.

**Q: Как проверить, что запросы идут?**  
A: Откройте DevTools → Network, выполните действие в приложении, проверьте запросы и их статусы.

**Q: Как обработать ошибки валидации?**  
A: Django REST Framework возвращает ошибки в формате `{"field": ["error message"]}`. Парсите их и показывайте рядом с полями.

---

## Дополнительные задания (опционально, не оцениваются)

1. **Реализуйте оптимистичное обновление** — обновляйте UI сразу, откатывайте при ошибке
2. **Добавьте Context API** — для глобального управления состоянием
3. **Реализуйте дебаунсинг** — для поиска и фильтрации
4. **Добавьте кэширование** — кэшируйте данные на клиенте
5. **Реализуйте пагинацию** — если данных много

---

**Удачи в выполнении задания!** 🚀

Если возникнут вопросы, обращайтесь к лекционному материалу или задавайте вопросы в форуме курса.
