# Deployment and Configuration Guide

## Overview

This comprehensive guide covers the deployment and configuration of the KPI Productivity application across different environments (development, staging, and production). The application consists of three main components: Gateway, Backend API, and Frontend, each with specific deployment requirements and configurations.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Configuration](#environment-configuration)
3. [Development Setup](#development-setup)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Database Configuration](#database-configuration)
7. [Security Configuration](#security-configuration)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance and Updates](#maintenance-and-updates)

## Architecture Overview

### Application Components

```mermaid
graph TB
    subgraph "External Access"
        Client[Client Applications]
        Browser[Web Browser]
    end
    
    subgraph "Security Gateway - Port 30002"
        Gateway[API Gateway/Proxy]
        Auth[Authentication Layer]
        RateLimit[Rate Limiting]
    end
    
    subgraph "Application Services"
        Backend[Backend API :3001]
        Frontend[Frontend :3000]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL Database)]
        Redis[(Redis Cache)]
    end
    
    subgraph "External Services"
        Sentry[Sentry Monitoring]
        Email[SMTP Email Service]
    end
    
    Client --> Gateway
    Browser --> Gateway
    Gateway --> Backend
    Gateway --> Frontend
    Backend --> DB
    Backend --> Redis
    Backend --> Sentry
    Backend --> Email
```

### Deployment Platforms

- **Gateway**: Self-hosted or containerized
- **Backend**: Railway.app (recommended) or self-hosted
- **Frontend**: Vercel (recommended) or self-hosted
- **Database**: Railway PostgreSQL or external provider
- **Redis**: Railway Redis or external provider

## Environment Configuration

### Environment Types

#### Development Environment
- **Purpose**: Local development and testing
- **Database**: Local PostgreSQL or SQLite
- **Redis**: Optional (local Redis or disabled)
- **Security**: Relaxed CORS, detailed error messages
- **Monitoring**: Optional

#### Staging Environment
- **Purpose**: Pre-production testing and QA
- **Database**: Staging PostgreSQL database
- **Redis**: Optional (can be disabled for testing)
- **Security**: Production-like security with test data
- **Monitoring**: Enabled with staging environment tags

#### Production Environment
- **Purpose**: Live application serving real users
- **Database**: Production PostgreSQL with backups
- **Redis**: Required for real-time features
- **Security**: Full security hardening
- **Monitoring**: Comprehensive monitoring and alerting

### Environment Variables

#### Backend Environment Variables

```bash
# Core Configuration
NODE_ENV=production                    # Environment: development, staging, production
PORT=3001                             # Server port
DATABASE_URL=postgresql://...         # PostgreSQL connection string
JWT_SECRET=your-super-secret-key      # JWT signing secret (min 32 chars)
JWT_EXPIRES_IN=7d                     # JWT token expiration
CORS_ORIGIN=https://yourdomain.com    # Frontend URL for CORS

# Redis Configuration
REDIS_URL=redis://localhost:6379      # Redis connection string
REDIS_PASSWORD=your-redis-password    # Redis password (if required)
REDIS_USERNAME=your-redis-username    # Redis username (if required)
REDIS_DB=0                           # Redis database number
REDIS_REQUIRED=true                  # Whether Redis is required (true for production)

# Email Service
SMTP_HOST=smtp.gmail.com             # SMTP server hostname
SMTP_PORT=587                        # SMTP port
SMTP_SECURE=false                    # Use SSL (true for port 465)
SMTP_USER=your-email@gmail.com       # SMTP username
SMTP_PASS=your-app-password          # SMTP password or app password
SMTP_FROM=noreply@yourdomain.com     # From address for emails
APP_NAME=KPI Productivity            # Application name for emails
FRONTEND_URL=https://yourdomain.com  # Frontend URL for email links

# Monitoring
SENTRY_DSN=https://...@sentry.io/... # Sentry DSN for error tracking
SENTRY_ENVIRONMENT=production        # Sentry environment tag

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000          # Rate limit window (15 minutes)
RATE_LIMIT_MAX_REQUESTS=100          # Max requests per window

# Health Checks
HEALTH_CHECK_ENABLED=true            # Enable health check endpoints
HEALTH_CHECK_REDIS=true              # Include Redis in health checks
HEALTH_CHECK_DATABASE=true           # Include database in health checks
```

#### Frontend Environment Variables

```bash
# API Configuration
VITE_API_URL=https://api.yourdomain.com/api  # Backend API URL

# Monitoring
VITE_SENTRY_DSN=https://...@sentry.io/...    # Sentry DSN for frontend errors
VITE_SENTRY_ENVIRONMENT=production           # Sentry environment tag

# Analytics
VITE_MIXPANEL_TOKEN=your-mixpanel-token      # Mixpanel analytics token
VITE_ENABLE_ANALYTICS=true                   # Enable analytics tracking
VITE_ENABLE_ERROR_REPORTING=true             # Enable error reporting

# App Configuration
VITE_APP_VERSION=1.0.0                       # Application version
VITE_DEBUG_MODE=false                        # Debug mode (false for production)
```

#### Gateway Environment Variables

```bash
# Gateway Configuration
GATEWAY_PORT=30002                    # Gateway port (only exposed port)
GATEWAY_HOST=localhost                # Gateway host

# Service URLs
BACKEND_URL=http://localhost:3001     # Backend service URL
FRONTEND_URL=http://localhost:3000    # Frontend service URL

# Security
RATE_LIMIT_WINDOW_MS=900000           # Rate limit window
RATE_LIMIT_MAX_REQUESTS=100           # Max requests per window

# Logging
LOG_LEVEL=info                        # Log level: debug, info, warn, error
```

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (or Docker)
- Redis 6+ (optional for development)
- Git

### Local Development Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/your-org/kpi-productivity-2026.git
   cd kpi-productivity-2026
   ```

2. **Install Dependencies**
   ```bash
   npm run install:all
   ```

3. **Database Setup**
   ```bash
   # Create local database
   createdb kpi_productivity
   
   # Copy environment files
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp gateway/.env.example gateway/.env
   
   # Update DATABASE_URL in backend/.env
   # DATABASE_URL="postgresql://username:password@localhost:5432/kpi_productivity"
   ```

4. **Database Migration**
   ```bash
   cd backend
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. **Start Development Servers**
   ```bash
   # Start all services
   npm run dev
   
   # Or start individually
   npm run dev:gateway    # Gateway on port 30002
   npm run dev:backend    # Backend on port 3001
   npm run dev:frontend   # Frontend on port 3000
   ```

6. **Verify Setup**
   ```bash
   # Check health endpoints
   curl http://localhost:30002/api/health
   curl http://localhost:3001/health
   curl http://localhost:3000
   ```

### Development Environment Configuration

#### Backend Development (.env)
```bash
NODE_ENV=development
DATABASE_URL="postgresql://username:password@localhost:5432/kpi_productivity"
JWT_SECRET="development-secret-key-change-in-production"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
REDIS_REQUIRED="false"
SENTRY_ENVIRONMENT="development"
FRONTEND_URL="http://localhost:3000"
```

#### Frontend Development (.env)
```bash
VITE_API_URL=http://localhost:3001/api
VITE_SENTRY_ENVIRONMENT=development
VITE_DEBUG_MODE=true
VITE_ENABLE_ANALYTICS=false
```

## Staging Deployment

### Staging Environment Setup

Staging environment mirrors production but uses separate databases and services for testing.

#### Railway Staging Configuration

1. **Create Staging Project**
   ```bash
   # Create new Railway project for staging
   railway login
   railway init kpi-productivity-staging
   ```

2. **Configure Staging Variables**
   ```bash
   # Set staging environment variables
   railway variables set NODE_ENV=staging
   railway variables set DATABASE_URL=$STAGING_DATABASE_URL
   railway variables set JWT_SECRET=$STAGING_JWT_SECRET
   railway variables set CORS_ORIGIN=$STAGING_FRONTEND_URL
   railway variables set REDIS_REQUIRED=false
   railway variables set SENTRY_ENVIRONMENT=staging
   ```

3. **Deploy to Staging**
   ```bash
   # Deploy backend to Railway staging
   railway up
   
   # Or use deployment script
   npm run deploy:staging
   ```

#### Vercel Staging Configuration

1. **Create Staging Project**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Create staging project
   vercel --name kpi-productivity-staging
   ```

2. **Configure Staging Environment**
   ```bash
   # Set staging environment variables
   vercel env add VITE_API_URL
   # Enter: https://kpi-backend-staging.railway.app/api
   
   vercel env add VITE_SENTRY_ENVIRONMENT
   # Enter: staging
   ```

3. **Deploy Frontend**
   ```bash
   # Deploy to staging
   vercel --prod
   ```

### Staging Deployment Script

The staging deployment script (`scripts/deploy-staging.sh`) automates the deployment process:

```bash
# Run staging deployment
./scripts/deploy-staging.sh
```

**Script Features:**
- Health check validation
- API endpoint testing
- Smoke tests for critical functionality
- Environment validation
- Deployment status notifications

### Staging Testing

After deployment, run comprehensive tests:

```bash
# Backend health checks
curl https://kpi-backend-staging.railway.app/health
curl https://kpi-backend-staging.railway.app/health/database
curl https://kpi-backend-staging.railway.app/health/redis

# Frontend accessibility
curl https://kpi-staging.vercel.app

# API functionality tests
curl -X POST https://kpi-backend-staging.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}'
```

## Production Deployment

### Production Environment Requirements

#### Infrastructure Requirements
- **Database**: PostgreSQL 14+ with automated backups
- **Redis**: Redis 6+ with persistence enabled
- **SSL/TLS**: Valid SSL certificates for all domains
- **CDN**: Content delivery network for static assets
- **Monitoring**: Comprehensive monitoring and alerting
- **Backup**: Automated database and file backups

#### Security Requirements
- **HTTPS**: All traffic must use HTTPS
- **Environment Variables**: Secure storage of secrets
- **Access Control**: Limited access to production systems
- **Audit Logging**: Comprehensive audit trails
- **Rate Limiting**: Protection against abuse
- **CORS**: Strict CORS configuration

### Production Deployment Process

#### 1. Pre-deployment Checklist

```bash
# Verify staging deployment
./scripts/deploy-staging.sh

# Run comprehensive tests
cd backend && npm run test
cd frontend && npm run test

# Security audit
npm audit --audit-level high

# Performance testing
cd backend && npm run test:performance
```

#### 2. Database Migration

```bash
# Backup production database
pg_dump $PRODUCTION_DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Run migrations
cd backend
NODE_ENV=production npm run db:migrate:prod
```

#### 3. Backend Deployment (Railway)

```bash
# Set production environment variables
railway variables set NODE_ENV=production
railway variables set DATABASE_URL=$PRODUCTION_DATABASE_URL
railway variables set JWT_SECRET=$PRODUCTION_JWT_SECRET
railway variables set REDIS_URL=$PRODUCTION_REDIS_URL
railway variables set REDIS_REQUIRED=true
railway variables set CORS_ORIGIN=$PRODUCTION_FRONTEND_URL
railway variables set SENTRY_DSN=$PRODUCTION_SENTRY_DSN
railway variables set SENTRY_ENVIRONMENT=production

# Deploy to production
railway up --detach
```

#### 4. Frontend Deployment (Vercel)

```bash
# Set production environment variables
vercel env add VITE_API_URL production
# Enter: https://kpi-backend.railway.app/api

vercel env add VITE_SENTRY_DSN production
# Enter: your-production-sentry-dsn

vercel env add VITE_SENTRY_ENVIRONMENT production
# Enter: production

# Deploy to production
vercel --prod
```

#### 5. Gateway Deployment

```bash
# Deploy gateway (self-hosted or containerized)
docker build -t kpi-gateway .
docker run -d -p 30002:30002 \
  -e BACKEND_URL=https://kpi-backend.railway.app \
  -e FRONTEND_URL=https://kpi-productivity.vercel.app \
  kpi-gateway
```

#### 6. Production Validation

```bash
# Run production deployment script
./scripts/deploy-production.sh
```

**Production Script Features:**
- Comprehensive health checks
- Security validation
- Performance testing
- Database connectivity verification
- Redis functionality testing
- SSL certificate validation
- CORS configuration testing
- Real-time monitoring setup
- Rollback capability

### Production Configuration Files

#### Railway Configuration (railway.json)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd backend && npm run build",
    "watchPatterns": ["backend/**"]
  },
  "deploy": {
    "startCommand": "cd backend && npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production",
        "PORT": "$PORT",
        "DATABASE_URL": "$DATABASE_URL",
        "REDIS_URL": "$REDIS_URL",
        "REDIS_REQUIRED": "true",
        "JWT_SECRET": "$JWT_SECRET",
        "CORS_ORIGIN": "$FRONTEND_URL",
        "SENTRY_DSN": "$SENTRY_DSN",
        "SENTRY_ENVIRONMENT": "production"
      }
    }
  }
}
```

#### Vercel Configuration (vercel.json)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ],
  "env": {
    "VITE_API_URL": "@api_url"
  }
}
```

## Database Configuration

### PostgreSQL Setup

#### Development Database

```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database and user
createdb kpi_productivity
createuser kpi_user --pwprompt
```

#### Production Database Configuration

```sql
-- Create production database with proper settings
CREATE DATABASE kpi_productivity_prod
  WITH ENCODING 'UTF8'
       LC_COLLATE = 'en_US.UTF-8'
       LC_CTYPE = 'en_US.UTF-8'
       TEMPLATE template0;

-- Create dedicated user
CREATE USER kpi_prod_user WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE kpi_productivity_prod TO kpi_prod_user;

-- Configure connection limits
ALTER USER kpi_prod_user CONNECTION LIMIT 20;
```

#### Database Performance Tuning

```sql
-- Production PostgreSQL configuration
-- Add to postgresql.conf

# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connection settings
max_connections = 100
shared_preload_libraries = 'pg_stat_statements'

# Logging
log_statement = 'mod'
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
```

### Database Migrations

#### Migration Management

```bash
# Create new migration
cd backend
npx prisma migrate dev --name add_new_feature

# Deploy migrations to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (development only)
npx prisma migrate reset
```

#### Migration Best Practices

1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Use transactions for complex migrations**
4. **Plan for rollback scenarios**
5. **Monitor migration performance**

### Database Backup and Recovery

#### Automated Backups

```bash
#!/bin/bash
# backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgresql"
DATABASE_URL="your-production-database-url"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_DIR/kpi_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/kpi_backup_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: kpi_backup_$DATE.sql.gz"
```

#### Recovery Process

```bash
# Restore from backup
gunzip kpi_backup_20260110_120000.sql.gz
psql $DATABASE_URL < kpi_backup_20260110_120000.sql
```

## Security Configuration

### SSL/TLS Configuration

#### Certificate Management

```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### HTTPS Enforcement

```nginx
# Nginx configuration for HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://localhost:30002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Environment Security

#### Secret Management

```bash
# Use environment-specific secret management
# Development: .env files (not committed)
# Staging/Production: Platform secret management

# Railway secrets
railway variables set JWT_SECRET=$(openssl rand -base64 32)

# Vercel secrets
vercel env add JWT_SECRET
```

#### Access Control

```bash
# Limit SSH access
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers deploy-user

# Firewall configuration
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 30002/tcp
ufw enable
```

### Application Security

#### Rate Limiting Configuration

```typescript
// Backend rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

#### CORS Configuration

```typescript
// Production CORS settings
import cors from 'cors';

const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
```

## Monitoring and Logging

### Application Monitoring

#### Sentry Configuration

```typescript
// Backend Sentry setup
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event) {
    // Filter sensitive information
    if (event.request?.headers) {
      delete event.request.headers.authorization;
    }
    return event;
  },
});
```

```typescript
// Frontend Sentry setup
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 0.1,
});
```

#### Health Check Endpoints

```typescript
// Comprehensive health checks
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      memory: checkMemory(),
      disk: await checkDisk(),
    }
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Logging Configuration

#### Structured Logging

```typescript
// Winston logger configuration
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'kpi-backend',
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

#### Log Aggregation

```bash
# Using Fluentd for log aggregation
# fluentd.conf
<source>
  @type tail
  path /app/logs/*.log
  pos_file /var/log/fluentd/app.log.pos
  tag app.logs
  format json
</source>

<match app.logs>
  @type elasticsearch
  host elasticsearch.yourdomain.com
  port 9200
  index_name kpi-logs
</match>
```

### Performance Monitoring

#### Application Performance Monitoring

```typescript
// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
});
```

#### Database Performance Monitoring

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Monitor slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Performance Optimization

### Backend Optimization

#### Database Optimization

```typescript
// Connection pooling
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Connection pool configuration
// In DATABASE_URL: ?connection_limit=20&pool_timeout=20
```

#### Caching Strategy

```typescript
// Redis caching implementation
import Redis from 'redis';

const redis = Redis.createClient({
  url: process.env.REDIS_URL,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
});

// Cache middleware
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      redis.setex(key, duration, JSON.stringify(body)).catch(console.error);
      res.sendResponse(body);
    };
    
    next();
  };
};
```

### Frontend Optimization

#### Build Optimization

```typescript
// Vite configuration for production
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts', 'd3'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

#### Code Splitting and Lazy Loading

```typescript
// Lazy loading components
import { lazy, Suspense } from 'react';

const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/teams" element={<TeamsPage />} />
      </Routes>
    </Suspense>
  );
}
```

### CDN Configuration

#### Static Asset Optimization

```bash
# Vercel automatic CDN configuration
# Assets are automatically served from global CDN

