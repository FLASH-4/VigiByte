import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// Security configurations
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const TOKEN_EXPIRY = '24h'
const SALT_ROUNDS = 10

// Role-based access control
const ROLES = {
  ADMIN: 'admin',
  OFFICER: 'officer',
  VIEWER: 'viewer'
}

const PERMISSIONS = {
  admin: ['create', 'read', 'update', 'delete', 'manage_users'],
  officer: ['create', 'read', 'update'],
  viewer: ['read']
}

// Generate JWT Token
export function generateToken(userId, email, role) {
  return jwt.sign(
    { userId, email, role, iat: Date.now() },
    SECRET_KEY,
    { expiresIn: TOKEN_EXPIRY }
  )
}

// Verify JWT Token
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY)
  } catch (err) {
    return null
  }
}

// Hash password
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Compare passwords
export async function comparePasswords(password, hash) {
  return bcrypt.compare(password, hash)
}

// Check permissions
export function hasPermission(role, action) {
  return PERMISSIONS[role]?.includes(action) || false
}

// Rate limiting helper
export function createRateLimiter(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  const requests = new Map()
  
  return function rateLimiter(identifier) {
    const now = Date.now()
    const userRequests = requests.get(identifier) || []
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < windowMs)
    
    if (recentRequests.length >= maxRequests) {
      return { allowed: false, remaining: 0 }
    }
    
    recentRequests.push(now)
    requests.set(identifier, recentRequests)
    
    return { allowed: true, remaining: maxRequests - recentRequests.length }
  }
}

// Session management
export class SessionManager {
  constructor() {
    this.sessions = new Map()
  }

  createSession(userId, metadata = {}) {
    const sessionId = this.generateSessionId()
    const session = {
      userId,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata,
      ip: metadata.ip || 'unknown',
      userAgent: metadata.userAgent || 'unknown'
    }
    this.sessions.set(sessionId, session)
    return sessionId
  }

  validateSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    
    // Check if session expired (24 hours)
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
      this.sessions.delete(sessionId)
      return null
    }
    
    // Update last activity
    session.lastActivity = Date.now()
    return session
  }

  destroySession(sessionId) {
    this.sessions.delete(sessionId)
  }

  generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15)
  }
}

// Audit logging
export class AuditLogger {
  constructor() {
    this.logs = []
  }

  log(action, userId, resource, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId,
      resource,
      details,
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown'
    }
    this.logs.push(logEntry)
    
    // Keep only last 10000 logs in memory (implement database persistence in production)
    if (this.logs.length > 10000) {
      this.logs.shift()
    }
    
    return logEntry
  }

  getLogs(filter = {}) {
    return this.logs.filter(log => {
      if (filter.userId && log.userId !== filter.userId) return false
      if (filter.action && log.action !== filter.action) return false
      if (filter.resource && log.resource !== filter.resource) return false
      return true
    })
  }
}
