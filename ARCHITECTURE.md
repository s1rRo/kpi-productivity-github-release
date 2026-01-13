# KPI Productivity System - Архитектура

## Общая архитектура системы

```mermaid
graph TB
    subgraph "Клиент"
        Browser[Браузер пользователя]
    end

    subgraph "Внешний доступ"
        Nginx[Nginx + SSL/TLS<br/>Port 443]
    end

    subgraph "Безопасность"
        Gateway[API Gateway<br/>Port 30002<br/>- Rate Limiting<br/>- Helmet.js<br/>- JWT Validation]
    end

    subgraph "Приложения"
        Frontend[React Frontend<br/>Port 3000<br/>- TypeScript<br/>- Vite<br/>- Tailwind CSS]
        Backend[Node.js Backend<br/>Port 3001<br/>- Express.js<br/>- Prisma ORM<br/>- Socket.IO]
        Docs[Интерактивная документация<br/>Port 3002]
    end

    subgraph "Базы данных"
        PostgreSQL[(PostgreSQL 15+<br/>Port 5432<br/>Основная БД)]
        Redis[(Redis 7+<br/>Port 6379<br/>Кэш и сессии)]
    end

    subgraph "Мониторинг"
        Sentry[Sentry<br/>Error Tracking]
    end

    subgraph "Управление процессами"
        PM2[PM2 Process Manager<br/>- Кластеризация<br/>- Auto-restart<br/>- Логи]
    end

    Browser -->|HTTPS| Nginx
    Nginx -->|Proxy| Gateway
    Gateway -->|API Requests| Backend
    Gateway -->|Static Files| Frontend
    Gateway -->|Docs Access| Docs

    Backend -->|SQL Queries| PostgreSQL
    Backend -->|Cache/Sessions| Redis
    Backend -->|Socket.IO| Redis
    Backend -->|Error Logs| Sentry

    Frontend -->|WebSocket| Backend

    PM2 -.Manages.-> Backend
    PM2 -.Manages.-> Gateway

    style Gateway fill:#ff6b6b
    style Backend fill:#4ecdc4
    style Frontend fill:#45b7d1
    style PostgreSQL fill:#95e1d3
    style Redis fill:#f38181
```

## Поток данных

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant Nginx as Nginx
    participant GW as Gateway
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant Cache as Redis
    participant Sentry as Sentry

    User->>Nginx: HTTPS Request
    Nginx->>GW: Proxy to localhost:30002

    alt Static Content
        GW->>FE: Serve React App
        FE->>User: HTML/CSS/JS
    else API Request
        GW->>GW: Rate Limiting Check
        GW->>GW: Security Headers
        GW->>BE: Forward API Request

        BE->>Cache: Check Cache
        alt Cache Hit
            Cache-->>BE: Return Cached Data
        else Cache Miss
            BE->>DB: Query Database
            DB-->>BE: Return Data
            BE->>Cache: Update Cache
        end

        BE->>Sentry: Log Errors (if any)
        BE-->>GW: API Response
        GW-->>User: JSON Response
    end

    Note over User,BE: WebSocket для реал-тайм обновлений
    User->>BE: WebSocket Connection
    BE->>Cache: Subscribe to Redis Pub/Sub
    Cache-->>BE: Real-time Events
    BE-->>User: Push Updates
```

## Структура компонентов

```mermaid
graph LR
    subgraph "Backend Components"
        API[API Routes]
        Auth[Authentication<br/>JWT]
        WS[WebSocket Handler<br/>Socket.IO]
        Services[Business Logic<br/>Services]
        Prisma[Prisma ORM]

        API --> Auth
        API --> Services
        WS --> Services
        Services --> Prisma
    end

    subgraph "Frontend Components"
        Routes[React Router]
        Pages[Pages/Views]
        Components[UI Components]
        State[State Management]
        API_Client[Axios Client]

        Routes --> Pages
        Pages --> Components
        Pages --> State
        State --> API_Client
    end

    subgraph "Gateway Components"
        RateLimit[Rate Limiter]
        Helmet[Security Headers]
        Proxy[Proxy Middleware]
        Logger[Access Logger]

        RateLimit --> Helmet
        Helmet --> Proxy
        Proxy --> Logger
    end
