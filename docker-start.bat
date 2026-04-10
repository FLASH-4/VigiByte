@echo off
REM VigiByte Docker Quick Start Script (Windows)

echo.
echo ╔════════════════════════════════════════╗
echo ║     🐳 VigiByte Docker Setup 🐳       ║
echo ╚════════════════════════════════════════╝
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    echo 📥 Download from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✅ Docker is installed
echo ✅ Docker Compose is installed
echo.

REM Check if .env file exists
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your Supabase credentials:
    echo    - VITE_SUPABASE_URL
    echo    - VITE_SUPABASE_ANON_KEY
    echo.
    echo Edit .env file now in your editor and press Enter when done...
    pause
)

echo 🔨 Building Docker image...
docker-compose build

echo.
echo 🚀 Starting VigiByte...
docker-compose up -d

echo.
echo ⏳ Waiting for services to be ready...
timeout /t 3

echo.
docker-compose ps | findstr "vigibyte" >nul
if errorlevel 0 (
    echo ✅ VigiByte is running!
    echo.
    echo ╔════════════════════════════════════════╗
    echo ║   🌐 Visit: http://localhost:5173     ║
    echo ║                                        ║
    echo ║   📊 Database: postgresql://localhost ║
    echo ║   User: vigibyte_user                  ║
    echo ║   DB: vigibyte_db                      ║
    echo ╚════════════════════════════════════════╝
    echo.
    echo 📋 Useful Commands:
    echo    docker-compose logs -f vigibyte     # View logs
    echo    docker-compose ps                   # View status
    echo    docker-compose down                 # Stop services
    echo    docker-compose restart              # Restart services
) else (
    echo ❌ Failed to start services
    echo 📋 Running: docker-compose logs
    docker-compose logs
    pause
    exit /b 1
)

pause
