#!/bin/bash

# Production Deployment Script
# This script deploys the KPI Productivity application to production

set -e

echo "🚀 Starting production deployment..."

# Configuration
DEPLOY_USER=${DEPLOY_USER:-"deploy"}
DEPLOY_HOST=${DEPLOY_HOST:-"your-server.com"}
DEPLOY_PATH=${DEPLOY_PATH:-"/var/www/kpi-productivity"}
BACKUP_PATH=${BACKUP_PATH:-"/var/backups/kpi-productivity"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if [ -z "$DEPLOY_HOST" ] || [ "$DEPLOY_HOST" = "your-server.com" ]; then
        error "Please set DEPLOY_HOST environment variable"
    fi
    
    # Check if we can connect to the server
    if ! ssh -o ConnectTimeout=10 "$DEPLOY_USER@$DEPLOY_HOST" "echo 'Connection test successful'" > /dev/null 2>&1; then
        error "Cannot connect to $DEPLOY_USER@$DEPLOY_HOST. Please check SSH configuration."
    fi
    
    log "Prerequisites check passed"
}

# Build application
build_application() {
    log "Building application..."
    
    # Clean previous builds
    rm -rf dist/ build/ */dist/ */build/
    
    # Build backend
    log "Building backend..."
    cd backend
    npm ci --production=false
    npm run build
    cd ..
    
    # Build frontend
    log "Building frontend..."
    cd frontend
    npm ci --production=false
    npm run build
    cd ..
    
    # Build gateway
    log "Building gateway..."
    cd gateway
    npm ci --production=false
    npm run build
    cd ..
    
    # Build documentation
    log "Building documentation..."
    cd docs/interactive
    npm ci --production=false
    npm run build
    cd ../..
    
    log "Application build completed"
}

# Create deployment package
create_package() {
    log "Creating deployment package..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    PACKAGE_NAME="kpi-productivity-${TIMESTAMP}.tar.gz"
    
    # Create temporary directory
    TEMP_DIR=$(mktemp -d)
    DEPLOY_DIR="$TEMP_DIR/kpi-productivity"
    
    mkdir -p "$DEPLOY_DIR"
    
    # Copy built applications
    cp -r backend/dist "$DEPLOY_DIR/backend-dist"
    cp -r backend/package*.json "$DEPLOY_DIR/"
    cp -r backend/prisma "$DEPLOY_DIR/"
    
    cp -r gateway/dist "$DEPLOY_DIR/gateway-dist"
    cp -r gateway/package*.json "$DEPLOY_DIR/gateway-"
    
    cp -r frontend/dist "$DEPLOY_DIR/frontend-dist"
    cp -r docs/interactive/dist "$DEPLOY_DIR/docs-dist"
    
    # Copy configuration files
    cp docker-compose.yml "$DEPLOY_DIR/"
    cp -r scripts "$DEPLOY_DIR/"
    
    # Create production package
    cd "$TEMP_DIR"
    tar -czf "$PACKAGE_NAME" kpi-productivity/
    mv "$PACKAGE_NAME" "$OLDPWD/"
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    echo "$PACKAGE_NAME"
}

