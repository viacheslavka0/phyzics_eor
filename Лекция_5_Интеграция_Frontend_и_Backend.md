# Лекция 5: Интеграция Frontend и Backend

**Цель лекции:** Освоить интеграцию React-приложения с Django REST API, научиться настраивать CORS, работать с аутентификацией, обрабатывать ошибки и синхронизировать состояние между клиентом и сервером.

**Продолжительность:** 90 минут

---

## План лекции

1. **Введение: проблемы интеграции** (5 мин)
2. **Настройка CORS** (10 мин)
3. **Аутентификация и сессии** (15 мин)
4. **Обработка ошибок и валидация** (15 мин)
5. **Синхронизация состояния** (15 мин)
6. **Работа с файлами и FormData** (10 мин)
7. **Оптимизация запросов** (10 мин)
8. **Лучшие практики** (10 мин)

---

## 1. Введение: проблемы интеграции

### 1.1. Архитектура клиент-сервер

В современном веб-приложении:

```
React App (Frontend)  ←→  Django REST API (Backend)  ←→  База данных
   localhost:5173              localhost:8000              SQLite/PostgreSQL
```

**Проблемы:**
- ❌ Разные порты (5173 и 8000)
- ❌ Разные домены (CORS)
- ❌ Аутентификация через cookies
- ❌ CSRF защита
- ❌ Синхронизация состояния

### 1.2. Основные задачи интеграции

1. **Настроить CORS** — разрешить запросы с frontend на backend
2. **Настроить аутентификацию** — работа с сессиями и cookies
3. **Обработать ошибки** — корректная обработка ошибок API
4. **Синхронизировать состояние** — обновление данных после изменений
5. **Работать с файлами** — загрузка изображений и документов

---

## 2. Настройка CORS

### 2.1. Что такое CORS?

**CORS (Cross-Origin Resource Sharing)** — механизм, который позволяет браузеру делать запросы к серверу на другом домене/порту.

**Проблема:**
```
Frontend: http://localhost:5173
Backend:  http://localhost:8000

Браузер блокирует запросы из-за разных источников (origin)
```

### 2.2. Установка django-cors-headers

**Установка:**
```bash
pip install django-cors-headers
```

**Настройка в settings.py:**
```python
INSTALLED_APPS = [
    ...
    'corsheaders',  # Добавить в начало списка
    ...
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Добавить в начало
    'django.middleware.security.SecurityMiddleware',
    ...
]

# Разрешить все источники (только для разработки!)
CORS_ALLOW_ALL_ORIGINS = True

# Или указать конкретные источники (для production)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Разрешить отправку cookies
CORS_ALLOW_CREDENTIALS = True
```

### 2.3. Настройка для production

**Безопасная настройка:**
```python
# settings.py

# Для разработки
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    # Для production
    CORS_ALLOWED_ORIGINS = [
        "https://yourdomain.com",
        "https://www.yourdomain.com",
    ]

CORS_ALLOW_CREDENTIALS = True
```

### 2.4. Альтернатива: Proxy в Vite

Если не хотите настраивать CORS, можно использовать proxy:

**vite.config.js:**
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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

**Преимущества:**
- ✅ Не нужно настраивать CORS
- ✅ Все запросы идут через один порт
- ✅ Проще для разработки

---

## 3. Аутентификация и сессии

### 3.1. Session Authentication в Django

Django использует сессии для аутентификации:

1. Пользователь логинится через `/admin/`
2. Django устанавливает cookie `sessionid`
3. Все последующие запросы включают этот cookie
4. Django проверяет сессию и определяет пользователя

### 3.2. Настройка в DRF

**settings.py:**
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

### 3.3. Работа с cookies в React

**Получение CSRF токена:**
```jsx
const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};
```

**Отправка запроса с cookies:**
```jsx
const response = await fetch('/api/courses/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCSRFCookie(),  // CSRF токен
  },
  credentials: 'include',  // Важно! Отправляет cookies
  body: JSON.stringify(data),
});
```

