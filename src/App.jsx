import { useState, useEffect } from 'react'
import { releaseAllStreams } from './lib/streamManager'
import { supabase } from './lib/supabase'
import { extractDomainFromEmail, getOrCreateOrganization, adminExistsForOrg } from './lib/organization'
import { generateTOTPSecret, verifyTOTP, generateQRCodeURL } from './lib/totp'
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
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [users, setUsers] = useState([])

  // 2FA States
  const [needsTOTP, setNeedsTOTP] = useState(false)
  const [totpSecret, setTotpSecret] = useState(null)
  const [qrCodeURL, setQrCodeURL] = useState(null)
  const [pendingUser, setPendingUser] = useState(null)

  /**
   * SESSION RESTORATION (Auto-Login)
   * On application mount, verifies if a valid JWT exists in localStorage.
   * Ensures secure session persistence across browser refreshes.
   * Also performs an early storage availability test to catch mobile
   * browsers that block site data (e.g. iOS Safari private mode).
   */
  useEffect(() => {
    const checkAuth = async () => {

      // MOBILE STORAGE TEST
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

      // Load users from Supabase FIRST
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
   * AUTHENTICATION HANDLER with Organization + 2FA
   */
  const handleLogin = async (credentials) => {
    setAuthError('')
    setLoading(true)

    try {
      const { email, password, isRegister, role, totpCode } = credentials

      // BRUTE FORCE PROTECTION
      const remainingAttempts = loginLimiter.getRemainingAttempts(`login_${email}`)
      if (!loginLimiter.check(`login_${email}`)) {
        throw new Error(`Too many login attempts. Try again in 15 minutes. (${remainingAttempts} attempts left)`)
      }

      // Extract organization from email domain
      const domain = extractDomainFromEmail(email)
      if (!domain) throw new Error('Invalid email format')

      // Get or create organization
      const org = await getOrCreateOrganization(domain)

      if (isRegister) {
        // --- REGISTRATION WORKFLOW ---
        const existingUser = users.find(u => u.email === email)
        if (existingUser) {
          throw new Error('User already exists')
        }

        // Check if trying to register as ADMIN
        if (role === 'admin') {
          const adminExists = await adminExistsForOrg(org.id)
          if (adminExists) {
            throw new Error('An admin already exists for this organization. Contact your org admin.')
          }
        }

        // Password validation
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long')
        }

        const hashedPassword = await hashPassword(password)

        const newUser = {
          email,
          password_hash: hashedPassword,
          role,
          id: 'user_' + Date.now(),
          organization_id: org.id,
          created_at: new Date().toISOString()
        }

        // For admin: Generate TOTP secret for 2FA
        if (role === 'admin') {
          const secret = generateTOTPSecret()
          newUser.totp_secret = secret
          newUser.totp_enabled = true

          // Save user first
          const { error: insertError } = await supabase.from('users').insert([newUser])
          if (insertError) throw new Error('Failed to register user: ' + insertError.message)

          // Set organization admin
          await supabase.from('organizations').update({ admin_id: newUser.id }).eq('id', org.id)

          // Show QR code for 2FA setup
          const qrUrl = generateQRCodeURL(secret, email, 'VigiByte')
          setTotpSecret(secret)
          setQrCodeURL(qrUrl)
          setNeedsTOTP(true)
          setPendingUser(newUser)

          setLoading(false)
          return // Wait for user to confirm 2FA setup
        }

        // For non-admin: register normally
        const { error: insertError } = await supabase.from('users').insert([newUser])
        if (insertError) throw new Error('Failed to register user: ' + insertError.message)

        const updatedUsers = [...users, newUser]
        setUsers(updatedUsers)

        // Generate token and login
        const token = await generateToken(newUser.id, newUser.email, newUser.role)
        storage.set('vigibyte_token', token)
        storage.set('vigibyte_user', JSON.stringify({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          organization_id: org.id
        }))

        setUser({ id: newUser.id, email: newUser.email, role: newUser.role, organization_id: org.id })

        await auditLogger.log('user_registered', newUser.id, newUser.email, { role, organization: domain })
        loginLimiter.reset(`login_${email}`)

      } else {
        // --- LOGIN WORKFLOW ---
        const foundUser = users.find(u => u.email === email)

        if (!foundUser) {
          await auditLogger.log('login_failed', 'unknown', email, { reason: 'user_not_found' })
          throw new Error('Invalid email or password')
        }

        // Verify password
        const passwordMatch = await comparePasswords(password, foundUser.password_hash)
        if (!passwordMatch) {
          await auditLogger.log('login_failed', foundUser.id, email, { reason: 'wrong_password' })
          throw new Error('Invalid email or password')
        }

        // If admin with 2FA enabled, verify TOTP code
        if (foundUser.role === 'admin' && foundUser.totp_enabled) {
          if (!totpCode) {
            setPendingUser(foundUser)
            setNeedsTOTP(false) // Set to false for verification, not setup
            setLoading(false)
            return // Request TOTP code from user
          }

          const totpValid = await verifyTOTP(foundUser.totp_secret, totpCode)
          if (!totpValid) {
            throw new Error('Invalid 2FA code')
          }
        }

        // Successful login
        const token = await generateToken(foundUser.id, foundUser.email, foundUser.role)
        storage.set('vigibyte_token', token)
        storage.set('vigibyte_user', JSON.stringify({
          id: foundUser.id,
          email: foundUser.email,
          role: foundUser.role,
          organization_id: foundUser.organization_id
        }))

        setUser({
          id: foundUser.id,
          email: foundUser.email,
          role: foundUser.role,
          organization_id: foundUser.organization_id
        })

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

  // Handle TOTP confirmation for admin 2FA setup
  const handleTOTPSetup = async (totpCode) => {
    try {
      if (!totpCode || totpCode.length !== 6) {
        throw new Error('Valid 6-digit code required')
      }

      // Verify the code works with the secret
      const isValid = await verifyTOTP(totpSecret, totpCode)
      if (!isValid) {
        throw new Error('Invalid 2FA code. Please try again.')
      }

      // Code is valid, complete admin login
      const token = await generateToken(pendingUser.id, pendingUser.email, pendingUser.role)
      storage.set('vigibyte_token', token)
      storage.set('vigibyte_user', JSON.stringify({
        id: pendingUser.id,
        email: pendingUser.email,
        role: pendingUser.role,
        organization_id: pendingUser.organization_id
      }))

      setUser({
        id: pendingUser.id,
        email: pendingUser.email,
        role: pendingUser.role,
        organization_id: pendingUser.organization_id
      })

      // Update users list
      setUsers(prev => [...prev, pendingUser])

      setNeedsTOTP(false)
      setTotpSecret(null)
      setQrCodeURL(null)
      setPendingUser(null)

      await auditLogger.log('2fa_setup_complete', pendingUser.id, pendingUser.email)
      loginLimiter.reset(`login_${pendingUser.email}`)
    } catch (err) {
      setAuthError(err.message)
      console.error('TOTP setup error:', err)
    }
  }

  // Handle TOTP verification for admin login
  const handleTOTPVerification = async (totpCode) => {
    try {
      if (!totpCode || totpCode.length !== 6) {
        throw new Error('Valid 6-digit code required')
      }

      const isValid = await verifyTOTP(pendingUser.totp_secret, totpCode)
      if (!isValid) {
        throw new Error('Invalid 2FA code. Please try again.')
      }

      // Code is valid, complete login
      const token = await generateToken(pendingUser.id, pendingUser.email, pendingUser.role)
      storage.set('vigibyte_token', token)
      storage.set('vigibyte_user', JSON.stringify({
        id: pendingUser.id,
        email: pendingUser.email,
        role: pendingUser.role,
        organization_id: pendingUser.organization_id
      }))

      setUser({
        id: pendingUser.id,
        email: pendingUser.email,
        role: pendingUser.role,
        organization_id: pendingUser.organization_id
      })

      setNeedsTOTP(false)
      setPendingUser(null)

      await auditLogger.log('login_success', pendingUser.id, pendingUser.email)
      loginLimiter.reset(`login_${pendingUser.email}`)
    } catch (err) {
      setAuthError(err.message)
      console.error('TOTP verification error:', err)
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

  // Display loading spinner
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
      {!user ? (
        <AuthPanel
          onLogin={handleLogin}
          error={authError}
          onClearError={() => setAuthError('')}
          needsTOTP={needsTOTP}
          qrCodeURL={qrCodeURL}
          totpSecret={totpSecret}
          onTOTPSetup={handleTOTPSetup}
          onTOTPVerification={handleTOTPVerification}
          pendingUser={pendingUser}
        />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}