# Deploy to server
deploy_to_server() {
    local package_name=$1
    
    log "Deploying to server..."
    
    # Upload package
    log "Uploading deployment package..."
    scp "$package_name" "$DEPLOY_USER@$DEPLOY_HOST:/tmp/"
    
    # Execute deployment on server
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        set -e
        
        # Create backup
        if [ -d "$DEPLOY_PATH" ]; then
            echo "Creating backup..."
            sudo mkdir -p "$BACKUP_PATH"
            sudo cp -r "$DEPLOY_PATH" "$BACKUP_PATH/backup-\$(date +%Y%m%d_%H%M%S)"
        fi
        
        # Extract new version
        echo "Extracting new version..."
        cd /tmp
        tar -xzf "$package_name"
        
        # Stop services
        echo "Stopping services..."
        sudo systemctl stop kpi-backend || true
        sudo systemctl stop kpi-gateway || true
        sudo systemctl stop nginx || true
        
        # Deploy new version
        echo "Deploying new version..."
        sudo mkdir -p "$DEPLOY_PATH"
        sudo cp -r kpi-productivity/* "$DEPLOY_PATH/"
        sudo chown -R $DEPLOY_USER:$DEPLOY_USER "$DEPLOY_PATH"
        
        # Install dependencies
        echo "Installing production dependencies..."
        cd "$DEPLOY_PATH"
        npm ci --production
        
        # Run database migrations
        echo "Running database migrations..."
        cd "$DEPLOY_PATH"
        npx prisma migrate deploy
        
        # Update systemd services
        echo "Updating systemd services..."
        sudo cp scripts/systemd/kpi-backend.service /etc/systemd/system/
        sudo cp scripts/systemd/kpi-gateway.service /etc/systemd/system/
        sudo systemctl daemon-reload
        
        # Start services
        echo "Starting services..."
        sudo systemctl start kpi-backend
        sudo systemctl start kpi-gateway
        sudo systemctl start nginx
        
        # Enable services
        sudo systemctl enable kpi-backend
        sudo systemctl enable kpi-gateway
        
        # Cleanup
        rm -f "/tmp/$package_name"
        rm -rf /tmp/kpi-productivity
        
        echo "Deployment completed successfully!"
EOF
    
    log "Deployment to server completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for services to start
    sleep 30
    
    # Check backend health
    if ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -f http://localhost:3001/health" > /dev/null 2>&1; then
        log "Backend health check passed"
    else
        error "Backend health check failed"
    fi
    
    # Check gateway health
    if ssh "$DEPLOY_USER@$DEPLOY_HOST" "curl -f http://localhost:30002/health" > /dev/null 2>&1; then
        log "Gateway health check passed"
    else
        error "Gateway health check failed"
    fi
    
    log "All health checks passed"
}

# Rollback function
rollback() {
    warn "Rolling back deployment..."
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        set -e
        
        # Find latest backup
        LATEST_BACKUP=\$(ls -t "$BACKUP_PATH" | head -n1)
        
        if [ -z "\$LATEST_BACKUP" ]; then
            echo "No backup found for rollback"
            exit 1
        fi
        
        echo "Rolling back to \$LATEST_BACKUP..."
        
        # Stop services
        sudo systemctl stop kpi-backend || true
        sudo systemctl stop kpi-gateway || true
        
        # Restore backup
        sudo rm -rf "$DEPLOY_PATH"
        sudo cp -r "$BACKUP_PATH/\$LATEST_BACKUP" "$DEPLOY_PATH"
        sudo chown -R $DEPLOY_USER:$DEPLOY_USER "$DEPLOY_PATH"
        
        # Start services
        sudo systemctl start kpi-backend
        sudo systemctl start kpi-gateway
        
        echo "Rollback completed"
EOF
    
    log "Rollback completed"
}

# Main deployment function
main() {
    log "Starting production deployment process"
    
    # Trap errors for rollback
    trap 'error "Deployment failed. Consider running rollback if needed."' ERR
    
    check_prerequisites
    build_application
    
    PACKAGE_NAME=$(create_package)
    log "Created deployment package: $PACKAGE_NAME"
    
    deploy_to_server "$PACKAGE_NAME"
    health_check
    
    # Cleanup local package
    rm -f "$PACKAGE_NAME"
    
    log "🎉 Production deployment completed successfully!"
    log "Application is now available at: https://$DEPLOY_HOST"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "health")
        health_check
        ;;
    *)
        echo "Usage: $0 [deploy|rollback|health]"
        echo "  deploy   - Deploy to production (default)"
        echo "  rollback - Rollback to previous version"
        echo "  health   - Check application health"
        exit 1
        ;;
esac