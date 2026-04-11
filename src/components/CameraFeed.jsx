import { useEffect, useRef, useState, useCallback } from 'react'
import * as faceapi from '@vladmandic/face-api'
import { getStream } from '../lib/streamManager'
import { loadModels, detectAllCriminals, detectAllCriminalsBrowserFallback, checkBackend } from '../lib/faceRecognition'
import { detectionHistory, captureScreenshot } from '../lib/detectionHistory'
import { AlertCircle, Users, Zap, WifiOff, Server } from 'lucide-react'

export default function CameraFeed({ activeCamera, onAlert, user, onDetectedCriminalsChange }) {
  const videoRef = useRef(null)
  const imgRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const criminalsRef = useRef([])
  const activeCameraRef = useRef(activeCamera)
  const lastBoxRef = useRef({})
  const backendOkRef = useRef(true)

  const [detectedCriminals, setDetectedCriminals] = useState([])
  const [scanCount, setScanCount] = useState(0)
  const [scanSpeed, setScanSpeed] = useState(0)
  const [totalFaces, setTotalFaces] = useState(0)
  const [backendStatus, setBackendStatus] = useState('checking') // 'ok' | 'offline' | 'checking'

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

  useEffect(() => { activeCameraRef.current = activeCamera }, [activeCamera])

  useEffect(() => {
    if (!activeCamera) return
    let cancelled = false

    async function startScanning() {
      try {
        // Check backend availability
        const ok = await checkBackend()
        backendOkRef.current = ok
        setBackendStatus(ok ? 'ok' : 'offline')

        if (!ok) {
          // Load browser models as fallback
          await loadModels()
          console.warn('⚠️ Backend offline — using browser fallback (reduced angle detection)')
        }

        await loadCriminals()

        if (activeCamera.type === 'webcam') {
          const stream = await getStream(activeCamera.id)
          if (cancelled) return
          if (videoRef.current) videoRef.current.srcObject = stream
        }

        if (!cancelled) startDetectionLoop()
      } catch (err) {
        console.error('Scanner Error', err)
      }
    }

    startScanning()
    return () => {
      cancelled = true
      clearInterval(intervalRef.current)
      setDetectedCriminals([])
    }
  }, [activeCamera?.id])

  useEffect(() => {
    if (onDetectedCriminalsChange) onDetectedCriminalsChange(detectedCriminals)
  }, [detectedCriminals, onDetectedCriminalsChange])

  function drawBox(ctx, box, color, label) {
    if (!box || box.x == null || box.y == null) return
    const { x, y, width, height } = box
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.strokeRect(x, y, width, height)
    if (label) {
      ctx.fillStyle = color
      ctx.fillRect(x, y - 32, width, 32)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px monospace'
      ctx.fillText(label, x + 8, y - 10)
    }
  }

  function startDetectionLoop() {
    clearInterval(intervalRef.current)

    intervalRef.current = setInterval(async () => {
      const start = performance.now()
      const camera = activeCameraRef.current
      const element = camera.type === 'webcam' ? videoRef.current : imgRef.current
      if (!element || !canvasRef.current) return

      const displaySize = {
        width: element.videoWidth || element.naturalWidth || 640,
        height: element.videoHeight || element.naturalHeight || 480
      }
      faceapi.matchDimensions(canvasRef.current, displaySize)

      // Use backend if available, else browser fallback
      const matches = backendOkRef.current
        ? await detectAllCriminals(element, criminalsRef.current)
        : await detectAllCriminalsBrowserFallback(element, criminalsRef.current)

      setScanSpeed(Math.round(performance.now() - start))
      setScanCount(c => c + 1)

      // Pehle check karo ki canvas exist karta hai ya nahi
      if (!canvasRef.current) return; 

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return; // Safer check

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // Face count — lightweight detection for counter only
      let faceCount = matches.length
      if (!backendOkRef.current) {
        try {
          const dets = await faceapi.detectAllFaces(element,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          faceCount = Math.max(dets.length, matches.length)
        } catch { }
      }
      setTotalFaces(faceCount)

      if (matches.length > 0) {
        const screenshot = await captureScreenshot(element)

        matches.forEach(match => {
          const box = match.boundingBox
          if (box && box.x != null) lastBoxRef.current[match.id] = box
          drawBox(ctx, lastBoxRef.current[match.id], '#ef4444', `${match.name} ${match.confidence}%`)

          detectionHistory.saveDetection({
            criminal: match,
            camera,
            confidence: match.confidence,
            screenshot,
            user_id: user?.id,
            user_email: user?.email
          }).catch(() => { })
        })

        setDetectedCriminals(prev => {
          const now = Date.now()
          const updated = [...prev]
          matches.forEach(match => {
            const idx = updated.findIndex(c => c.id === match.id)
            if (idx !== -1) {
              updated[idx] = { ...match, lastSeen: now, detectionCount: (updated[idx].detectionCount || 0) + 1, firstSeen: updated[idx].firstSeen, screenshot }
            } else {
              updated.push({ ...match, lastSeen: now, firstSeen: now, detectionCount: 1, screenshot })
            }
          })
          return updated.filter(c => now - c.lastSeen < 5000)
        })

        matches.forEach(match => onAlert(match, camera, matches.length, null, match.confidence))

      } else {
        // Clear stale boxes
        Object.keys(lastBoxRef.current).forEach(id => delete lastBoxRef.current[id])
      }

    }, 500) // 500ms — gives backend time to respond
  }

  return (
    <div className="space-y-6">
      <div className="relative bg-[#020617] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
        {activeCamera.type === 'webcam' ? (
          <video ref={videoRef} autoPlay muted playsInline
            className="w-full h-auto max-h-[500px] object-contain opacity-90" />
        ) : (
          <img ref={imgRef} src={activeCamera.source} crossOrigin="anonymous"
            className="w-full h-auto max-h-[500px] object-contain opacity-90" alt="ip-feed" />
        )}
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

        {/* Status Badge */}
        <div className="absolute top-6 left-6 flex items-center gap-2 bg-slate-950/80 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 font-sans">
            Neural Analysis Active
          </span>
        </div>

        {/* Stats */}
        <div className="absolute top-6 right-6 flex gap-2">
          {/* Backend status indicator */}
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
          <div className="bg-slate-950/80 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-yellow-500" />
              <span className="text-[10px] font-bold text-slate-300">{scanSpeed}ms</span>
            </div>
          </div>
          <div className="bg-slate-950/80 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Users size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold text-slate-300">{totalFaces} faces</span>
            </div>
          </div>
        </div>

        {/* Threat Banner */}
        {detectedCriminals.length > 0 && (
          <div className="absolute bottom-6 left-6 right-6 bg-red-600/90 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-red-400 shadow-2xl animate-pulse">
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