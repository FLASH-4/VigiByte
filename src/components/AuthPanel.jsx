import { useState } from 'react'
import { Lock, AlertCircle, Eye, EyeOff, Shield, LogOut } from 'lucide-react'

/**
 * AuthPanel Component
 * Purpose: Handles User Authentication (Login/Register) and Role Selection.
 * Features: Password validation, show/hide password toggle, and Session Management UI.
 */
export default function AuthPanel({ onLogin, onLogout, user, error: externalError }) {
  const [isLogin, setIsLogin] = useState(true) // Toggle between Login and Registration modes
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState('officer') // Default role for new users
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('') // Local validation error state
  const [showPassword, setShowPassword] = useState(false)

  // Standard Regex for Email Validation
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  // Security Policy: Minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const validatePassword = (password) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    return re.test(password)
  }

  /**
   * Form Submission Handler
   * Validates inputs before passing credentials to the parent authentication function.
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        throw new Error('Email and password required') // Basic check
      }

      if (!validateEmail(email)) {
        throw new Error('Invalid email format') // Syntax check
      }

      if (isLogin) {
        // Handle Login Logic
        if (password.length < 8) {
          throw new Error('Invalid credentials') // Minimal length check for security
        }
        onLogin({ email, password })
      } else {
        // Handle Registration Logic
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match') // UI-level validation
        }
        if (!validatePassword(password)) {
          throw new Error('Password must be 8+ chars with uppercase, lowercase, number, special char')
        }
        // Send registration data including selected Role-Based Access Control (RBAC)
        onLogin({ email, password, isRegister: true, role: selectedRole })
      }
    } catch (err) {
      setError(err.message) // Display error to the user
    } finally {
      setLoading(false)
    }
  }

  // --- LOGGED-IN VIEW ---
  // Displayed when the user is successfully authenticated via Supabase/Backend
  if (user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40 p-4">
        <div className="bg-[#0c101f] rounded-3xl border border-white/10 p-8 max-w-md w-full shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="text-green-500" size={24} />
            <h2 className="text-xl font-bold text-white">Welcome Back</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Logged In As</p>
              <p className="text-lg font-bold text-white break-all">{user.email}</p>
              <p className="text-xs text-slate-400 mt-2 uppercase">Role: {user.role}</p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-xs text-blue-300">
                ✅ All criminal records are encrypted and access is being logged
              </p>
            </div>

            <button
              onClick={onLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold uppercase text-sm transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- AUTHENTICATION FORM VIEW ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40 p-4">
      <div className="bg-[#0c101f] rounded-3xl border border-white/10 p-8 max-w-md w-full shadow-2xl animate-in">
        <div className="flex items-center gap-3 mb-8">
          <Lock className="text-blue-500" size={28} />
          <h1 className="text-2xl font-bold text-white">VigiByte</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@vigibyte.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              disabled={loading}
            />
          </div>

          {/* Password Input with Visibility Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
              Password
              {!isLogin && <span className="text-red-400 ml-2">*8+ chars, 1 uppercase, 1 special</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Visible only during Registration) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                disabled={loading}
              />
            </div>
          )}

          {/* Role-Based Access Control (RBAC) Selector */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
                Assign Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                disabled={loading}
              >
                <option value="admin" className="bg-slate-900">🔑 ADMIN - Full access (create/read/update/delete)</option>
                <option value="officer" className="bg-slate-900">👮 OFFICER - Limited access (create/read/update)</option>
                <option value="viewer" className="bg-slate-900">👁️ VIEWER - View-only access</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">Select the role for this user</p>
            </div>
          )}

          {/* Unified Error Handling Display (Local + Backend) */}
          {(error || externalError) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error || externalError}</p>
            </div>
          )}

          {/* Dynamic Button Text based on Auth State */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-3 rounded-xl font-bold uppercase text-sm transition-all"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>

          {/* Toggle between Login and Registration Mode */}
          <p className="text-center text-xs text-slate-400">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setPassword('')
                setConfirmPassword('')
                setSelectedRole('officer')
              }}
              className="text-blue-400 hover:text-blue-300 font-bold"
              disabled={loading}
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </form>

        {/* Security Feature Highlights for UI/Presentation */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">🔒 Security Features</p>
          <ul className="space-y-1.5 text-[10px] text-slate-400">
            <li>✅ End-to-end encryption for all data</li>
            <li>✅ Role-based access control (RBAC)</li>
            <li>✅ Activity logging & audit trail</li>
            <li>✅ Session timeout protection</li>
            <li>✅ Password hashing with PBKDF2 (Web Crypto API)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}