# Практическое задание 4: Создание Frontend на React

**К лекции:** "Frontend — React основы"

**Тип в Moodle:** Задание (с прикреплением файлов)

**Время выполнения:** 2–2.5 часа

**Максимальный балл:** 20 баллов

---

## Цель задания

Освоить создание пользовательского интерфейса с использованием React, научиться работать с компонентами, состоянием, хуками и взаимодействовать с API.

---

## Задание

Создайте React-приложение для работы с вашим ЭОР. Приложение должно отображать список курсов/модулей, позволять просматривать детали и взаимодействовать с API (можно использовать API из задания 3 или создать упрощённый mock API).

### Предварительные требования

**Вариант А:** Используйте API из задания 3 (если оно выполнено).

**Вариант Б:** Создайте упрощённый mock API или используйте готовые данные в виде JSON.

---

## Требования к приложению

### 1. Установка и настройка проекта

**Шаг 1:** Создайте React-проект с Vite:

```bash
npm create vite@latest my-eor-frontend -- --template react
cd my-eor-frontend
npm install
```

**Шаг 2:** Установите Tailwind CSS (опционально, но рекомендуется):

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Шаг 3:** Настройте Tailwind в `tailwind.config.js`:

```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Шаг 4:** Добавьте в `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### 2. Структура компонентов

Создайте следующую структуру:

```
src/
├── components/          ← переиспользуемые компоненты
│   ├── CourseCard.jsx
│   ├── LoadingSpinner.jsx
│   └── ErrorMessage.jsx
├── utils/              ← утилиты
│   └── api.js
├── App.jsx             ← главный компонент
├── main.jsx            ← точка входа
└── index.css           ← стили
```

---

### 3. Компоненты

Создайте минимум **4 компонента**:

#### 3.1. Главный компонент (App.jsx)

**Требования:**
- Используйте `useState` для управления состоянием (минимум 3 состояния)
- Используйте `useEffect` для загрузки данных при монтировании
- Обрабатывайте состояния загрузки и ошибок
- Используйте условный рендеринг

**Пример структуры:**
```jsx
import { useState, useEffect } from 'react';
import CourseList from './components/CourseList';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';

export default function App() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    // Загрузка данных
  }, []);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  
  return (
    <div className="min-h-screen bg-slate-50">
      <h1>Мой ЭОР</h1>
      <CourseList courses={courses} />
    </div>
  );
}
```

#### 3.2. Компонент списка (CourseList.jsx или аналогичный)

**Требования:**
- Принимает массив данных через props
- Использует `map()` для рендеринга списка
- Каждый элемент имеет уникальный `key`
- Обрабатывает пустой список

**Пример:**
```jsx
export default function CourseList({ courses, onSelectCourse }) {
  if (!courses || courses.length === 0) {
    return <div className="text-center text-slate-500">Нет курсов</div>;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map(course => (
        <CourseCard
          key={course.id}
          course={course}
          onClick={() => onSelectCourse(course.id)}
        />
      ))}
    </div>
  );
}
```

#### 3.3. Компонент карточки (CourseCard.jsx или аналогичный)

**Требования:**
- Принимает данные через props
- Обрабатывает событие `onClick`
- Использует Tailwind CSS для стилизации
- Имеет hover-эффекты

**Пример:**
```jsx
export default function CourseCard({ course, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
    >
      <h3 className="text-xl font-bold text-slate-900 mb-2">
        {course.title}
      </h3>
      <p className="text-slate-600 mb-4">
        {course.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {course.modules_count || 0} модулей
        </span>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Открыть
        </button>
      </div>
    </div>
  );
}
```

#### 3.4. Вспомогательные компоненты

**LoadingSpinner.jsx:**
```jsx
export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
```

**ErrorMessage.jsx:**
```jsx
export default function ErrorMessage({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
      <p className="text-red-800">{message}</p>
    </div>
  );
}
```

---

### 4. Работа с API

#### 4.1. Утилита для работы с API

Создайте файл `src/utils/api.js`:

```jsx
// Утилита для получения CSRF токена (для Django)
const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

// Базовая функция для API запросов
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

// Функции для конкретных эндпоинтов
export async function fetchCourses() {
  return apiCall('/api/courses/');
}

export async function fetchCourse(id) {
  return apiCall(`/api/courses/${id}/`);
}
```

