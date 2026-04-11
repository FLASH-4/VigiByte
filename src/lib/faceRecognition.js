/**
 * faceRecognition.js
 * * VigiByte Facial Recognition Engine
 * * Purpose: This module acts as the interface between the VigiByte frontend and the 
 * high-performance Python AI backend (FastAPI + dlib CNN). It manages hybrid 
 * recognition logic by prioritizing server-side processing for complex angle 
 * detection while maintaining browser-side fallbacks for reliability.
 */

import * as faceapi from '@vladmandic/face-api'

// Define the endpoint for the Python AI Engine
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8001'

let modelsLoaded = false
let loadingPromise = null

// ── BROWSER MODELS (ENROLLMENT PREVIEW ONLY) ──────────────────────────────────

/**
 * Loads the lightweight browser-based models.
 * Used primarily for real-time face validation during the criminal enrollment process.
 */
export async function loadModels() {
  if (modelsLoaded) return
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      const MODEL_URL = '/models'
      // Load TinyFaceDetector for speed and landmark/recognition nets for feature extraction
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

// ── BACKEND API CALLS ─────────────────────────────────────────────────────────

/**
 * Health Check
 * Verifies if the VigiByte Python AI Engine is reachable and responsive.
 */
export async function checkBackend() {
  try {
    // Ping the backend health endpoint with a 20-second timeout
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(20000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Remote Feature Extraction
 * Sends a base64 image to the dlib CNN backend to extract a 128-dimensional 
 * facial descriptor vector. CNN is preferred for superior tilted/angled face detection.
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
  return data.descriptor  // Return the extracted 128-float array
}

/**
 * Remote Detection Loop
 * Primary identification function. Captures a video frame, compresses it to 
 * JPEG base64, and transmits it to the backend for comparison against the registry.
 */
export async function detectAllCriminals(videoElement, criminals) {
  if (!videoElement || videoElement.readyState < 2) return []
  if (!criminals?.length) return []

  try {
    // Capture current video frame using an off-screen canvas
    const canvas = document.createElement('canvas')
    canvas.width = videoElement.videoWidth || 640
    canvas.height = videoElement.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoElement, 0, 0)

    // Convert frame to Base64 JPEG at 70% quality for optimal bandwidth/speed balance
    const frameBase64 = canvas.toDataURL('image/jpeg', 0.7)

    const res = await fetch(`${BACKEND_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame_base64: frameBase64,
        criminals: criminals.map(c => ({
          id: c.id,
          name: c.name,
          // Normalize face_descriptor to array format before transmission
          face_descriptor: Array.isArray(c.face_descriptor)
            ? c.face_descriptor
            : c.face_descriptor ? Array.from(c.face_descriptor) : null,
          age: c.age,
          crime: c.crime,
          crime_date: c.crime_date,
          danger_level: c.danger_level,
          photo_url: c.photo_url
        })).filter(c => c.face_descriptor), // Only send criminals with valid descriptors
        threshold: 0.5 // Strictness level for positive identification
      })
    })

    if (!res.ok) return []

    const data = await res.json()

    // Map the results back into the format expected by the CameraFeed UI
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
 * Browser-Side Fallback Inference
 * Invoked only if the Python AI Engine is unreachable. 
 * Performs Euclidean distance calculations directly in the browser using face-api.js.
 */
export async function detectAllCriminalsBrowserFallback(videoElement, criminals) {
  if (!modelsLoaded) await loadModels()
  if (!videoElement || videoElement.readyState < 2) return []

  try {
    // Perform multi-face detection and feature extraction in the browser
    const detections = await faceapi
      .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.3
      }))
      .withFaceLandmarks()
      .withFaceDescriptors()

    if (!detections?.length) return []

    const THRESHOLD = 0.52 // Euclidean distance limit for browser-side matching
    const matches = []

    for (const detection of detections) {
      let bestMatch = null
      let bestDistance = Infinity

      for (const criminal of criminals) {
        if (!criminal.face_descriptor) continue
        
        // Ensure comparison against Float32Array format
        const stored = criminal.face_descriptor instanceof Float32Array
          ? criminal.face_descriptor
          : new Float32Array(criminal.face_descriptor)
          
        const distance = faceapi.euclideanDistance(detection.descriptor, stored)
        
        // Match selection based on the lowest mathematical distance
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

/**
 * Single Face Capture (Legacy/Enrollment)
 * Identifies a single face in a provided image element.
 */
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

/**
 * Data Sanitization
 * Pre-processes the criminal list to ensure all face descriptors are typed correctly.
 */
export function preprocessCriminals(criminals) {
  return criminals.map(c => ({
    ...c,
    face_descriptor: c.face_descriptor instanceof Float32Array
      ? c.face_descriptor
      : c.face_descriptor ? new Float32Array(c.face_descriptor) : null
  }))
}