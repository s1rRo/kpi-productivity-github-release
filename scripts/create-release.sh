#!/bin/bash

# Create GitHub Release Package Script
# This script creates a complete release package for GitHub

set -e

echo "📦 Creating GitHub release package..."

# Configuration
RELEASE_VERSION=${1:-"1.0.0"}
RELEASE_NAME="kpi-productivity-v${RELEASE_VERSION}"
RELEASE_DIR="release-packages"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] $1${NC}"
}

# Create release directory
log "Creating release directory..."
mkdir -p "$RELEASE_DIR"
cd "$RELEASE_DIR"

# Clean previous release
if [ -d "$RELEASE_NAME" ]; then
    rm -rf "$RELEASE_NAME"
fi

# Create release package directory
mkdir "$RELEASE_NAME"
cd "$RELEASE_NAME"

# Copy project structure
log "Copying project files..."

# Root files
cp ../../README.md .
cp ../../LICENSE .
cp ../../CHANGELOG.md .
cp ../../CONTRIBUTING.md .
cp ../../DEPLOYMENT.md .
cp ../../package.json .
cp ../../.gitignore .
cp ../../docker-compose.yml .
cp ../../docker-compose.dev.yml .
cp ../../ecosystem.config.js .
cp ../../.dockerignore .

# Backend
log "Copying backend..."
cp -r ../../backend .
# Clean backend
rm -rf backend/node_modules
rm -rf backend/dist
rm -rf backend/logs
rm -f backend/.env

# Gateway
log "Copying gateway..."
cp -r ../../gateway .
# Clean gateway
rm -rf gateway/node_modules
rm -rf gateway/dist
rm -rf gateway/logs
rm -f gateway/.env

# Frontend
log "Copying frontend..."
cp -r ../../frontend .
# Clean frontend
rm -rf frontend/node_modules
rm -rf frontend/dist
rm -f frontend/.env

# Documentation
log "Copying documentation..."
cp -r ../../docs .
# Clean documentation
rm -rf docs/interactive/node_modules
rm -rf docs/interactive/dist
rm -f docs/interactive/.env

# Scripts
log "Copying scripts..."
cp -r ../../scripts .

# GitHub workflows
log "Copying GitHub workflows..."
cp -r ../../.github .

# Create additional release files
log "Creating release-specific files..."

# Create VERSION file
echo "$RELEASE_VERSION" > VERSION

# Create INSTALL.md
cat > INSTALL.md << 'EOF'
# Quick Installation Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

## Quick Start
```bash
# 1. Run setup script
./scripts/setup.sh

# 2. Start development
npm run dev
```

## Production Deployment
```bash
# 1. Configure environment
cp backend/.env.example backend/.env
cp gateway/.env.example gateway/.env
# Edit .env files

# 2. Deploy
./scripts/deploy-production.sh
```

For detailed instructions, see DEPLOYMENT.md
EOF

# Create docker-compose.production.yml
cat > docker-compose.production.yml << 'EOF'
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kpi_productivity
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - kpi-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - kpi-network

  backend:
    build: ./backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD}@db:5432/kpi_productivity
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - kpi-network

  gateway:
    build: ./gateway
    environment:
      - NODE_ENV=production
      - BACKEND_URL=http://backend:3001
      - FRONTEND_URL=http://frontend:3000
    ports:
      - "30002:30002"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - kpi-network

  frontend:
    build: ./frontend
    environment:
      - VITE_API_BASE_URL=http://localhost:30002
    restart: unless-stopped
    networks:
      - kpi-network

volumes:
  postgres_data:
  redis_data:

networks:
  kpi-network:
    driver: bridge
EOF

# Create systemd service files
log "Creating systemd service files..."
mkdir -p scripts/systemd

cat > scripts/systemd/kpi-backend.service << 'EOF'
[Unit]
Description=KPI Productivity Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/kpi-productivity
ExecStart=/usr/bin/node backend/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

cat > scripts/systemd/kpi-gateway.service << 'EOF'
[Unit]
Description=KPI Productivity Gateway
After=network.target kpi-backend.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/kpi-productivity
ExecStart=/usr/bin/node gateway/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=30002

[Install]
WantedBy=multi-user.target
EOF

# Create security configuration
log "Creating security configuration..."
mkdir -p config/security

cat > config/security/firewall-setup.sh << 'EOF'
#!/bin/bash
# Firewall setup script for KPI Productivity

# Linux (iptables)
if command -v iptables &> /dev/null; then
    echo "Configuring iptables..."
    sudo iptables -P INPUT DROP
    sudo iptables -A INPUT -i lo -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 30002 -s 127.0.0.1 -j ACCEPT
    sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    
    # Save rules
    sudo mkdir -p /etc/iptables
    sudo iptables-save > /etc/iptables/rules.v4
    echo "iptables configured successfully"
fi

# macOS (pfctl)
if command -v pfctl &> /dev/null; then
    echo "Configuring pfctl..."
    echo "block all" > /tmp/pf.rules
    echo "pass in on lo0 proto tcp from 127.0.0.1 to 127.0.0.1 port 30002" >> /tmp/pf.rules
    echo "pass out all" >> /tmp/pf.rules
    
    sudo pfctl -f /tmp/pf.rules -e
    echo "pfctl configured successfully"
