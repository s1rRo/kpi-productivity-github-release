import React from 'react';
import { Rocket, Server, Cloud, Settings } from 'lucide-react';
import CodeBlock from '../components/CodeBlock';

const DeploymentPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Rocket className="w-8 h-8 text-purple-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Deployment Documentation
          </h1>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Comprehensive deployment guides for production and staging environments.
        </p>
      </div>

      <div className="space-y-8">
        {/* Environment Configuration */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Settings className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Environment Configuration
            </h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Environment Variables
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Configure the following environment variables for production deployment:
              </p>

              <CodeBlock
                language="bash"
                title="Production Environment Variables"
                code={`# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/kpi_productivity"
REDIS_URL="redis://localhost:6379"

# JWT Configuration
JWT_SECRET="your-super-secure-jwt-secret-key-here"
JWT_EXPIRES_IN="24h"

# API Configuration
PORT=3001
NODE_ENV="production"
API_BASE_URL="https://your-domain.com"

# Security Configuration
CORS_ORIGIN="https://your-frontend-domain.com"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring Configuration
SENTRY_DSN="your-sentry-dsn-here"
SENTRY_ENVIRONMENT="production"
SENTRY_RELEASE="1.0.0"

# Email Configuration (if using email features)
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT=587
SMTP_USER="your-email@domain.com"
SMTP_PASS="your-email-password"

# SSL Configuration
SSL_CERT_PATH="/path/to/ssl/cert.pem"
SSL_KEY_PATH="/path/to/ssl/private.key"`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Docker Configuration
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Use Docker for consistent deployment across environments:
              </p>

              <CodeBlock
                language="dockerfile"
                title="Dockerfile"
                code={`# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3001

CMD ["npm", "start"]`}
              />

              <CodeBlock
                language="yaml"
                title="docker-compose.yml"
                code={`version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/kpi_productivity
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_BASE_URL=http://localhost:30002
    restart: unless-stopped

  gateway:
    build: ./gateway
    ports:
      - "30002:30002"
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=kpi_productivity
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:`}
              />
            </div>
          </div>
        </div>

        {/* Production Deployment */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Server className="w-6 h-6 text-green-600 mr-3" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Production Deployment
            </h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Server Setup
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Prepare your production server with the necessary dependencies:
              </p>

              <CodeBlock
                language="bash"
                code={`# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker and Docker Compose
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install Nginx (for reverse proxy)
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Install PM2 for process management
sudo npm install -g pm2`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Database Setup
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Set up PostgreSQL database for production:
              </p>

              <CodeBlock
                language="bash"
                code={`# Create database user
sudo -u postgres createuser --interactive --pwprompt kpi_user

# Create database
sudo -u postgres createdb -O kpi_user kpi_productivity

# Run migrations
cd /path/to/your/app/backend
npm run migrate:deploy

# Seed initial data (if needed)
npm run seed`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                SSL/TLS Configuration
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Configure SSL certificates for secure HTTPS connections:
              </p>

              <CodeBlock
                language="bash"
                code={`# Install Certbot for Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal setup
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet`}
              />

              <CodeBlock
                language="nginx"
                title="Nginx Configuration"
                code={`server {
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

    # Proxy to API Gateway
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
}`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Process Management
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Use PM2 to manage application processes:
              </p>

              <CodeBlock
                language="javascript"
                title="ecosystem.config.js"
                code={`module.exports = {
  apps: [
    {
      name: 'kpi-backend',
      script: './backend/dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'kpi-gateway',
      script: './gateway/dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 30002
      },
      error_file: './logs/gateway-error.log',
      out_file: './logs/gateway-out.log',
      log_file: './logs/gateway-combined.log',
      time: true
    }
  ]
};`}
              />

              <CodeBlock
                language="bash"
                code={`# Start applications
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

# Monitor applications
pm2 monit

# View logs
pm2 logs

# Restart applications
pm2 restart all`}
              />
            </div>
          </div>
        </div>

        {/* Cloud Deployment */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Cloud className="w-6 h-6 text-purple-600 mr-3" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Cloud Deployment Options
            </h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Railway Deployment
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Deploy to Railway with automatic builds and deployments:
              </p>

              <CodeBlock
                language="json"
                title="railway.json"
                code={`{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Vercel Deployment (Frontend)
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Deploy the frontend to Vercel for optimal performance:
              </p>

              <CodeBlock
                language="json"
                title="vercel.json"
                code={`{
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
      "src": "/api/(.*)",
      "dest": "https://your-backend-domain.com/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "env": {
    "VITE_API_BASE_URL": "https://your-backend-domain.com"
  }
}`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Docker Swarm Deployment
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Scale with Docker Swarm for high availability:
              </p>

              <CodeBlock
                language="yaml"
                title="docker-stack.yml"
                code={`version: '3.8'

services:
  backend:
    image: your-registry/kpi-backend:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    networks:
      - kpi-network
    environment:
      - NODE_ENV=production
    secrets:
      - db_password
      - jwt_secret

  gateway:
    image: your-registry/kpi-gateway:latest
    ports:
      - "30002:30002"
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == manager
    networks:
      - kpi-network

networks:
  kpi-network:
    driver: overlay

secrets:
  db_password:
    external: true
  jwt_secret:
    external: true`}
              />
            </div>
          </div>
        </div>

        {/* Monitoring & Maintenance */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-100 mb-4">
            Post-Deployment Checklist
          </h2>
          <div className="space-y-2 text-yellow-800 dark:text-yellow-200">
            <div className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>SSL certificates configured and auto-renewal enabled</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Database migrations applied successfully</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Environment variables configured securely</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Firewall rules applied and tested</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Monitoring and logging configured</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Backup strategy implemented</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Health checks responding correctly</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Performance testing completed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeploymentPage;