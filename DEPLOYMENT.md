# Deployment Guide

This guide covers deployment options for the KPI Productivity system, from development to production environments.

## 🚀 Quick Start

### Development Setup

```bash
# Clone and setup
git clone https://github.com/your-username/kpi-productivity.git
cd kpi-productivity
./scripts/setup.sh

# Start development servers
npm run dev
```

### Docker Development

```bash
# Start database services
docker-compose -f docker-compose.dev.yml up -d

# Install dependencies and start
npm run install:all
npm run dev
```

## 🏗️ Production Deployment

### Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Nginx
- SSL certificate (Let's Encrypt recommended)

### Option 1: Automated Script Deployment

```bash
# Configure deployment variables
export DEPLOY_HOST="your-server.com"
export DEPLOY_USER="deploy"

# Run deployment
./scripts/deploy-production.sh
```

### Option 2: Manual Production Setup

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install Nginx
sudo apt-get install -y nginx
sudo systemctl enable nginx

# Install PM2
sudo npm install -g pm2
```

#### 2. Database Setup

```bash
# Create database user
sudo -u postgres createuser --interactive --pwprompt kpi_user

# Create database
sudo -u postgres createdb -O kpi_user kpi_productivity

# Configure PostgreSQL (optional)
sudo nano /etc/postgresql/15/main/postgresql.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf
sudo systemctl restart postgresql
```

#### 3. Application Deployment

```bash
# Create deployment directory
sudo mkdir -p /var/www/kpi-productivity
sudo chown $USER:$USER /var/www/kpi-productivity

# Clone repository
cd /var/www/kpi-productivity
git clone https://github.com/your-username/kpi-productivity.git .

# Install dependencies
npm run install:all

# Build applications
npm run build

# Configure environment
cp backend/.env.example backend/.env
cp gateway/.env.example gateway/.env
# Edit .env files with production values

# Run database migrations
cd backend
npm run db:migrate
npm run db:seed
cd ..
```

#### 4. Security Configuration

```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw deny 3000
sudo ufw deny 3001

# Configure iptables for port restriction
sudo iptables -P INPUT DROP
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 30002 -s 127.0.0.1 -j ACCEPT
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Save iptables rules
sudo iptables-save > /etc/iptables/rules.v4
```

#### 5. SSL Configuration

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Configure auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 6. Nginx Configuration

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/kpi-productivity
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Main application
    location / {
        proxy_pass http://localhost:30002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://localhost:30002/health;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/kpi-productivity /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 7. Process Management

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
# Follow the instructions provided by PM2
```

### Option 3: Docker Production Deployment

#### 1. Docker Compose Production

```bash
# Clone repository
git clone https://github.com/your-username/kpi-productivity.git
cd kpi-productivity

# Configure environment
cp backend/.env.example backend/.env
cp gateway/.env.example gateway/.env
# Edit .env files

# Deploy with Docker Compose
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs
```

#### 2. Docker Swarm Deployment

```bash
# Initialize swarm
docker swarm init

# Create secrets
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-db-password" | docker secret create db_password -

# Deploy stack
docker stack deploy -c docker-stack.yml kpi-productivity

# Check services
docker service ls
docker service logs kpi-productivity_backend
```

## ☁️ Cloud Deployment

### Railway Deployment

1. **Connect Repository**
   - Connect your GitHub repository to Railway
   - Railway will auto-detect the services

2. **Configure Environment Variables**
   ```
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   JWT_SECRET=your-secret
   NODE_ENV=production
   ```

3. **Deploy**
   - Railway will automatically build and deploy
   - Custom domains can be configured in settings

### Vercel Deployment (Frontend Only)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod

# Configure environment variables in Vercel dashboard
```

### Heroku Deployment

1. **Prepare for Heroku**
   ```bash
   # Create Procfile
   echo "web: npm start" > Procfile
   
   # Create heroku-postbuild script in package.json
   "heroku-postbuild": "npm run build"
   ```

2. **Deploy to Heroku**
   ```bash
   # Create Heroku app
   heroku create kpi-productivity
   
   # Add PostgreSQL
   heroku addons:create heroku-postgresql:hobby-dev
   
   # Add Redis
   heroku addons:create heroku-redis:hobby-dev
   
   # Configure environment variables
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your-secret
   
   # Deploy
   git push heroku main
   ```

### AWS Deployment

#### Using AWS ECS

1. **Build and Push Images**
   ```bash
   # Build images
   docker build -t kpi-backend ./backend
   docker build -t kpi-gateway ./gateway
   
   # Tag for ECR
   docker tag kpi-backend:latest 123456789.dkr.ecr.region.amazonaws.com/kpi-backend:latest
   docker tag kpi-gateway:latest 123456789.dkr.ecr.region.amazonaws.com/kpi-gateway:latest
   
   # Push to ECR
   docker push 123456789.dkr.ecr.region.amazonaws.com/kpi-backend:latest
   docker push 123456789.dkr.ecr.region.amazonaws.com/kpi-gateway:latest
   ```

2. **Create ECS Service**
   - Use the provided task definitions
   - Configure load balancer
   - Set up auto-scaling

#### Using AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init kpi-productivity

# Create environment
eb create production

# Deploy
eb deploy
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/kpi_productivity"
REDIS_URL="redis://localhost:6379"

# Security
JWT_SECRET="your-super-secure-secret"
JWT_EXPIRES_IN="24h"
BCRYPT_ROUNDS=12

# Server
PORT=3001
NODE_ENV="production"
CORS_ORIGIN="https://your-domain.com"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
SENTRY_ENVIRONMENT="production"

# Email (optional)
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT=587
SMTP_USER="your-email@domain.com"
SMTP_PASS="your-password"
```

#### Gateway (.env)
```bash
# Server
PORT=30002
NODE_ENV="production"

# Services
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN="https://your-domain.com"

# SSL (production)
SSL_CERT_PATH="/path/to/cert.pem"
SSL_KEY_PATH="/path/to/private.key"
```

### Database Configuration

#### PostgreSQL Optimization

```sql
-- /etc/postgresql/15/main/postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

#### Redis Configuration

```bash
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## 📊 Monitoring

### Health Checks

```bash
# Application health
curl -f http://localhost:30002/health

# Backend health
curl -f http://localhost:3001/health

# Database health
curl -f http://localhost:3001/api/health/detailed
```

### Log Monitoring

```bash
# PM2 logs
pm2 logs

# Application logs
tail -f logs/backend-combined.log
tail -f logs/gateway-combined.log

# System logs
sudo journalctl -u kpi-backend -f
sudo journalctl -u kpi-gateway -f
```

### Performance Monitoring

- **Sentry**: Error tracking and performance monitoring
- **PM2 Monitoring**: Process monitoring and restart
- **Nginx Logs**: Access and error logs
- **Database Monitoring**: Query performance and connections

## 🔄 Maintenance

### Updates

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm run install:all

# Build applications
npm run build

# Restart services
pm2 restart all

# Check health
curl -f http://localhost:30002/health
```

### Backups

```bash
# Database backup
pg_dump -U kpi_user kpi_productivity > backup_$(date +%Y%m%d).sql

# Redis backup
redis-cli BGSAVE

# Application backup
tar -czf app_backup_$(date +%Y%m%d).tar.gz /var/www/kpi-productivity
```

### Rollback

```bash
# Using deployment script
./scripts/deploy-production.sh rollback

# Manual rollback
pm2 stop all
git checkout previous-version
npm run build
pm2 start ecosystem.config.js
```

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
sudo lsof -i :30002
sudo kill -9 <PID>
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

#### Memory Issues
```bash
# Check memory usage
free -h
pm2 monit

# Restart services
pm2 restart all
```

#### SSL Certificate Issues
```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew --dry-run
```

### Performance Issues

#### High CPU Usage
- Check PM2 monitoring
- Review application logs
- Consider scaling instances

#### High Memory Usage
- Monitor with `pm2 monit`
- Check for memory leaks
- Restart services if needed

#### Database Performance
- Check slow query logs
- Review database connections
- Optimize queries and indexes

### Security Issues

#### Failed Authentication Attempts
- Check security logs
- Review firewall rules
- Consider IP blocking

#### Suspicious Activity
- Monitor access logs
- Check for unusual patterns
- Update security measures

## 📞 Support

For deployment issues:
1. Check the troubleshooting section
2. Review application logs
3. Create a GitHub issue with details
4. Contact the development team

---

**Note**: Always test deployments in a staging environment before production deployment.