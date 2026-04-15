import { useState, useEffect } from 'react'
import { Lock, AlertCircle, Eye, EyeOff, Shield, LogOut, Copy, Check } from 'lucide-react'

/**
 * AuthPanel Component with 2FA Support
 */
export default function AuthPanel({ onLogin, onLogout, user, error: externalError, onClearError, needsTOTP, qrCodeURL, totpSecret, onTOTPSetup, onTOTPVerification, pendingUser }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState('officer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [copied, setCopied] = useState(false)

  // Check if user was rejected and should see register form
  useEffect(() => {
    const showRegister = localStorage.getItem('vigibyte_show_register');
    if (showRegister === 'true') {
      setIsLogin(false);
      localStorage.removeItem('vigibyte_show_register');
    }
  }, [])

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const validatePassword = (password) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    return re.test(password)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        throw new Error('Email and password required')
      }

      if (!validateEmail(email)) {
        throw new Error('Invalid email format')
      }

      if (isLogin) {
        if (password.length < 8) {
          throw new Error('Invalid credentials')
        }
        onLogin({ email, password })
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }
        if (!validatePassword(password)) {
          throw new Error('Password must be 8+ chars with uppercase, lowercase, number, special char')
        }
        onLogin({ email, password, isRegister: true, role: selectedRole })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTOTPSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!totpCode || totpCode.length !== 6 || isNaN(totpCode)) {
        throw new Error('Please enter valid 6-digit code')
      }

      if (needsTOTP === true) {
        // Setup mode - verifying the code works
        onTOTPSetup(totpCode)
      } else {
        // Verification mode - logging in
        onTOTPVerification(totpCode)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrCodeURL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- 2FA SETUP VIEW ---
  if (needsTOTP === true && qrCodeURL && pendingUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40 p-4 overflow-hidden">
        <div className="bg-[#0c101f] rounded-3xl border border-white/10 p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in max-h-[90vh] overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="text-yellow-500" size={28} />
            <h1 className="text-xl sm:text-2xl font-bold text-white">Setup 2FA Security</h1>
          </div>

          <div className="space-y-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-sm text-yellow-100">
                📱 Scan this QR code with Google Authenticator, Authy, or Microsoft Authenticator
              </p>
            </div>

            {/* QR Code Display */}
            <div className="flex justify-center bg-white p-4 rounded-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeURL)}`}
                alt="2FA QR Code"
                className="w-48 h-48"
              />
            </div>

            {/* Manual Setup Key for Mobile Users */}
            {totpSecret && (
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-2">📋 Can't scan? Enter this key manually:</p>
                <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-lg">
                  <code className="text-sm font-mono text-yellow-300 break-all flex-1">{totpSecret}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSecret)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="flex-shrink-0 p-2 hover:bg-slate-700 rounded transition-colors"
                  >
                    {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-blue-400" />}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleTOTPSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
                  Enter 6-Digit Code from App
                </label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength="6"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all text-center text-2xl tracking-widest"
                  disabled={loading}
                  inputMode="numeric"
                />
              </div>

              {(error || externalError) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error || externalError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-3 rounded-xl font-bold uppercase text-sm transition-all"
              >
                {loading ? 'Verifying...' : 'Verify & Complete Setup'}
              </button>
            </form>

            <p className="text-xs text-slate-400 text-center">
              ✅ After verification, you'll be logged in to your account
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- 2FA VERIFICATION VIEW (Login) ---
  if (needsTOTP === false && pendingUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40 p-4 overflow-hidden">
        <div className="bg-[#0c101f] rounded-3xl border border-white/10 p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in max-h-[90vh] overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="text-green-500" size={28} />
            <h1 className="text-xl sm:text-2xl font-bold text-white">2FA Verification</h1>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <p className="text-sm text-blue-100">
                🔐 Enter the 6-digit code from your authenticator app to complete login
              </p>
            </div>

            <form onSubmit={handleTOTPSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
                  Authentication Code
                </label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength="6"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all text-center text-2xl tracking-widest"
                  disabled={loading}
                  inputMode="numeric"
                  autoFocus
                />
              </div>

              {(error || externalError) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error || externalError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white py-3 rounded-xl font-bold uppercase text-sm transition-all"
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // --- LOGGED-IN VIEW ---
  if (user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40 p-4">
        <div className="bg-[#0c101f] rounded-3xl border border-white/10 p-6 sm:p-8 max-w-md w-full shadow-2xl">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/40 p-4 overflow-hidden">
      <div className="bg-[#0c101f] rounded-3xl border border-white/10 p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center gap-3 mb-8">
          <Lock className="text-blue-500" size={28} />
          <h1 className="text-2xl font-bold text-white">VigiByte</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              disabled={loading}
            />
          </div>

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

          {(error || externalError) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error || externalError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-3 rounded-xl font-bold uppercase text-sm transition-all"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>

          <p className="text-center text-xs text-slate-400">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setPassword('')
                setConfirmPassword('')
                onClearError?.()
              }}
              className="text-blue-400 hover:text-blue-300 font-bold"
              disabled={loading}
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">🔒 Security Features</p>
          <ul className="space-y-1.5 text-[10px] text-slate-400">
            <li>✅ Organization-based data sharing (@domain)</li>
            <li>✅ Admin 2FA (Google Authenticator)</li>
            <li>✅ Role-based access control (RBAC)</li>
            <li>✅ Activity logging & audit trail</li>
            <li>✅ Password hashing with PBKDF2</li>
          </ul>
        </div>
      </div>
    </div>
  )
}