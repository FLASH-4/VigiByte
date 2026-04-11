import * as faceapi from '@vladmandic/face-api'

let modelsLoaded = false
let loadingPromise = null

// Check for WebGL support (GPU acceleration)
const hasWebGL = (() => {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch (e) {
    return false
  }
})()

console.log(`WebGL Support: ${hasWebGL ? '✅ GPU Available' : '❌ CPU Only'}`)

/**
 * Load face detection models (optimized for speed)
 */
export async function loadModels() {
  if (modelsLoaded) return
  
  if (loadingPromise) {
    return loadingPromise
  }
  
  loadingPromise = (async () => {
    try {
      const MODEL_URL = '/models'
      
      console.log('🔄 Loading face detection models...')
      
      // Load all models in parallel for faster startup
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ])
      
      modelsLoaded = true
      console.log('✅ All models loaded successfully!')
    } catch (error) {
      console.error('❌ Model loading failed:', error)
      loadingPromise = null
      throw error
    }
  })()
  
  return loadingPromise
}

/**
 * ULTRA-FAST: Detect ALL faces and match against criminals
 * Returns array of all matches found in the frame
 * 
 * @param {HTMLVideoElement} videoElement - Video feed
 * @param {Array} criminals - Criminal database
 * @returns {Array} - All criminal matches with confidence
 */
export async function detectAllCriminals(videoElement, criminals) {
  if (!modelsLoaded) {
    await loadModels()
  }
  
  if (!videoElement || videoElement.readyState < 2) {
    return []
  }
  
  try {
    const startTime = performance.now()
    
    // STEP 1: Detect ALL faces at once (parallel GPU processing)
    const detections = await faceapi
      .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 320, // ✅ Smaller = MUCH faster (160 vs 416)
        scoreThreshold: 0.1 // ✅ Lower threshold to catch more faces
      }))
      .withFaceLandmarks()
      .withFaceDescriptors()
    
    if (!detections || detections.length === 0) {
      return []
    }
    
    // STEP 2: Match ALL detected faces against ALL criminals in parallel
    const matches = []
    const THRESHOLD = 0.52
    
    // Process all faces simultaneously
    for (const detection of detections) {
      let bestMatch = null
      let bestDistance = Infinity
      
      // Compare against all criminals
      for (const criminal of criminals) {
        if (!criminal.face_descriptor) continue
        
        const storedDescriptor = criminal.face_descriptor instanceof Float32Array
          ? criminal.face_descriptor
          : new Float32Array(criminal.face_descriptor)
        
        const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor)
        
        if (distance < THRESHOLD && distance < bestDistance) {
          bestDistance = distance
          bestMatch = {
            ...criminal,
            confidence: Math.round((1 - distance) * 100),
            matchDistance: distance,
            boundingBox: detection.detection.box // Store face location
          }
        }
      }
      
      if (bestMatch) {
        matches.push(bestMatch)
      }
    }
    
    const endTime = performance.now()
    const processingTime = Math.round(endTime - startTime)
    
    if (matches.length > 0) {
      console.log(`⚡ Found ${matches.length} criminal(s) in ${processingTime}ms`)
    }
    
    return matches
    
  } catch (error) {
    console.error('Face detection failed:', error)
    return []
  }
}

/**
 * LEGACY: Single face descriptor (kept for compatibility)
 */
export async function getFaceDescriptor(imageElement) {
  if (!modelsLoaded) {
    await loadModels()
  }
  
  try {
    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    
    return detection ? detection.descriptor : null
  } catch (error) {
    console.error('Face descriptor extraction failed:', error)
    return null
  }
}

/**
 * LEGACY: Get all face descriptors (kept for compatibility)
 */
export async function getAllFaceDescriptors(videoElement) {
  if (!modelsLoaded) {
    await loadModels()
  }
  
  try {
    if (!videoElement || videoElement.readyState < 2) {
      return []
    }
    
    const detections = await faceapi
      .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.4
      }))
      .withFaceLandmarks()
      .withFaceDescriptors()
    
    return detections || []
  } catch (error) {
    console.error('Face detection failed:', error)
    return []
  }
}

/**
 * LEGACY: Match single face (kept for compatibility)
 */
export function matchFace(unknownDescriptor, criminals) {
  if (!unknownDescriptor || !criminals || criminals.length === 0) {
    return null
  }
  
  const THRESHOLD = 0.52
  let bestMatch = null
  let bestDistance = Infinity
  
  for (const criminal of criminals) {
    try {
      if (!criminal.face_descriptor) continue
      
      const storedDescriptor = criminal.face_descriptor instanceof Float32Array
        ? criminal.face_descriptor
        : new Float32Array(criminal.face_descriptor)
      
      const distance = faceapi.euclideanDistance(unknownDescriptor, storedDescriptor)
      
      if (distance < THRESHOLD && distance < bestDistance) {
        bestDistance = distance
        bestMatch = {
          ...criminal,
          confidence: Math.round((1 - distance) * 100),
          matchDistance: distance
        }
      }
    } catch (error) {
      console.error(`Error matching criminal ${criminal.id}:`, error)
      continue
    }
  }
  
  return bestMatch
}

/**
 * Performance optimization: Pre-process criminal descriptors
 * Call this once when criminals list changes
 */
export function preprocessCriminals(criminals) {
  return criminals.map(criminal => {
    if (!criminal.face_descriptor) return criminal
    
    return {
      ...criminal,
      face_descriptor: criminal.face_descriptor instanceof Float32Array
        ? criminal.face_descriptor
        : new Float32Array(criminal.face_descriptor)
    }
  })
}

/**
 * Get system performance info
 */
export function getPerformanceInfo() {
  return {
    webglSupport: hasWebGL,
    modelsLoaded,
    backend: hasWebGL ? 'GPU (WebGL)' : 'CPU',
    recommendation: hasWebGL 
      ? 'Good performance expected' 
      : 'Consider enabling GPU acceleration for better performance'
  }
}
