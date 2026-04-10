const streams = {}
const pending = {}

export async function getStream(cameraId) {
  // Return existing active stream immediately
  if (streams[cameraId]?.active) {
    return streams[cameraId]
  }

  // If a request is already in flight, piggyback on it
  if (pending[cameraId]) {
    return pending[cameraId]
  }

  pending[cameraId] = navigator.mediaDevices
    .getUserMedia({ video: true }) // ← simpler constraints, less likely to fail
    .then(stream => {
      streams[cameraId] = stream
      delete pending[cameraId]
      return stream
    })
    .catch(err => {
      delete pending[cameraId]
      delete streams[cameraId]
      throw err
    })

  return pending[cameraId]
}

export function releaseStream(cameraId) {
  if (streams[cameraId]) {
    streams[cameraId].getTracks().forEach(t => t.stop())
    delete streams[cameraId]
  }
}