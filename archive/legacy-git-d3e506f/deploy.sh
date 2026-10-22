#!/bin/bash

# Обновляем код из репозитория
git pull

# Устанавливаем зависимости
npm install

# Создаем необходимые директории
mkdir -p www/dist
mkdir -p www/dist/img

# Копируем ассеты
cp -r www/img/* www/dist/img/

# Собираем CSS
npm run css

# Перезапускаем сервер (предполагая, что вы используете pm2)
pm2 restart timer  # замените 'timer' на имя вашего процесса в pm2