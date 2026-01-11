# KPI Productivity System

A comprehensive productivity tracking system with security hardening, interactive documentation, and real-time monitoring capabilities.

## 🚀 Features

- **Habit Tracking & KPI Management** - Track daily habits and calculate productivity KPIs
- **Interactive API Documentation** - Modern documentation interface with live testing
- **Security Hardening** - Comprehensive security measures with firewall configuration
- **Real-time Monitoring** - Sentry integration, Redis monitoring, and health checks
- **Team Collaboration** - Team management and invitation system
- **Analytics Dashboard** - Detailed analytics and reporting

## 📋 Project Structure

```
kpi-productivity/
├── backend/                 # Node.js/Express API server
├── frontend/               # React frontend application
├── gateway/                # API Gateway with security features
├── docs/                   # Documentation and guides
│   └── interactive/        # Interactive documentation interface
├── .github/workflows/      # GitHub Actions CI/CD
└── scripts/               # Deployment and utility scripts
```

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** with Prisma ORM
- **Redis** for caching and real-time features
- **Socket.IO** for real-time communication
- **JWT** authentication
- **Sentry** for error tracking

### Frontend
- **React** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication

### Security & Infrastructure
- **API Gateway** with rate limiting and security headers
- **Firewall configuration** (iptables/pfctl)
- **SSL/TLS** encryption
- **Input validation** and sanitization
- **Comprehensive logging** and monitoring

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/kpi-productivity.git
   cd kpi-productivity
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend && npm install
   
   # Frontend
   cd ../frontend && npm install
   
   # Gateway
   cd ../gateway && npm install
   
   # Interactive Documentation
   cd ../docs/interactive && npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment files
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp gateway/.env.example gateway/.env
   
   # Configure your environment variables
   ```

4. **Database Setup**
   ```bash
   cd backend
   npm run db:migrate
   npm run db:seed
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend  
   cd frontend && npm run dev
   
   # Terminal 3 - Gateway
   cd gateway && npm run dev
   
   # Terminal 4 - Documentation (optional)
   cd docs/interactive && npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Gateway: http://localhost:30002
   - Documentation: http://localhost:3002

## 🔒 Security Features

- **Port Restriction**: Only localhost:30002 accessible externally
- **API Gateway**: Single entry point with security middleware
- **Firewall Configuration**: Automated iptables/pfctl rules
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Protection against abuse
- **Security Headers**: Helmet.js security headers
- **Access Logging**: Detailed security audit logs

## 📚 Documentation

- **Interactive Documentation**: Modern API documentation with live testing
- **Security Guide**: Comprehensive security hardening instructions
- **Deployment Guide**: Production deployment instructions
- **Monitoring Guide**: Sentry, Redis, and database monitoring setup

Access the interactive documentation at `/docs` or run the documentation server separately.

## 🔧 Development

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Gateway security tests
cd gateway && npm test

# Frontend tests
cd frontend && npm test
```

### Building for Production

```bash
# Build all components
npm run build:all

# Or build individually
cd backend && npm run build
cd frontend && npm run build
cd gateway && npm run build
cd docs/interactive && npm run build
```

### Documentation Management

```bash
# Validate documentation
cd docs/interactive && npm run docs:validate

# Update documentation
cd docs/interactive && npm run docs:update

# Deploy documentation
cd docs/interactive && npm run docs:deploy
```

## 🚀 Deployment

### Production Deployment

1. **Server Setup**
   ```bash
   # Install dependencies
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql redis-server nginx
   ```

2. **Security Configuration**
   ```bash
   # Configure firewall
   sudo iptables -P INPUT DROP
   sudo iptables -A INPUT -i lo -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 30002 -s 127.0.0.1 -j ACCEPT
   sudo iptables-save > /etc/iptables/rules.v4
   ```

3. **SSL Setup**
   ```bash
   # Install Certbot
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

4. **Process Management**
   ```bash
   # Install PM2
   sudo npm install -g pm2
   
   # Start applications
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual containers
docker build -t kpi-backend ./backend
docker build -t kpi-frontend ./frontend
docker build -t kpi-gateway ./gateway
```

### Cloud Deployment

- **Railway**: Automatic deployment from GitHub
- **Vercel**: Frontend deployment
- **Heroku**: Full-stack deployment
- **AWS/GCP**: Container deployment

## 📊 Monitoring

### Health Checks

- **Application Health**: `/api/health`
- **Database Health**: `/api/health/detailed`
- **Redis Health**: Automatic monitoring
- **Security Monitoring**: Access logs and alerts

### Sentry Integration

```javascript
// Error tracking
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

### Performance Monitoring

- **Response Times**: Automatic tracking
- **Database Queries**: Slow query detection
- **Memory Usage**: Process monitoring
- **Real-time Metrics**: Socket.IO monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation for new features
- Follow security best practices
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` directory
- **Issues**: Create a GitHub issue
- **Security**: Report security issues privately
- **Community**: Join our discussions

## 🎯 Roadmap

- [ ] Mobile application
- [ ] Advanced analytics
- [ ] Third-party integrations
- [ ] Multi-language support
- [ ] Advanced team features
- [ ] API rate limiting improvements
- [ ] Enhanced security features

## 📈 Performance

- **Response Time**: < 200ms average
- **Uptime**: 99.9% target
- **Security**: Zero known vulnerabilities
- **Test Coverage**: > 80%

---

**Built with ❤️ for productivity enthusiasts**