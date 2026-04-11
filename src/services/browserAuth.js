// Improved Browser-Compatible Authentication
// Still client-side but MORE SECURE than before
// FREE - No backend needed

// Use environment variable for JWT secret
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'default-secret-change-this-in-production'

/**
 * Generate secure JWT-like token with proper HMAC signature
 */
export async function generateToken(userId, email, role) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    id: userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  }

  const headerStr = base64UrlEncode(JSON.stringify(header))
  const payloadStr = base64UrlEncode(JSON.stringify(payload))
  
  // Create HMAC signature using Web Crypto API (FREE, built-in)
  const signature = await createHMACSignature(`${headerStr}.${payloadStr}`, JWT_SECRET)
  
  return `${headerStr}.${payloadStr}.${signature}`
}

/**
 * Verify token with HMAC signature verification
 */
export async function verifyToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerStr, payloadStr, signature] = parts
    
    // Verify signature
    const expectedSignature = await createHMACSignature(`${headerStr}.${payloadStr}`, JWT_SECRET)
    if (signature !== expectedSignature) {
      console.warn('Invalid token signature')
      return null
    }

    const payload = JSON.parse(base64UrlDecode(payloadStr))
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.warn('Token expired')
      return null
    }

    return payload
  } catch (err) {
    console.error('Token verification failed:', err)
    return null
  }
}

/**
 * Create HMAC signature using Web Crypto API (FREE, secure)
 */
async function createHMACSignature(message, secret) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Improved password hashing with PBKDF2 (better than SHA-256)
 * Still client-side but more secure (FREE, built-in)
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(password)
  
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  
  // Import password as key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  
  // Derive key using PBKDF2 (10,000 iterations)
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  )
  
  const hashArray = Array.from(new Uint8Array(derivedBits))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  // Return salt + hash
  return `${saltHex}:${hashHex}`
}

/**
 * Compare password with hash
 */
export async function comparePasswords(password, storedHash) {
  try {
    const [saltHex, originalHash] = storedHash.split(':')
    
    // Convert salt back to Uint8Array
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
    
    // Hash the input password with the same salt
    const encoder = new TextEncoder()
    const passwordData = encoder.encode(password)
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits']
    )
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 10000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    )
    
    const hashArray = Array.from(new Uint8Array(derivedBits))
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return computedHash === originalHash
  } catch (err) {
    console.error('Password comparison failed:', err)
    return false
  }
}

/**
 * Role-based access control
 */
export function hasPermission(role, action) {
  const permissions = {
    admin: ['create', 'read', 'update', 'delete', 'manage_users'],
    officer: ['create', 'read', 'update'],
    viewer: ['read']
  }

  return permissions[role]?.includes(action) || false
}

/**
 * Session Manager with localStorage encryption
 */
export class SessionManager {
  constructor() {
    this.storageKey = 'vigibyte_sessions'
  }

  async createSession(userId, email, role) {
    const sessionId = `session_${Date.now()}_${crypto.randomUUID()}`
    const session = {
      id: sessionId,
      userId,
      email,
      role,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000, // 24 hours
      lastActivity: Date.now()
    }
    
    // Encrypt session before storing
    const encrypted = await this.encryptData(JSON.stringify(session))
    localStorage.setItem(`${this.storageKey}_${sessionId}`, encrypted)
    
    return sessionId
  }

  async getSession(sessionId) {
    try {
      const encrypted = localStorage.getItem(`${this.storageKey}_${sessionId}`)
      if (!encrypted) return null
      
      const sessionData = await this.decryptData(encrypted)
      const session = JSON.parse(sessionData)
      
      if (Date.now() > session.expiresAt) {
        this.destroySession(sessionId)
        return null
      }
      
      // Update last activity
      session.lastActivity = Date.now()
      const newEncrypted = await this.encryptData(JSON.stringify(session))
      localStorage.setItem(`${this.storageKey}_${sessionId}`, newEncrypted)
      
      return session
    } catch (err) {
      console.error('Session retrieval failed:', err)
      return null
    }
  }

  destroySession(sessionId) {
    localStorage.removeItem(`${this.storageKey}_${sessionId}`)
  }

  // Simple XOR encryption (better than plaintext, FREE)
  async encryptData(data) {
    const key = JWT_SECRET
    let encrypted = ''
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return base64UrlEncode(encrypted)
  }

  async decryptData(encrypted) {
    const data = base64UrlDecode(encrypted)
    const key = JWT_SECRET
    let decrypted = ''
    for (let i = 0; i < data.length; i++) {
      decrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return decrypted
  }
}

/**
 * Audit Logger - Store in IndexedDB (FREE, more storage than localStorage)
 */
export class AuditLogger {
  constructor() {
    this.dbName = 'vigibyte_audit'
    this.storeName = 'logs'
    this.initDB()
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('userId', 'userId', { unique: false })
          store.createIndex('action', 'action', { unique: false })
        }
      }
    })
  }

  async log(action, userId, email, details = {}) {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId,
      email,
      details,
      userAgent: navigator.userAgent
    }
    
    store.add(logEntry)
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getLogs(filter = {}) {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readonly')
    const store = transaction.objectStore(this.storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        let logs = request.result
        
        // Apply filters
        if (filter.userId) {
          logs = logs.filter(log => log.userId === filter.userId)
        }
        if (filter.action) {
          logs = logs.filter(log => log.action === filter.action)
        }
        
        resolve(logs)
      }
      request.onerror = () => reject(request.error)
    })
  }
}

/**
 * Rate Limiter with persistent storage
 */
export function createRateLimiter(maxAttempts = 5, windowMs = 900000) {
  const storageKey = 'vigibyte_rate_limit'
  
  // Load attempts from localStorage
  const loadAttempts = () => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? new Map(JSON.parse(stored)) : new Map()
    } catch {
      return new Map()
    }
  }
  
  const saveAttempts = (attempts) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...attempts]))
    } catch (err) {
      console.error('Failed to save rate limit data:', err)
    }
  }

  return {
    check: (key) => {
      const attempts = loadAttempts()
      const now = Date.now()
      const userAttempts = attempts.get(key) || []
      const validAttempts = userAttempts.filter(time => now - time < windowMs)

      if (validAttempts.length >= maxAttempts) {
        return false
      }

      validAttempts.push(now)
      attempts.set(key, validAttempts)
      saveAttempts(attempts)
      return true
    },
    
    reset: (key) => {
      const attempts = loadAttempts()
      attempts.delete(key)
      saveAttempts(attempts)
    },
    
    getRemainingAttempts: (key) => {
      const attempts = loadAttempts()
      const now = Date.now()
      const userAttempts = attempts.get(key) || []
      const validAttempts = userAttempts.filter(time => now - time < windowMs)
      return Math.max(0, maxAttempts - validAttempts.length)
    }
  }
}

// Helper functions
function base64UrlEncode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  } catch (e) {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }
}

function base64UrlDecode(str) {
  try {
    str = str.replace(/-/g, '+').replace(/_/g, '/')
    while (str.length % 4) {
      str += '='
    }
    return decodeURIComponent(escape(atob(str)))
  } catch (e) {
    return atob(str)
  }
}

// Export singleton instances
export const sessionManager = new SessionManager()
export const auditLogger = new AuditLogger()
export const loginLimiter = createRateLimiter(5, 900000) // 5 attempts per 15 minutes
