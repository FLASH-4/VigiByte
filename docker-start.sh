#!/bin/bash

# VigiByte Docker Quick Start Script
# This script sets up and runs VigiByte in Docker

set -e  # Exit on any error

echo "╔════════════════════════════════════════╗"
echo "║     🐳 VigiByte Docker Setup 🐳       ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "📥 Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi

echo "✅ Docker is installed"
echo "✅ Docker Compose is installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your Supabase credentials:"
    echo "   - VITE_SUPABASE_URL"
    echo "   - VITE_SUPABASE_ANON_KEY"
    echo ""
    read -p "Press Enter after updating .env file..."
fi

echo "🔨 Building Docker image..."
docker-compose build

echo ""
echo "🚀 Starting VigiByte..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 3

# Check if services are running
if docker-compose ps | grep -q "vigibyte.*Up"; then
    echo "✅ VigiByte is running!"
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║   🌐 Visit: http://localhost:5173     ║"
    echo "║                                        ║"
    echo "║   📊 Database: postgresql://localhost ║"
    echo "║   User: vigibyte_user                  ║"
    echo "║   DB: vigibyte_db                      ║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "📋 Useful Commands:"
    echo "   docker-compose logs -f vigibyte     # View logs"
    echo "   docker-compose ps                   # View status"
    echo "   docker-compose down                 # Stop services"
    echo "   docker-compose restart              # Restart services"
else
    echo "❌ Failed to start services"
    echo "📋 Running: docker-compose logs"
    docker-compose logs
    exit 1
fi
