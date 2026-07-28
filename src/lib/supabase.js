import { createClient } from '@supabase/supabase-js'

const directSupabaseUrl = 'https://mqxqvyckzdqnnhkozfxk.supabase.co'
const supabaseUrl = import.meta.env.PROD ? `${window.location.origin}/supabase` : directSupabaseUrl
const supabasePublishableKey = 'sb_publishable_jO_2ivbmep_syPjRobOazw_CXiOvYru'

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
