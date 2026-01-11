#!/bin/bash

# KPI Productivity Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up KPI Productivity development environment..."

# Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed."
        exit 1
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        echo "⚠️  PostgreSQL is not installed. You can install it or use Docker."
    fi
    
    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        echo "⚠️  Redis is not installed. You can install it or use Docker."
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        echo "✅ Docker is available"
    else
        echo "⚠️  Docker is not installed (optional for development)"
    fi
    
    echo "✅ Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    # Root dependencies
    npm install
    
    # Backend dependencies
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
    
    # Gateway dependencies
    echo "📦 Installing gateway dependencies..."
    cd gateway && npm install && cd ..
    
    # Frontend dependencies
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    
    # Documentation dependencies
    echo "📦 Installing documentation dependencies..."
    cd docs/interactive && npm install && cd ../..
    
    echo "✅ All dependencies installed"
}

# Setup environment files
setup_environment() {
    echo "⚙️  Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        echo "✅ Created backend/.env from example"
    else
        echo "⚠️  backend/.env already exists"
    fi
    
    # Gateway environment
    if [ ! -f "gateway/.env" ]; then
        cp gateway/.env.example gateway/.env
        echo "✅ Created gateway/.env from example"
    else
        echo "⚠️  gateway/.env already exists"
    fi
    
    # Frontend environment
    if [ ! -f "frontend/.env" ]; then
        cp frontend/.env.example frontend/.env
        echo "✅ Created frontend/.env from example"
    else
        echo "⚠️  frontend/.env already exists"
    fi
    
    # Documentation environment
    if [ ! -f "docs/interactive/.env" ]; then
        cp docs/interactive/.env.example docs/interactive/.env
        echo "✅ Created docs/interactive/.env from example"
    else
        echo "⚠️  docs/interactive/.env already exists"
    fi
}

# Setup database
setup_database() {
    echo "🗄️  Setting up database..."
    
    if command -v docker &> /dev/null; then
        echo "🐳 Starting database services with Docker..."
        docker-compose -f docker-compose.dev.yml up -d
        
        # Wait for database to be ready
        echo "⏳ Waiting for database to be ready..."
        sleep 10
        
        # Run migrations
        echo "🔄 Running database migrations..."
        cd backend
        npm run db:migrate
        
        # Seed database
        echo "🌱 Seeding database..."
        npm run db:seed
        cd ..
        
        echo "✅ Database setup completed with Docker"
    else
        echo "⚠️  Docker not available. Please set up PostgreSQL and Redis manually."
        echo "   Then run: cd backend && npm run db:migrate && npm run db:seed"
    fi
}

# Create necessary directories
create_directories() {
    echo "📁 Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p backend/logs
    mkdir -p gateway/logs
    mkdir -p docs/generated
    mkdir -p docs/.versions
    
    echo "✅ Directories created"
}

# Generate JWT secret
generate_secrets() {
    echo "🔐 Generating secrets..."
    
    # Generate JWT secret if not exists
    if ! grep -q "JWT_SECRET=" backend/.env || grep -q "JWT_SECRET=\"\"" backend/.env; then
        JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
        sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=\"$JWT_SECRET\"/" backend/.env
        echo "✅ Generated JWT secret"
    fi
    
    # Generate session secret if not exists
    if ! grep -q "SESSION_SECRET=" backend/.env || grep -q "SESSION_SECRET=\"\"" backend/.env; then
        SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
        sed -i.bak "s/SESSION_SECRET=.*/SESSION_SECRET=\"$SESSION_SECRET\"/" backend/.env
        echo "✅ Generated session secret"
    fi
}

# Main setup function
main() {
    echo "🎯 KPI Productivity Setup"
    echo "========================"
    
    check_prerequisites
    install_dependencies
    setup_environment
    create_directories
    generate_secrets
    setup_database
    
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Review and update environment files (.env) with your configuration"
    echo "2. Start the development servers:"
    echo "   npm run dev"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend:      http://localhost:3000"
    echo "   Backend API:   http://localhost:3001"
    echo "   Gateway:       http://localhost:30002"
    echo "   Documentation: http://localhost:3002"
    echo ""
    echo "📚 For more information, see the README.md file"
}

# Run main function
main "$@"