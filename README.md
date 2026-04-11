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
🛡️ VigiByte — AI-Powered Security Intelligence PlatformVigiByte is a production-grade, real-time surveillance and criminal identification system. It utilizes a Hybrid AI Architecture—combining high-performance Python-based CNN detection with browser-side fallback mechanisms to ensure 24/7 law enforcement monitoring.🏗️ Hybrid Architecture OverviewVigiByte operates on a dual-engine AI system:Primary Engine (Cloud/Edge): A Python FastAPI backend utilizing dlib's CNN (Convolutional Neural Network) for robust detection of angled, tilted, or partially occluded faces.Fallback Engine (Browser): Client-side face-api.js execution for real-time tracking and low-latency preprocessing.✨ Features🎥 Live Surveillance Hub — Multi-camera stream management with active tracking.🤖 Deep Learning Identification — Uses SsdMobilenetv1 and dlib CNN for forensic-grade accuracy.🗄️ Criminal Registry — Cloud-synced database with automatic biometric face enrollment.🔔 Instant Risk Alerts — Real-time visual and audio notifications for "High Risk" detections.📊 Forensic Analytics — Detailed detection history with captured screenshots and geolocation data.🔐 Zero-Cost Security — Enterprise-grade Auth (PBKDF2 + HMAC) using native browser Web Crypto API.🛠️ Tech StackLayerTechnologyFrontendReact 19 + Vite + Tailwind CSS v4AI BackendPython 3.10 + FastAPI + dlib (CNN)DatabaseSupabase (PostgreSQL) + Row Level Security (RLS)Computer Visionface-api.js + Roboflow (Person Counting)Auth & EncryptionWeb Crypto API (PBKDF2 SHA-256)DeploymentDocker & Docker Compose🚀 Quick Start1. PrerequisitesNode.js (v18+)Python (v3.10+)Docker (Optional for local stack)2. Backend Setup (AI Engine)Bashcd backend
pip install -r requirements.txt
python main.py
3. Frontend SetupBash# From the root directory
npm install
cp .env.example .env  # Configure your Supabase & Backend URLs
npm run dev
📁 Project StructureVigiByte/
├── backend/                # Python AI Engine (FastAPI + dlib)
│   ├── main.py             # Recognition logic & API endpoints
│   └── Dockerfile          # Containerization for AI engine
├── public/
│   └── models/             # Pre-trained Weights (SsdMobilenet, Landmarks)
├── src/
│   ├── components/         # UI: CameraFeed, Dashboard, AlertPanel
│   ├── lib/                # Logic: faceRecognition, detectionHistory, supabase
│   ├── services/           # Auth: browserAuth, roboflow (Scene Analysis)
│   ├── utils/              # Testing: securityTests.js
│   └── App.jsx             # Main Controller
├── .env                    # System Configuration
└── docker-compose.yml      # Full-stack Orchestration
🔐 Security ProtocolsBiometric Integrity: Face descriptors are stored as 128-dimensional vectors (Biometric Hashing).Session Security: HMAC-SHA256 signed JWTs with automatic 24h expiration.Brute Force Protection: Client-side rate limiting (5 attempts per window).Audit Logging: Every action is logged in an immutable IndexedDB audit trail.🐳 ContainerizationDeploy the entire intelligence stack (Web + AI Backend + Local DB) with a single command:Bashdocker-compose up --build
👤 User RolesAdmin: Full forensics, user management, and record deletion.Officer: Live monitoring, record creation, and history search.Viewer: Monitoring only (Read-only).📄 LicenseMIT License. Developed as a high-security Information Technology final-year project (Batch 2026).
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