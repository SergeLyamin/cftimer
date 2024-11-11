#!/bin/bash

# Остановить выполнение скрипта при ошибках
set -e

echo "Деплой начался..."

# Переходим в директорию проекта
cd /home/timer/timer.lyamin.org/www

# Проверяем права доступа
if [ ! -w "." ]; then
    echo "Ошибка: нет прав на запись в директорию"
    exit 1
fi

# Получаем последние изменения
git pull origin main

# Устанавливаем зависимости
npm install --production

# Проверяем установлен ли PM2
if ! command -v pm2 &> /dev/null; then
    echo "Устанавливаем PM2..."
    npm install -g pm2
fi

# Перезапускаем приложение через PM2
pm2 restart ecosystem.config.js --env production

echo "Деплой завершен успешно!" 