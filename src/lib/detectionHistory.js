// Detection History Manager
// Stores all criminal detections with timestamps, camera info, and screenshots

class DetectionHistoryDB {
  constructor() {
    this.dbName = 'vigibyte_detections'
    this.storeName = 'detection_history'
    this.db = null
    this.initDB()
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          
          // Indexes for fast searching
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('criminal_id', 'criminal_id', { unique: false })
          store.createIndex('camera_id', 'camera_id', { unique: false })
          store.createIndex('date', 'date', { unique: false })
          store.createIndex('confidence', 'confidence', { unique: false })
        }
      }
    })
  }

  async ensureDB() {
    if (!this.db) {
      await this.initDB()
    }
    return this.db
  }

  /**
   * Save a detection event
   */
  async saveDetection(detection) {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    const record = {
      criminal_id: detection.criminal.id,
      criminal_name: detection.criminal.name,
      crime: detection.criminal.crime,
      age: detection.criminal.age,
      risk_level: detection.criminal.risk_level,
      confidence: detection.confidence,
      camera_id: detection.camera.id,
      camera_name: detection.camera.name,
      camera_location: detection.camera.location,
      camera_coordinates: detection.camera.coordinates,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD for grouping
      screenshot: detection.screenshot, // Base64 screenshot
      photo_url: detection.criminal.photo_url || detection.criminal.image_url,
      user_id: detection.user_id || 'unknown',
      user_email: detection.user_email || 'unknown'
    }
    
    return new Promise((resolve, reject) => {
      const request = store.add(record)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get all detections with optional filters
   */
  async getDetections(filter = {}) {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      
      request.onsuccess = () => {
        let results = request.result
        
        // Apply filters
        if (filter.criminal_id) {
          results = results.filter(r => r.criminal_id === filter.criminal_id)
        }
        if (filter.camera_id) {
          results = results.filter(r => r.camera_id === filter.camera_id)
        }
        if (filter.date) {
          results = results.filter(r => r.date === filter.date)
        }
        if (filter.minConfidence) {
          results = results.filter(r => r.confidence >= filter.minConfidence)
        }
        if (filter.startDate && filter.endDate) {
          results = results.filter(r => 
            r.date >= filter.startDate && r.date <= filter.endDate
          )
        }
        
        // Sort by timestamp (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp)
        
        // Limit results if specified
        if (filter.limit) {
          results = results.slice(0, filter.limit)
        }
        
        resolve(results)
      }
      
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get detection statistics
   */
  async getStats() {
    const detections = await this.getDetections()
    
    const stats = {
      total: detections.length,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      byCriminal: {},
      byCamera: {},
      byDate: {},
      highConfidence: 0,
      avgConfidence: 0
    }
    
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    let totalConfidence = 0
    
    detections.forEach(det => {
      // Time-based counts
      if (det.date === todayStr) stats.today++
      if (det.date >= weekAgo) stats.thisWeek++
      if (det.date >= monthAgo) stats.thisMonth++
      
      // By criminal
      stats.byCriminal[det.criminal_id] = (stats.byCriminal[det.criminal_id] || 0) + 1
      
      // By camera
      stats.byCamera[det.camera_id] = (stats.byCamera[det.camera_id] || 0) + 1
      
      // By date
      stats.byDate[det.date] = (stats.byDate[det.date] || 0) + 1
      
      // Confidence
      if (det.confidence >= 80) stats.highConfidence++
      totalConfidence += det.confidence
    })
    
    stats.avgConfidence = detections.length > 0 
      ? Math.round(totalConfidence / detections.length) 
      : 0
    
    return stats
  }

  /**
   * Delete old detections (data retention)
   */
  async deleteOldDetections(daysToKeep = 90) {
    const db = await this.ensureDB()
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    const cutoffStr = cutoffDate.toISOString().split('T')[0]
    
    const detections = await this.getDetections()
    const toDelete = detections.filter(d => d.date < cutoffStr)
    
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    let deleted = 0
    for (const det of toDelete) {
      await new Promise((resolve, reject) => {
        const request = store.delete(det.id)
        request.onsuccess = () => {
          deleted++
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    }
    
    console.log(`🗑️ Deleted ${deleted} old detection records`)
    return deleted
  }

  /**
   * Export detections to CSV
   */
  async exportToCSV(filter = {}) {
    const detections = await this.getDetections(filter)
    
    const headers = [
      'Date', 'Time', 'Criminal Name', 'Crime', 'Confidence %',
      'Camera Name', 'Location', 'Coordinates', 'Risk Level', 'User'
    ]
    
    const rows = detections.map(d => {
      const date = new Date(d.timestamp)
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        d.criminal_name,
        d.crime,
        d.confidence,
        d.camera_name,
        d.camera_location,
        d.camera_coordinates,
        d.risk_level,
        d.user_email
      ]
    })
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    return csvContent
  }

  /**
   * Clear all detection history
   */
  async clearAll() {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

// Export singleton instance
export const detectionHistory = new DetectionHistoryDB()

// Helper function to capture screenshot from video
export async function captureScreenshot(videoElement) {
  if (!videoElement) return null
  
  const canvas = document.createElement('canvas')
  canvas.width = videoElement.videoWidth || 640
  canvas.height = videoElement.videoHeight || 480
  
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
  
  // Convert to base64 (compressed JPEG)
  return canvas.toDataURL('image/jpeg', 0.7)
}
