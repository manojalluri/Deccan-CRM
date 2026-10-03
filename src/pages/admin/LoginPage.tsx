import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ChefHat, Mail, Lock, KeyRound, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { staffService } from '@/services/staffService'
import { getDefaultRouteForRole } from '@/lib/permissions'
import toast from 'react-hot-toast'

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotStep, setForgotStep] = useState<'email' | 'new_password'>('email')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    setError('')
    setLoading(true)

    const { error, role } = await signIn(email, password)
    setLoading(false)

    if (error) {
      setError('Invalid email or password. Please try again.')
      toast.error('Sign in failed')
    } else {
      toast.success('Welcome back!')
      const targetRoute = getDefaultRouteForRole(role)
      navigate(targetRoute)
    }
  }

  const handleOpenForgot = () => {
    setForgotEmail(email || '')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotStep('email')
    setForgotOpen(true)
  }

  const handleVerifyForgotEmail = (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) {
      toast.error('Please enter your registered email address')
      return
    }
    const staff = staffService.findStaffByEmail(forgotEmail)
    // Check if it's the chef demo email or registered staff
    if (!staff && forgotEmail.toLowerCase() !== 'chef@restaurant.com') {
      toast.error('No staff account found with this email address.')
      return
    }
    setForgotStep('new_password')
  }

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotNewPassword) {
      toast.error('Please enter a new password')
      return
    }
    if (forgotNewPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setForgotLoading(true)
    const res = await staffService.resetPassword(forgotEmail, forgotNewPassword)
    setForgotLoading(false)

    if (!res.success) {
      toast.error(res.error || 'Failed to reset password')
      return
    }

    toast.success('Password updated successfully!')
    setEmail(forgotEmail)
    setPassword(forgotNewPassword)
    setForgotOpen(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] relative overflow-hidden p-6">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-[var(--color-accent)]/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-[var(--color-accent)]/5 blur-3xl" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[480px] bg-white border border-[var(--color-border-subtle)] rounded-3xl shadow-2xl shadow-black/5 relative z-10"
        style={{ padding: '48px 40px' }}
      >
        {/* Header with Logo */}
        <div className="flex flex-col items-center justify-center mb-10">
          <div className="w-16 h-16 bg-[var(--color-accent)] rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20 mb-6">
            <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="font-sans font-bold tracking-tight text-3xl text-gray-900">
            Deccan CRM
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 ml-1">Email address</label>
            <Input
              type="email"
              placeholder="chef@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={18} className="text-gray-400" />}
              autoComplete="email"
              id="login-email"
              className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all text-base rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 ml-1">Password</label>
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={18} className="text-gray-400" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-700 transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
              autoComplete="current-password"
              id="login-password"
              className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all text-base rounded-xl"
            />
            <div className="flex justify-end mt-2 pt-1">
              <button
                type="button"
                onClick={handleOpenForgot}
                className="text-sm font-bold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-semibold flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {error}
            </motion.div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full mt-4 h-12 text-base font-bold rounded-xl shadow-md"
            size="lg"
            id="login-submit"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          {/* Quick Demo Role Switcher */}
          <div className="mt-4 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Test Role Logins (1-Click)</span>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
              <button
                type="button"
                onClick={() => {
                  setEmail('chef@restaurant.com')
                  setPassword('password123')
                  toast.success('Admin credentials selected!')
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  email === 'chef@restaurant.com'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-amber-100/50 border-amber-200'
                }`}
              >
                <span>🛡️</span>
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('jane@restaurant.com')
                  setPassword('manager123')
                  toast.success('Manager credentials selected!')
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  email === 'jane@restaurant.com'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border-amber-200'
                }`}
              >
                <span>👔</span>
                <span>Manager</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('sarah@restaurant.com')
                  setPassword('staff123')
                  toast.success('Staff / Waiter credentials selected!')
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  email === 'sarah@restaurant.com'
                    ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-teal-50 border-amber-200'
                }`}
              >
                <span>🛎️</span>
                <span>Staff</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('mike@restaurant.com')
                  setPassword('kitchen123')
                  toast.success('Kitchen Chef credentials selected!')
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  email === 'mike@restaurant.com'
                    ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-amber-50 border-amber-200'
                }`}
              >
                <span>👨‍🍳</span>
                <span>Kitchen</span>
              </button>
            </div>

            <div className="text-[11px] text-amber-950 font-mono space-y-0.5 bg-white/70 p-2 rounded-xl border border-amber-200/60">
              <div className="truncate">Email: <span className="font-semibold select-all">{email || 'chef@restaurant.com'}</span></div>
              <div className="truncate">Password: <span className="font-semibold select-all">{password || 'password123'}</span></div>
            </div>
          </div>
        </form>

        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs font-medium text-gray-500">
            Restaurant POS & Management System • Deccan CRM
          </p>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Password"
        description="Enter your registered staff email to set a new password."
        size="sm"
      >
        <div className="space-y-4 -mt-2">
          {forgotStep === 'email' ? (
            <form onSubmit={handleVerifyForgotEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Staff Email Address</label>
                <Input
                  type="email"
                  placeholder="e.g. staff@restaurant.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  leftIcon={<Mail size={16} className="text-gray-400" />}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Continue
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Account verified for <strong>{forgotEmail}</strong></span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">New Password</label>
                <Input
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  leftIcon={<Lock size={16} className="text-gray-400" />}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Confirm New Password</label>
                <Input
                  type="password"
                  placeholder="Re-enter new password"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  leftIcon={<KeyRound size={16} className="text-gray-400" />}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setForgotStep('email')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  loading={forgotLoading}
                  className="flex-1"
                >
                  Save New Password
                </Button>
              </div>
            </form>
          )}
        </div>
      </Dialog>
    </div>
  )
}
