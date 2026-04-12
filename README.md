# 🛡️ VigiByte — AI-Powered Security Intelligence Platform

VigiByte is a real-time criminal identification system built for law enforcement. It uses live camera feeds and AI facial recognition to detect known criminals instantly, with a Python backend for production-grade detection of tilted and angled faces.

🌐 **Live Demo:** [vigi-byte.vercel.app](https://vigi-byte.vercel.app)

---

## ✨ Features

- 🎥 **Live Surveillance** — Webcam & IP camera support with real-time video feed
- 🤖 **AI Face Recognition** — Python backend (DeepFace + Facenet + SSD) handles tilted, angled, and partial faces
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
        ├── Supabase (PostgreSQL) — criminal records, face descriptors, photo storage
        │
        └── Python Backend (FastAPI + DeepFace)  →  flash-04-vigibyte-api.hf.space
                └── Facenet + SSD — handles straight, tilted, angled faces
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

> `DATABASE_URL` in `.env.example` is optional — only needed if running local PostgreSQL via Docker. Main app uses Supabase cloud.

---

## 🌐 Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | [vigi-byte.vercel.app](https://vigi-byte.vercel.app) |
| Backend | Hugging Face Spaces | [flash-04-vigibyte-api.hf.space](https://flash-04-vigibyte-api.hf.space) |
| Database | Supabase | Cloud PostgreSQL |

### Deploy Frontend (Vercel)
1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com) → select **Vite** preset
3. Set environment variables
4. Deploy

### Deploy Backend (Hugging Face Spaces)
1. New Space on [huggingface.co](https://huggingface.co) → SDK: Docker
2. Upload `main.py`, `requirements.txt`, `Dockerfile`, `README.md`
3. Space auto-builds and deploys

> ⚠️ Hugging Face free tier may have cold starts. Use [UptimeRobot](https://uptimerobot.com) to keep it awake (ping every 5 min).

---

## 🗃️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + Vite 8 | Fast build, component-based |
| Styling | Tailwind CSS v4 | Utility-first, no custom CSS |
| Database | Supabase (PostgreSQL) | SQL, built-in storage, RLS, free |
| Face Detection | DeepFace (Facenet + SSD) | Tilted face support, no compilation |
| Browser Fallback | @vladmandic/face-api | Works offline when backend down |
| Auth | Web Crypto API (PBKDF2 + HMAC) | Browser-native, no extra packages |
| Backend | FastAPI (Python) | Fast, async, easy deploy |
| Charts | Recharts | React-native charts |
| Icons | Lucide React | Modern, consistent |

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
│   │   ├── streamManager.js    # Camera stream lifecycle management
│   │   └── detectionHistory.js # Detection event storage (IndexedDB)
│   └── services/
│       └── browserAuth.js      # PBKDF2 auth + JWT session manager
├── backend/
│   ├── main.py                 # FastAPI — /detect, /get-descriptor, /health
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Container config for HF Spaces
│   └── render.yaml             # (Legacy) Render.com config
├── public/
│   └── models/                 # face-api.js browser model files (fallback)
├── .env.example                # Environment variable template
└── README.md
```

---

## 🔐 Security

- Passwords hashed with **PBKDF2** (10,000 iterations, SHA-256) — browser-native
- Sessions signed with **HMAC-SHA256** tokens
- Rate limiting — 5 login attempts per 15 minutes
- Audit logging via IndexedDB
- Supabase Row Level Security (RLS) enabled
- CSP headers configured in Vite
- Camera stream released on logout

---

## 📄 License

MIT License