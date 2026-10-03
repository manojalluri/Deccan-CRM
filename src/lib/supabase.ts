import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const isConfigured = supabaseUrl &&
  supabaseUrl !== 'your_supabase_project_url' &&
  supabaseUrl.startsWith('http')

if (!isConfigured) {
  console.warn(
    '⚠️ Supabase is not configured. Please update your .env file with your Supabase project URL and anon key.\n' +
    'Copy .env.example to .env and fill in your credentials from: https://supabase.com/dashboard'
  )
}

// Use placeholder values if not configured to prevent startup crash
const url = isConfigured ? supabaseUrl : 'https://placeholder.supabase.co'
const key = isConfigured ? supabaseAnonKey : 'placeholder-key'

export const supabase = createClient<any>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export const isSupabaseConfigured = isConfigured

export default supabase
