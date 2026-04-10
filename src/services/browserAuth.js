// Browser-compatible authentication system
// Simple JWT-like token generation without Node.js dependencies

/**
 * Generate a simple browser-compatible token
 * Format: base64(header).base64(payload).base64(signature)
 */
export function generateToken(userId, email, role) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    id: userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  }

  const headerStr = base64Encode(JSON.stringify(header))
  const payloadStr = base64Encode(JSON.stringify(payload))
  
  // Simple signature (not cryptographically secure, for demo only)
  const signature = base64Encode(JSON.stringify({ sig: `${headerStr}.${payloadStr}`.substring(0, 10) }))
  
  return `${headerStr}.${payloadStr}.${signature}`
}

/**
 * Verify token and return decoded payload
 */
export function verifyToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(base64Decode(parts[1]))
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch (err) {
    return null
  }
}

/**
 * Simple role-based access control check
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
 * Hash password using browser crypto (simple hashing)
 * This is NOT for production - use backend for real hashing
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Compare password with hash
 */
export async function comparePasswords(password, hash) {
  const newHash = await hashPassword(password)
  return newHash === hash
}

/**
 * Session Manager for 24-hour sessions
 */
export class SessionManager {
  constructor() {
    this.sessions = new Map()
  }

  createSession(userId, email, role) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const session = {
      id: sessionId,
      userId,
      email,
      role,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000, // 24 hours
      lastActivity: Date.now()
    }
    this.sessions.set(sessionId, session)
    return sessionId
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId)
      return null
    }
    session.lastActivity = Date.now()
    return session
  }

  destroySession(sessionId) {
    this.sessions.delete(sessionId)
  }

  isValid(sessionId) {
    return this.getSession(sessionId) !== null
  }
}

/**
 * Audit Logger for tracking all actions
 */
export class AuditLogger {
  constructor() {
    this.logs = []
  }

  log(action, userId, email, details = {}) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      action,
      userId,
      email,
      details,
      ip: 'browser'
    })
  }

  getLogs() {
    return [...this.logs]
  }

  clearOldLogs(daysOld = 365) {
    const cutoff = Date.now() - daysOld * 86400000
    this.logs = this.logs.filter(log => new Date(log.timestamp).getTime() > cutoff)
  }
}

/**
 * Rate Limiter
 */
export function createRateLimiter(maxAttempts = 100, windowMs = 900000) {
  const attempts = new Map()

  return {
    check: (key) => {
      const now = Date.now()
      const userAttempts = attempts.get(key) || []
      const validAttempts = userAttempts.filter(time => now - time < windowMs)

      if (validAttempts.length >= maxAttempts) {
        return false
      }

      validAttempts.push(now)
      attempts.set(key, validAttempts)
      return true
    },
    
    reset: (key) => {
      attempts.delete(key)
    }
  }
}

// Helper functions
function base64Encode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)))
  } catch (e) {
    return btoa(str)
  }
}

function base64Decode(str) {
  try {
    return decodeURIComponent(escape(atob(str)))
  } catch (e) {
    return atob(str)
  }
}

// Export singleton instances
export const sessionManager = new SessionManager()
export const auditLogger = new AuditLogger()
export const loginLimiter = createRateLimiter(5, 900000) // 5 attempts per 15 minutes
