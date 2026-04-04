import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — สร้างครั้งเดียวเพื่อไม่ให้ Realtime channel ถูก unsubscribe
let _supabase: ReturnType<typeof createBrowserClient> | null = null

function getClient() {
  if (!_supabase) {
    _supabase = createBrowserClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  }
  return _supabase
}

export const supabase = getClient()