# Custom CDN setup (if self-hosting)
# Nginx configuration for static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Vary Accept-Encoding;
    gzip_static on;
}
```

## Troubleshooting

### Common Deployment Issues

#### Database Connection Issues

```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool status
# In application logs, look for:
# - "Connection pool exhausted"
# - "Connection timeout"
# - "Database connection failed"

# Solutions:
# 1. Increase connection pool size
# 2. Check database server capacity
# 3. Optimize slow queries
# 4. Implement connection retry logic
```

#### Redis Connection Issues

```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Common issues:
# - Redis server not running
# - Network connectivity issues
# - Authentication failures
# - Memory limits exceeded

# Solutions:
# 1. Verify Redis server status
# 2. Check network configuration
# 3. Validate credentials
# 4. Monitor memory usage
```

#### Environment Variable Issues

```bash
# Debug environment variables
node -e "console.log(process.env)" | grep -i kpi

# Common issues:
# - Missing required variables
# - Incorrect variable names
# - Wrong environment values
# - Encoding issues

# Solutions:
# 1. Verify all required variables are set
# 2. Check variable naming consistency
# 3. Validate variable values
# 4. Check for special characters
```

### Performance Issues

#### Slow Database Queries

```sql
-- Identify slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC;

-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;
```

#### High Memory Usage

```bash
# Monitor memory usage
free -h
ps aux --sort=-%mem | head

