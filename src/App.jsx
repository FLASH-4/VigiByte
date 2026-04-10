import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import AuthPanel from './components/AuthPanel'
import { generateToken, verifyToken, hashPassword, loginLimiter } from './services/browserAuth.js'

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
    const token = localStorage.getItem('vigibyte_token')
    const userData = localStorage.getItem('vigibyte_user')
    
    if (token && userData) {
      const verified = verifyToken(token)
      if (verified) {
        setUser(JSON.parse(userData))
      } else {
        // Token expired, clear storage
        localStorage.removeItem('vigibyte_token')
        localStorage.removeItem('vigibyte_user')
      }
    }
    setLoading(false)
  }, [])

  // Handle Login
  const handleLogin = async (credentials) => {
    setAuthError('')
    setLoading(true)

    try {
      const { email, password, isRegister } = credentials

      // Rate limiting check
      if (!loginLimiter.check(`login_${email}`)) {
        throw new Error('Too many login attempts. Try again later.')
      }

      if (isRegister) {
        // Register new user
        const existingUser = users.find(u => u.email === email)
        if (existingUser) {
          throw new Error('User already exists')
        }

        // Use selected role from registration form
        const role = credentials.role || 'officer'
        
        // Hash password
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
        const token = generateToken(newUser.id, newUser.email, newUser.role)
        localStorage.setItem('vigibyte_token', token)
        localStorage.setItem('vigibyte_user', JSON.stringify({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role
        }))
        
        setUser({ id: newUser.id, email: newUser.email, role: newUser.role })
      } else {
        // Login existing user
        const foundUser = users.find(u => u.email === email)
        
        if (!foundUser) {
          throw new Error('Invalid email or password')
        }

        // Compare passwords
        const passwordMatch = await comparePasswords(password, foundUser.passwordHash)
        if (!passwordMatch) {
          throw new Error('Invalid email or password')
        }

        const token = generateToken(foundUser.id, foundUser.email, foundUser.role)
        localStorage.setItem('vigibyte_token', token)
        localStorage.setItem('vigibyte_user', JSON.stringify({
          id: foundUser.id,
          email: foundUser.email,
          role: foundUser.role
        }))
        
        setUser({ id: foundUser.id, email: foundUser.email, role: foundUser.role })
      }
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('vigibyte_token')
    localStorage.removeItem('vigibyte_user')
    setUser(null)
    setAuthError('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin">🔄</div>
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
        <>
          <Dashboard user={user} onLogout={handleLogout} />
        </>
      )}
    </div>
  )
}

// Helper function (re-export from browserAuth)
async function comparePasswords(password, hash) {
  const { hashPassword } = await import('./services/browserAuth.js')
  const newHash = await hashPassword(password)
  return newHash === hash
}