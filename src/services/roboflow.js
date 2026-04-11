/**
 * ROBOFLOW OBJECT DETECTION INTERFACE
 * Purpose: Integrates the COCO (Common Objects in Context) pre-trained model 
 * from Roboflow for high-level scene analysis.
 * This specific implementation filters for human detection to augment 
 * the facial recognition logic with person-counting capabilities.
 */

// Accessing the secure API key from environment variables
const ROBOFLOW_API_KEY = import.meta.env.VITE_ROBOFLOW_KEY

// API Endpoint for the COCO v13 model (optimized for general object detection)
const MODEL_URL = "https://detect.roboflow.com/coco/13"

/**
 * HUMAN DETECTION ENGINE
 * Processes an image frame and identifies all human subjects present in the scene.
 * @param {string} imageBase64 - The raw image data encoded in base64 format.
 * @returns {Array} - A filtered list of 'person' objects with coordinates and confidence scores.
 */
export async function detectPersons(imageBase64) {
  // Transmit image data to Roboflow's inference server
  const response = await fetch(`${MODEL_URL}?api_key=${ROBOFLOW_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: imageBase64,
  })

  // Parse the identification results
  const data = await response.json()

  // Filter the generic COCO detection list to only include entries classified as 'person'
  // This helps in calculating the 'Neural Load' and scene complexity in the Dashboard
  return data.predictions?.filter(p => p.class === 'person') || []
}