# Node.js memory profiling
node --inspect --max-old-space-size=4096 dist/index.js

# Solutions:
# 1. Optimize database queries
# 2. Implement proper caching
# 3. Fix memory leaks
# 4. Increase server memory
```

#### High CPU Usage

```bash
# Monitor CPU usage
top -p $(pgrep node)
htop

# Profile CPU usage
node --prof dist/index.js
node --prof-process isolate-*.log > processed.txt

# Solutions:
# 1. Optimize algorithms
# 2. Implement caching
# 3. Use worker threads
# 4. Scale horizontally
```

### Error Debugging

#### Application Errors

```bash
# Check application logs
tail -f logs/combined.log
tail -f logs/error.log

# Check system logs
journalctl -u kpi-backend -f

# Common error patterns:
# - Unhandled promise rejections
# - Database connection errors
# - Authentication failures
# - Rate limit exceeded
```

#### Network Issues

```bash
# Test network connectivity
curl -I https://api.yourdomain.com/health
nslookup api.yourdomain.com
traceroute api.yourdomain.com

# Check SSL certificates
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com

# Test CORS configuration
curl -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://api.yourdomain.com/api/health
```

## Maintenance and Updates

### Regular Maintenance Tasks

#### Daily Tasks
- Monitor application health and performance
- Check error logs and alerts
- Verify backup completion
- Monitor resource usage

#### Weekly Tasks
- Review performance metrics
- Update dependencies (security patches)
- Clean up old logs and backups
- Review security alerts

#### Monthly Tasks
- Full security audit
- Performance optimization review
- Database maintenance and optimization
- Disaster recovery testing

### Update Procedures

#### Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Security audit
npm audit
npm audit fix

# Test after updates
npm test
npm run test:integration
```

