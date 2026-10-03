import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { StaffRole } from '@/types/database'
import { getDefaultRouteForRole } from '@/lib/permissions'
import toast from 'react-hot-toast'
import { useEffect, useRef } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: StaffRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const hasAlertedRef = useRef(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)] text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  // Wait for profile to load if role verification is required
  if (allowedRoles && allowedRoles.length > 0 && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)] text-sm">Verifying permissions...</p>
        </div>
      </div>
    )
  }

  // If specific roles are required, verify user's role
  if (allowedRoles && allowedRoles.length > 0 && profile?.role) {
    const isAllowed = allowedRoles.includes(profile.role)
    if (!isAllowed) {
      if (!hasAlertedRef.current) {
        hasAlertedRef.current = true
        toast.error(`Access Restricted: Your role (${profile.role}) does not have access to this section.`, {
          id: 'rbac-denied',
          duration: 4000,
        })
      }
      const targetRoute = getDefaultRouteForRole(profile.role)
      return <Navigate to={targetRoute} replace />
    }
  }

  return <>{children}</>
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user) {
    const targetRoute = getDefaultRouteForRole(profile?.role)
    return <Navigate to={targetRoute} replace />
  }

  return <>{children}</>
}