```

## Схема безопасности

```mermaid
graph TB
    Internet[Интернет]

    subgraph "Firewall Layer"
        IPTables[iptables/pfctl<br/>- DROP all INPUT by default<br/>- ALLOW localhost<br/>- ALLOW port 443<br/>- ALLOW port 30002 from localhost only]
    end

    subgraph "SSL/TLS Layer"
        Certbot[Let's Encrypt SSL<br/>- Auto-renewal<br/>- HTTPS only]
    end

    subgraph "Application Security"
        GatewaySec[API Gateway Security<br/>- Rate Limiting: 100 req/15min<br/>- Helmet.js headers<br/>- CORS policy<br/>- Input validation]

        BackendSec[Backend Security<br/>- JWT Authentication<br/>- Password hashing: bcrypt<br/>- SQL injection protection: Prisma<br/>- XSS protection<br/>- Request validation]
    end

    Internet -->|HTTPS Only| IPTables
    IPTables -->|Port 443| Certbot
    Certbot -->|SSL Terminated| GatewaySec
    GatewaySec -->|localhost only| BackendSec

    style IPTables fill:#ff6b6b
    style Certbot fill:#feca57
    style GatewaySec fill:#ff9ff3
    style BackendSec fill:#48dbfb
```

## Схема деплоймента

```mermaid
graph TB
    subgraph "Development"
        DevLocal[Local Development<br/>npm run dev]
    end

    subgraph "Version Control"
        GitHub[GitHub Repository<br/>main, feature branches]
    end

    subgraph "CI/CD"
        Actions[GitHub Actions<br/>- Linting<br/>- Tests<br/>- Build<br/>- Security Audit]
    end

    subgraph "Deployment Options"
        Docker[Docker Compose<br/>docker-compose up -d]
        PM2Deploy[PM2 Deployment<br/>ecosystem.config.js]
        Cloud[Cloud Platforms<br/>Railway/Vercel/Heroku]
    end

    subgraph "Production Server"
        ProdNginx[Nginx]
        ProdPM2[PM2 Cluster]
        ProdDB[PostgreSQL]
        ProdRedis[Redis]
    end

    subgraph "Monitoring"
        Logs[Logs<br/>PM2 + Application]
        Health[Health Checks<br/>/health endpoints]
        SentryProd[Sentry<br/>Error Tracking]
    end

    DevLocal -->|git push| GitHub
    GitHub -->|Trigger| Actions
    Actions -->|Success| Docker
    Actions -->|Success| PM2Deploy
    Actions -->|Success| Cloud

    Docker --> ProdNginx
    PM2Deploy --> ProdPM2

    ProdNginx --> ProdPM2
    ProdPM2 --> ProdDB
    ProdPM2 --> ProdRedis

    ProdPM2 --> Logs
    ProdPM2 --> Health
    ProdPM2 --> SentryProd
```

## Технологический стек по уровням

```mermaid
graph TB
    subgraph "Frontend Layer"
        React[React 18<br/>TypeScript]
        Vite[Vite Build Tool]
        Tailwind[Tailwind CSS]
        Router[React Router]
        Axios[Axios HTTP Client]
    end

    subgraph "Backend Layer"
        Express[Express.js]
        Prisma[Prisma ORM]
        SocketIO[Socket.IO]
        JWT[JWT Auth]
        Bcrypt[Bcrypt Password]
    end

    subgraph "Database Layer"
        Postgres[PostgreSQL 15+<br/>Relational DB]
        RedisDB[Redis 7+<br/>Cache & Pub/Sub]
    end

    subgraph "Infrastructure Layer"
        NodeJS[Node.js 18+]
        Docker[Docker & Docker Compose]
        PM2Service[PM2 Process Manager]
        NginxWeb[Nginx Web Server]
    end

    subgraph "Security Layer"
        Helmet[Helmet.js]
        RateLimiter[Express Rate Limit]
        Firewall[iptables/pfctl]
        SSL[Let's Encrypt SSL]
    end

    React --> Express
    Express --> Prisma
    Prisma --> Postgres
    Express --> RedisDB
    SocketIO --> RedisDB

    NodeJS -.Runtime.-> Express
    NodeJS -.Runtime.-> React
    Docker -.Container.-> NodeJS
    PM2Service -.Manages.-> NodeJS
    NginxWeb -.Proxy.-> Express

    Firewall -.Protects.-> NginxWeb
    SSL -.Secures.-> NginxWeb
    Helmet -.Secures.-> Express
    RateLimiter -.Protects.-> Express
```

## Порты и доступ

| Сервис | Порт | Доступ | Описание |
|--------|------|--------|----------|
| Nginx | 443 | Внешний | HTTPS вход (production) |
| Nginx | 80 | Внешний | HTTP редирект на HTTPS |
| Gateway | 30002 | localhost only | Единственная точка входа |
| Frontend | 3000 | localhost only | React dev server |
| Backend | 3001 | localhost only | API server |
| Docs | 3002 | localhost only | Documentation server |
| PostgreSQL | 5432 | localhost only | Database |
| Redis | 6379 | localhost only | Cache & sessions |

## Особенности безопасности

### 1. Сетевая изоляция
- ✅ Только Gateway (port 30002) доступен через localhost
- ✅ Все остальные порты заблокированы firewall
- ✅ Nginx проксирует на Gateway
- ✅ SSL/TLS для внешних соединений

### 2. Application Security
- ✅ JWT authentication на всех API endpoints
- ✅ Rate limiting: 100 запросов за 15 минут
- ✅ Helmet.js для security headers
- ✅ Input validation на всех входящих данных
- ✅ SQL injection protection через Prisma ORM
- ✅ XSS protection
- ✅ CORS политика

### 3. Мониторинг и логирование
- ✅ Sentry для отслеживания ошибок
- ✅ Детальные access logs
- ✅ Health check endpoints
- ✅ Redis и PostgreSQL мониторинг

## Схема масштабирования

```mermaid
graph TB
    subgraph "Horizontal Scaling"
        LB[Load Balancer<br/>Nginx]
        GW1[Gateway Instance 1]
        GW2[Gateway Instance 2]
        BE1[Backend Instance 1]
        BE2[Backend Instance 2]
        BE3[Backend Instance 3]
    end

    subgraph "Data Layer"
        Primary[(PostgreSQL Primary)]
        Replica1[(PostgreSQL Replica 1)]
        RedisCluster[Redis Cluster<br/>3 masters + 3 replicas]
    end

    subgraph "Cache Layer"
        CDN[CDN<br/>Static Assets]
    end

    LB --> GW1
    LB --> GW2
    GW1 --> BE1
    GW1 --> BE2
    GW2 --> BE2
    GW2 --> BE3

    BE1 --> Primary
    BE2 --> Replica1
    BE3 --> Replica1

    BE1 --> RedisCluster
    BE2 --> RedisCluster
    BE3 --> RedisCluster

    LB --> CDN
```

## Производительность

### Целевые метрики
- **Response Time**: < 200ms средний ответ API
- **Uptime**: 99.9% доступность
- **Concurrent Users**: 1000+ одновременных пользователей
- **Database**: < 100ms на запрос
- **Cache Hit Rate**: > 80%

### PM2 Кластеризация
- **Backend**: max instances (по числу CPU cores)
- **Gateway**: 2 instances
- **Auto-restart**: при сбое или превышении памяти
- **Max Memory**: 1GB для backend, 512MB для gateway

## Ключевые эндпоинты

### Backend API
- `POST /api/auth/login` - Аутентификация
- `POST /api/auth/register` - Регистрация
- `GET /api/habits` - Получить привычки
- `POST /api/habits` - Создать привычку
- `GET /api/kpi` - Расчет KPI
- `GET /api/teams` - Команды
- `GET /api/health` - Health check
- `GET /api/health/detailed` - Детальный health check

### Gateway
- `GET /health` - Gateway health
- `*` - Proxy к backend/frontend

### WebSocket Events
- `habit:created` - Новая привычка создана
- `habit:updated` - Привычка обновлена
- `kpi:calculated` - KPI пересчитан
- `team:updated` - Команда обновлена

## Требования к окружению

### Development
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- npm или yarn

### Production
- Ubuntu 20.04+ или аналогичный Linux
- Node.js 18+
- PostgreSQL 15+ с репликацией
- Redis 7+ cluster
- Nginx с SSL
- PM2 для process management
- Docker (опционально)
- Minimum 2GB RAM, 2 CPU cores

---

**Создано для**: KPI Productivity GitHub Release
**Версия**: 1.0.0
**Дата**: 2026-01-13
