# 🐳 VigiByte Docker Setup Guide

## What's Inside?

- **Dockerfile** - Multi-stage build for optimized production image
- **docker-compose.yml** - Complete stack: VigiByte app + PostgreSQL database
- **.dockerignore** - Excludes unnecessary files from build context
- **.env.example** - Environment variables template

---

## 🚀 Quick Start

### 1. **Clone/Setup Environment**
```bash
# Copy environment variables
cp .env.example .env

# Edit .env with your Supabase credentials
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. **Run with Docker Compose** (Recommended)
```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f vigibyte

# Stop everything
docker-compose down
```

### 3. **Access VigiByte**
```
http://localhost:5173
```

---

## 📦 Building Manually (Optional)

```bash
# Build image
docker build -t vigibyte:latest .

# Run container
docker run -d \
  -p 5173:5173 \
  -e VITE_SUPABASE_URL=https://your-project.supabase.co \
  -e VITE_SUPABASE_ANON_KEY=your-key \
  --name vigibyte-app \
  vigibyte:latest

# View logs
docker logs -f vigibyte-app

# Stop container
docker stop vigibyte-app
docker rm vigibyte-app
```

---

## 🔧 Docker Compose Services

### **vigibyte** (React App)
- **Port**: 5173 (http://localhost:5173)
- **Auto-rebuilds** on code changes (with volumes)
- **Health Check**: Automatically monitors app status
- **Restart**: Automatically restarts on failure

### **vigibyte-db** (PostgreSQL - Optional)
- **Port**: 5432
- **User**: vigibyte_user
- **Password**: vigibyte_secure_password_123
- **Database**: vigibyte_db
- **Volume**: Data persists even after container stops

---

## 📋 Common Commands

```bash
# View running containers
docker-compose ps

# View logs of specific service
docker-compose logs vigibyte
docker-compose logs vigibyte-db

# Rebuild after code changes
docker-compose up -d --build

# Remove everything (including volumes)
docker-compose down -v

# Execute command in running container
docker-compose exec vigibyte npm run build

# View real-time stats
docker stats
```

---

## 🌐 Production Deployment

### Deploy to Server (Linux/Ubuntu):

```bash
# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone project
git clone <your-repo> vigibyte
cd vigibyte

# Setup environment
cp .env.example .env
# Edit .env with production Supabase credentials

# Start application
docker-compose up -d

# View logs
docker-compose logs -f vigibyte
```

---

## 🔐 Security Tips

- ✅ **Change database password** in `.env` before production
- ✅ **Use secrets management** for Supabase keys (AWS Secrets, HashiCorp Vault, etc.)
- ✅ **Enable Docker security** - use Docker security scanning
- ✅ **Limit container resources** - add CPU/memory limits in compose file
- ✅ **Use HTTPS** - set up reverse proxy (Nginx) in front of Docker

---

## 📊 Expected Build Time

- **First build**: ~2-3 minutes (downloads deps, builds)
- **Subsequent builds**: ~30-60 seconds (cached layers)

---

## 🚨 Troubleshooting

### Container won't start
```bash
docker-compose logs vigibyte  # Check error logs
docker-compose restart vigibyte  # Try restart
```

### Port already in use
```bash
# Use different port in docker-compose.yml
# Change "5173:5173" to "8080:5173"
```

### Database connection issues
```bash
# Verify database is running
docker-compose ps vigibyte-db

# Connect to database
docker-compose exec vigibyte-db psql -U vigibyte_user -d vigibyte_db
```

### Clear everything and restart fresh
```bash
docker-compose down -v
docker-compose up -d --build
```

---

## 📈 Scaling (Multiple Instances)

```bash
# Scale vigibyte to 3 instances
docker-compose up -d --scale vigibyte=3

# Note: You'll need a load balancer (Nginx) in front
```

---

## 🔄 Continuous Integration/Deployment

### GitHub Actions Example:
```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: docker/setup-buildx-action@v1
      - uses: docker/build-push-action@v2
        with:
          context: .
          push: true
          tags: yourusername/vigibyte:latest
```

---

## 📚 Resources

- **Docker Docs**: https://docs.docker.com
- **Docker Compose**: https://docs.docker.com/compose
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/nodejs-docker-webapp

---

**Now VigiByte is fully portable and deployment-ready! 🚀**