**Требования:**
- Обработка ошибок (403, 401, другие)
- Поддержка CSRF токена (для Django)
- Использование `credentials: 'include'` для cookies

#### 4.2. Использование в компонентах

**Пример загрузки данных:**
```jsx
import { useState, useEffect } from 'react';
import { fetchCourses } from './utils/api';

export default function App() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true);
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
  
  // ...
}
```

**Пример POST запроса:**
```jsx
const handleCreate = async (formData) => {
  try {
    const response = await fetch('/api/courses/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFCookie(),
      },
      credentials: 'include',
      body: JSON.stringify(formData),
    });
    
    if (!response.ok) throw new Error('Ошибка создания');
    
    const data = await response.json();
    console.log('Создан:', data);
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Ошибка: ' + error.message);
  }
};
```

---

### 5. Хуки

Используйте минимум **4 разных хука**:

#### 5.1. useState (обязательно)

Используйте для управления состоянием:
- Данные (список курсов, выбранный курс)
- Состояния загрузки и ошибок
- Состояния форм

#### 5.2. useEffect (обязательно)

Используйте для:
- Загрузки данных при монтировании компонента
- Загрузки данных при изменении зависимостей

**Пример:**
```jsx
useEffect(() => {
  async function loadData() {
    const data = await fetchCourses();
    setCourses(data);
  }
  loadData();
}, []); // Пустой массив = только при монтировании

useEffect(() => {
  if (selectedCourseId) {
    async function loadCourse() {
      const course = await fetchCourse(selectedCourseId);
      setCourse(course);
    }
    loadCourse();
  }
}, [selectedCourseId]); // При изменении selectedCourseId
```

#### 5.3. useCallback (опционально, +1 балл)

Используйте для мемоизации функций:

```jsx
import { useCallback } from 'react';

const handleSelect = useCallback((id) => {
  setSelectedCourse(id);
}, []); // Функция создаётся только один раз
```

#### 5.4. useRef (опционально, +1 балл)

Используйте для ссылок на DOM-элементы:

```jsx
import { useRef } from 'react';

const inputRef = useRef(null);

const handleFocus = () => {
  inputRef.current.focus();
};

return <input ref={inputRef} />;
```

---

### 6. Context API (опционально, +2 балла)

Создайте контекст для управления глобальным состоянием:

**Создание контекста:**
```jsx
// src/context/AppContext.jsx
import { createContext, useContext } from 'react';

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext not found');
  return ctx;
}

export default AppContext;
```

**Провайдер:**
```jsx
// App.jsx
import AppContext from './context/AppContext';

export default function App() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  
  const contextValue = {
    courses,
    setCourses,
    selectedCourse,
    setSelectedCourse,
  };
  
  return (
    <AppContext.Provider value={contextValue}>
      <CourseList />
    </AppContext.Provider>
  );
}
```

**Использование:**
```jsx
import { useApp } from './context/AppContext';

function CourseCard({ course }) {
  const { setSelectedCourse } = useApp();
  
  return (
    <button onClick={() => setSelectedCourse(course.id)}>
      {course.title}
    </button>
  );
}
```

---

### 7. Стилизация

Используйте Tailwind CSS для стилизации:

**Требования:**
- Минимум 10 различных классов Tailwind
- Адаптивный дизайн (минимум 2 breakpoint: `md:`, `lg:`)
- Hover-эффекты на интерактивных элементах
- Использование цветов, отступов, теней

**Примеры классов:**
```jsx
<div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
  <h2 className="text-2xl font-bold text-slate-900 mb-4">
    Заголовок
  </h2>
  <p className="text-slate-600 mb-4">
    Текст
  </p>
  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
    Кнопка
  </button>
</div>
```

---

### 8. Обработка событий

Реализуйте минимум **3 типа событий**:

- `onClick` — клик по кнопке/карточке
- `onChange` — изменение значения в input/select
- `onSubmit` — отправка формы

**Пример формы:**
```jsx
function SearchForm({ onSearch }) {
  const [query, setQuery] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск..."
        className="px-4 py-2 border rounded-lg"
      />
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
        Найти
      </button>
    </form>
  );
}
```

