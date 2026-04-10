const ROBOFLOW_API_KEY = import.meta.env.VITE_ROBOFLOW_KEY
const MODEL_URL = "https://detect.roboflow.com/coco/13"

export async function detectPersons(imageBase64) {
  const response = await fetch(`${MODEL_URL}?api_key=${ROBOFLOW_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: imageBase64,
  })
  const data = await response.json()
  return data.predictions?.filter(p => p.class === 'person') || []
}