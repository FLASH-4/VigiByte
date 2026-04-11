import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import AuthPanel from './components/AuthPanel'
import { 
  generateToken, 
  verifyToken, 
  hashPassword, 
  comparePasswords,  // ✅ FIXED: Added this import
  loginLimiter,
  auditLogger 
} from './services/browserAuth.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [users, setUsers] = useState(() => {
    // Load users from localStorage (demo database)
    const saved = localStorage.getItem('vigibyte_users')
    return saved ? JSON.parse(saved) : []
  })

  // Check if already logged in (on page load)
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('vigibyte_token')
      const userData = localStorage.getItem('vigibyte_user')
      
      if (token && userData) {
        const verified = await verifyToken(token)  // ✅ Now async
        if (verified) {
          setUser(JSON.parse(userData))
          // Log successful session restoration
          await auditLogger.log('session_restored', verified.id, verified.email)
        } else {
          // Token expired, clear storage
          localStorage.removeItem('vigibyte_token')
          localStorage.removeItem('vigibyte_user')
        }
      }
      setLoading(false)
    }
    
    checkAuth()
  }, [])

  // Handle Login
  const handleLogin = async (credentials) => {
    setAuthError('')
    setLoading(true)

    try {
      const { email, password, isRegister } = credentials

      // Rate limiting check
      const remainingAttempts = loginLimiter.getRemainingAttempts(`login_${email}`)
      if (!loginLimiter.check(`login_${email}`)) {
        throw new Error(`Too many login attempts. Try again in 15 minutes. (${remainingAttempts} attempts left)`)
      }

      if (isRegister) {
        // Register new user
        const existingUser = users.find(u => u.email === email)
        if (existingUser) {
          throw new Error('User already exists')
        }

        // Validate password strength
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long')
        }

        // Use selected role from registration form
        const role = credentials.role || 'officer'
        
        // Hash password with improved PBKDF2
        const hashedPassword = await hashPassword(password)
        
        const newUser = { 
          email, 
          passwordHash: hashedPassword, 
          role, 
          id: 'user_' + Date.now(),
          createdAt: new Date().toISOString()
        }
        
        const updatedUsers = [...users, newUser]
        setUsers(updatedUsers)
        localStorage.setItem('vigibyte_users', JSON.stringify(updatedUsers))

        // Auto-login after registration
        const token = await generateToken(newUser.id, newUser.email, newUser.role)
        localStorage.setItem('vigibyte_token', token)
        localStorage.setItem('vigibyte_user', JSON.stringify({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role
        }))
        
        setUser({ id: newUser.id, email: newUser.email, role: newUser.role })
        
        // Log registration
        await auditLogger.log('user_registered', newUser.id, newUser.email, { role })
        
        // Reset rate limiter on success
        loginLimiter.reset(`login_${email}`)
        
      } else {
        // Login existing user
        const foundUser = users.find(u => u.email === email)
        
        if (!foundUser) {
          await auditLogger.log('login_failed', 'unknown', email, { reason: 'user_not_found' })
          throw new Error('Invalid email or password')
        }

        // Compare passwords using improved method
        const passwordMatch = await comparePasswords(password, foundUser.passwordHash)
        if (!passwordMatch) {
          await auditLogger.log('login_failed', foundUser.id, email, { reason: 'wrong_password' })
          throw new Error('Invalid email or password')
        }

        const token = await generateToken(foundUser.id, foundUser.email, foundUser.role)
        localStorage.setItem('vigibyte_token', token)
        localStorage.setItem('vigibyte_user', JSON.stringify({
          id: foundUser.id,
          email: foundUser.email,
          role: foundUser.role
        }))
        
        setUser({ id: foundUser.id, email: foundUser.email, role: foundUser.role })
        
        // Log successful login
        await auditLogger.log('login_success', foundUser.id, foundUser.email)
        
        // Reset rate limiter on success
        loginLimiter.reset(`login_${email}`)
      }
    } catch (err) {
      setAuthError(err.message)
      console.error('Authentication error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle Logout
  const handleLogout = async () => {
    if (user) {
      await auditLogger.log('logout', user.id, user.email)
    }
    
    localStorage.removeItem('vigibyte_token')
    localStorage.removeItem('vigibyte_user')
    setUser(null)
    setAuthError('')
  }

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
      {!user ? (
        <AuthPanel onLogin={handleLogin} error={authError} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}
