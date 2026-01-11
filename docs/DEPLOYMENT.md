# KPI Productivity 2026 - Deployment Guide

This document provides comprehensive instructions for deploying the KPI Productivity 2026 application to production and staging environments.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Database Migration](#database-migration)
5. [Redis Configuration](#redis-configuration)
6. [Staging Deployment](#staging-deployment)
7. [Production Deployment](#production-deployment)
8. [Health Checks](#health-checks)
9. [Monitoring](#monitoring)
10. [Rollback Procedures](#rollback-procedures)
11. [Troubleshooting](#troubleshooting)

## Overview

The application consists of:
- **Frontend**: React SPA deployed on Vercel
- **Backend**: Node.js API deployed on Railway
- **Database**: PostgreSQL (Railway managed)
- **Cache**: Redis (Railway managed)
- **Monitoring**: Sentry for error tracking

## Prerequisites

### Required Tools
- Node.js 20+
- npm or yarn
- Git
- curl (for health checks)

### Required Accounts
- [Vercel](https://vercel.com) account for frontend deployment
- [Railway](https://railway.app) account for backend and database
- [Sentry](https://sentry.io) account for error monitoring
- Domain name (optional, for custom domains)

### Required Secrets
Set up the following secrets in your CI/CD environment:

#### Vercel Secrets
- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

#### Railway Secrets
- `RAILWAY_TOKEN`: Railway deployment token

#### Application Secrets
- `JWT_SECRET`: Strong secret for JWT token signing
- `ADMIN_TOKEN`: Admin token for migration endpoints
- `SENTRY_DSN`: Sentry project DSN
- `SNYK_TOKEN`: Snyk security scanning token
- `SLACK_WEBHOOK_URL`: Slack webhook for notifications

#### Environment URLs
- `PRODUCTION_BACKEND_URL`: Production backend URL
- `PRODUCTION_FRONTEND_URL`: Production frontend URL
- `STAGING_BACKEND_URL`: Staging backend URL
- `STAGING_FRONTEND_URL`: Staging frontend URL

## Environment Configuration

### Backend Environment Variables

#### Required for All Environments
```bash
NODE_ENV=production|staging|development
PORT=3001
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
```

#### Redis Configuration
```bash
REDIS_URL=redis://user:password@host:port
REDIS_PASSWORD=your-redis-password
REDIS_USERNAME=your-redis-username
REDIS_DB=0
REDIS_REQUIRED=true  # Set to true in production
```

#### CORS and Security
```bash
CORS_ORIGIN=https://your-frontend-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Monitoring
```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production|staging
```

#### Email Configuration (for invitations)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@kpi-productivity.com
APP_NAME=KPI Productivity
```

#### Health Checks
```bash
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_REDIS=true
HEALTH_CHECK_DATABASE=true
```

### Frontend Environment Variables

```bash
VITE_API_URL=https://your-backend-domain.com
VITE_SENTRY_DSN=https://your-frontend-sentry-dsn@sentry.io/project-id
VITE_ENVIRONMENT=production|staging
```

## Database Migration

### Automatic Migrations

The application automatically runs migrations on startup. The migration system:

1. Detects the database type (SQLite for development, PostgreSQL for production)
2. Runs appropriate migrations for the detected database
3. Seeds default habits if the database is empty
4. Handles migration failures gracefully

### Manual Migration Commands

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Run Prisma migrations (production)
npm run db:migrate:prod

# Run custom migration utility
npm run migrate:run

# Check database connection
npm run migrate:status
```

### Migration Files

- `backend/prisma/migrations/migrate_to_postgresql.sql`: Full PostgreSQL schema
- `backend/prisma/migrations/seed_default_habits.sql`: Default habits seeding
- `backend/prisma/migrations/add_*.sql`: Feature-specific migrations

## Redis Configuration

### Development
Redis is optional in development. The application will work without Redis but real-time features will be disabled.

### Production
Redis is required in production for:
- Real-time notifications
- Session caching
- Rate limiting
- WebSocket connection management

### Redis Setup on Railway

1. Add Redis service to your Railway project
2. Connect Redis to your backend service
3. Set `REDIS_REQUIRED=true` in production environment
4. Configure Redis URL in environment variables

## Staging Deployment

### Automatic Staging Deployment

Staging deployment is triggered automatically when code is pushed to the `develop` branch.

### Manual Staging Deployment

```bash
# Run staging deployment script
./scripts/deploy-staging.sh

# Or use npm script
cd backend && npm run deploy:staging
```

### Staging Environment

- **Backend**: Deployed to Railway staging service
- **Frontend**: Deployed to Vercel preview deployment
- **Database**: Separate staging PostgreSQL instance
- **Redis**: Optional (can be disabled with `REDIS_REQUIRED=false`)

### Staging Tests

The staging deployment script runs:
1. Health checks for backend and frontend
2. Database connectivity tests
3. Redis connectivity tests (if enabled)
4. API endpoint smoke tests
5. CORS configuration verification

## Production Deployment

### Automatic Production Deployment

Production deployment is triggered automatically when code is pushed to the `main` branch, after all tests pass.

### Manual Production Deployment

```bash
# Run production deployment script
./scripts/deploy-production.sh

# Or use npm script
cd backend && npm run deploy:production
```

### Production Deployment Process

1. **Prerequisites Check**: Verify environment variables and tools
2. **Migration Check**: Ensure database migrations are up to date
3. **Health Checks**: Verify all services are responding
4. **Security Checks**: Verify HTTPS and security headers
5. **Performance Tests**: Check response times
6. **Monitoring Setup**: Verify monitoring is active
7. **Rollback Preparation**: Prepare rollback procedures if needed

### Production Environment

- **Backend**: Railway production service with auto-scaling
- **Frontend**: Vercel production deployment with CDN
- **Database**: Railway managed PostgreSQL with backups
- **Redis**: Railway managed Redis with persistence
- **Monitoring**: Sentry error tracking and performance monitoring

## Health Checks

### Health Check Endpoints

- `GET /health`: Overall system health
- `GET /health/database`: Database connectivity
- `GET /health/redis`: Redis connectivity
- `GET /health/detailed`: Detailed system information (staging/dev only)

### Health Check Response Format

```json
{
  "status": "ok|degraded|error",
  "timestamp": "2024-01-09T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": "healthy|unhealthy",
    "redis": "healthy|unhealthy"
  }
}
```

### Monitoring Health Checks

Health checks are monitored by:
- Railway's built-in health check system
- CI/CD pipeline post-deployment verification
- External monitoring services (optional)

## Monitoring

### Error Tracking

Sentry is configured for both frontend and backend error tracking:

- **Backend**: Server errors, database errors, API errors
- **Frontend**: JavaScript errors, network errors, user interactions

### Performance Monitoring

- **Response Times**: API endpoint response times
- **Database Queries**: Slow query detection
- **Memory Usage**: Server memory monitoring
- **Redis Performance**: Cache hit rates and response times

### Alerts

Configure alerts for:
- Service downtime
- High error rates
- Slow response times
- Database connection failures
- Redis connection failures

## Rollback Procedures

### Automatic Rollback Triggers

Rollback is triggered automatically if:
- Health checks fail after deployment
- Error rates exceed threshold
- Performance degrades significantly

### Manual Rollback

#### Backend Rollback (Railway)
```bash
# Rollback to previous deployment
railway rollback

# Or rollback to specific deployment
railway rollback --deployment-id <deployment-id>
```

#### Frontend Rollback (Vercel)
```bash
# Rollback to previous deployment
vercel rollback

# Or rollback to specific deployment
vercel rollback <deployment-url>
```

#### Database Rollback
```bash
# Rollback database migrations (if needed)
npx prisma migrate reset
npx prisma migrate deploy
```

### Rollback Verification

After rollback:
1. Run health checks
2. Verify critical functionality
3. Monitor error rates
4. Notify team of rollback completion

## Troubleshooting

### Common Issues

#### Migration Failures
```bash
# Check database connection
npm run migrate:status

# Reset and re-run migrations
npx prisma migrate reset
npm run migrate:run
```

#### Redis Connection Issues
```bash
# Check Redis connectivity
curl -f $BACKEND_URL/health/redis

# Verify Redis configuration
echo $REDIS_URL
```

#### CORS Issues
```bash
# Verify CORS configuration
curl -H "Origin: $FRONTEND_URL" -H "Access-Control-Request-Method: GET" -X OPTIONS $BACKEND_URL/api/health
```

#### SSL/TLS Issues
```bash
# Check SSL certificate
curl -I $BACKEND_URL/health
openssl s_client -connect your-domain.com:443
```

### Debugging Commands

```bash
# Check service status
curl -f $BACKEND_URL/health

# Check detailed system info (staging only)
curl -f $STAGING_BACKEND_URL/health/detailed

# Test database connection
curl -f $BACKEND_URL/health/database

# Test Redis connection
curl -f $BACKEND_URL/health/redis

# Check logs
railway logs --service kpi-backend
```

### Support Contacts

- **Infrastructure Issues**: Railway support
- **Frontend Issues**: Vercel support
- **Application Issues**: Development team
- **Security Issues**: Security team

## Security Considerations

### Environment Variables
- Never commit secrets to version control
- Use Railway's environment variable management
- Rotate secrets regularly

### Database Security
- Use strong passwords
- Enable SSL connections
- Regular security updates
- Backup encryption

### API Security
- HTTPS only in production
- Rate limiting enabled
- Input validation
- Authentication required for protected endpoints

### Monitoring Security
- Monitor for suspicious activity
- Set up security alerts
- Regular security audits
- Dependency vulnerability scanning

## Performance Optimization

### Backend Optimization
- Database query optimization
- Redis caching strategy
- Connection pooling
- Gzip compression

### Frontend Optimization
- Code splitting
- Asset optimization
- CDN usage
- Caching strategies

### Database Optimization
- Index optimization
- Query performance monitoring
- Connection pooling
- Regular maintenance

## Backup and Recovery

### Database Backups
- Railway automatic daily backups
- Manual backup procedures
- Backup verification
- Recovery testing

### Application Backups
- Code repository backups
- Configuration backups
- Environment variable backups
- Documentation backups

### Recovery Procedures
- Database recovery steps
- Application recovery steps
- Data integrity verification
- Service restoration verification

---

For additional support or questions about deployment, please refer to the project documentation or contact the development team.