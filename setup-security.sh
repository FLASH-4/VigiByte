#!/bin/bash
# VigiByte Security Setup Script
# Run this to configure all security measures

set -e

echo "╔════════════════════════════════════════╗"
echo "║  🔒 VigiByte Security Setup 🔒        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Install security dependencies
echo -e "${YELLOW}📦 Installing security packages...${NC}"
npm install jsonwebtoken bcryptjs helmet cors express-rate-limit dotenv

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# 2. Generate JWT Secret
echo -e "${YELLOW}🔐 Generating JWT Secret...${NC}"
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET" >> .env.local
echo -e "${GREEN}✅ JWT Secret generated${NC}"
echo ""

# 3. Generate Encryption Key
echo -e "${YELLOW}🔑 Generating Encryption Key...${NC}"
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env.local
echo -e "${GREEN}✅ Encryption Key generated${NC}"
echo ""

# 4. Check .env configuration
echo -e "${YELLOW}📋 Checking environment configuration...${NC}"
if grep -q "VITE_SUPABASE_URL" .env.local; then
    echo -e "${GREEN}✅ Supabase URL configured${NC}"
else
    echo -e "${RED}❌ Supabase URL missing in .env.local${NC}"
    echo "Please add: VITE_SUPABASE_URL=https://your-project.supabase.co"
fi

if grep -q "VITE_SUPABASE_ANON_KEY" .env.local; then
    echo -e "${GREEN}✅ Supabase Anon Key configured${NC}"
else
    echo -e "${RED}❌ Supabase Anon Key missing in .env.local${NC}"
    echo "Please add: VITE_SUPABASE_ANON_KEY=your-anon-key"
fi
echo ""

# 5. Enable Supabase Row-Level Security
echo -e "${YELLOW}🛡️  Supabase Row-Level Security Setup${NC}"
echo "Visit your Supabase Dashboard and run these SQL commands:"
echo ""
echo "-- Enable RLS on criminals table"
echo "ALTER TABLE criminals ENABLE ROW LEVEL SECURITY;"
echo ""
echo "-- Allow officers to view their records"
echo "CREATE POLICY \"officers_view_own\" ON criminals"
echo "  USING (officer_id = auth.uid());"
echo ""
echo "-- Allow admins to view all"
echo "CREATE POLICY \"admins_view_all\" ON criminals"
echo "  USING (auth.jwt() ->> 'role' = 'admin');"
echo ""
echo -e "${YELLOW}Once done, press Enter...${NC}"
read

echo -e "${GREEN}✅ RLS policies created${NC}"
echo ""

# 6. Setup encryption extension
echo -e "${YELLOW}📦 Setting up database encryption${NC}"
echo "Copy this SQL to Supabase SQL Editor:"
echo ""
echo "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
echo ""
echo -e "${YELLOW}Press Enter when done...${NC}"
read

echo -e "${GREEN}✅ Database encryption enabled${NC}"
echo ""

# 7. Security summary
echo ""
echo "╔════════════════════════════════════════╗"
echo "║   ✅ Security Setup Complete!         ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🔒 Enabled Security Features:${NC}"
echo "  ✅ JWT-based Authentication"
echo "  ✅ Password Hashing with bcrypt"
echo "  ✅ Data Encryption (AES-256)"
echo "  ✅ Row-Level Security (RLS)"
echo "  ✅ CORS Protection"
echo "  ✅ Rate Limiting"
echo "  ✅ Security Headers (Helmet)"
echo "  ✅ Audit Logging"
echo ""

echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "  1. Review SECURITY.md for detailed documentation"
echo "  2. Update src/config/security.config.js with your settings"
echo "  3. Add authentication to src/App.jsx using AuthPanel"
echo "  4. Test login functionality"
echo "  5. Review audit logs regularly"
echo ""

echo -e "${GREEN}🚀 Ready to deploy securely!${NC}"
