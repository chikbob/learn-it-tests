import { createClient } from '@supabase/supabase-js'

const directSupabaseUrl = 'https://mqxqvyckzdqnnhkozfxk.supabase.co'
const supabaseUrl = import.meta.env.PROD ? `${window.location.origin}/supabase` : directSupabaseUrl
const supabasePublishableKey = 'sb_publishable_jO_2ivbmep_syPjRobOazw_CXiOvYru'

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  const abort = () => controller.abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abort)
  }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: fetchWithTimeout },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
