# 🛡️ VigiByte — AI-Powered Security Intelligence Platform

VigiByte is a real-time criminal identification system built for law enforcement. It uses live camera feeds and AI facial recognition to detect known criminals instantly, with a Python backend for production-grade detection of tilted and angled faces.

---

## ✨ Features

- 🎥 **Live Surveillance** — Webcam & IP camera support with real-time video feed
- 🤖 **AI Face Recognition** — Python backend (dlib CNN) handles tilted, angled, and partial faces
- 🗄️ **Criminal Database** — Add, search, and manage criminal records with photo enrollment
- 🔔 **Instant Alerts** — Real-time threat notifications with confidence score and bounding box
- 🔐 **Role-Based Access** — Admin, Officer, and Viewer roles with separate permissions
- 📊 **Security Analytics** — Audit logs, detection history, and activity tracking
- 🔒 **Secure Auth** — PBKDF2 password hashing + HMAC-signed tokens via Web Crypto API
- 🌐 **Hybrid Detection** — Falls back to browser model if backend is offline

---

## 🏗️ Architecture

```
Browser (React + Vite)
    │
    ├── Supabase (PostgreSQL) — criminal records, face descriptors, auth
    │
    └── Python Backend (FastAPI + dlib) — face detection & matching
            └── CNN model — handles straight, tilted, angled faces
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18+
- Python 3.11
- A Supabase account (free)

### 1. Clone & Install Frontend
```bash
git clone https://github.com/yourusername/VigiByte.git
cd VigiByte
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Fill in your values in .env
```

### 3. Start Python Backend
```bash
cd backend
pip install -r requirements.txt        # First time only — takes ~5 min (dlib compiles)
& "C:\Program Files\Python311\python.exe" -m uvicorn main:app --reload --port 8001
# On Mac/Linux: python3 -m uvicorn main:app --reload --port 8001
```

### 4. Start Frontend
```bash
# In project root (new terminal)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_JWT_SECRET=your-random-secret-min-32-chars
VITE_APP_NAME=VigiByte
VITE_BACKEND_URL=http://localhost:8001
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase public/anon key |
| `VITE_JWT_SECRET` | ✅ | Secret for signing session tokens (min 32 chars) |
| `VITE_BACKEND_URL` | ✅ | Python backend URL (local or Render) |
| `VITE_APP_NAME` | No | Display name (default: VigiByte) |

Get Supabase keys from: [supabase.com](https://supabase.com) → Project Settings → API

---

## 🗃️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Storage) |
| Face Detection | Python — face_recognition (dlib CNN) |
| Browser Fallback | @vladmandic/face-api (TinyFaceDetector) |
| Auth | Web Crypto API (PBKDF2 + HMAC-SHA256) |
| Charts | Recharts |
| Icons | Lucide React |

---

## 👤 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — create, read, update, delete, manage users |
| **Officer** | Create, read, update records |
| **Viewer** | Read-only access |

---

## 📁 Project Structure

```
VigiByte/
├── src/
│   ├── components/
│   │   ├── AuthPanel.jsx       # Login / Register UI
│   │   ├── CameraFeed.jsx      # Live camera + face detection
│   │   ├── CriminalDB.jsx      # Criminal records management
│   │   ├── Dashboard.jsx       # Main dashboard + analytics
│   │   └── AlertPanel.jsx      # Real-time alert notifications
│   ├── lib/
│   │   ├── faceRecognition.js  # Backend API bridge + browser fallback
│   │   ├── supabase.js         # Supabase client
│   │   └── detectionHistory.js # Detection event storage (IndexedDB)
│   └── services/
│       └── browserAuth.js      # PBKDF2 auth + JWT session manager
├── backend/
│   ├── main.py                 # FastAPI app — /detect, /get-descriptor
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Container config for deployment
│   └── render.yaml             # Render.com deployment config
├── public/
│   └── models/                 # face-api.js browser model files
├── .env.example                # Environment variable template
└── README.md
```

---

## 🔐 Security

- Passwords hashed with **PBKDF2** (10,000 iterations, SHA-256)
- Sessions signed with **HMAC-SHA256** tokens
- Rate limiting — 5 login attempts per 15 minutes
- Audit logging via IndexedDB
- Supabase Row Level Security (RLS) enabled
- CSP headers configured in Vite

---

## 🐳 Docker (Optional)

```bash
docker-compose up
```

> Includes optional local PostgreSQL. Main app uses Supabase cloud by default.

---

## 📄 License

MIT License