**Важно:** `credentials: 'include'` обязательно для отправки cookies!

### 3.4. Утилита для API запросов

**src/utils/api.js:**
```jsx
const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

export async function apiCall(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',  // Отправляем cookies
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFCookie(),
        ...options.headers,
      },
    });
    
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Нет доступа. Войдите через /admin/');
      }
      if (res.status === 401) {
        throw new Error('Требуется авторизация');
      }
      const error = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      throw new Error(error.detail || 'Ошибка');
    }
    
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

### 3.5. Проверка аутентификации

**В компоненте:**
```jsx
useEffect(() => {
  async function checkAuth() {
    try {
      const response = await fetch('/api/session/current/', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Перенаправить на страницу входа
        window.location.href = '/admin/';
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  }
  
  checkAuth();
}, []);
```

---

## 4. Обработка ошибок и валидация

### 4.1. Типы ошибок

**HTTP статусы:**
- `400 Bad Request` — неверные данные
- `401 Unauthorized` — не авторизован
- `403 Forbidden` — нет доступа
- `404 Not Found` — ресурс не найден
- `500 Internal Server Error` — ошибка сервера

### 4.2. Обработка ошибок в утилите

```jsx
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
      // Обработка разных статусов
      if (res.status === 401) {
        throw new Error('Требуется авторизация. Войдите через /admin/');
      }
      if (res.status === 403) {
        throw new Error('Нет доступа. Войдите как учитель через /admin/');
      }
      if (res.status === 404) {
        throw new Error('Ресурс не найден');
      }
      
      // Пытаемся получить детали ошибки от сервера
      const error = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      
      // Если есть поле errors (валидация), показываем их
      if (error.errors) {
        const errorMessages = Object.entries(error.errors)
          .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
          .join('\n');
        throw new Error(errorMessages);
      }
      
      throw new Error(error.detail || error.message || 'Ошибка сервера');
    }
    
    return res.json();
  } catch (error) {
    // Если это уже наш Error, пробрасываем дальше
    if (error instanceof Error) {
      throw error;
    }
    // Иначе создаём новый
    throw new Error('Неизвестная ошибка');
  }
}
```

### 4.3. Обработка ошибок в компонентах

```jsx
function CourseForm() {
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  
  const handleSubmit = async (formData) => {
    try {
      setError('');
      setFieldErrors({});
      
      const data = await apiCall('/api/courses/', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      
      console.log('Создан:', data);
    } catch (err) {
      // Обработка ошибок валидации
      if (err.message.includes(':')) {
        // Ошибки полей
        const errors = {};
        err.message.split('\n').forEach(line => {
          const [field, message] = line.split(':');
          if (field && message) {
            errors[field.trim()] = message.trim();
          }
        });
        setFieldErrors(errors);
      } else {
        // Общая ошибка
        setError(err.message);
      }
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      
      <input
        type="text"
        name="title"
        className={fieldErrors.title ? 'border-red-500' : ''}
      />
      {fieldErrors.title && (
        <p className="text-red-600 text-sm">{fieldErrors.title}</p>
      )}
      
      <button type="submit">Создать</button>
    </form>
  );
}
```

### 4.4. Глобальная обработка ошибок

**Создание компонента ErrorBoundary:**
```jsx
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Что-то пошло не так</h1>
            <p className="text-slate-600">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Использование:**
```jsx
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

---

## 5. Синхронизация состояния

### 5.1. Проблема синхронизации

После создания/обновления объекта на сервере нужно обновить состояние на клиенте.

**Проблема:**
```jsx
const handleCreate = async (data) => {
  await apiCall('/api/courses/', { method: 'POST', body: JSON.stringify(data) });
  // Как обновить список курсов?
};
```

### 5.2. Решение 1: Перезагрузка данных

```jsx
function CourseList() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/courses/');
      setCourses(data);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadCourses();
  }, []);
  
  const handleCreate = async (formData) => {
    await apiCall('/api/courses/', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    // Перезагружаем список
    await loadCourses();
  };
  
  return (
    <div>
      <CreateForm onSubmit={handleCreate} />
      {courses.map(course => <CourseCard key={course.id} course={course} />)}
    </div>
  );
}
```

### 5.3. Решение 2: Оптимистичное обновление

```jsx
const handleCreate = async (formData) => {
  // Оптимистично добавляем в список
  const tempCourse = { id: Date.now(), ...formData, created_at: new Date() };
  setCourses([...courses, tempCourse]);
  
  try {
    // Создаём на сервере
    const newCourse = await apiCall('/api/courses/', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    
    // Заменяем временный объект на реальный
    setCourses(courses.map(c => c.id === tempCourse.id ? newCourse : c));
  } catch (error) {
    // Откатываем изменения при ошибке
    setCourses(courses.filter(c => c.id !== tempCourse.id));
    alert('Ошибка создания: ' + error.message);
  }
};
```

### 5.4. Решение 3: Context API для глобального состояния

```jsx
// context/AppContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';
import { fetchCourses } from '../utils/api';

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext not found');
  return ctx;
}

