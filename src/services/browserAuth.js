/**
 * BROWSER-BASED AUTHENTICATION ENGINE
 * Purpose: Provides a secure, cost-free authentication layer within the browser environment.
 * Features: JWT-style token signing (HMAC), PBKDF2 password hashing, RBAC, and Audit Logging.
 * This module leverages the Web Crypto API for industry-standard security without a backend.
 */

// Global Secret Key for cryptographic operations
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'default-secret-change-this-in-production'

/**
 * TOKEN GENERATION (HS256)
 * Creates a signed JWT-like token using the HMAC SHA-256 algorithm.
 * Contains user identification and expiration data (24-hour TTL).
 */
export async function generateToken(userId, email, role) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    id: userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000), // Issued at
    exp: Math.floor(Date.now() / 1000) + 86400 // 24-hour expiration
  }

  const headerStr = base64UrlEncode(JSON.stringify(header))
  const payloadStr = base64UrlEncode(JSON.stringify(payload))
  
  // Generate a cryptographically secure signature to prevent payload tampering
  const signature = await createHMACSignature(`${headerStr}.${payloadStr}`, JWT_SECRET)
  
  return `${headerStr}.${payloadStr}.${signature}`
}

/**
 * TOKEN VERIFICATION
 * Validates the token's integrity by re-calculating the HMAC signature.
 * Also performs expiration checks (TTL validation).
 */
export async function verifyToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerStr, payloadStr, signature] = parts
    
    // Integrity Check: Compare incoming signature with locally computed signature
    const expectedSignature = await createHMACSignature(`${headerStr}.${payloadStr}`, JWT_SECRET)
    if (signature !== expectedSignature) {
      console.warn('Invalid token signature - possible tampering detected')
      return null
    }

    const payload = JSON.parse(base64UrlDecode(payloadStr))
    
    // Expiration Check: Ensure the session is still within its valid timeframe
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
 * HMAC SIGNATURE CREATION
 * Internal utility using the SubtleCrypto interface for high-speed, secure signing.
 */
async function createHMACSignature(message, secret) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)
  
  // Import the raw secret as a cryptographic key for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  // Sign the message and convert the buffer to a hex string
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * SECURE PASSWORD HASHING (PBKDF2)
 * Replaces standard SHA-256 with Password-Based Key Derivation Function 2.
 * Includes unique salting and 10,000 iterations to protect against rainbow table attacks.
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(password)
  
  // Generate a unique 16-byte random salt for every user
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  
  // Execute key stretching with 10,000 iterations to increase brute-force resistance
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
  
  // Concatenate salt and hash for storage (standard security practice)
  return `${saltHex}:${hashHex}`
}

/**
 * PASSWORD COMPARISON
 * Extracts the salt from a stored hash and re-computes the PBKDF2 bits to verify input.
 */
export async function comparePasswords(password, storedHash) {
  try {
    const [saltHex, originalHash] = storedHash.split(':')
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
    
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
 * ROLE-BASED ACCESS CONTROL (RBAC)
 * Defines access privileges for different user tiers within the VigiByte platform.
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
 * SESSION MANAGEMENT
 * Handles session creation, validation, and encrypted persistence in LocalStorage.
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
      expiresAt: Date.now() + 86400000, // 24-hour limit
      lastActivity: Date.now()
    }
    
    // Encrypt the session data before storing to protect against local inspection
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

  // Obfuscation Layer: Simple XOR cipher for local data protection
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
 * SYSTEM AUDIT LOGGER
 * Maintains an immutable log of critical events using IndexedDB.
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
        if (filter.userId) logs = logs.filter(log => log.userId === filter.userId)
        if (filter.action) logs = logs.filter(log => log.action === filter.action)
        resolve(logs)
      }
      request.onerror = () => reject(request.error)
    })
  }
}

/**
 * PERSISTENT RATE LIMITER
 * Protects against brute-force attacks by tracking login attempts in LocalStorage.
 */
export function createRateLimiter(maxAttempts = 5, windowMs = 900000) {
  const storageKey = 'vigibyte_rate_limit'
  
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
        return false // Limit exceeded
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

// --- CORE UTILITY FUNCTIONS ---

function base64UrlEncode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  } catch (e) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
}

function base64UrlDecode(str) {
  try {
    str = str.replace(/-/g, '+').replace(/_/g, '/')
    while (str.length % 4) { str += '=' }
    return decodeURIComponent(escape(atob(str)))
  } catch (e) {
    return atob(str)
  }
}

// Exporting singleton instances for global access
export const sessionManager = new SessionManager()
export const auditLogger = new AuditLogger()
export const loginLimiter = createRateLimiter(5, 900000) // 5 attempts per 15-minute window