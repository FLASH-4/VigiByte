import { useState, useEffect } from 'react'
import { releaseAllStreams } from './lib/streamManager'
import { supabase } from './lib/supabase'
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
 * STORAGE SAFETY WRAPPER
 * Purpose: Abstracts all localStorage operations behind try/catch guards.
 * On mobile browsers (especially iOS Safari in private mode), localStorage
 * can throw exceptions or silently fail. This wrapper ensures the app
 * degrades gracefully instead of crashing or behaving unexpectedly.
 */
const storage = {
  get: (key) => {
    try { 
      return localStorage.getItem(key) 
    } catch(e) { 
      console.warn('Storage read failed:', key, e)
      return null 
    }
  },
  set: (key, value) => {
    try { 
      localStorage.setItem(key, value)
      return true
    } catch(e) { 
      console.warn('Storage write failed:', key, e)
      return false
    }
  },
  remove: (key) => {
    try { 
      localStorage.removeItem(key) 
    } catch(e) { 
      console.warn('Storage remove failed:', key, e) 
    }
  }
}

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
  const [users, setUsers] = useState([])          // User registry from Supabase

  /**
   * SESSION RESTORATION (Auto-Login)
   * On application mount, verifies if a valid JWT exists in localStorage.
   * Ensures secure session persistence across browser refreshes.
   * Also performs an early storage availability test to catch mobile
   * browsers that block site data (e.g. iOS Safari private mode).
   */
  useEffect(() => {
    const checkAuth = async () => {

      // MOBILE STORAGE TEST: Verify localStorage is functional before proceeding.
      // iOS Safari in private/incognito mode has a 0-byte quota and throws on setItem.
      // This catches that early and shows a clear error instead of silently failing.
      try {
        localStorage.setItem('vigibyte_test', '1')
        const test = localStorage.getItem('vigibyte_test')
        localStorage.removeItem('vigibyte_test')
        if (test !== '1') throw new Error('Storage test mismatch')
      } catch(e) {
        setAuthError('⚠️ Your browser is blocking site storage. Please disable private/incognito mode or allow site data in your browser settings.')
        setLoading(false)
        return
      }

      // Load users from Supabase
      await loadUsers()

      const token = storage.get('vigibyte_token')
      const userData = storage.get('vigibyte_user')

      if (token && userData) {
        // Cryptographic verification of the existing session token
        const verified = await verifyToken(token)
        if (verified) {
          setUser(JSON.parse(userData))
          // Forensic log of the restored session
          await auditLogger.log('session_restored', verified.id, verified.email)
        } else {
          // Automatic cleanup of expired or tampered session tokens
          storage.remove('vigibyte_token')
          storage.remove('vigibyte_user')
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  // Load users from Supabase
  async function loadUsers() {
    try {
      const { data, error } = await supabase.from('users').select('*')
      if (error) throw error
      setUsers(data || [])
    } catch(err) {
      console.warn('Failed to load users from Supabase, using empty list:', err)
      setUsers([])
    }
  }

  /**
   * AUTHENTICATION HANDLER
   * Orchestrates both Registration and Login workflows.
   * Includes rate limiting, password hashing (PBKDF2), and audit logging.
   * All localStorage operations go through the safe storage wrapper to
   * prevent silent failures on restrictive mobile browsers.
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

        // Persist to Supabase
        const { error: insertError } = await supabase.from('users').insert([newUser])
        if (insertError) throw new Error('Failed to register user: ' + insertError.message)

        // Update local state
        const updatedUsers = [...users, newUser]
        setUsers(updatedUsers)

        // AUTHENTICATION: Generate signed token for immediate session access
        const token = await generateToken(newUser.id, newUser.email, newUser.role)
        storage.set('vigibyte_token', token)
        storage.set('vigibyte_user', JSON.stringify({
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

        // Successful validation — generate and persist the new session token
        const token = await generateToken(foundUser.id, foundUser.email, foundUser.role)
        storage.set('vigibyte_token', token)
        storage.set('vigibyte_user', JSON.stringify({
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
   * Uses safe storage wrapper to ensure cleanup succeeds even on restrictive browsers.
   */
  const handleLogout = async () => {
    if (user) {
      await auditLogger.log('logout', user.id, user.email)
    }

    // Release ALL active camera streams
    releaseAllStreams()

    storage.remove('vigibyte_token')
    storage.remove('vigibyte_user')
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
    <div className="min-h-screen bg-[#080a10] text-white w-full overflow-x-hidden">
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