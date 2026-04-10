import * as faceapi from '@vladmandic/face-api'

let modelsLoaded = false

export async function loadModels() {
  if (modelsLoaded) return
  const MODEL_URL = '/models'
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  modelsLoaded = true
  console.log('Models loaded!')
}

export async function getFaceDescriptor(imageElement) {
  const detection = await faceapi
    .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
  return detection ? detection.descriptor : null
}

export async function getAllFaceDescriptors(videoElement) {
  return await faceapi
    .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors()
}

export function matchFace(unknownDescriptor, criminals) {
  if (!unknownDescriptor || criminals.length === 0) return null
  const THRESHOLD = 0.52
  let bestMatch = null
  let bestDistance = Infinity
  for (const criminal of criminals) {
    const storedDescriptor = new Float32Array(criminal.face_descriptor)
    const distance = faceapi.euclideanDistance(unknownDescriptor, storedDescriptor)
    if (distance < THRESHOLD && distance < bestDistance) {
      bestDistance = distance
      bestMatch = { ...criminal, confidence: Math.round((1 - distance) * 100) }
    }
  }
  return bestMatch
}