import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://polnkpzxtrfuqqjohepb.supabase.co'
const supabasePublishableKey = 'sb_publishable_420UzA8OtUjvdrk63EXz_g_InqoHure'

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