---

## Что сдать

### 1. Архив проекта (обязательно)

Архив должен содержать:
- Весь код проекта (папка `src/`)
- Файл `package.json`
- Файл `README.md` с инструкциями по запуску

**Исключите из архива:**
- `node_modules/`
- `.git/`
- `dist/` или `build/`

### 2. Скриншоты (обязательно)

**a) Скриншот работающего приложения:**
- Откройте приложение в браузере
- Должен быть виден интерфейс с данными

**b) Скриншот консоли браузера:**
- Откройте DevTools (F12)
- Покажите вкладку Console
- Не должно быть ошибок (красные сообщения)

**c) Скриншот Network (опционально, +1 балл):**
- Покажите вкладку Network в DevTools
- Должны быть видны запросы к API

### 3. Описание приложения (обязательно)

Создайте файл `DESCRIPTION.md` со следующим содержанием:

```
ОПИСАНИЕ ПРИЛОЖЕНИЯ

НАЗНАЧЕНИЕ:
[Краткое описание того, что делает приложение]

КОМПОНЕНТЫ:

1. App.jsx
   - Назначение: [главный компонент, управление состоянием]
   - Используемые хуки: [useState, useEffect, ...]
   - Состояние: [список состояний]

2. CourseList.jsx
   - Назначение: [отображение списка курсов]
   - Props: [список props]
   - Особенности: [условный рендеринг, обработка пустого списка]

3. CourseCard.jsx
   - Назначение: [отображение карточки курса]
   - Props: [список props]
   - События: [onClick, ...]

4. [Другие компоненты...]

РАБОТА С API:

- Эндпоинты: [список используемых эндпоинтов]
- Функции в utils/api.js: [список функций]
- Обработка ошибок: [как обрабатываются ошибки]

ХУКИ:

- useState: [где и для чего используется]
- useEffect: [где и для чего используется]
- useCallback: [если используется]
- useRef: [если используется]

СТИЛИЗАЦИЯ:

- Используется Tailwind CSS
- Основные классы: [примеры]
- Адаптивность: [какие breakpoints используются]
```

### 4. Инструкции по запуску (обязательно)

Создайте файл `README.md`:

```markdown
# Мой ЭОР Frontend

## Установка

```bash
npm install
```

## Запуск

```bash
npm run dev
```

Приложение откроется на http://localhost:5173

## Требования

- Node.js 16+
- npm или yarn

## API

Приложение работает с API на http://localhost:8000/api/

Для работы с API необходимо:
1. Запустить Django сервер (задание 3)
2. Авторизоваться через /admin/
```

---

## Критерии оценивания

| Критерий | Баллы | Описание |
|----------|-------|----------|
| **Установка и настройка** | 1 | Проект создан, зависимости установлены, приложение запускается |
| **Структура компонентов** | 2 | Создано минимум 4 компонента:<br>- Главный компонент (0.5)<br>- Компонент списка (0.5)<br>- Компонент карточки (0.5)<br>- Вспомогательные компоненты (0.5) |
| **Хуки** | 4 | Использованы минимум 4 разных хука:<br>- useState (минимум 3 использования) (1)<br>- useEffect (минимум 2 использования) (1.5)<br>- useCallback (опционально, +0.5)<br>- useRef (опционально, +0.5)<br>- Context API (опционально, +1) |
| **Работа с API** | 3 | Реализована работа с API:<br>- Утилита api.js с обработкой ошибок (1)<br>- Загрузка данных в useEffect (1)<br>- Обработка состояний загрузки и ошибок (1) |
| **Обработка событий** | 2 | Реализовано минимум 3 типа событий:<br>- onClick (0.5)<br>- onChange (0.5)<br>- onSubmit (0.5)<br>- Другие события (0.5) |
| **Стилизация** | 2 | Использован Tailwind CSS:<br>- Минимум 10 различных классов (0.5)<br>- Адаптивный дизайн (0.5)<br>- Hover-эффекты (0.5)<br>- Качественный дизайн (0.5) |
| **Условный рендеринг** | 1 | Использован условный рендеринг для:<br>- Состояния загрузки<br>- Состояния ошибки<br>- Пустых списков |
| **Качество кода** | 2 | Код структурирован, есть комментарии, следует best practices:<br>- Правильное именование (0.5)<br>- Комментарии и docstring (0.5)<br>- Организация файлов (0.5)<br>- Нет ошибок в консоли (0.5) |
| **Описание и документация** | 2 | Созданы файлы:<br>- DESCRIPTION.md с полным описанием (1)<br>- README.md с инструкциями (1) |
| **Скриншоты** | 1 | Приложены скриншоты:<br>- Работающего приложения (0.5)<br>- Консоли без ошибок (0.5) |
| **ИТОГО** | **20** | |

