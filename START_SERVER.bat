@echo off
echo ========================================
echo Запуск Django сервера EORA
echo ========================================
echo.

cd /d "%~dp0"

REM Активация виртуального окружения (если есть)
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
    echo Виртуальное окружение активировано
) else (
    echo Виртуальное окружение не найдено, используем системный Python
)

echo.
echo Запускаю сервер на http://127.0.0.1:8000/
echo Для остановки нажмите Ctrl+C
echo.

python manage.py runserver

pause
