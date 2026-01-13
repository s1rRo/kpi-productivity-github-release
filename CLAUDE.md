# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CLAUDE.md: Инструкции для Claude Code в проекте KPI Productivity GitHub Release

## Обзор проекта
Это full-stack система для отслеживания продуктивности: мониторинг привычек, расчет KPI, командная коллаборация, аналитика и реал-тайм мониторинг. Включает backend (Node.js/Express с Prisma и PostgreSQL), frontend (React/TypeScript с Vite и Tailwind), API-гейтвей для безопасности и интерактивную документацию. Текущий статус: в разработке, с фокусом на безопасность, производительность и CI/CD.

## Цели
- Обеспечить трекинг привычек и автоматический расчет KPI.
- Поддерживать командное управление и приглашения.
- Предоставить безопасный API с rate-limiting и аутентификацией.
- Реализовать реал-тайм обновления через Socket.IO и Redis.
- Включить мониторинг (Sentry, health checks) и аналитику.
- Обеспечить простоту деплоя с Docker и PM2.

## Ключевые функции
- **Core**: Трекинг привычек, KPI-расчет, команды и приглашения.
- **API**: JWT-аутентификация, валидация ввода, rate-limiting, Helmet.js для заголовков.
- **Реал-тайм**: Socket.IO, Redis-кэширование, живые обновления.
- **Мониторинг**: Sentry для ошибок, эндпоинты /api/health и /api/health/detailed, проверки Redis.
- **Документация**: Интерактивные API-доки с живым тестированием.
- **Безопасность**: API-гейтвей как единственная точка входа, фаервол (iptables/pfctl), SSL/TLS.
- **Инфраструктура**: Docker-Compose, PM2, GitHub Actions для CI/CD.

## Структура файлов
- backend/: Node.js/Express API с Prisma и PostgreSQL.
- frontend/: React/TypeScript UI с Vite и Tailwind.
- gateway/: API-гейтвей с middleware для безопасности.
- docs/interactive/: Сервер для интерактивных доков.
- .github/workflows/: CI/CD пайплайны.
- scripts/: Скрипты для деплоя и утилит.
- docker-compose.yml: Для контейнеризации.
- ecosystem.config.js: Конфиг PM2.
- Другие: .gitignore, CHANGELOG.md, CONTRIBUTING.md, DEPLOYMENT.md, LICENSE, README.md.

## Стек технологий
- Backend: Node.js 18+, Express, Prisma, PostgreSQL 15+, Redis 7+, Socket.IO, JWT, Sentry.
- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Axios.
- Gateway: Node.js с Helmet и rate-limit.
- DevOps: Docker-Compose, PM2, iptables/pfctl, Nginx + Certbot.
- CI/CD: GitHub Actions.
- Языки: TypeScript (основной), JavaScript, Shell, Dockerfile.

## Инструкции по установке
1. Клонируй репозиторий: `git clone https://github.com/s1rRo/kpi-productivity-github-release.git && cd kpi-productivity-github-release`.
2. Установи зависимости в каждом подпроекте: `cd backend && npm ci`, аналогично для frontend, gateway и docs/interactive.
3. Скопируй .env-файлы: `cp backend/.env.example backend/.env` и заполни значения (аналогично для других).
4. Миграции БД: `cd backend && npm run db:migrate && npm run db:seed`.
5. Запуск в dev: Открой отдельные терминалы для `npm run dev` в backend (порт 3001), frontend (3000), gateway (30002), docs (3002).
6. Доступ: UI на localhost:3000, API на 3001, гейтвей на 30002.

## Workflow разработки
- Тесты: `npm test` в backend, gateway, frontend.
- Билд: `npm run build:all` или по отдельности.
- Доки: `cd docs/interactive && npm run docs:validate/update/deploy`.
- Коммиты: Используй conventional commits (feat:, fix: и т.д.).
- TypeScript: Строго следуй типизации, компилируй без ошибок.
- Тесты: >80% покрытия, добавляй для новых фич.
- Перед кодингом: Планируй шаг за шагом, проверяй логи, не удаляй файлы без подтверждения.

## Практики безопасности
- Гейтвей как единственная точка входа; блокируй другие порты.
- Фаервол: `sudo iptables -P INPUT DROP` и правила для localhost:30002.
- Заголовки: Helmet.js.
- Аутентификация: JWT на каждом запросе.
- Валидация: Санитизация ввода перед БД.
- Логи: Детализированные для аудита.
- Избегай: rm -rf, sudo; всегда deny деструктивные команды.

## Деплоймент
- Сервер (Ubuntu): Установи Node.js, PostgreSQL, Redis, Nginx.
- SSL: Certbot для домена.
- PM2: `pm2 start ecosystem.config.js`.
- Docker: `docker-compose up -d`.
- Облако: Railway, Vercel (frontend), Heroku, AWS/GCP.

## Мониторинг и health checks
- Эндпоинты: /api/health (базовый), /api/health/detailed (с БД и Redis).
- Sentry: Инициализируй с DSN в .env.
- Цели: <200ms отклик, 99.9% аптайм.

## Контрибьютинг
1. Форкни репозиторий.
2. Создай бранч: `git checkout -b feature/new-feature`.
3. Коммить с conventional messages.
4. Push и открой PR.
- Добавляй тесты, обновляй доки, следуй безопасности.

## Лицензия
MIT — см. LICENSE.

## Полезные команды
- Установка: `npm ci` в подпроектах.
- Миграции: `npm run db:migrate`.
- Dev-запуск: `npm run dev`.
- Билд: `npm run build:all`.
- Тесты: `npm test`.
- Docker: `docker-compose up -d`.
- PM2: `pm2 restart ecosystem.config.js`.
- Логи: `pm2 logs`.
