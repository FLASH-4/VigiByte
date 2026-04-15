# VigiByte - Global Criminal Intelligence Platform 🌍🔍

> A multi-tenant AI-powered surveillance and criminal database system with real-time threat detection and global intelligence sharing.

## 🎯 Project Overview

VigiByte is an enterprise-grade security platform that enables organizations to:
- **Monitor** multiple surveillance cameras with AI-powered facial recognition
- **Detect** wanted criminals in real-time camera feeds
- **Share** global criminal database across all organizations
- **Manage** officers and viewers with role-based access control
- **Track** security alerts and maintain audit trails

## ✨ Key Features

### 🌐 Global Criminal Database
- **Shared across all organizations** - worldwide threat intelligence
- **Read-only protection** - immutable global records prevent tampering
- **Persistent** - survives organization deletion
- **Instantly accessible** - all users see updates in real-time

### 📹 Real-Time Surveillance
- **Multi-camera support** - manage unlimited surveillance nodes
- **Live AI detection** - facial recognition powered by TensorFlow.js
- **Instant alerts** - immediate notifications when criminals detected
- **Performance monitoring** - track CPU load, detection confidence, signal metrics

### 👥 Role-Based Access Control (RBAC)
- **Admin** - Full control, can approve/revoke officers, manage org data
- **Officer** - Can add cameras, manage local criminal database
- **Viewer** - Read-only access, view alerts and criminal records

### 🔐 Security Features
- **2FA Authentication** - Google Authenticator support for admins
- **Row-Level Security** - Data isolation per organization
- **Audit Logging** - Complete activity trail
- **Password Hashing** - PBKDF2 encryption
- **Session Management** - JWT-based authentication

### 📊 Admin Dashboard Features
- **Officer Management** - Approve/revoke pending officers
- **Real-time Subscriptions** - Automatic updates via Supabase Realtime
- **Organization Profiles** - Multi-tenant data management
- **System Health Monitoring** - Connection status tracking

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Custom JWT + Supabase Auth
- **AI/ML**: TensorFlow.js (face-api.js)
- **Real-time**: Supabase Realtime
- **Deployment**: Vercel

### Database Schema

```
organizations
├── id, domain, created_at

users
├── id, email, password_hash, role, organization_id
├── is_active, totp_secret, created_at

cameras
├── id, name, location, coordinates, type (webcam/ip/image)
├── source, organization_id, created_at

criminals
├── id, name, age, crime, danger_level
├── photo_url, organization_id, created_at

global_criminals ⭐ (READ-ONLY, NOT organization-scoped)
├── id, name, photo_url, is_wanted, threat_level
├── is_active, created_at

approved_officers
├── id, user_id, organization_id, created_at
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- Supabase account
- Google Authenticator (for 2FA)

### Environment Setup

1. **Clone the repository**
```bash
git clone https://github.com/FLASH-4/VigiByte.git
cd VigiByte
```

2. **Create .env.local**
```bash
cp .env.example .env.local
# Edit with your Supabase credentials
```

3. **Install dependencies**
```bash
npm install
```

4. **Set up Supabase**
- Create a Supabase project
- Run migrations (see Database Setup)
- Update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

5. **Start development server**
```bash
npm run dev
```

## 🗄️ Database Setup

### Create Tables in Supabase SQL Editor

```sql
-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'officer', 'viewer')),
  organization_id UUID REFERENCES organizations(id),
  is_active BOOLEAN DEFAULT true,
  totp_secret TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cameras
CREATE TABLE cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  coordinates TEXT,
  type TEXT CHECK (type IN ('webcam', 'ip', 'image')),
  source TEXT,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Organization Criminals (local database)
CREATE TABLE criminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INTEGER,
  crime TEXT,
  danger_level TEXT DEFAULT 'MEDIUM',
  photo_url TEXT,
  photo_data BYTEA,
  face_descriptor JSONB,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Global Criminals (SHARED, READ-ONLY)
