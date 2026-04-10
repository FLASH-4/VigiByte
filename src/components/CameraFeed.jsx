import { useEffect, useRef, useState, useCallback } from 'react'
import * as faceapi from '@vladmandic/face-api'
import { getStream } from '../lib/streamManager'
import { loadModels, getAllFaceDescriptors, matchFace } from '../lib/faceRecognition'

export default function CameraFeed({ activeCamera, onAlert }) {
  const videoRef = useRef(null)
  const imgRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const criminalsRef = useRef([])
  const activeCameraRef = useRef(activeCamera)
  const [scanCount, setScanCount] = useState(0)

  async function loadCriminals() {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/criminals?select=*`, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    })
    const data = await res.json()
    criminalsRef.current = Array.isArray(data) ? data : []
  }

  useEffect(() => {
    activeCameraRef.current = activeCamera
  }, [activeCamera])

  useEffect(() => {
    if (!activeCamera) return
    let cancelled = false

    async function startScanning() {
      try {
        await loadModels()
        await loadCriminals()

        if (activeCamera.type === 'webcam') {
          // Reuse the stream GridNode already acquired — no new getUserMedia
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
      // DO NOT stop tracks — GridNode still needs them
    }
  }, [activeCamera?.id]) // ← only re-run when camera actually changes

  function startDetectionLoop() {
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(async () => {
      const camera = activeCameraRef.current
      const element = camera.type === 'webcam' ? videoRef.current : imgRef.current
      if (!element || !canvasRef.current) return

      const displaySize = {
        width: element.videoWidth || element.naturalWidth || 640,
        height: element.videoHeight || element.naturalHeight || 480
      }

      faceapi.matchDimensions(canvasRef.current, displaySize)
      const detections = await getAllFaceDescriptors(element)

      setScanCount(c => c + 1)
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      const resized = faceapi.resizeResults(detections, displaySize)

      for (const det of resized) {
        const { x, y, width, height } = det.detection.box
        const match = matchFace(det.descriptor, criminalsRef.current)

        if (match) {
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; ctx.strokeRect(x, y, width, height)
          ctx.fillStyle = '#ef4444'; ctx.fillRect(x, y - 35, width, 35)
          ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Inter'
          ctx.fillText(`${match.name}`, x + 10, y - 12)
          onAlert(match, camera, 1, null, match.confidence)
        } else {
          ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height)
        }
      }
    }, 1000)
  }

  return (
    <div className="relative bg-[#020617] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl group">
      {activeCamera.type === 'webcam' ? (
        <video ref={videoRef} autoPlay muted playsInline
          className="w-full h-auto max-h-[500px] object-contain opacity-90" />
      ) : (
        <img ref={imgRef} src={activeCamera.source} crossOrigin="anonymous"
          className="w-full h-auto max-h-[500px] object-contain opacity-90" alt="ip-feed" />
      )}
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
      <div className="absolute top-6 left-6 flex items-center gap-2 bg-slate-950/80 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 font-sans">
          Neural Analysis Session
        </span>
      </div>
    </div>
  )
}