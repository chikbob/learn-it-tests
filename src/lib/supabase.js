import { createClient } from '@supabase/supabase-js'

const directSupabaseUrl = 'https://polnkpzxtrfuqqjohepb.supabase.co'
const supabaseUrl = import.meta.env.PROD ? `${window.location.origin}/supabase` : directSupabaseUrl
const supabasePublishableKey = 'sb_publishable_420UzA8OtUjvdrk63EXz_g_InqoHure'

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
