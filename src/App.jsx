import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import AuthPanel from './components/AuthPanel'
import { 
  generateToken, 
  verifyToken, 
  hashPassword, 
  comparePasswords, 
  loginLimiter,
  auditLogger 
} from './services/browserAuth.js'

/**
 * VIGIBYTE ROOT COMPONENT (App.jsx)
 * Purpose: Acts as the Application Controller. 
 * Manages the top-level state for user authentication, session persistence, 
 * and orchestration between the AuthPanel and the main Dashboard.
 */
export default function App() {
  // --- APPLICATION STATE ---
  const [user, setUser] = useState(null)          // Stores current authenticated user metadata
  const [loading, setLoading] = useState(true)    // Handles the global initial loading state
  const [authError, setAuthError] = useState('')  // Captures and displays authentication failures
  
  // Persistent User Registry: Syncs with LocalStorage to simulate a database for demo purposes
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('vigibyte_users')
    return saved ? JSON.parse(saved) : []
  })

  /**
   * SESSION RESTORATION (Auto-Login)
   * On application mount, verifies if a valid JWT exists in LocalStorage.
   * Ensures secure session persistence across browser refreshes.
   */
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('vigibyte_token')
      const userData = localStorage.getItem('vigibyte_user')
      
      if (token && userData) {
        // Cryptographic verification of the existing session token
        const verified = await verifyToken(token) 
        if (verified) {
          setUser(JSON.parse(userData))
          // Forensic log of the restored session
          await auditLogger.log('session_restored', verified.id, verified.email)
        } else {
          // Automatic cleanup of expired or tampered session tokens
          localStorage.removeItem('vigibyte_token')
          localStorage.removeItem('vigibyte_user')
        }
      }
      setLoading(false)
    }
    
    checkAuth()
  }, [])

  /**
   * AUTHENTICATION HANDLER
   * Orchestrates both Registration and Login workflows.
   * Includes rate limiting, password hashing (PBKDF2), and audit logging.
   */
  const handleLogin = async (credentials) => {
    setAuthError('')
    setLoading(true)

    try {
      const { email, password, isRegister } = credentials

      // BRUTE FORCE PROTECTION: Checks the rate limiter before processing credentials
      const remainingAttempts = loginLimiter.getRemainingAttempts(`login_${email}`)
      if (!loginLimiter.check(`login_${email}`)) {
        throw new Error(`Too many login attempts. Try again in 15 minutes. (${remainingAttempts} attempts left)`)
      }

      if (isRegister) {
        // --- REGISTRATION WORKFLOW ---
        const existingUser = users.find(u => u.email === email)
        if (existingUser) {
          throw new Error('User already exists')
        }

        // Enforce basic password complexity requirements
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long')
        }

        const role = credentials.role || 'officer'
        
        // SECURE HASHING: Uses PBKDF2 with 10k iterations instead of plaintext
        const hashedPassword = await hashPassword(password)
        
        const newUser = { 
          email, 
          passwordHash: hashedPassword, 
          role, 
          id: 'user_' + Date.now(),
          createdAt: new Date().toISOString()
        }
        
        // Persist the new record to the local registry
        const updatedUsers = [...users, newUser]
        setUsers(updatedUsers)
        localStorage.setItem('vigibyte_users', JSON.stringify(updatedUsers))

        // AUTHENTICATION: Generate signed token for immediate session access
        const token = await generateToken(newUser.id, newUser.email, newUser.role)
        localStorage.setItem('vigibyte_token', token)
        localStorage.setItem('vigibyte_user', JSON.stringify({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role
        }))
        
        setUser({ id: newUser.id, email: newUser.email, role: newUser.role })
        
        // Audit trail for new account creation
        await auditLogger.log('user_registered', newUser.id, newUser.email, { role })
        
        // Clear rate limiter tracking on successful entry
        loginLimiter.reset(`login_${email}`)
        
      } else {
        // --- LOGIN WORKFLOW ---
        const foundUser = users.find(u => u.email === email)
        
        if (!foundUser) {
          await auditLogger.log('login_failed', 'unknown', email, { reason: 'user_not_found' })
          throw new Error('Invalid email or password')
        }

        // CRYPTOGRAPHIC COMPARISON: Verify input against the derived PBKDF2 hash
        const passwordMatch = await comparePasswords(password, foundUser.passwordHash)
        if (!passwordMatch) {
          await auditLogger.log('login_failed', foundUser.id, email, { reason: 'wrong_password' })
          throw new Error('Invalid email or password')
        }

        // Successful validation - Token generation
        const token = await generateToken(foundUser.id, foundUser.email, foundUser.role)
        localStorage.setItem('vigibyte_token', token)
        localStorage.setItem('vigibyte_user', JSON.stringify({
          id: foundUser.id,
          email: foundUser.email,
          role: foundUser.role
        }))
        
        setUser({ id: foundUser.id, email: foundUser.email, role: foundUser.role })
        
        await auditLogger.log('login_success', foundUser.id, foundUser.email)
        loginLimiter.reset(`login_${email}`)
      }
    } catch (err) {
      setAuthError(err.message)
      console.error('Authentication error:', err)
    } finally {
      setLoading(false)
    }
  }

  /**
   * LOGOUT HANDLER
   * Performs session termination, clears local storage, and updates the audit log.
   */
  const handleLogout = async () => {
    if (user) {
      await auditLogger.log('logout', user.id, user.email)
    }
    
    // Systematic removal of session data
    localStorage.removeItem('vigibyte_token')
    localStorage.removeItem('vigibyte_user')
    setUser(null)
    setAuthError('')
  }

  // --- RENDERING LOGIC ---

  // Display futuristic loading spinner during initial boot/auth check
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p className="mt-4 text-slate-400">Loading VigiByte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-white">
      {/* Conditional Rendering: 
          - If no user session: Show AuthPanel (Secure Gatekeeper)
          - If session exists: Show Dashboard (Central Command)
      */}
      {!user ? (
        <AuthPanel onLogin={handleLogin} error={authError} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}