#### Application Updates

```bash
# 1. Test in staging
git checkout staging
git pull origin main
./scripts/deploy-staging.sh

# 2. Run comprehensive tests
npm run test:all
npm run test:performance

# 3. Deploy to production
git checkout main
./scripts/deploy-production.sh

# 4. Monitor deployment
# Check health endpoints
# Monitor error rates
# Verify functionality
```

### Backup and Recovery

#### Automated Backup Strategy

```bash
#!/bin/bash
# comprehensive-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Database backup
pg_dump $DATABASE_URL > $BACKUP_DIR/db_backup_$DATE.sql

# Redis backup (if applicable)
redis-cli -u $REDIS_URL --rdb $BACKUP_DIR/redis_backup_$DATE.rdb

# Application files backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /app

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/ s3://your-backup-bucket/ --recursive

# Cleanup old backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

#### Disaster Recovery Plan

1. **Immediate Response**
   - Assess the scope of the issue
   - Activate incident response team
   - Communicate with stakeholders

2. **Recovery Steps**
   - Restore from latest backup
   - Verify data integrity
   - Test application functionality
   - Monitor for issues

3. **Post-Recovery**
   - Conduct post-mortem analysis
   - Update recovery procedures
   - Implement preventive measures

This comprehensive deployment and configuration guide provides all the necessary information for successfully deploying and maintaining the KPI Productivity application across different environments.