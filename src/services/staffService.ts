import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { StaffRole, Profile } from '@/types/database'

export interface StaffMember {
  id: string
  restaurant_id?: string
  name: string
  email: string
  password?: string
  role: StaffRole
  status: 'active' | 'inactive'
  lastActive: string
  created_at?: string
}

const STORAGE_KEY = 'samravaa_staff_members'

const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'Head Chef & Admin',
    email: 'chef@restaurant.com',
    password: 'password123',
    role: 'admin',
    status: 'active',
    lastActive: 'Active now',
    created_at: new Date().toISOString(),
  },
  {
    id: 'staff-2',
    name: 'Jane Smith',
    email: 'jane@restaurant.com',
    password: 'manager123',
    role: 'manager',
    status: 'active',
    lastActive: '2 hours ago',
    created_at: new Date().toISOString(),
  },
  {
    id: 'staff-3',
    name: 'Mike Kitchen',
    email: 'mike@restaurant.com',
    password: 'kitchen123',
    role: 'kitchen',
    status: 'active',
    lastActive: '5 hours ago',
    created_at: new Date().toISOString(),
  },
  {
    id: 'staff-4',
    name: 'Sarah Server',
    email: 'sarah@restaurant.com',
    password: 'staff123',
    role: 'staff',
    status: 'active',
    lastActive: '1 day ago',
    created_at: new Date().toISOString(),
  },
]

function getStoredStaff(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STAFF))
      return INITIAL_STAFF
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_STAFF
  } catch {
    return INITIAL_STAFF
  }
}

function saveStoredStaff(staff: StaffMember[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staff))
  } catch (err) {
    console.error('Failed to save staff to localStorage:', err)
  }
}

export const staffService = {
  /**
   * Retrieves all staff members (optionally filtered by restaurant)
   */
  async getStaff(restaurantId?: string): Promise<StaffMember[]> {
    const localList = getStoredStaff()

    if (isSupabaseConfigured && restaurantId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('restaurant_id', restaurantId)

        if (!error && data && data.length > 0) {
          // Merge Supabase profiles with local credential metadata
          const merged: StaffMember[] = data.map((p: Profile) => {
            const match = localList.find(s => s.id === p.id || s.email.toLowerCase() === p.email.toLowerCase())
            return {
              id: p.id,
              restaurant_id: p.restaurant_id || restaurantId,
              name: p.name,
              email: p.email,
              password: match?.password || 'staff123',
              role: p.role,
              status: match?.status || 'active',
              lastActive: match?.lastActive || 'Recently',
              created_at: p.created_at,
            }
          })

          // Also keep any local-only staff added
          for (const l of localList) {
            if (!merged.some(m => m.email.toLowerCase() === l.email.toLowerCase())) {
              merged.push(l)
            }
          }
          saveStoredStaff(merged)
          return merged
        }
      } catch (err) {
        console.warn('Error fetching staff profiles from Supabase, using local store:', err)
      }
    }

    return localList
  },

  /**
   * Directly creates a staff member with explicit credentials (Email & Password).
   * No invitation required.
   */
  async createStaff(params: {
    name: string
    email: string
    password?: string
    role: StaffRole
    restaurant_id?: string
  }): Promise<{ staff: StaffMember | null; error: string | null }> {
    const staffList = getStoredStaff()
    const cleanEmail = params.email.trim().toLowerCase()

    if (staffList.some(s => s.email.toLowerCase() === cleanEmail)) {
      return { staff: null, error: `A staff member with email "${cleanEmail}" already exists.` }
    }

    const newStaff: StaffMember = {
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      restaurant_id: params.restaurant_id || 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: params.name.trim(),
      email: cleanEmail,
      password: params.password || 'Staff@123',
      role: params.role,
      status: 'active',
      lastActive: 'Never logged in',
      created_at: new Date().toISOString(),
    }

    // Save locally
    const updated = [newStaff, ...staffList]
    saveStoredStaff(updated)

    // Sync to Supabase profiles table if configured
    if (isSupabaseConfigured) {
      try {
        await supabase.from('profiles').insert({
          id: newStaff.id,
          restaurant_id: newStaff.restaurant_id,
          name: newStaff.name,
          email: newStaff.email,
          role: newStaff.role,
          created_at: newStaff.created_at,
        })
      } catch (err) {
        console.warn('Could not insert profile in Supabase:', err)
      }
    }

    return { staff: newStaff, error: null }
  },

  /**
   * Updates an existing staff member's details or credentials
   */
  async updateStaff(
    id: string,
    updates: Partial<Pick<StaffMember, 'name' | 'role' | 'status' | 'password'>>
  ): Promise<{ staff: StaffMember | null; error: string | null }> {
    const staffList = getStoredStaff()
    const idx = staffList.findIndex(s => s.id === id)
    if (idx === -1) {
      return { staff: null, error: 'Staff member not found.' }
    }

    staffList[idx] = {
      ...staffList[idx],
      ...updates,
    }

    saveStoredStaff(staffList)

    if (isSupabaseConfigured && (updates.name || updates.role)) {
      try {
        await supabase
          .from('profiles')
          .update({
            ...(updates.name ? { name: updates.name } : {}),
            ...(updates.role ? { role: updates.role } : {}),
          })
          .eq('id', id)
      } catch (err) {
        console.warn('Could not update profile in Supabase:', err)
      }
    }

    return { staff: staffList[idx], error: null }
  },

  /**
   * Deletes a staff member
   */
  async deleteStaff(id: string): Promise<{ success: boolean; error: string | null }> {
    const staffList = getStoredStaff()
    const member = staffList.find(s => s.id === id)
    if (!member) {
      return { success: false, error: 'Staff member not found' }
    }
    if (member.role === 'owner') {
      return { success: false, error: 'Cannot delete the restaurant owner.' }
    }

    const filtered = staffList.filter(s => s.id !== id)
    saveStoredStaff(filtered)

    if (isSupabaseConfigured) {
      try {
        await supabase.from('profiles').delete().eq('id', id)
      } catch (err) {
        console.warn('Could not delete profile in Supabase:', err)
      }
    }

    return { success: true, error: null }
  },

  /**
   * Verifies credentials for staff login
   */
  verifyStaffCredentials(email: string, password: string): StaffMember | null {
    const cleanEmail = email.trim().toLowerCase()
    const staffList = getStoredStaff()
    const found = staffList.find(
      s => s.email.toLowerCase() === cleanEmail && s.password === password && s.status === 'active'
    )
    if (found) {
      // Update last active
      found.lastActive = 'Just now'
      saveStoredStaff(staffList)
      return found
    }
    return null
  },

  /**
   * Finds a staff member by email (for password reset)
   */
  findStaffByEmail(email: string): StaffMember | null {
    const cleanEmail = email.trim().toLowerCase()
    const staffList = getStoredStaff()
    return staffList.find(s => s.email.toLowerCase() === cleanEmail) || null
  },

  /**
   * Resets password for staff via forgot password flow
   */
  async resetPassword(email: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
    const cleanEmail = email.trim().toLowerCase()
    const staffList = getStoredStaff()
    const idx = staffList.findIndex(s => s.email.toLowerCase() === cleanEmail)

    if (idx === -1) {
      return { success: false, error: 'No account registered with this email address.' }
    }

    staffList[idx].password = newPassword
    saveStoredStaff(staffList)

    // If supabase auth configured, also trigger password reset email if needed
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.resetPasswordForEmail(cleanEmail)
      } catch {
        // Fallback silently handled
      }
    }

    return { success: true, error: null }
  },
}
