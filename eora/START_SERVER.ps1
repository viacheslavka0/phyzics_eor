# Запуск Django сервера EORA
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Запуск Django сервера EORA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переход в директорию скрипта
Set-Location $PSScriptRoot

# Активация виртуального окружения (если есть)
if (Test-Path .venv\Scripts\activate.ps1) {
    . .venv\Scripts\activate.ps1
    Write-Host "Виртуальное окружение активировано" -ForegroundColor Green
} else {
    Write-Host "Виртуальное окружение не найдено, используем системный Python" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Запускаю сервер на http://127.0.0.1:8000/" -ForegroundColor Green
Write-Host "Для остановки нажмите Ctrl+C" -ForegroundColor Yellow
Write-Host ""

python manage.py runserver
