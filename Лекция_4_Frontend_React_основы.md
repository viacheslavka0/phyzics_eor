# Лекция 4: Frontend — React основы

**Цель лекции:** Освоить создание пользовательского интерфейса для ЭОР с использованием React, научиться работать с компонентами, состоянием, хуками и взаимодействовать с API.

**Продолжительность:** 90 минут

---

## План лекции

1. **Введение: что такое React и зачем он нужен** (5 мин)
2. **Структура React-приложения** (10 мин)
3. **Компоненты и JSX** (15 мин)
4. **Состояние (State) и хуки** (20 мин)
5. **Работа с API** (15 мин)
6. **Context API для управления состоянием** (10 мин)
7. **Оптимизация: lazy loading и мемоизация** (10 мин)
8. **Стилизация с Tailwind CSS** (5 мин)

---

## 1. Введение: что такое React и зачем он нужен

### 1.1. Проблема без React

В традиционных веб-приложениях мы манипулируем DOM напрямую:

```javascript
// Старый способ
const button = document.getElementById('myButton');
button.addEventListener('click', () => {
  const count = parseInt(document.getElementById('count').textContent);
  document.getElementById('count').textContent = count + 1;
});
```

**Проблемы:**
- ❌ Сложно поддерживать при росте приложения
- ❌ Легко допустить ошибки
- ❌ Много повторяющегося кода
- ❌ Сложно синхронизировать состояние и UI

### 1.2. Решение: React

**React** — библиотека для создания пользовательских интерфейсов.

**Основные принципы:**
- ✅ **Компонентный подход** — разбиваем UI на переиспользуемые компоненты
- ✅ **Декларативность** — описываем, как должен выглядеть UI, а не как его изменить
- ✅ **Однонаправленный поток данных** — данные течёт сверху вниз
- ✅ **Виртуальный DOM** — React эффективно обновляет только изменённые части

**Пример:**
```jsx
function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Счёт: {count}</p>
      <button onClick={() => setCount(count + 1)}>Увеличить</button>
    </div>
  );
}
```

### 1.3. Установка и настройка

**Создание проекта с Vite:**
```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm run dev
```

**Или с Create React App:**
```bash
npx create-react-app my-app
cd my-app
npm start
```

---

## 2. Структура React-приложения

### 2.1. Базовая структура проекта

```
ui/
├── src/
│   ├── components/      ← переиспользуемые компоненты
│   │   ├── SchemaEditor.jsx
│   │   └── ...
│   ├── App.jsx          ← главный компонент
│   ├── main.jsx         ← точка входа
│   └── index.css        ← стили
├── package.json         ← зависимости
└── vite.config.js       ← конфигурация Vite
```

### 2.2. Точка входа (main.jsx)