---

## Пример минимального решения

Ниже приведён пример минимального решения для справки. **Не копируйте его полностью!** Используйте как ориентир и адаптируйте под свою предметную область.

### src/utils/api.js

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
      const error = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
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

export async function fetchCourse(id) {
  return apiCall(`/api/courses/${id}/`);
}
```

### src/components/LoadingSpinner.jsx

```jsx
export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
```

### src/components/ErrorMessage.jsx

```jsx
export default function ErrorMessage({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
      <p className="text-red-800">{message}</p>
    </div>
  );
}
```

### src/components/CourseCard.jsx

```jsx
export default function CourseCard({ course, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
    >
      <h3 className="text-xl font-bold text-slate-900 mb-2">
        {course.title}
      </h3>
      <p className="text-slate-600 mb-4">
        {course.description}
      </p>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Открыть
      </button>
    </div>
  );
}
```

### src/components/CourseList.jsx

```jsx
import CourseCard from './CourseCard';

export default function CourseList({ courses, onSelectCourse }) {
  if (!courses || courses.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        Нет доступных курсов
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map(course => (
        <CourseCard
          key={course.id}
          course={course}
          onClick={() => onSelectCourse(course.id)}
        />
      ))}
    </div>
  );
}
```

### src/App.jsx

```jsx
import { useState, useEffect } from 'react';
import { fetchCourses } from './utils/api';
import CourseList from './components/CourseList';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';

export default function App() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  
  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true);
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
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return <ErrorMessage message={error} />;
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">Мой ЭОР</h1>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold mb-6">Каталог курсов</h2>
        <CourseList
          courses={courses}
          onSelectCourse={setSelectedCourse}
        />
      </main>
    </div>
  );
}
```

---

## Рекомендации

1. **Начните с простого** — сначала создайте базовую структуру, потом добавляйте функциональность
2. **Тестируйте по ходу** — после каждого компонента проверяйте, что он работает
3. **Используйте DevTools** — проверяйте консоль на ошибки
4. **Организуйте код** — разделяйте компоненты, утилиты, стили
5. **Комментируйте** — добавляйте комментарии к сложным местам

---

## Часто задаваемые вопросы

**Q: Как протестировать без API?**  
A: Создайте mock данные в виде JSON или используйте `useState` с начальными данными.

**Q: Как подключить к API из задания 3?**  
A: Убедитесь, что Django сервер запущен на `http://localhost:8000`, и используйте относительные пути `/api/...` или настройте proxy в `vite.config.js`.

**Q: Что делать, если получаю CORS ошибку?**  
A: Установите `django-cors-headers` в Django или настройте proxy в Vite.

**Q: Как добавить роутинг?**  
A: Установите `react-router-dom`: `npm install react-router-dom` (это опционально для этого задания).

**Q: Почему не работают стили Tailwind?**  
A: Убедитесь, что добавили `@tailwind` директивы в `index.css` и перезапустили dev сервер.

---

## Дополнительные задания (опционально, не оцениваются)

1. **Добавьте роутинг** — используйте React Router для навигации между страницами
2. **Добавьте форму создания** — форма для создания нового курса/модуля
3. **Добавьте поиск** — фильтрация списка по названию
4. **Добавьте пагинацию** — если данных много, разбейте на страницы
5. **Добавьте анимации** — используйте CSS transitions или библиотеку анимаций

---

**Удачи в выполнении задания!** 🚀

Если возникнут вопросы, обращайтесь к лекционному материалу или задавайте вопросы в форуме курса.
