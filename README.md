# 🛡️ VigiByte — AI-Powered Security Intelligence Platform

VigiByte is a real-time surveillance and criminal identification system built with React, Supabase, and face-api.js. It enables law enforcement agencies to detect known criminals through live camera feeds using AI-powered facial recognition.

---

## ✨ Features

- 🎥 **Live Camera Surveillance** — Real-time video feed with automatic face detection
- 🤖 **AI Face Recognition** — Matches detected faces against a criminal database using SsdMobilenetv1 + TinyFaceDetector (handles angled & tilted faces)
- 🗄️ **Criminal Database** — Add, search, and manage criminal records with photo enrollment
- 🔔 **Real-time Alerts** — Instant notifications when a known criminal is detected
- 🔐 **Role-Based Access Control** — Admin, Officer, and Viewer roles with granular permissions
- 📊 **Security Analytics** — Audit logs, detection history, and activity tracking
- 🔒 **Secure Auth** — PBKDF2 password hashing + HMAC-signed JWT tokens (browser-native Web Crypto API)

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/VigiByte.git
cd VigiByte
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Fill in your Supabase credentials in .env
```

### 3. Run
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous/public key |
| `VITE_JWT_SECRET` | ✅ Yes | Secret key for signing session tokens (min 32 chars) |
| `VITE_APP_NAME` | No | App display name (default: VigiByte) |

Get Supabase credentials from: [supabase.com](https://supabase.com) → Project Settings → API

---

## 🗃️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Face Detection | @vladmandic/face-api (SsdMobilenetv1 + TinyFaceDetector) |
| Auth | Web Crypto API (PBKDF2 + HMAC-SHA256) |
| Charts | Recharts |
| Icons | Lucide React |

---

## 👤 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — create, read, update, delete, manage users |
| **Officer** | create, read, update records |
| **Viewer** | Read-only access |

---

## 🐳 Docker (Optional)

```bash
docker-compose up
```

> Note: Docker setup includes an optional local PostgreSQL instance. The main app uses Supabase cloud by default.

---

## 🔐 Security

- Passwords hashed with **PBKDF2** (10,000 iterations, SHA-256) via Web Crypto API
- Sessions signed with **HMAC-SHA256** tokens
- Rate limiting on login (5 attempts / 15 min)
- Encrypted session storage in browser
- Audit logging via IndexedDB
- Supabase Row Level Security (RLS) on all tables

---

## 📁 Project Structure

```
src/
├── components/
│   ├── AuthPanel.jsx       # Login / Register UI
│   ├── CameraFeed.jsx      # Live camera + face detection
│   ├── CriminalDB.jsx      # Criminal records management
│   ├── Dashboard.jsx       # Main dashboard + analytics
│   └── AlertPanel.jsx      # Real-time alert notifications
├── lib/
│   ├── faceRecognition.js  # Face detection & matching logic
│   ├── supabase.js         # Supabase client
│   ├── detectionHistory.js # Detection event history
│   └── streamManager.js    # Camera stream management
├── services/
│   └── browserAuth.js      # Browser-compatible auth (PBKDF2 + JWT)
└── config/
    └── security.config.js  # Security configuration
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.