fi
EOF

chmod +x config/security/firewall-setup.sh

# Create monitoring configuration
log "Creating monitoring configuration..."
mkdir -p config/monitoring

cat > config/monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'kpi-backend'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    
  - job_name: 'kpi-gateway'
    static_configs:
      - targets: ['localhost:30002']
    metrics_path: '/metrics'
EOF

# Create backup scripts
log "Creating backup scripts..."
mkdir -p scripts/backup

cat > scripts/backup/backup.sh << 'EOF'
#!/bin/bash
# Backup script for KPI Productivity

BACKUP_DIR="/var/backups/kpi-productivity"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Database backup
pg_dump -U kpi_user kpi_productivity > "$BACKUP_DIR/database_$DATE.sql"

# Redis backup
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Application backup
tar -czf "$BACKUP_DIR/application_$DATE.tar.gz" /var/www/kpi-productivity

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x scripts/backup/backup.sh

# Update package.json version
log "Updating version in package.json..."
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$RELEASE_VERSION\"/" package.json
rm -f package.json.bak

# Create checksums
log "Creating checksums..."
find . -type f -name "*.js" -o -name "*.ts" -o -name "*.json" | xargs sha256sum > CHECKSUMS.txt

# Create release notes
log "Creating release notes..."
cat > RELEASE_NOTES.md << EOF
# KPI Productivity v${RELEASE_VERSION}

## 🚀 What's New

### Features
- Complete productivity tracking system
- Interactive API documentation
- Comprehensive security hardening
- Real-time monitoring and analytics

### Security
- Firewall configuration and port restriction
- JWT authentication with secure password hashing
- Comprehensive input validation and sanitization
- Security monitoring and audit logging

### Documentation
- Interactive documentation interface with live API testing
- Comprehensive deployment and security guides
- Automated documentation updates and versioning

## 📦 Installation

### Quick Start
\`\`\`bash
# Extract release
tar -xzf kpi-productivity-v${RELEASE_VERSION}.tar.gz
cd kpi-productivity-v${RELEASE_VERSION}

# Run setup
./scripts/setup.sh

# Start development
npm run dev
\`\`\`

### Production Deployment
\`\`\`bash
# Configure environment
cp backend/.env.example backend/.env
cp gateway/.env.example gateway/.env
# Edit .env files with your configuration

# Deploy to production
./scripts/deploy-production.sh
\`\`\`

## 🔧 Configuration

See DEPLOYMENT.md for detailed configuration instructions.

## 📚 Documentation

- **README.md** - Project overview and quick start
- **DEPLOYMENT.md** - Detailed deployment instructions
- **CONTRIBUTING.md** - Development and contribution guidelines
- **docs/** - Complete documentation including API reference

## 🔒 Security

This release includes comprehensive security hardening:
- Network-level security with firewall configuration
- Application-level security with input validation
- Authentication and authorization with JWT
- Comprehensive monitoring and logging

## 🆘 Support

- **Issues**: https://github.com/your-username/kpi-productivity/issues
- **Documentation**: See docs/ directory
- **Security**: Report security issues privately

## 📊 System Requirements

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- 2GB RAM minimum (4GB recommended)
- 10GB disk space

## 🎯 Verified Platforms

- Ubuntu 20.04+
- CentOS 8+
- macOS 12+
- Docker 20.10+

---

**Full Changelog**: https://github.com/your-username/kpi-productivity/blob/main/CHANGELOG.md
EOF

# Go back to original directory
cd ../..

# Create compressed archive
log "Creating compressed archive..."
cd "$RELEASE_DIR"
tar -czf "${RELEASE_NAME}.tar.gz" "$RELEASE_NAME"
zip -r "${RELEASE_NAME}.zip" "$RELEASE_NAME"

# Create checksums for archives
sha256sum "${RELEASE_NAME}.tar.gz" > "${RELEASE_NAME}.tar.gz.sha256"
sha256sum "${RELEASE_NAME}.zip" > "${RELEASE_NAME}.zip.sha256"

# Display results
log "Release package created successfully!"
echo ""
echo "📦 Release files:"
echo "   - ${RELEASE_NAME}.tar.gz ($(du -h ${RELEASE_NAME}.tar.gz | cut -f1))"
echo "   - ${RELEASE_NAME}.zip ($(du -h ${RELEASE_NAME}.zip | cut -f1))"
echo "   - ${RELEASE_NAME}.tar.gz.sha256"
echo "   - ${RELEASE_NAME}.zip.sha256"
echo ""
echo "📁 Release directory: $RELEASE_DIR/$RELEASE_NAME"
echo ""
echo "🚀 Ready for GitHub release!"
echo ""
echo "Next steps:"
echo "1. Create a new release on GitHub"
echo "2. Upload the .tar.gz and .zip files"
echo "3. Upload the .sha256 checksum files"
echo "4. Copy RELEASE_NOTES.md content to release description"

cd ..