CREATE TABLE global_criminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  photo_url TEXT,
  photo_data BYTEA,
  is_wanted BOOLEAN DEFAULT true,
  threat_level TEXT DEFAULT 'medium',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Approved Officers
CREATE TABLE approved_officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Enable Row Level Security & Global Criminals Policy

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE criminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_criminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_officers ENABLE ROW LEVEL SECURITY;

-- Global Criminals - READ-ONLY PROTECTION
CREATE POLICY "Global criminals read-only" ON global_criminals
  FOR SELECT USING (is_active = true);

CREATE POLICY "Prevent insert to global" ON global_criminals
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Prevent update to global" ON global_criminals
  FOR UPDATE USING (false);

CREATE POLICY "Prevent delete from global" ON global_criminals
  FOR DELETE USING (false);
```

## 👤 User Workflows

### Admin Registration
1. First admin creates account (org created automatically)
2. Sets up 2FA with Google Authenticator
3. Starts adding surveillance cameras
4. Approves officer registrations

### Officer Registration
1. Registers with organization domain
2. Waits for admin approval
3. Once approved, can add local criminals
4. Can view global and local criminal databases

### Viewer Access
1. Registered by admin as viewer
2. No editing permissions
3. Can view alerts and criminal records

## 🔄 Account Deletion Behavior

### Admin Deletes Account
- ✕ Entire organization deleted
- ✕ All officers & viewers removed
- ✕ Organization cameras deleted
- ✕ Local criminal records deleted
- ✓ Global criminals preserved

### Officer/Viewer Deletes Account
- ✓ Only user record deleted
- ✓ All organization data preserved
- ✓ Criminal records remain intact

## 🔒 Security Protocols

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (@$!%*?&)

### 2FA Setup
- Google Authenticator app required
- QR code generation for easy setup
- Manual key entry for mobile users
- 6-digit TOTP verification

### Rate Limiting
- Login attempts: 5 per minute per email
- Global throttling on sensitive endpoints

## 🚢 Deployment

### Deploy to Vercel (Recommended)

```bash
# Connect to Vercel
vercel link

# Deploy
vercel
```

### Docker Deployment

```bash
# Build image
docker build -t vigibyte:latest .

# Run container
docker run -p 3000:5173 vigibyte:latest
```

## 📱 Mobile Responsiveness

VigiByte is fully responsive with support for:
- Desktop (1920px+)
- Tablet (768px - 1919px)
- Mobile (320px - 767px)

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Folder Structure

```
src/
├── components/        # React components
│   ├── Dashboard.jsx
│   ├── AuthPanel.jsx
│   ├── CriminalDB.jsx
│   └── ...
├── lib/              # Utilities & services
│   ├── supabase.js
│   ├── faceRecognition.js
│   ├── organization.js
│   └── totp.js
├── services/         # Business logic
│   └── browserAuth.js
└── App.jsx
```

## 🐛 Troubleshooting

### Storage Issues (Mobile)
On iOS Safari in private mode, localStorage may be unavailable. The app detects this and shows an appropriate warning.

### Face Detection Not Working
- Check browser permissions
- Ensure camera feed is accessible
- Verify TensorFlow.js models are loaded
- Check browser console for errors

### Real-time Updates Not Working
- Verify Realtime is enabled in Supabase
- Check RLS policies are correctly configured
- Ensure user has appropriate permissions

## 📊 Performance

- **Face Detection**: ~300-500ms per image (depends on CPU)
- **Database Queries**: <100ms average
- **Real-time Updates**: <1s propagation
- **Build Size**: ~850KB (gzipped)

## 📝 License

This project is proprietary. All rights reserved.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:
1. Create a feature branch
2. Make your changes
3. Write clear commit messages
4. Submit a pull request

## 📧 Contact

For issues, questions, or feature requests, please create an issue on GitHub.

---

**VigiByte** - Making the world safer, one detection at a time. 🌍🔒
