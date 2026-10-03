import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile, StaffRole } from '@/types/database'
import { staffService } from '@/services/staffService'

const AUTH_STORAGE_KEY = 'samravaa_active_auth'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role?: StaffRole }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize with cached auth if available to prevent RBAC flickering
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.user || null
      }
    } catch {
      // Fallback
    }
    return null
  })

  const [session, setSession] = useState<Session | null>(null)
  
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.profile || null
      }
    } catch {
      // Fallback
    }
    return null
  })

  const [loading, setLoading] = useState(true)

  const persistAuth = (u: User | null, p: Profile | null) => {
    try {
      if (u && p) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: u, profile: p }))
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    } catch (e) {
      console.warn('Failed to persist auth:', e)
    }
  }

  const fetchProfile = async (userId: string, fallbackRole: StaffRole = 'admin'): Promise<Profile> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        const defaultProf: Profile = {
          id: userId,
          restaurant_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          name: 'Head Chef & Admin',
          email: user?.email || 'chef@restaurant.com',
          role: fallbackRole,
          created_at: new Date().toISOString()
        }
        setProfile(defaultProf)
        if (user) persistAuth(user, defaultProf)
        return defaultProf
      }
      setProfile(data)
      if (user) persistAuth(user, data)
      return data
    } catch (err) {
      console.error('Error fetching profile:', err)
      const defaultProf: Profile = {
        id: userId,
        restaurant_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        name: 'Head Chef & Admin',
        email: user?.email || 'chef@restaurant.com',
        role: fallbackRole,
        created_at: new Date().toISOString()
      }
      setProfile(defaultProf)
      if (user) persistAuth(user, defaultProf)
      return defaultProf
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, profile?.role || 'admin')
  }

  useEffect(() => {
    // Check if we already have a valid stored local staff session
    const saved = localStorage.getItem(AUTH_STORAGE_KEY)
    let hasValidLocal = false
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.user && parsed.profile) {
          setUser(parsed.user)
          setProfile(parsed.profile)
          hasValidLocal = true
        }
      } catch {
        // Fallback
      }
    }

    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        if (!hasValidLocal) {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else if (!hasValidLocal) {
          setUser(null)
          setProfile(null)
          persistAuth(null, null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error: Error | null; role?: StaffRole }> => {
    // 1. Direct staff credential verification (Works for all roles: admin, manager, staff, kitchen)
    const verifiedStaff = staffService.verifyStaffCredentials(email, password)
    if (verifiedStaff) {
      const staffUser = {
        id: verifiedStaff.id,
        app_metadata: {},
        user_metadata: { name: verifiedStaff.name, role: verifiedStaff.role },
        aud: 'authenticated',
        created_at: verifiedStaff.created_at || new Date().toISOString(),
        email: verifiedStaff.email,
        phone: '',
      } as User

      const staffProfile: Profile = {
        id: verifiedStaff.id,
        restaurant_id: verifiedStaff.restaurant_id || 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        name: verifiedStaff.name,
        email: verifiedStaff.email,
        role: verifiedStaff.role,
        created_at: verifiedStaff.created_at || new Date().toISOString()
      }

      setUser(staffUser)
      setProfile(staffProfile)
      persistAuth(staffUser, staffProfile)
      return { error: null, role: verifiedStaff.role }
    }

    if (!isSupabaseConfigured) {
      // Demo mode bypass
      const mockUserId = '19beda63-7a37-4c97-81b8-9109aa885f4c'
      const mockUser = { id: mockUserId, email } as User
      const mockProfile: Profile = {
        id: mockUserId,
        restaurant_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        name: 'Head Chef & Admin',
        email: email,
        role: 'admin',
        created_at: new Date().toISOString()
      }
      setUser(mockUser)
      setProfile(mockProfile)
      persistAuth(mockUser, mockProfile)
      return { error: null, role: 'admin' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Fallback for demo credentials
      if (email === 'chef@restaurant.com' && password === 'password123') {
        const mockUserId = '19beda63-7a37-4c97-81b8-9109aa885f4c'
        const mockUser = { id: mockUserId, email } as User
        const mockProfile: Profile = {
          id: mockUserId,
          restaurant_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          name: 'Head Chef & Admin',
          email: email,
          role: 'admin',
          created_at: new Date().toISOString()
        }
        setUser(mockUser)
        setProfile(mockProfile)
        persistAuth(mockUser, mockProfile)
        return { error: null, role: 'admin' }
      }
      return { error: error as Error | null }
    }

    if (data?.user) {
      const p = await fetchProfile(data.user.id)
      return { error: null, role: p?.role || 'admin' }
    }
    return { error: null, role: 'admin' }
  }

  const signOut = async () => {
    persistAuth(null, null)
    setUser(null)
    setProfile(null)
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut()
      } catch {
        // Fallback
      }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signIn,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