export function AppProvider({ children }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchCourses();
      setCourses(data);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const createCourse = useCallback(async (formData) => {
    const newCourse = await apiCall('/api/courses/', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    setCourses([...courses, newCourse]);
    return newCourse;
  }, [courses]);
  
  const updateCourse = useCallback(async (id, formData) => {
    const updatedCourse = await apiCall(`/api/courses/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(formData),
    });
    setCourses(courses.map(c => c.id === id ? updatedCourse : c));
    return updatedCourse;
  }, [courses]);
  
  const deleteCourse = useCallback(async (id) => {
    await apiCall(`/api/courses/${id}/`, { method: 'DELETE' });
    setCourses(courses.filter(c => c.id !== id));
  }, [courses]);
  
  return (
    <AppContext.Provider value={{
      courses,
      loading,
      loadCourses,
      createCourse,
      updateCourse,
      deleteCourse,
    }}>
      {children}
    </AppContext.Provider>
  );
}
```

**Использование:**
```jsx
function CourseList() {
  const { courses, loading, loadCourses } = useApp();
  
  useEffect(() => {
    loadCourses();
  }, [loadCourses]);
  
  // ...
}

function CreateForm() {
  const { createCourse } = useApp();
  
  const handleSubmit = async (formData) => {
    await createCourse(formData);
    // Состояние автоматически обновится!
  };
  
  // ...
}
```

### 5.5. Пример из реального проекта

```jsx
// Обновление сессии после действий
const updateSession = async () => {
  if (!selectedKS) return;
  const res = await fetch(`/api/session/current/?ks_id=${selectedKS}`, {
    credentials: 'include',
  });
  const data = await res.json();
  setSession(data);
};

// Использование после проверки ответов
const handleCheck = async (answers) => {
  try {
    const response = await fetch(`/api/ks/${selectedKS}/check/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFCookie(),
      },
      credentials: 'include',
      body: JSON.stringify(answers),
    });
    
    if (!response.ok) throw new Error('Ошибка проверки');
    
    const result = await response.json();
    
    // Обновляем сессию после проверки
    await updateSession();
    
    return result;
  } catch (error) {
    console.error('Check error:', error);
    throw error;
  }
};
```

---

## 6. Работа с файлами и FormData

### 6.1. Загрузка файлов

**Проблема:** JSON не поддерживает файлы. Нужно использовать `FormData`.

**Создание FormData:**
```jsx
const handleFileUpload = async (file, title) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('title', title);
  
  try {
    const response = await fetch('/api/courses/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRFCookie(),
        // НЕ указываем Content-Type! Браузер установит автоматически
      },
      credentials: 'include',
      body: formData,  // FormData вместо JSON
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

### 6.2. Компонент загрузки файла

```jsx
function ImageUpload({ onUpload }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Превью изображения
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);
      
      const data = await apiUpload('/api/upload/', formData);
      onUpload(data);
      
      setFile(null);
      setPreview(null);
    } catch (error) {
      alert('Ошибка загрузки: ' + error.message);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mb-4"
      />
      
      {preview && (
        <div className="mb-4">
          <img src={preview} alt="Preview" className="max-w-xs rounded-lg" />
        </div>
      )}
      
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {uploading ? 'Загрузка...' : 'Загрузить'}
      </button>
    </div>
  );
}
```

### 6.3. Утилита для загрузки файлов

```jsx
export async function apiUpload(url, formData) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRFToken': getCSRFCookie(),
        // НЕ указываем Content-Type для FormData!
      },
      body: formData,
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Ошибка загрузки' }));
      throw new Error(error.detail || 'Ошибка загрузки');
    }
    
    return res.json();
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
```

### 6.4. Смешанные данные (JSON + файлы)

**Проблема:** Нужно отправить и JSON данные, и файл.

**Решение:** Всё отправляем через FormData:

```jsx
const handleSubmit = async (formData, imageFile) => {
  const data = new FormData();
  
  // JSON данные
  data.append('title', formData.title);
  data.append('description', formData.description);
  
  // Файл
  if (imageFile) {
    data.append('image', imageFile);
  }
  
  // JSONField данные (если нужно)
  data.append('options', JSON.stringify(formData.options));
  
  const response = await fetch('/api/courses/', {
    method: 'POST',
    headers: {
      'X-CSRFToken': getCSRFCookie(),
    },
    credentials: 'include',
    body: data,
  });
  
  return response.json();
};
```

**На backend (Django):**
```python
def create(self, request, *args, **kwargs):
    # Обычные поля
    title = request.data.get('title')
    description = request.data.get('description')
    
    # Файл
    image = request.FILES.get('image')
    
    # JSONField (нужно распарсить)
    options_json = request.data.get('options')
    if options_json:
        import json
        options = json.loads(options_json)
    
    # Создание объекта
    course = Course.objects.create(
        title=title,
        description=description,
        image=image,
        options=options,
    )
    
    return Response(CourseSerializer(course).data)
```

---

## 7. Оптимизация запросов

### 7.1. Дебаунсинг (Debouncing)

**Проблема:** Много запросов при вводе текста в поиск.

**Решение:**
```jsx
import { useState, useEffect, useRef } from 'react';

function SearchInput({ onSearch }) {
  const [query, setQuery] = useState('');
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Устанавливаем новый таймер
    timeoutRef.current = setTimeout(() => {
      if (query.trim()) {
        onSearch(query);
      }
    }, 500); // Ждём 500ms после последнего ввода
    
    // Очистка при размонтировании
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, onSearch]);
  
  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Поиск..."
    />
  );
}
```

### 7.2. Кэширование запросов

```jsx
const cache = new Map();

export async function fetchCourse(id, useCache = true) {
  // Проверяем кэш
  if (useCache && cache.has(id)) {
    const cached = cache.get(id);
    // Проверяем, не устарели ли данные (например, 5 минут)
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
  }
  
  // Загружаем с сервера
  const data = await apiCall(`/api/courses/${id}/`);
  
  // Сохраняем в кэш
  if (useCache) {
    cache.set(id, {
      data,
      timestamp: Date.now(),
    });
  }
  
  return data;
}
```

### 7.3. Отмена запросов (AbortController)

```jsx
useEffect(() => {
  const abortController = new AbortController();
  
  async function loadData() {
    try {
      const response = await fetch('/api/courses/', {
        signal: abortController.signal,  // Сигнал для отмены
      });
      const data = await response.json();
      setCourses(data);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
      } else {
        console.error('Error:', error);
      }
    }
  }
  
  loadData();
  
  // Отменяем запрос при размонтировании
  return () => {
    abortController.abort();
  };
}, []);
```

### 7.4. Пакетные запросы

**Проблема:** Много отдельных запросов.

**Решение:** Один запрос для всех данных:

```jsx
// Плохо: много запросов
useEffect(() => {
  courses.forEach(course => {
    fetch(`/api/courses/${course.id}/modules/`).then(...);
  });
}, [courses]);

// Хорошо: один запрос
useEffect(() => {
  async function loadAll() {
    const data = await apiCall('/api/courses/with-modules/');
    setCourses(data);
  }
  loadAll();
}, []);
```

---

## 8. Лучшие практики

### 8.1. Организация кода

**Структура:**
```
src/
├── utils/
│   ├── api.js          ← базовые функции API
│   └── apiUpload.js   ← загрузка файлов
├── hooks/
│   ├── useApi.js      ← кастомный хук для API
│   └── useDebounce.js ← хук для дебаунсинга
├── context/
│   └── AppContext.jsx ← глобальное состояние
└── components/
    └── ...
```

### 8.2. Единая точка входа для API

```jsx
// utils/api.js
const API_BASE_URL = '/api';

export const api = {
  courses: {
    list: () => apiCall(`${API_BASE_URL}/courses/`),
    get: (id) => apiCall(`${API_BASE_URL}/courses/${id}/`),
    create: (data) => apiCall(`${API_BASE_URL}/courses/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiCall(`${API_BASE_URL}/courses/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiCall(`${API_BASE_URL}/courses/${id}/`, {
      method: 'DELETE',
    }),
  },
  // ...
};

// Использование
import { api } from './utils/api';

const courses = await api.courses.list();
const course = await api.courses.get(1);
```

### 8.3. Обработка состояний загрузки

```jsx
function useAsync(asyncFunction) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  
  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]);
  
  return { loading, error, data, execute };
}

// Использование
function CourseList() {
  const { loading, error, data, execute } = useAsync(api.courses.list);
  
  useEffect(() => {
    execute();
  }, [execute]);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} />;
  
  return <div>{data.map(...)}</div>;
}
```

### 8.4. Валидация на клиенте

```jsx
function validateCourse(data) {
  const errors = {};
  
  if (!data.title || data.title.length < 3) {
    errors.title = 'Название должно быть не менее 3 символов';
  }
  
  if (data.description && data.description.length > 1000) {
    errors.description = 'Описание слишком длинное';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

const handleSubmit = async (formData) => {
  const validation = validateCourse(formData);
  
  if (!validation.isValid) {
    setFieldErrors(validation.errors);
    return;
  }
  
  // Отправляем на сервер
  await api.courses.create(formData);
};
```

---

## Итоги

1. **CORS** — настройка для разрешения запросов между доменами
2. **Аутентификация** — работа с сессиями и cookies через `credentials: 'include'`
3. **Обработка ошибок** — корректная обработка всех типов ошибок
4. **Синхронизация** — обновление состояния после изменений на сервере
5. **Файлы** — использование FormData для загрузки файлов
6. **Оптимизация** — дебаунсинг, кэширование, отмена запросов
7. **Лучшие практики** — организация кода, единая точка входа, валидация

**Следующий шаг:** Тестирование и деплой приложения.

---

## Вопросы для самопроверки

1. Зачем нужен CORS и как его настроить?
2. Почему важно использовать `credentials: 'include'`?
3. Как обработать ошибки валидации от сервера?
4. В чём разница между оптимистичным и пессимистичным обновлением?
5. Как загрузить файл через API?
6. Что такое дебаунсинг и зачем он нужен?

---

## Дополнительные ресурсы

- [Django CORS Headers Documentation](https://github.com/adamchainz/django-cors-headers)
- [MDN: Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
