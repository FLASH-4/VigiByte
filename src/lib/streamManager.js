/**
 * STREAM MANAGER UTILITY
 * Purpose: Centralized management for media streams across the VigiByte network.
 * This module ensures that hardware camera resources are handled efficiently by
 * preventing redundant requests and managing the lifecycle of active video tracks.
 */

// Cache for active MediaStream objects
const streams = {}

// Cache for in-flight Promise objects to prevent race conditions
const pending = {}

/**
 * CAMERA RESOURCE ACQUISITION
 * Retrieves a video stream for a specific Node ID. 
 * Implements a "piggyback" logic to handle multiple requests for the same camera simultaneously.
 */
export async function getStream(cameraId) {
  // Check if a valid, active stream already exists in the cache
  if (streams[cameraId]?.active) {
    return streams[cameraId]
  }

  // If a request for this cameraId is already in progress, return the existing Promise
  if (pending[cameraId]) {
    return pending[cameraId]
  }

  // Initiate a new hardware request via the MediaDevices API
  pending[cameraId] = navigator.mediaDevices
    .getUserMedia({ video: true }) // Using standard constraints for maximum hardware compatibility
    .then(stream => {
      streams[cameraId] = stream // Store successful stream in cache
      delete pending[cameraId]   // Clear the pending state
      return stream
    })
    .catch(err => {
      // Clean up both caches in the event of a hardware or permission error
      delete pending[cameraId]
      delete streams[cameraId]
      throw err
    })

  return pending[cameraId]
}

/**
 * RESOURCE DISPOSAL
 * Gracefully shuts down all tracks for a specific camera node to release hardware locks.
 */
export function releaseStream(cameraId) {
  if (streams[cameraId]) {
    // Iterate through all video/audio tracks and stop them individually
    streams[cameraId].getTracks().forEach(t => t.stop())
    delete streams[cameraId] // Remove from active cache
  }
}