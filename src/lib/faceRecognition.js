/**
 * faceRecognition.js
 * 
 * Now delegates to Python backend (FastAPI + dlib CNN) for production-grade detection.
 * Browser face-api models kept ONLY for face enrollment preview in CriminalDB.
 * 
 * Backend handles: tilted, angled, partial faces — all properly detected.
 */

import * as faceapi from '@vladmandic/face-api'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8001'

let modelsLoaded = false
let loadingPromise = null

// ── Browser models (enrollment preview only) ──────────────────────────────────

export async function loadModels() {
  if (modelsLoaded) return
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      const MODEL_URL = '/models'
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ])
      modelsLoaded = true
      console.log('✅ Browser models loaded (enrollment only)')
    } catch (error) {
      loadingPromise = null
      throw error
    }
  })()

  return loadingPromise
}

// ── Backend API calls ─────────────────────────────────────────────────────────

/**
 * Check if backend is reachable
 */
export async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(20000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Get face descriptor from image via backend (dlib CNN).
 * Called during criminal enrollment in CriminalDB.
 * Replaces browser getFaceDescriptor() for storage in Supabase.
 */
export async function getFaceDescriptorFromBackend(imageBase64) {
  const res = await fetch(`${BACKEND_URL}/get-descriptor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64 })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Backend descriptor extraction failed')
  }

  const data = await res.json()
  return data.descriptor  // 128-float array
}

/**
 * Detect criminals in a video frame via backend.
 * Main detection loop — replaces browser detectAllCriminals().
 * Returns same format as before so CameraFeed works unchanged.
 */
export async function detectAllCriminals(videoElement, criminals) {
  if (!videoElement || videoElement.readyState < 2) return []
  if (!criminals?.length) return []

  try {
    // Capture frame from video to canvas
    const canvas = document.createElement('canvas')
    canvas.width = videoElement.videoWidth || 640
    canvas.height = videoElement.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoElement, 0, 0)

    // Convert to base64 JPEG (0.7 quality — good balance for speed)
    const frameBase64 = canvas.toDataURL('image/jpeg', 0.7)

    const res = await fetch(`${BACKEND_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame_base64: frameBase64,
        criminals: criminals.map(c => ({
          id: c.id,
          name: c.name,
          face_descriptor: Array.isArray(c.face_descriptor)
            ? c.face_descriptor
            : c.face_descriptor ? Array.from(c.face_descriptor) : null,
          // Pass through all fields for alert panel
          age: c.age,
          crime: c.crime,
          crime_date: c.crime_date,
          danger_level: c.danger_level,
          photo_url: c.photo_url
        })).filter(c => c.face_descriptor),
        threshold: 0.5
      })
    })

    if (!res.ok) return []

    const data = await res.json()

    // Return in same format CameraFeed expects
    return data.matches.map(m => ({
      ...m,
      confidence: m.confidence,
      boundingBox: m.boundingBox
    }))

  } catch (error) {
    console.error('Backend detection failed:', error)
    return []
  }
}

/**
 * Browser fallback — used only if backend is unreachable.
 * Less accurate for tilted faces but better than nothing.
 */
export async function detectAllCriminalsBrowserFallback(videoElement, criminals) {
  if (!modelsLoaded) await loadModels()
  if (!videoElement || videoElement.readyState < 2) return []

  try {
    const detections = await faceapi
      .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.3
      }))
      .withFaceLandmarks()
      .withFaceDescriptors()

    if (!detections?.length) return []

    const THRESHOLD = 0.52
    const matches = []

    for (const detection of detections) {
      let bestMatch = null
      let bestDistance = Infinity

      for (const criminal of criminals) {
        if (!criminal.face_descriptor) continue
        const stored = criminal.face_descriptor instanceof Float32Array
          ? criminal.face_descriptor
          : new Float32Array(criminal.face_descriptor)
        const distance = faceapi.euclideanDistance(detection.descriptor, stored)
        if (distance < THRESHOLD && distance < bestDistance) {
          bestDistance = distance
          bestMatch = {
            ...criminal,
            confidence: Math.round((1 - distance) * 100),
            boundingBox: detection.detection.box
          }
        }
      }
      if (bestMatch) matches.push(bestMatch)
    }
    return matches
  } catch (err) {
    console.error('Browser fallback failed:', err)
    return []
  }
}

// Legacy exports (kept for compatibility)
export async function getFaceDescriptor(imageElement) {
  if (!modelsLoaded) await loadModels()
  try {
    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    return detection ? detection.descriptor : null
  } catch { return null }
}

export function preprocessCriminals(criminals) {
  return criminals.map(c => ({
    ...c,
    face_descriptor: c.face_descriptor instanceof Float32Array
      ? c.face_descriptor
      : c.face_descriptor ? new Float32Array(c.face_descriptor) : null
  }))
}