```jsx
// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Что происходит:**
1. Импортируем React и компонент App
2. Находим элемент с `id="root"` в HTML
3. Рендерим компонент App в этот элемент

### 2.3. Главный компонент (App.jsx)

```jsx
// App.jsx
import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <h1>Добро пожаловать в ЭОР!</h1>
    </div>
  );
}
```

---

## 3. Компоненты и JSX

### 3.1. Что такое компонент?

**Компонент** — это функция, которая возвращает JSX (JavaScript XML).

**JSX** — синтаксис, похожий на HTML, но это JavaScript.

```jsx
function Welcome() {
  return <h1>Привет, мир!</h1>;
}
```

### 3.2. Функциональные компоненты

**Функциональный компонент** — это обычная функция JavaScript:

```jsx
function CourseCard({ title, description }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

// Использование
<CourseCard 
  title="Физика" 
  description="Курс по физике для 7 класса" 
/>
```

**Особенности:**
- Имя компонента должно начинаться с заглавной буквы
- Компонент должен возвращать JSX (или `null`)
- Параметры передаются через объект `props`

### 3.3. JSX синтаксис

**Базовый JSX:**
```jsx
const element = <h1>Привет, мир!</h1>;
```

**Встроенные выражения:**
```jsx
const name = "Иван";
const element = <h1>Привет, {name}!</h1>;
```

**Атрибуты:**
```jsx
// class → className (так как class — зарезервированное слово)
<div className="container">
  <img src={imageUrl} alt="Описание" />
</div>
```

**Условный рендеринг:**
```jsx
function Greeting({ isLoggedIn }) {
  if (isLoggedIn) {
    return <h1>Добро пожаловать!</h1>;
  }
  return <h1>Пожалуйста, войдите.</h1>;
}

// Или через тернарный оператор
function Greeting({ isLoggedIn }) {
  return (
    <div>
      {isLoggedIn ? (
        <h1>Добро пожаловать!</h1>
      ) : (
        <h1>Пожалуйста, войдите.</h1>
      )}
    </div>
  );
}
```

**Списки:**
```jsx
function CourseList({ courses }) {
  return (
    <div>
      {courses.map(course => (
        <div key={course.id}>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
      ))}
    </div>
  );
}
```

**Важно:** При рендеринге списков всегда указывайте `key` с уникальным значением.

### 3.4. Обработка событий

```jsx
function Button() {
  const handleClick = () => {
    alert('Кнопка нажата!');
  };
  
  return (
    <button onClick={handleClick}>
      Нажми меня
    </button>
  );
}
```

**События:**
- `onClick` — клик мыши
- `onChange` — изменение значения (для input, select)
- `onSubmit` — отправка формы
- `onMouseEnter` — наведение мыши
- и др.

**Пример с формой:**
```jsx
function SearchForm() {
  const [query, setQuery] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault(); // Предотвратить перезагрузку страницы
    console.log('Поиск:', query);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Введите запрос"
      />
      <button type="submit">Найти</button>
    </form>
  );
}
```

### 3.5. Пример компонента из реального проекта

```jsx
function CatalogView({ catalog, onSelectKS }) {
  const [expandedClass, setExpandedClass] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  
  return (
    <div className="space-y-4">
      {catalog.map((schoolClass) => (
        <div key={schoolClass.id} className="card">
          <button
            onClick={() => setExpandedClass(
              expandedClass === schoolClass.id ? null : schoolClass.id
            )}
            className="w-full px-6 py-4 flex items-center justify-between"
          >
            <h3>{schoolClass.title}</h3>
            <span>{expandedClass === schoolClass.id ? '▼' : '▶'}</span>
          </button>
          
          {expandedClass === schoolClass.id && (
            <div className="border-t">
              {schoolClass.sections?.map((section) => (
                <div key={section.id}>
                  <h4>{section.title}</h4>
                  {section.topics?.map((topic) => (
                    <div key={topic.id}>
                      <h5>{topic.title}</h5>
                      {topic.knowledge_systems?.map((ks) => (
                        <button
                          key={ks.id}
                          onClick={() => onSelectKS(ks.id)}
                          className="btn-primary"
                        >
                          {ks.title}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Состояние (State) и хуки

### 4.1. Что такое состояние?

**Состояние (State)** — данные компонента, которые могут изменяться и вызывают перерисовку компонента.

**Без состояния:**
```jsx
function Counter() {
  return (
    <div>
      <p>Счёт: 0</p>
      <button>Увеличить</button> {/* Не работает! */}
    </div>
  );
}
```

**Со состоянием:**
```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Счёт: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Увеличить
      </button>
    </div>
  );
}
```

### 4.2. Хук useState

**useState** — хук для работы с состоянием.

**Синтаксис:**
```jsx
const [state, setState] = useState(initialValue);
```

**Параметры:**
- `initialValue` — начальное значение состояния

**Возвращает:**
- `state` — текущее значение состояния
- `setState` — функция для обновления состояния

**Примеры:**

**Простое значение:**
```jsx
const [name, setName] = useState('');
const [count, setCount] = useState(0);
const [isActive, setIsActive] = useState(false);
```

**Объект:**
```jsx
const [user, setUser] = useState({
  name: '',
  email: ''
});

// Обновление объекта
setUser({ ...user, name: 'Иван' });
```

**Массив:**
```jsx
const [items, setItems] = useState([]);

// Добавление элемента
setItems([...items, newItem]);

// Удаление элемента
setItems(items.filter(item => item.id !== idToRemove));
```

### 4.3. Хук useEffect

**useEffect** — хук для выполнения побочных эффектов (загрузка данных, подписки, таймеры).

**Синтаксис:**
```jsx
useEffect(() => {
  // Код эффекта
  return () => {
    // Очистка (опционально)
  };
}, [dependencies]);
```

**Примеры:**

**Загрузка данных при монтировании:**
```jsx
function CourseList() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchCourses() {
      try {
        const response = await fetch('/api/courses/');
        const data = await response.json();
        setCourses(data);
      } catch (error) {
        console.error('Ошибка:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCourses();
  }, []); // Пустой массив = выполнить только при монтировании
  
  if (loading) return <div>Загрузка...</div>;
  
  return (
    <div>
      {courses.map(course => (
        <div key={course.id}>{course.title}</div>
      ))}
    </div>
  );
}
```

**Загрузка данных при изменении зависимости:**
```jsx
function CourseDetail({ courseId }) {
  const [course, setCourse] = useState(null);
  
  useEffect(() => {
    async function fetchCourse() {
      const response = await fetch(`/api/courses/${courseId}/`);
      const data = await response.json();
      setCourse(data);
    }
    
    if (courseId) {
      fetchCourse();
    }
  }, [courseId]); // Выполнить при изменении courseId
  
  if (!course) return <div>Загрузка...</div>;
  
  return <div>{course.title}</div>;
}
```

**Очистка (cleanup):**
```jsx
useEffect(() => {
  const timer = setInterval(() => {
    console.log('Тик');
  }, 1000);
  
  return () => {
    clearInterval(timer); // Очистка при размонтировании
  };
}, []);
```

### 4.4. Хук useCallback

**useCallback** — мемоизирует функцию, чтобы не создавать её заново при каждом рендере.

**Проблема:**
```jsx
function Parent() {
  const [count, setCount] = useState(0);
  
  const handleClick = () => {
    console.log('Клик');
  };
  
  return <Child onClick={handleClick} />; // Новая функция при каждом рендере!
}

function Child({ onClick }) {
  // Компонент перерисовывается даже если onClick не изменился
  return <button onClick={onClick}>Кнопка</button>;
}
```

**Решение:**
```jsx
import { useCallback } from 'react';

function Parent() {
  const [count, setCount] = useState(0);
  
  const handleClick = useCallback(() => {
    console.log('Клик');
  }, []); // Функция создаётся только один раз
  
  return <Child onClick={handleClick} />;
}
```

### 4.5. Хук useRef

**useRef** — хук для хранения ссылки на DOM-элемент или значения, которое не вызывает перерисовку.

**Пример с DOM-элементом:**
```jsx
import { useRef } from 'react';

function TextInput() {
  const inputRef = useRef(null);
  
  const handleFocus = () => {
    inputRef.current.focus(); // Фокус на input
  };
  
  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onClick={handleFocus}>Фокус</button>
    </div>
  );
}
```

**Пример с значением:**
```jsx
function Timer() {
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);
  
  const start = () => {
    intervalRef.current = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
  };
  
  const stop = () => {
    clearInterval(intervalRef.current);
  };
  
  return (
    <div>
      <p>Счёт: {count}</p>
      <button onClick={start}>Старт</button>
      <button onClick={stop}>Стоп</button>
    </div>
  );
}
```

### 4.6. Пример из реального проекта

```jsx
export default function App() {
  // Состояние
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [selectedKS, setSelectedKS] = useState(null);
  const [ksData, setKsData] = useState(null);
  const [session, setSession] = useState(null);
  const [view, setView] = useState("catalog");
  
  // Загрузка каталога при монтировании
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/catalog/");
        if (!r.ok) throw new Error("Войдите в систему через /admin/");
        const data = await r.json();
        setCatalog(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  
  // Загрузка данных системы знаний при выборе
  useEffect(() => {
    if (!selectedKS) return;
    
    (async () => {
      setLoading(true);
      try {
        const ksRes = await fetch(`/api/ks/${selectedKS}/`);
        const ksJson = await ksRes.json();
        setKsData(ksJson);
        
        const sessRes = await fetch(`/api/session/current/?ks_id=${selectedKS}`);
        const sessJson = await sessRes.json();
        setSession(sessJson);
        
        setView("learning");
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKS]);
  
  // ...
}
```

---

## 5. Работа с API

### 5.1. Базовый fetch

**GET запрос:**
```jsx
useEffect(() => {
  async function fetchData() {
    try {
      const response = await fetch('/api/courses/');
      if (!response.ok) {
        throw new Error('Ошибка загрузки');
      }
      const data = await response.json();
      setCourses(data);
    } catch (error) {
      console.error('Ошибка:', error);
      setError(error.message);
    }
  }
  
  fetchData();
}, []);
```

### 5.2. POST запрос

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    const response = await fetch('/api/courses/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFCookie(), // Для Django CSRF
      },
      credentials: 'include', // Для отправки cookies
      body: JSON.stringify({
        title: formData.title,
        description: formData.description,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка создания');
    }
    
    const data = await response.json();
    console.log('Создан:', data);
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Ошибка: ' + error.message);
  }
};
```

### 5.3. Работа с CSRF токеном (Django)

```jsx
// Утилита для получения CSRF токена
const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

// Использование
const response = await fetch('/api/courses/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCSRFCookie(),
  },
  credentials: 'include',
  body: JSON.stringify(data),
});
```

### 5.4. Обработка ошибок

```jsx
async function apiCall(url, options = {}) {
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
        throw new Error('Нет доступа. Войдите как учитель через /admin/');
      }
      if (res.status === 401) {
        throw new Error('Требуется авторизация. Войдите через /admin/');
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

// Использование
useEffect(() => {
  (async () => {
    try {
      const data = await apiCall('/api/courses/');
      setCourses(data);
    } catch (error) {
      setError(error.message);
    }
  })();
}, []);
```

### 5.5. Загрузка файлов (FormData)

```jsx
const handleFileUpload = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('title', 'Название');
  
  try {
    const response = await fetch('/api/upload/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRFCookie(),
        // НЕ указываем Content-Type для FormData!
      },
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Ошибка загрузки');
    
    const data = await response.json();
    console.log('Загружено:', data);
  } catch (error) {
    console.error('Ошибка:', error);
  }
};
```

---

## 6. Context API для управления состоянием

### 6.1. Проблема prop drilling

Когда нужно передать данные через много уровней компонентов:

```jsx
function App() {
  const [user, setUser] = useState(null);
  return <Layout user={user} setUser={setUser} />;
}

function Layout({ user, setUser }) {
  return <Header user={user} setUser={setUser} />;
}

function Header({ user, setUser }) {
  return <UserMenu user={user} setUser={setUser} />;
}

function UserMenu({ user, setUser }) {
  // Наконец-то используем!
  return <div>{user.name}</div>;
}
```

### 6.2. Решение: Context API

**Создание контекста:**
```jsx
import { createContext, useContext } from 'react';

const AppContext = createContext(null);

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext not found');
  return ctx;
}
```

**Провайдер:**
```jsx
function App() {
  const [catalog, setCatalog] = useState([]);
  const [selectedKS, setSelectedKS] = useState(null);
  const [ksData, setKsData] = useState(null);
  
  const contextValue = {
    catalog,
    selectedKS,
    setSelectedKS,
    ksData,
    setKsData,
  };
  
  return (
    <AppContext.Provider value={contextValue}>
      <Layout />
    </AppContext.Provider>
  );
}
```

**Использование:**
```jsx
function UserMenu() {
  const { user, setUser } = useApp(); // Получаем из контекста
  
  return <div>{user.name}</div>;
}
```

### 6.3. Пример из реального проекта

```jsx
// Создание контекста
const AppContext = createContext(null);

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext not found');
  return ctx;
}

// Главный компонент
export default function App() {
  const [catalog, setCatalog] = useState([]);
  const [selectedKS, setSelectedKS] = useState(null);
  const [ksData, setKsData] = useState(null);
  const [session, setSession] = useState(null);
  
  const contextValue = {
    catalog,
    selectedKS,
    setSelectedKS,
    ksData,
    session,
    setSession,
    handleBackToCatalog: () => {
      setView('catalog');
      setSelectedKS(null);
      setKsData(null);
      setSession(null);
    },
  };
  
  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen">
        {view === 'catalog' ? <CatalogView /> : <LearningView />}
      </div>
    </AppContext.Provider>
  );
}

// Использование в дочернем компоненте
function LearningView() {
  const { ksData, session, handleBackToCatalog } = useApp();
  
  return (
    <div>
      <button onClick={handleBackToCatalog}>Назад</button>
      <h1>{ksData?.title}</h1>
    </div>
  );
}
```

---

## 7. Оптимизация: lazy loading и мемоизация

### 7.1. Lazy loading компонентов

**Проблема:** Все компоненты загружаются сразу, даже если они не используются.

**Решение:** Lazy loading — загрузка компонента только когда он нужен.

```jsx
import { lazy, Suspense } from 'react';

// Обычный импорт (загружается сразу)
// import SchemaEditor from './components/SchemaEditor';

// Lazy loading (загружается только при использовании)
const SchemaEditor = lazy(() => import('./components/SchemaEditor'));

function App() {
  const [showEditor, setShowEditor] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowEditor(true)}>
        Открыть редактор
      </button>
      
      {showEditor && (
        <Suspense fallback={<div>Загрузка редактора...</div>}>
          <SchemaEditor />
        </Suspense>
      )}
    </div>
  );
}
```

**Преимущества:**
- ✅ Уменьшает размер начального бандла
- ✅ Ускоряет первую загрузку страницы
- ✅ Загружает компоненты по требованию

### 7.2. Мемоизация с useMemo

**useMemo** — мемоизирует вычисляемое значение.

**Проблема:**
```jsx
function ExpensiveComponent({ items }) {
  // Это вычисление выполняется при каждом рендере
  const expensiveValue = items.reduce((sum, item) => sum + item.value, 0);
  
  return <div>{expensiveValue}</div>;
}
```

**Решение:**
```jsx
import { useMemo } from 'react';

function ExpensiveComponent({ items }) {
  // Вычисление выполняется только при изменении items
  const expensiveValue = useMemo(() => {
    return items.reduce((sum, item) => sum + item.value, 0);
  }, [items]);
  
  return <div>{expensiveValue}</div>;
}
```

### 7.3. Пример из реального проекта

```jsx
import { lazy, Suspense } from 'react';

// Lazy loading тяжёлых компонентов
const SchemaEditor = lazy(() => import('./components/SchemaEditor'));
const ElementCreatorVisual = lazy(() => import('./components/ElementCreatorVisual'));

function TaskEditor() {
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowSchemaEditor(true)}>
        Открыть редактор схем
      </button>
      
      {showSchemaEditor && (
        <Suspense fallback={
          <div className="flex items-center justify-center p-8">
            <div className="text-slate-500">Загрузка редактора...</div>
          </div>
        }>
          <SchemaEditor />
        </Suspense>
      )}
    </div>
  );
}
```

---

## 8. Стилизация с Tailwind CSS

### 8.1. Что такое Tailwind CSS?

**Tailwind CSS** — utility-first CSS фреймворк. Вместо написания CSS в отдельных файлах, используем классы прямо в JSX.

**Традиционный подход:**
```css
/* styles.css */
.card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

```jsx
<div className="card">Контент</div>
```

**Tailwind подход:**
```jsx
<div className="bg-white rounded-lg p-4 shadow-sm">
  Контент
</div>
```

### 8.2. Основные классы Tailwind

**Цвета:**
```jsx
<div className="bg-blue-500 text-white">Синий фон, белый текст</div>
<div className="text-slate-600">Серый текст</div>
```

**Отступы:**
```jsx
<div className="p-4">padding: 1rem</div>
<div className="m-2">margin: 0.5rem</div>
<div className="px-6 py-4">padding: 1rem 1.5rem</div>
```

**Размеры:**
```jsx
<div className="w-full h-64">Ширина 100%, высота 16rem</div>
<div className="max-w-6xl mx-auto">Максимальная ширина, центрирование</div>
```

**Flexbox:**
```jsx
<div className="flex items-center justify-between">
  <div>Лево</div>
  <div>Право</div>
</div>
```

**Адаптивность:**
```jsx
<div className="w-full md:w-1/2 lg:w-1/3">
  Адаптивная ширина
</div>
```

### 8.3. Пример из реального проекта

```jsx
function CourseCard({ course, onSelect }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
      <h3 className="text-xl font-bold text-slate-900 mb-2">
        {course.title}
      </h3>
      <p className="text-slate-600 mb-4">
        {course.description}
      </p>
      <button
        onClick={() => onSelect(course.id)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Выбрать
      </button>
    </div>
  );
}
```

---

## Практические рекомендации

### 1. Организация компонентов

**Структура:**
```
src/
├── components/        ← переиспользуемые компоненты
│   ├── CourseCard.jsx
│   ├── LoadingSpinner.jsx
│   └── ErrorMessage.jsx
├── pages/            ← страницы (опционально)
│   ├── CatalogPage.jsx
│   └── LearningPage.jsx
├── hooks/            ← кастомные хуки (опционально)
│   └── useApi.js
├── utils/            ← утилиты
│   └── api.js
└── App.jsx
```

### 2. Именование

- **Компоненты:** PascalCase (`CourseCard`, `LearningView`)
- **Функции:** camelCase (`handleClick`, `fetchData`)
- **Константы:** UPPER_SNAKE_CASE (`API_BASE_URL`)

### 3. Разделение ответственности

- **Компоненты** — только отображение и обработка событий
- **Хуки** — логика работы с состоянием
- **Утилиты** — вспомогательные функции

### 4. Обработка ошибок

Всегда обрабатывайте ошибки при работе с API:

```jsx
useEffect(() => {
  (async () => {
    try {
      const data = await apiCall('/api/courses/');
      setCourses(data);
    } catch (error) {
      setError(error.message);
      // Показать уведомление пользователю
    }
  })();
}, []);
```

### 5. Загрузочные состояния

Всегда показывайте индикатор загрузки:

```jsx
if (loading) {
  return <LoadingSpinner />;
}

if (error) {
  return <ErrorMessage message={error} />;
}

return <Content data={data} />;
```

---

## Итоги

1. **React** — библиотека для создания UI с компонентным подходом
2. **Компоненты** — функции, возвращающие JSX
3. **Хуки** — `useState`, `useEffect`, `useCallback`, `useRef` для работы с состоянием и эффектами
4. **API** — работа через `fetch` с обработкой ошибок
5. **Context API** — для передачи данных без prop drilling
6. **Lazy loading** — для оптимизации загрузки
7. **Tailwind CSS** — utility-first CSS фреймворк

**Следующий шаг:** Интеграция Frontend и Backend, создание полноценного приложения.

---

## Вопросы для самопроверки

1. В чём разница между функциональным и классовым компонентом?
2. Когда использовать `useEffect` с пустым массивом зависимостей?
3. Как передать данные от родителя к ребёнку? А от ребёнка к родителю?
4. Зачем нужен `key` при рендеринге списков?
5. Что такое Context API и когда его использовать?
6. Как работает lazy loading в React?

---

## Дополнительные ресурсы

- [Официальная документация React](https://react.dev/)
- [React Hooks API Reference](https://react.dev/reference/react)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/)
