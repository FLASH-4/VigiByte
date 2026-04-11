# 🛡️ VigiByte — AI-Powered Security Intelligence Platform

VigiByte is a real-time criminal identification system built for law enforcement. It uses live camera feeds and AI facial recognition to detect known criminals instantly, with a Python backend for production-grade detection of tilted and angled faces.

🌐 **Live Demo:** [vigi-byte.vercel.app](https://vigi-byte.vercel.app)

---

## ✨ Features

- 🎥 **Live Surveillance** — Webcam & IP camera support with real-time video feed
- 🤖 **AI Face Recognition** — Python backend (DeepFace + Facenet512 + RetinaFace) handles tilted, angled, and partial faces
- 🗄️ **Criminal Database** — Add, search, and manage criminal records with photo enrollment
- 🔔 **Instant Alerts** — Real-time threat notifications with confidence score and bounding box
- 🔐 **Role-Based Access** — Admin, Officer, and Viewer roles with separate permissions
- 📊 **Security Analytics** — Audit logs, detection history, and activity tracking
- 🔒 **Secure Auth** — PBKDF2 password hashing + HMAC-signed tokens via Web Crypto API
- 🌐 **Hybrid Detection** — Falls back to browser model if backend is offline

---

## 🏗️ Architecture

```
Browser (React + Vite)  →  vigi-byte.vercel.app
        │
        ├── Supabase (PostgreSQL) — criminal records, face descriptors
        │
        └── Python Backend (FastAPI + DeepFace)  →  vigi-byte-api.onrender.com
                └── Facenet512 + RetinaFace — handles straight, tilted, angled faces
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18+
- Python 3.11
- Supabase account (free)

### 1. Clone & Install
```bash
git clone https://github.com/FLASH-4/VigiByte.git
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
pip install -r requirements.txt
& "C:\Program Files\Python311\python.exe" -m uvicorn main:app --reload --port 8001
# Mac/Linux: python3 -m uvicorn main:app --reload --port 8001
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
| `VITE_BACKEND_URL` | ✅ | Python backend URL (local or deployed) |
| `VITE_APP_NAME` | No | Display name (default: VigiByte) |

---

## 🌐 Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | [vigi-byte.vercel.app](https://vigi-byte.vercel.app) |
| Backend | Render | [vigi-byte-api.onrender.com](https://vigi-byte-api.onrender.com) |
| Database | Supabase | Cloud PostgreSQL |

### Deploy Frontend (Vercel)
1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Set environment variables
4. Deploy

### Deploy Backend (Render)
1. New Web Service on [render.com](https://render.com)
2. Root Directory: `backend`, Environment: `Docker`
3. Deploy

> ⚠️ Render free tier spins down after inactivity — first request may take ~50 seconds to wake up.

---

## 🗃️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Storage) |
| Face Detection | DeepFace (Facenet512 + RetinaFace) |
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
│   ├── main.py                 # FastAPI — /detect, /get-descriptor, /health
│   ├── requirements.txt        # Python dependencies (DeepFace, FastAPI)
│   ├── Dockerfile              # Container config for Render deployment
│   └── render.yaml             # Render.com deployment config
├── public/
│   └── models/                 # face-api.js browser model files (fallback)
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

## 📄 License

MIT License