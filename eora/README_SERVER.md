# Как запустить сервер EORA

## Способ 1: Через готовый скрипт (самый простой)

### Windows (двойной клик):
1. Откройте папку `C:\physics\eora`
2. Дважды кликните на файл **`START_SERVER.bat`**
3. Откроется окно командной строки с запущенным сервером
4. Сервер будет работать, пока окно открыто
5. Для остановки нажмите `Ctrl+C` или закройте окно

### Windows PowerShell:
1. Откройте PowerShell в папке `C:\physics\eora`
2. Выполните: `.\START_SERVER.ps1`

---

## Способ 2: Вручную через командную строку

### Шаг 1: Откройте командную строку или PowerShell
- Нажмите `Win + R`, введите `cmd` или `powershell`, нажмите Enter
- Или откройте PowerShell из меню Пуск

### Шаг 2: Перейдите в папку проекта
```bash
cd C:\physics\eora
```

### Шаг 3: Активируйте виртуальное окружение (если есть)
```bash
# Для cmd:
.venv\Scripts\activate.bat

# Для PowerShell:
.venv\Scripts\activate.ps1
```

**Если виртуального окружения нет** - пропустите этот шаг, будет использован системный Python.

### Шаг 4: Запустите сервер
```bash
python manage.py runserver
```

### Шаг 5: Откройте браузер
- Интерфейс ученика: http://127.0.0.1:8000/app/
- Интерфейс учителя: http://127.0.0.1:8000/teacher/
- Админка: http://127.0.0.1:8000/admin/

### Шаг 6: Остановка сервера
- Нажмите `Ctrl+C` в окне командной строки
- Или просто закройте окно

---

## Почему сервер может не запускаться?

### Проблема 1: Порт 8000 уже занят
**Ошибка:** `Error: That port is already in use`

**Решение:**
```bash
# Используйте другой порт:
python manage.py runserver 8001
# Или найдите и закройте процесс, использующий порт 8000
```

### Проблема 2: Python не найден
**Ошибка:** `'python' is not recognized as an internal or external command`

**Решение:**
- Установите Python с https://www.python.org/
- Или используйте `py` вместо `python`:
  ```bash
  py manage.py runserver
  ```

### Проблема 3: Ошибки в коде
**Ошибка:** Различные ошибки при запуске

**Решение:**
```bash
# Проверьте код на ошибки:
python manage.py check

# Примените миграции (если нужно):
python manage.py migrate
```

### Проблема 4: Виртуальное окружение не активируется
**Ошибка:** `cannot be loaded because running scripts is disabled`

**Решение для PowerShell:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Проверка, что сервер работает

После запуска вы должны увидеть:
```
Watching for file changes with StatReloader
Performing system checks...
System check identified no issues (0 silenced).
Django version X.X.X, using settings 'eora.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

Если видите это сообщение - сервер работает! ✅

---

## Полезные команды

```bash
# Проверка кода на ошибки
python manage.py check

# Применение миграций БД
python manage.py migrate

# Создание суперпользователя (для админки)
python manage.py createsuperuser

# Запуск на другом порту
python manage.py runserver 8080

# Запуск на всех интерфейсах (доступ из сети)
python manage.py runserver 0.0.0.0:8000
```

---

## Важно!

- **Сервер должен работать постоянно**, пока вы работаете с приложением
- **Не закрывайте окно** командной строки, пока работаете
- **Для остановки** нажмите `Ctrl+C` (не просто закройте окно)
- **После изменений в коде** сервер перезагрузится автоматически (если DEBUG=True)
