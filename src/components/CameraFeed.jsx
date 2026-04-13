import { useEffect, useRef, useState, useCallback } from 'react'
import * as faceapi from '@vladmandic/face-api'
import { getStream } from '../lib/streamManager'
import { loadModels, detectAllCriminals, detectAllCriminalsBrowserFallback, checkBackend } from '../lib/faceRecognition'
import { detectionHistory, captureScreenshot } from '../lib/detectionHistory'
import { AlertCircle, Users, Zap, WifiOff, Server } from 'lucide-react'

/**
 * CameraFeed Component
 * Purpose: Manages live video streams and coordinates real-time face detection.
 * It implements a hybrid architecture: using a Python backend for high-accuracy CNN detection
 * and falling back to browser-based TinyFaceDetector if the backend is unreachable.
 */
export default function CameraFeed({ activeCamera, onAlert, user, onDetectedCriminalsChange }) {
  // --- REFS FOR STABLE STATE ---
  const videoRef = useRef(null)          // Reference to the hidden/visible video element
  const imgRef = useRef(null)            // Reference for IP camera/static image feeds
  const canvasRef = useRef(null)         // Overlay canvas for drawing detection boxes
  const intervalRef = useRef(null)       // Store the interval ID for cleanup
  const criminalsRef = useRef([])        // In-memory cache of known criminal records
  const activeCameraRef = useRef(activeCamera) // Track camera state without triggering re-renders
  const lastBoxRef = useRef({})          // Cache for bounding boxes to prevent visual flickering
  const backendOkRef = useRef(true)      // Fast-access ref to check server health status

  // --- COMPONENT STATES ---
  const [detectedCriminals, setDetectedCriminals] = useState([]) // List of currently identified subjects
  const [scanCount, setScanCount] = useState(0)                  // Total detection cycles completed
  const [scanSpeed, setScanSpeed] = useState(0)                  // Latency in milliseconds per scan
  const [totalFaces, setTotalFaces] = useState(0)                // Count of all faces in frame (known + unknown)
  const [backendStatus, setBackendStatus] = useState('checking') // UI state for system health monitoring

  /**
   * Loads the criminal database from Supabase REST API.
   * Uses headers for API key authentication.
   */
  async function loadCriminals() {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/criminals?select=*`, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    })
    const data = await res.json()
    criminalsRef.current = Array.isArray(data) ? data : []
    console.log(`✅ Loaded ${criminalsRef.current.length} criminals`)
  }

  // Keep the reference updated to the latest camera selection
  useEffect(() => { activeCameraRef.current = activeCamera }, [activeCamera])

  /**
   * INITIALIZATION EFFECT:
   * Checks backend health, loads models, and starts the video stream.
   */
  useEffect(() => {
    if (!activeCamera) return
    let cancelled = false // Flag to prevent memory leaks on unmount

    async function startScanning() {
      try {
        const ok = await checkBackend(); // Ping the FastAPI server
        backendOkRef.current = ok;
        setBackendStatus(ok ? 'ok' : 'offline');

        if (!ok) {
          await loadModels(); // If server is down, load face-api.js models in browser
          console.warn('⚠️ Backend offline — using browser fallback (reduced accuracy)');
        }

        await loadCriminals(); // Fetch known subjects from database

        if (activeCamera.type === 'webcam') {
          const stream = await getStream(activeCamera.id); // Access local camera hardware
          if (cancelled) return;
          if (videoRef.current) videoRef.current.srcObject = stream;
        }

        if (!cancelled) startDetectionLoop(); // Trigger the recurring detection process
      } catch (err) {
        console.error('Scanner Error', err);
      }
    }

    startScanning()
    return () => {
      cancelled = true;
      clearInterval(intervalRef.current); // Stop the loop when component is destroyed
      setDetectedCriminals([]);
    }
  }, [activeCamera?.id])

  // Propagate detected criminals list to parent component for global alerts
  useEffect(() => {
    if (onDetectedCriminalsChange) onDetectedCriminalsChange(detectedCriminals)
  }, [detectedCriminals, onDetectedCriminalsChange])

  /**
   * DRAWING UTILITY
   * Renders the red bounding box and identification label on the canvas overlay.
   */
  function drawBox(ctx, box, color, label) {
    if (!box || box.x == null || box.y == null) return
    const { x, y, width, height } = box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height); // Draw the box
    if (label) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 32, width, 32); // Draw label background
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(label, x + 8, y - 10); // Draw name and confidence
    }
  }

  /**
   * CORE DETECTION LOOP
   * Runs every 500ms to process frames and identify subjects.
   */
  function startDetectionLoop() {
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      const start = performance.now(); // Start performance timer
      const camera = activeCameraRef.current;
      const element = camera.type === 'webcam' ? videoRef.current : imgRef.current;
      if (!element || !canvasRef.current) return;

      // Ensure canvas matches the dimensions of the video stream
      const displaySize = {
        width: element.videoWidth || element.naturalWidth || 640,
        height: element.videoHeight || element.naturalHeight || 480
      }
      faceapi.matchDimensions(canvasRef.current, displaySize)

      // EXECUTE DETECTION: Decide between Server-side CNN or Browser-side HOG/TinyFace
      const matches = backendOkRef.current
        ? await detectAllCriminals(element, criminalsRef.current)
        : await detectAllCriminalsBrowserFallback(element, criminalsRef.current);

      setScanSpeed(Math.round(performance.now() - start)); // Update latency metric
      setScanCount(c => c + 1);

      if (!canvasRef.current) return; 
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return; 

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); // Wipe canvas for new frame

      // Light detection to count total faces (even if they aren't criminals)
      let faceCount = matches.length
      if (!backendOkRef.current) {
        try {
          const dets = await faceapi.detectAllFaces(element,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          faceCount = Math.max(dets.length, matches.length)
        } catch { }
      }
      setTotalFaces(faceCount);

      // --- MATCH LOGIC & HISTORY SAVING ---
      if (matches.length > 0) {
        const screenshot = await captureScreenshot(element); // Capture frame for evidence

        matches.forEach(match => {
          const box = match.boundingBox
          if (box && box.x != null) lastBoxRef.current[match.id] = box;
          drawBox(ctx, lastBoxRef.current[match.id], '#ef4444', `${match.name} ${match.confidence}%`);

          // Log the detection to Supabase for the Audit Trail
          detectionHistory.saveDetection({
            criminal: match,
            camera,
            confidence: match.confidence,
            screenshot,
            user_id: user?.id,
            user_email: user?.email
          }).catch(() => { }); // Fail silently to keep stream smooth
        })

        // UPDATE UI STATE: Mark subjects as detected and handle "Stale" filtering
        setDetectedCriminals(prev => {
          const now = Date.now();
          const updated = [...prev];
          matches.forEach(match => {
            const idx = updated.findIndex(c => c.id === match.id);
            if (idx !== -1) {
              updated[idx] = { ...match, lastSeen: now, detectionCount: (updated[idx].detectionCount || 0) + 1, firstSeen: updated[idx].firstSeen, screenshot };
            } else {
              updated.push({ ...match, lastSeen: now, firstSeen: now, detectionCount: 1, screenshot });
            }
          })
          // Auto-remove criminals who haven't been seen in the last 5 seconds
          return updated.filter(c => now - c.lastSeen < 5000);
        })

        matches.forEach(match => onAlert(match, camera, matches.length, null, match.confidence));

      } else {
        Object.keys(lastBoxRef.current).forEach(id => delete lastBoxRef.current[id]); // Clear old boxes
      }

    }, 800) // 500ms Interval: Balancing speed vs CPU load
  }

  return (
    <div className="space-y-6">
      <div className="relative bg-[#020617] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
        {/* Dynamic Source Selection */}
        {activeCamera.type === 'webcam' ? (
          <video ref={videoRef} autoPlay muted playsInline
            className="w-full h-auto max-h-[500px] object-contain opacity-90" />
        ) : (
          <img ref={imgRef} src={activeCamera.source} crossOrigin="anonymous"
            className="w-full h-auto max-h-[500px] object-contain opacity-90" alt="ip-feed" />
        )}
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

        {/* STATUS BADGE: Top Left */}
        <div className="absolute top-2 sm:top-6 left-2 sm:left-6 flex items-center gap-2 bg-slate-950/80 px-2 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 font-sans">
            Neural Analysis Active
          </span>
        </div>

        {/* ANALYTICS HUD: Top Right */}
        <div className="absolute top-2 sm:top-6 right-2 sm:right-6 flex gap-1 sm:gap-2 flex-wrap justify-end max-w-[55%]">
          {/* Backend Health Metric */}
          <div className="bg-slate-950/80 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
              {backendStatus === 'ok'
                ? <Server size={12} className="text-green-400" />
                : backendStatus === 'offline'
                  ? <WifiOff size={12} className="text-yellow-500" />
                  : <Server size={12} className="text-slate-500 animate-pulse" />
              }
              <span className={`text-[10px] font-bold ${backendStatus === 'ok' ? 'text-green-400' : backendStatus === 'offline' ? 'text-yellow-500' : 'text-slate-500'}`}>
                {backendStatus === 'ok' ? 'AI' : backendStatus === 'offline' ? 'Fallback' : '...'}
              </span>
            </div>
          </div>
          {/* Latency Metric */}
          <div className="bg-slate-950/80 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-yellow-500" />
              <span className="text-[10px] font-bold text-slate-300">{scanSpeed}ms</span>
            </div>
          </div>
          {/* Crowd Count Metric */}
          <div className="bg-slate-950/80 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Users size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold text-slate-300">{totalFaces} faces</span>
            </div>
          </div>
        </div>

        {/* CRITICAL THREAT BANNER: Appears only when identification occurs */}
        {detectedCriminals.length > 0 && (
          <div className="absolute bottom-2 sm:bottom-6 left-2 sm:left-6 right-2 sm:right-6 bg-red-600/90 backdrop-blur-md px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border-2 border-red-400 shadow-2xl animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-white" />
                <div>
                  <p className="text-white font-bold text-sm">⚠️ THREAT DETECTED</p>
                  <p className="text-red-100 text-xs">{detectedCriminals.length} criminal(s) identified</p>
                </div>
              </div>
              <div className="text-white font-bold text-2xl">{detectedCriminals.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* QUIET SCANNING INDICATOR */}
      {detectedCriminals.length === 0 && scanCount > 5 && (
        <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-4 text-center">
          <div className="text-slate-500 text-xs font-medium">✅ No threats detected - Scanning in progress...</div>
          <div className="text-slate-600 text-[10px] mt-1">
            Scanned {scanCount} times • {totalFaces} face{totalFaces !== 1 ? 's' : ''} in frame
            {backendStatus === 'offline' && ' • ⚠️ Backend offline, using browser fallback'}
          </div>
        </div>
      )}
    </div>
  )
}